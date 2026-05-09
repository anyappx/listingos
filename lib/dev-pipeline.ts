/**
 * Local dev video pipeline — no fal.ai, no R2, no Redis.
 * Uses FFmpeg Ken Burns on listing photos and saves to /public/videos/.
 * Only runs when FAL_KEY is a placeholder (local testing).
 */

import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { createKenBurnsClip, cropTo9x16, extractThumbnail } from "@/lib/ffmpeg";
import { generateAllContent } from "@/lib/claude";
import { createAdminClient } from "@/lib/supabase/server";

export function isDevMode(): boolean {
  const falKey = process.env.FAL_KEY || "";
  const r2Key = process.env.R2_ACCESS_KEY_ID || "";
  return falKey.startsWith("placeholder") || r2Key.startsWith("placeholder");
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https") ? https : http;
    client.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function updateProgress(jobId: string, step: string, percent: number) {
  const admin = createAdminClient();
  await admin.from("video_jobs").update({
    status: "processing",
    progress_step: step,
    progress_percent: percent,
  }).eq("id", jobId);
}

export async function runLocalPipeline(payload: {
  jobId: string;
  listingId: string;
  userId: string;
  durationSeconds: number;
  style: string;
}) {
  const { jobId, listingId, userId, durationSeconds } = payload;
  const admin = createAdminClient();
  const tmpDir = path.join(process.cwd(), "tmp", jobId);

  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    // 1. Fetch listing
    await updateProgress(jobId, "Importing your listing photos", 10);
    const { data: listing } = await admin.from("listings").select("*").eq("id", listingId).single();
    if (!listing) throw new Error("Listing not found");

    const photos: { url: string }[] = (listing.photos || []).slice(0, 6);
    if (photos.length === 0) throw new Error("No photos found");

    // 2. Download photos
    await updateProgress(jobId, "Rendering cinematic motion", 25);
    const clipPaths: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const photoPath = path.join(tmpDir, `photo-${i}.jpg`);
      const clipPath = path.join(tmpDir, `clip-${i}.mp4`);

      try {
        await downloadFile(photos[i].url, photoPath);
        await createKenBurnsClip(photoPath, clipPath, 4);
        clipPaths.push(clipPath);
      } catch (e) {
        console.error(`[dev-pipeline] clip ${i} failed:`, e instanceof Error ? e.message : e);
      }

      const pct = 25 + Math.floor((i / photos.length) * 40);
      await updateProgress(jobId, "Rendering cinematic motion", pct);
    }

    if (clipPaths.length === 0) throw new Error("All photo clips failed");

    // 3. Concatenate clips into 16:9
    await updateProgress(jobId, "Assembling your video", 70);
    const fileListPath = path.join(tmpDir, "clips.txt");
    const fileListContent = clipPaths.map((p) => `file '${p}'`).join("\n");
    fs.writeFileSync(fileListPath, fileListContent);

    const output16x9 = path.join(tmpDir, "16x9.mp4");
    await concatClips(fileListPath, output16x9, durationSeconds);

    // 4. Crop to 9:16
    await updateProgress(jobId, "Creating your 9:16 version", 88);
    const output9x16 = path.join(tmpDir, "9x16.mp4");
    await cropTo9x16(output16x9, output9x16);

    // 5. Extract thumbnail
    const thumbPath = path.join(tmpDir, "thumb.jpg");
    await extractThumbnail(output16x9, thumbPath).catch(() => {});

    // 6. Copy to /public/videos/
    await updateProgress(jobId, "Uploading final video", 93);
    const publicDir = path.join(process.cwd(), "public", "videos", jobId);
    fs.mkdirSync(publicDir, { recursive: true });

    const pub16x9 = path.join(publicDir, "16x9.mp4");
    const pub9x16 = path.join(publicDir, "9x16.mp4");
    const pubThumb = path.join(publicDir, "thumb.jpg");

    fs.copyFileSync(output16x9, pub16x9);
    fs.copyFileSync(output9x16, pub9x16);
    if (fs.existsSync(thumbPath)) fs.copyFileSync(thumbPath, pubThumb);

    // Public URLs (served by Next.js static file serving)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const url16x9 = `${appUrl}/videos/${jobId}/16x9.mp4`;
    const url9x16 = `${appUrl}/videos/${jobId}/9x16.mp4`;
    const thumbnailUrl = fs.existsSync(thumbPath)
      ? `${appUrl}/videos/${jobId}/thumb.jpg`
      : "";

    // 7. Generate content (mock or real)
    const { descriptions, captions } = await generateAllContent({
      address: listing.address || "",
      city: listing.city || "",
      price: listing.price,
      beds: listing.beds,
      baths: listing.baths,
      sqft: listing.sqft,
      rawDescription: listing.raw_description || undefined,
      style: payload.style as "modern" | "luxury" | "energetic" | "minimal",
    });

    // 8. Save video row
    const { data: videoRow } = await admin.from("videos").insert({
      job_id: jobId,
      listing_id: listingId,
      user_id: userId,
      url_16x9: url16x9,
      url_9x16: url9x16,
      thumbnail_url: thumbnailUrl,
      duration_seconds: durationSeconds,
      is_watermarked: true,
    }).select().single();

    // 9. Save descriptions to listing
    await admin.from("listings").update({
      description_mls: descriptions.mls,
      description_social: descriptions.social,
      description_luxury: descriptions.luxury,
      caption_instagram: captions.instagram,
      caption_tiktok: captions.tiktok,
      caption_facebook: captions.facebook,
      fair_housing_passed: true,
    }).eq("id", listingId);

    // 10. Mark complete
    await admin.from("video_jobs").update({
      status: "complete",
      progress_step: "Done!",
      progress_percent: 100,
    }).eq("id", jobId);

    void videoRow;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pipeline failed";
    await admin.from("video_jobs").update({
      status: "failed",
      error_message: message,
    }).eq("id", jobId);

    // Refund credit
    const { data: user } = await admin.from("users").select("listings_used_this_month").eq("id", userId).single();
    if (user && user.listings_used_this_month > 0) {
      await admin.from("users").update({
        listings_used_this_month: user.listings_used_this_month - 1,
      }).eq("id", userId);
    }
  } finally {
    // Cleanup tmp
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// FFmpeg concat + trim to target duration
async function concatClips(fileListPath: string, outputPath: string, targetSeconds: number): Promise<void> {
  const ffmpegLib = (await import("fluent-ffmpeg")).default;
  const ffmpegStatic = (await import("ffmpeg-static")).default;
  if (ffmpegStatic) ffmpegLib.setFfmpegPath(ffmpegStatic);
  return new Promise((resolve, reject) => {
    ffmpegLib()
      .input(fileListPath)
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        "-an",
        "-movflags +faststart",
        `-t ${targetSeconds}`,
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}
