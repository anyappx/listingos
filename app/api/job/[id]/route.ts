import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getSignedVideoUrl } from "@/lib/r2";
import { generateQRCode } from "@/lib/qr";
import { isDevMode } from "@/lib/dev-pipeline";
import type { JobStatusResponse } from "@/lib/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const adminSupabase = createAdminClient();

  const { data: job } = await adminSupabase
    .from("video_jobs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  if (job.status === "queued") {
    const response: JobStatusResponse = {
      status: "queued",
      progressStep: job.progress_step || "Waiting to start...",
      progressPercent: job.progress_percent || 0,
    };
    return NextResponse.json(response);
  }

  if (job.status === "processing") {
    const response: JobStatusResponse = {
      status: "processing",
      progressStep: job.progress_step || "Processing...",
      progressPercent: job.progress_percent || 0,
    };
    return NextResponse.json(response);
  }

  if (job.status === "failed") {
    const response: JobStatusResponse = {
      status: "failed",
      error: job.error_message || "Video generation failed. Credit refunded.",
    };
    return NextResponse.json(response);
  }

  if (job.status === "complete") {
    const [{ data: video }, { data: listing }] = await Promise.all([
      adminSupabase.from("videos").select("*").eq("job_id", id).single(),
      adminSupabase.from("listings").select("*").eq("id", job.listing_id).single(),
    ]);

    if (!video || !listing) {
      return NextResponse.json({ status: "processing", progressPercent: 99 });
    }

    // Dev mode: URLs are already absolute but may have stale port — rewrite to current origin
    // Production: sign R2 keys
    let url16x9 = "";
    let url9x16 = "";

    if (isDevMode()) {
      const origin = request.nextUrl.origin;
      const rewrite = (u: string) => {
        try { return u.replace(/^https?:\/\/[^/]+/, origin); } catch { return u; }
      };
      url16x9 = rewrite(video.url_16x9 || "");
      url9x16 = rewrite(video.url_9x16 || "");
    } else {
      [url16x9, url9x16] = await Promise.all([
        video.url_16x9 ? getSignedVideoUrl(video.url_16x9) : Promise.resolve(""),
        video.url_9x16 ? getSignedVideoUrl(video.url_9x16) : Promise.resolve(""),
      ]);
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/l/${listing.slug}`;
    const qrCodeUrl = await generateQRCode(shareUrl);

    const response: JobStatusResponse = {
      status: "complete",
      progressPercent: 100,
      video: {
        url16x9,
        url9x16,
        thumbnailUrl: video.thumbnail_url || "",
        durationSeconds: video.duration_seconds || 30,
      },
      listing: {
        descriptionMls: listing.description_mls || "",
        descriptionSocial: listing.description_social || "",
        descriptionLuxury: listing.description_luxury || "",
        captionInstagram: listing.caption_instagram || "",
        captionTiktok: listing.caption_tiktok || "",
        captionFacebook: listing.caption_facebook || "",
        shareUrl,
        qrCodeUrl,
      },
    };
    return NextResponse.json(response);
  }

  return NextResponse.json({ error: "Unknown job status" }, { status: 500 });
}
