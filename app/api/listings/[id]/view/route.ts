import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// In-memory deduplication fallback when Redis is unavailable
const recentViews = new Map<string, number>();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
  const dedupeKey = `${id}:${ip}`;

  // Redis debounce: 1 view per IP per listing per hour
  let alreadySeen = false;
  try {
    const { Redis } = await import("ioredis");
    const redis = new Redis(process.env.UPSTASH_REDIS_URL!, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    });
    const redisKey = `view_dedup:${dedupeKey}`;
    const result = await redis.set(redisKey, "1", "EX", 3600, "NX");
    alreadySeen = result === null;
    await redis.quit();
  } catch {
    // Fallback to in-memory dedup
    const now = Date.now();
    const last = recentViews.get(dedupeKey);
    if (last && now - last < 3600_000) {
      alreadySeen = true;
    } else {
      recentViews.set(dedupeKey, now);
      if (recentViews.size > 10_000) {
        const cutoff = now - 3600_000;
        for (const [k, v] of recentViews.entries()) {
          if (v < cutoff) recentViews.delete(k);
        }
      }
    }
  }

  if (alreadySeen) {
    return NextResponse.json({ counted: false });
  }

  const admin = createAdminClient();
  try {
    await admin.rpc("increment_view_count", { listing_id: id });
  } catch {
    const { data } = await admin.from("listings").select("view_count").eq("id", id).single();
    if (data) {
      await admin.from("listings").update({ view_count: (data.view_count || 0) + 1 }).eq("id", id);
    }
  }

  return NextResponse.json({ counted: true });
}
