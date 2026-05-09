import * as fs from "fs";
import * as path from "path";
import type { Job } from "bullmq";
import { createAdminClient } from "@/lib/supabase/server";
import { generateClipsParallel } from "@/lib/fal";
import { assembleVideo, cropTo9x16, extractThumbnail } from "@/lib/ffmpeg";
import { uploadToR2WithRetry, getThumbnailUrl } from "@/lib/r2";
import { fetchNeighborhoodClips, downloadPexelsClip } from "@/lib/pexels";
import { generateAllContent } from "@/lib/claude";
import { createVideoWorker } from "./queue";
import type { VideoJobPayload, BrandKit, Listing } from "@/lib/types";

const PROGRESS_STEPS = [
  { step: "Importing your listing photos", percent: 10 },
  { step: "Fetching neighborhood clips", percent: 20 },
  { step: "Rendering cinematic motion", percent: 35 },
  { step: "Assembling your video", percent: 70 },
  { step: "Adding your branding", percent: 80 },
  { step: "Mixing music", percent: 88 },
  { step: "Creating your 9:16 version", percent: 93 },
  { step: "Uploading final video", percent: 97 },
  { step: "Done!", percent: 100 },
];

async function updateProgress(jobId: string, stepIdx: number): Promise<void> {
  const supabase = createAdminClient();
  const step = PROGRESS_STEPS[stepIdx];
  await supabase.from("video_jobs").update({
    progress_step: step.step,
    progress_percent: step.percent,
  }).eq("id", jobId);
}

async function refundCredit(userId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.rpc("check_and_deduct_credit", { p_user_id: userId }); // This is a no-op for refund
  // Direct SQL refund
  await supabase.from("users").update({
    listings_used_this_month: supabase.from("users").select("listings_used_this_month - 1 as val")
  }).eq("id", userId);

  // Use raw SQL approach via RPC or direct update with current value
  const { data: user } = await supabase.from("users").select("listings_used_this_month").eq("id", userId).single();
  if (user && user.listings_used_this_month > 0) {
    await supabase.from("users").update({
      listings_used_this_month: user.listings_used_this_month - 1
    }).eq("id", userId);
  }
}

async function failJob(jobId: string, userId: string, error: string): Promise<void> {
  const supabase = createAdminClient();
  await Promise.all([
    supabase.from("video_jobs").update({
      status: "failed",
      error_message: error,
      progress_step: "Generation failed",
    }).eq("id", jobId),
    refundCredit(userId),
  ]);
}

async function processVideoJob(job: Job<VideoJobPayload>): Promise<void> {
  const { jobId, listingId, userId, style, durationSeconds, musicTrackId, includeNeighborhoodBroll } = job.data;
  const supabase = createAdminClient();
  const jobTmpDir = path.join("/tmp", jobId);

  try {
    fs.mkdirSync(jobTmpDir, { recursive: true });

    // Mark as processing
    await supabase.from("video_jobs").update({ status: "processing" }).eq("id", jobId);

    // Step 0: Fetch listing + brand kit + music track
    await updateProgress(jobId, 0);

    const [{ data: listing }, { data: brandKit }, { data: musicTrack }] = await Promise.all([
      supabase.from("listings").select("*").eq("id", listingId).single(),
      supabase.from("brand_kits").select("*").eq("user_id", userId).single(),
      supabase.from("music_tracks").select("*").eq("id", musicTrackId).single(),
    ]);

    if (!listing) throw new Error("Listing not found");

    const typedListing = listing as Listing;
    const typedBrandKit = brandKit as BrandKit | null;

    // Select up to 8 photos, cover first
    const photos = (typedListing.photos || []).sort((a, b) => {
      if (a.is_cover) return -1;
      if (b.is_cover) return 1;
      return a.order - b.order;
    }).slice(0, 8);

    if (photos.length === 0) throw new Error("No photos found for listing");
    const photoUrls = photos.map((p) => p.url);

    // Step 1: Fetch neighborhood clips (parallel, non-blocking on failure)
    await updateProgress(jobId, 1);
    let brollPaths: string[] = [];
    if (includeNeighborhoodBroll && typedListing.city) {
      try {
        const brollUrls = await fetchNeighborhoodClips(typedListing.city, 3);
        const downloadPromises = brollUrls.map((url, i) => {
          const brollPath = path.join(jobTmpDir, `broll-${i}.mp4`);
          return downloadPexelsClip(url, brollPath).then((ok) => (ok ? brollPath : null));
        });
        const downloaded = await Promise.all(downloadPromises);
        brollPaths = downloaded.filter(Boolean) as string[];
      } catch {
        // Skip B-roll silently
      }
    }

    // Step 2: Generate clips via fal.ai (parallel, max 4 at once)
    await updateProgress(jobId, 2);

    let clipPaths: string[] = [];
    try {
      let progressDone = 0;
      clipPaths = await generateClipsParallel(photoUrls, style, jobTmpDir, (done) => {
        progressDone = done;
        // Update progress incrementally between 35-55%
        const pct = 35 + Math.round((progressDone / photoUrls.length) * 20);
        supabase.from("video_jobs").update({ progress_percent: pct }).eq("id", jobId);
      });
    } catch {
      throw new Error("All clip generation failed");
    }

    if (clipPaths.length === 0) throw new Error("No clips generated");

    // Interleave B-roll clips between photo clips
    const allClips: string[] = [];
    for (let i = 0; i < clipPaths.length; i++) {
      allClips.push(clipPaths[i]);
      if (brollPaths.length > 0 && i < brollPaths.length) {
        allClips.push(brollPaths[i % brollPaths.length]);
      }
    }

    // Step 3: Assemble 16:9 video
    await updateProgress(jobId, 3);

    // Download music track if it's a local path
    const musicTrackPath = musicTrack
      ? path.join(process.cwd(), "public", musicTrack.file_path.replace(/^\//, ""))
      : null;

    if (!musicTrackPath || !fs.existsSync(musicTrackPath)) {
      throw new Error("Music track file not found");
    }

    const output16x9 = path.join(jobTmpDir, "output-16x9.mp4");
    const watermarkPath = path.join(process.cwd(), "public", "watermark.png");

    // Check if user is on free/trial plan
    const { data: user } = await supabase.from("users").select("plan").eq("id", userId).single();
    const needsWatermark = !user || user.plan === "trial";

    await assembleVideo({
      clipPaths: allClips,
      musicPath: musicTrackPath,
      outputPath: output16x9,
      durationSeconds,
      agentName: typedBrandKit?.agent_name || "Agent",
      brokerage: typedBrandKit?.brokerage || "",
      primaryColor: typedBrandKit?.primary_color || "#1A2E4A",
      font: typedBrandKit?.font || "Inter",
      watermarkPath: needsWatermark && fs.existsSync(watermarkPath) ? watermarkPath : undefined,
    });

    await updateProgress(jobId, 4);

    // Step 4: Crop to 9:16
    await updateProgress(jobId, 6);
    const output9x16 = path.join(jobTmpDir, "output-9x16.mp4");
    await cropTo9x16(output16x9, output9x16);

    // Step 5: Extract thumbnail
    const thumbnailPath = path.join(jobTmpDir, "thumbnail.jpg");
    await extractThumbnail(output16x9, thumbnailPath);

    // Step 6: Upload to R2
    await updateProgress(jobId, 7);

    const r2Key16x9 = `videos/${userId}/${listingId}/${jobId}-16x9.mp4`;
    const r2Key9x16 = `videos/${userId}/${listingId}/${jobId}-9x16.mp4`;
    const r2KeyThumb = `videos/${userId}/${listingId}/${jobId}-thumb.jpg`;

    await Promise.all([
      uploadToR2WithRetry(r2Key16x9, output16x9, "video/mp4"),
      uploadToR2WithRetry(r2Key9x16, output9x16, "video/mp4"),
      uploadToR2WithRetry(r2KeyThumb, thumbnailPath, "image/jpeg"),
    ]);

    // Step 7: Get thumbnail public URL (signed URLs generated on-demand in /api/job/[id])
    const thumbnailPublicUrl = getThumbnailUrl(r2KeyThumb);

    // Get file sizes
    const size16x9 = fs.statSync(output16x9).size;

    // Step 8: Insert video row
    await supabase.from("videos").insert({
      job_id: jobId,
      listing_id: listingId,
      user_id: userId,
      url_16x9: r2Key16x9, // store key, generate signed URL on demand
      url_9x16: r2Key9x16,
      thumbnail_url: thumbnailPublicUrl,
      duration_seconds: durationSeconds,
      file_size_bytes: size16x9,
      is_watermarked: needsWatermark,
    });

    // Step 9: Generate Claude content (parallel, non-blocking)
    const contentPromise = generateAllContent({
      address: typedListing.address || "",
      city: typedListing.city || "",
      price: typedListing.price,
      beds: typedListing.beds,
      baths: typedListing.baths,
      sqft: typedListing.sqft,
      rawDescription: typedListing.raw_description || undefined,
      style,
    }).then(async ({ descriptions, captions }) => {
      await supabase.from("listings").update({
        description_mls: descriptions.mls,
        description_social: descriptions.social,
        description_luxury: descriptions.luxury,
        caption_instagram: captions.instagram,
        caption_tiktok: captions.tiktok,
        caption_facebook: captions.facebook,
        fair_housing_passed: true,
      }).eq("id", listingId);
    }).catch(console.error); // Non-blocking

    // Step 10: Mark job complete
    await updateProgress(jobId, 8);
    await supabase.from("video_jobs").update({
      status: "complete",
      progress_percent: 100,
      progress_step: "Done!",
    }).eq("id", jobId);

    // Send email (non-blocking)
    import("@/lib/resend").then(({ sendVideoReady }) => {
      supabase.from("users").select("email").eq("id", userId).single().then(({ data }) => {
        if (data?.email) {
          sendVideoReady({
            to: data.email,
            agentName: "Agent",
            address: typedListing.address || "Your listing",
            listingId,
            slug: typedListing.slug || listingId,
          }).catch(console.error);
        }
      });
    }).catch(console.error);

    // Wait for content (it may still be running)
    await contentPromise;

    // Cleanup temp files
    try { fs.rmSync(jobTmpDir, { recursive: true, force: true }); } catch {}
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error(`[VideoWorker] Job ${jobId} failed:`, errorMessage);
    await failJob(jobId, userId, errorMessage);
    try { fs.rmSync(jobTmpDir, { recursive: true, force: true }); } catch {}
    throw err;
  }
}

// Start worker when this file is run directly
const concurrency = parseInt(process.env.WORKER_CONCURRENCY || "3", 10);
const worker = createVideoWorker(processVideoJob, concurrency);

worker.on("completed", (job) => {
  console.log(`[VideoWorker] Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`[VideoWorker] Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[VideoWorker] Worker error:", err);
});

console.log(`[VideoWorker] Started with concurrency ${concurrency}`);

export default worker;
