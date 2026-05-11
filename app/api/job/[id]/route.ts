import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getSignedVideoUrl } from "@/lib/r2";
import { generateQRCode } from "@/lib/qr";
import { isDevMode } from "@/lib/utils";
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
    const resolveUrl = async (u: string | null | undefined): Promise<string> => {
      if (!u) return "";
      if (isDevMode()) {
        const origin = request.nextUrl.origin;
        try { return u.replace(/^https?:\/\/[^/]+/, origin); } catch { return u; }
      }
      return getSignedVideoUrl(u);
    };

    const [url16x9, url9x16, url1x1, url4x5, gifUrl] = await Promise.all([
      resolveUrl(video.url_16x9),
      resolveUrl(video.url_9x16),
      resolveUrl(video.url_1x1),
      resolveUrl(video.url_4x5),
      resolveUrl(video.gif_url),
    ]);

    const rawThumbs: string[] = Array.isArray(video.selector_thumbnails) ? video.selector_thumbnails : [];
    const selectorThumbnails = await Promise.all(rawThumbs.map((u: string) => resolveUrl(u)));

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
        ...(gifUrl ? { gifUrl } : {}),
        ...(selectorThumbnails.length ? { selectorThumbnails } : {}),
        ...(url1x1 ? { url1x1 } : {}),
        ...(url4x5 ? { url4x5 } : {}),
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
