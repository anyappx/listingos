import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getSignedVideoUrl } from "@/lib/r2";
import type { Video } from "@/lib/types";

// archiver is not installed — returns JSON with download URLs instead.
// Install `archiver` and `@types/archiver` for ZIP streaming support.

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // 1. AUTH
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. BUSINESS LOGIC
  try {
    const admin = createAdminClient();

    // Fetch listing (verify ownership)
    const { data: listing, error: listingErr } = await admin
      .from("listings")
      .select("id, slug")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (listingErr || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    // Fetch all videos for this listing owned by this user
    const { data: videos, error: videosErr } = await admin
      .from("videos")
      .select("*")
      .eq("listing_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (videosErr) {
      throw new Error(`DB: ${videosErr.message}`);
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json(
        { error: "No videos found for this listing" },
        { status: 404 }
      );
    }

    const origin = request.nextUrl.origin;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;

    // Resolve each video URL to a downloadable URL
    const downloadUrls: { label: string; url: string }[] = [];

    for (const video of videos as Video[]) {
      const urlFields: { label: string; raw: string | null }[] = [
        { label: "16x9", raw: video.url_16x9 },
        { label: "9x16", raw: video.url_9x16 },
      ];

      for (const { label, raw } of urlFields) {
        if (!raw) continue;

        let resolvedUrl: string;

        if (raw.startsWith("http://localhost") || raw.startsWith("/videos/")) {
          // Local filesystem fallback URL
          const publicPath = raw.replace(appUrl, "").replace(origin, "");
          resolvedUrl = `${appUrl}${publicPath.startsWith("/") ? publicPath : `/${publicPath}`}`;
        } else if (raw.startsWith("http://") || raw.startsWith("https://")) {
          // Already a full HTTP URL (e.g. R2 public URL)
          resolvedUrl = raw;
        } else {
          // Treat as R2 key — generate a signed URL
          try {
            resolvedUrl = await getSignedVideoUrl(raw, 3600);
          } catch {
            resolvedUrl = raw;
          }
        }

        const isWatermarked = video.is_watermarked;
        downloadUrls.push({
          label: `${label}${isWatermarked ? "_watermarked" : "_clean"}`,
          url: resolvedUrl,
        });
      }
    }

    // archiver is not installed — return JSON listing all download URLs.
    // Note: install `archiver` and `@types/archiver` for ZIP streaming support.
    return NextResponse.json(
      {
        note: "Install archiver for ZIP support. Download each URL individually.",
        slug: listing.slug,
        filename: `listing-${listing.slug}-videos.zip`,
        videos: downloadUrls,
      },
      {
        headers: {
          "Content-Disposition": `attachment; filename="listing-${listing.slug}-videos.zip"`,
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error(`[api/listings/${id}/download-all] ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
