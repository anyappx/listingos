import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { ScrapeInputSchema } from "@/lib/validations";
import { scrapeUrl, downloadAndStorePhotos, validateDomain, generateSlug } from "@/lib/scraper";

async function checkRateLimit(userId: string): Promise<boolean> {
  try {
    const url = process.env.UPSTASH_REDIS_URL;
    const token = process.env.UPSTASH_REDIS_TOKEN;
    if (!url || url.startsWith("placeholder") || !token) return true; // skip if not configured
    // Use Upstash REST API directly (no ioredis needed — avoids connection errors)
    const key = `scrape_rate:${userId}`;
    const incrRes = await fetch(`${url}/incr/${key}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!incrRes.ok) return true; // skip on error
    const { result: count } = await incrRes.json() as { result: number };
    if (count === 1) {
      await fetch(`${url}/expire/${key}/60`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    return count <= 5;
  } catch {
    return true; // don't block on rate limit errors
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Auth check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse + validate input
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = ScrapeInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid URL" },
        { status: 400 }
      );
    }

    const { url } = parsed.data;

    if (!validateDomain(url)) {
      return NextResponse.json(
        { error: "Unsupported domain. Use Zillow, Redfin, or Realtor.com" },
        { status: 400 }
      );
    }

    // Rate limit: 5 scrapes per minute per user
    const allowed = await checkRateLimit(user.id);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit: 5 scrapes per minute" },
        { status: 429 }
      );
    }

    // Scrape listing
    let scraped;
    try {
      scraped = await scrapeUrl(url);
    } catch (scrapeErr) {
      console.error("[/api/scrape] scrapeUrl failed:", scrapeErr);
      return NextResponse.json(
        { error: "Could not extract listing data", fallback: "manual_upload" },
        { status: 422 }
      );
    }

    // Create listing row
    const listingId = crypto.randomUUID();
    const slug = generateSlug(scraped.address || "listing", scraped.city || "");

    const { error: insertError } = await adminSupabase.from("listings").insert({
      id: listingId,
      user_id: user.id,
      slug,
      address: scraped.address || null,
      city: scraped.city || null,
      state: scraped.state || null,
      zip: scraped.zip || null,
      price: scraped.price || null,
      beds: scraped.beds || null,
      baths: scraped.baths || null,
      sqft: scraped.sqft || null,
      raw_description: scraped.description || null,
      source_url: url,
      photos: [],
    });

    if (insertError) {
      console.error("[/api/scrape] insert error:", JSON.stringify(insertError));
      return NextResponse.json({ error: "Failed to create listing: " + insertError.message }, { status: 500 });
    }

    // Download + store photos (non-fatal if it fails)
    let photos: { url: string; order: number; is_cover: boolean }[] = [];
    let photoWarnings: { photoIndex: number; warning: string }[] = [];
    if (scraped.photoUrls && scraped.photoUrls.length > 0) {
      try {
        const result = await downloadAndStorePhotos(scraped.photoUrls, user.id, listingId);
        photos = result.photos;
        photoWarnings = result.warnings;
        if (photos.length > 0) {
          await adminSupabase.from("listings").update({ photos }).eq("id", listingId);
        }
      } catch (photoErr) {
        console.error("[/api/scrape] photo download error (non-fatal):", photoErr);
      }
    }

    // Merge scraper-level warnings (e.g. Zillow blocked) with photo warnings
    const allWarnings = [
      ...(scraped.warnings || []),
      ...photoWarnings,
    ];

    return NextResponse.json({
      listingId,
      slug,
      address: scraped.address,
      city: scraped.city,
      price: scraped.price,
      beds: scraped.beds,
      baths: scraped.baths,
      sqft: scraped.sqft,
      description: scraped.description,
      photos,
      warnings: allWarnings,
      noPhotos: photos.length === 0,
    });
  } catch (err) {
    console.error("[/api/scrape] unhandled error:", err);
    return NextResponse.json(
      { error: "Internal error: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
