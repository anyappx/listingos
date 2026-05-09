import { type NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { GenerateInputSchema } from "@/lib/validations";
import { isDevMode } from "@/lib/dev-pipeline";
import { spawn } from "child_process";
import * as path from "path";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = GenerateInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { listingId, style, durationSeconds, formats, musicTrackId, includeNeighborhoodBroll } = parsed.data;
  const adminSupabase = createAdminClient();

  // Verify listing belongs to user
  const { data: listing } = await adminSupabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("user_id", user.id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  // Check for active job on this listing
  const { data: existingJob } = await adminSupabase
    .from("video_jobs")
    .select("id, status")
    .eq("listing_id", listingId)
    .in("status", ["queued", "processing"])
    .single();

  if (existingJob) {
    return NextResponse.json(
      { error: "Video already generating for this listing" },
      { status: 409 }
    );
  }

  // Atomic credit check + deduct
  const { data: creditResult } = await adminSupabase.rpc("check_and_deduct_credit", {
    p_user_id: user.id,
  });

  if (!creditResult) {
    return NextResponse.json(
      { error: "No credits remaining", upgradeUrl: "/dashboard/account" },
      { status: 402 }
    );
  }

  // Create video_jobs row
  const jobId = crypto.randomUUID();
  const { error: jobError } = await adminSupabase.from("video_jobs").insert({
    id: jobId,
    listing_id: listingId,
    user_id: user.id,
    status: "queued",
    style,
    duration_seconds: durationSeconds,
    music_track_id: musicTrackId,
    include_neighborhood_broll: includeNeighborhoodBroll,
    progress_step: "Waiting to start...",
    progress_percent: 0,
  });

  if (jobError) {
    // Refund credit
    const { data: u } = await adminSupabase.from("users").select("listings_used_this_month").eq("id", user.id).single();
    if (u && u.listings_used_this_month > 0) {
      await adminSupabase.from("users").update({ listings_used_this_month: u.listings_used_this_month - 1 }).eq("id", user.id);
    }
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }

  if (isDevMode()) {
    // Dev mode: spawn standalone Node.js pipeline script — avoids Next.js/Turbopack bundling issues
    const scriptPath = path.join(process.cwd(), "scripts", "pipeline.js");
    const nodeBin = process.execPath;
    const child = spawn(nodeBin, [scriptPath, jobId, listingId, user.id, String(durationSeconds), style], {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (d: Buffer) => process.stdout.write(`[pipeline] ${d}`));
    child.stderr?.on("data", (d: Buffer) => process.stderr.write(`[pipeline:err] ${d}`));
    child.unref();
  } else {
    // Production: enqueue to BullMQ worker
    const { enqueueVideoJob } = await import("@/workers/queue");
    await enqueueVideoJob({ jobId, listingId, userId: user.id, style, durationSeconds, formats, musicTrackId, includeNeighborhoodBroll });
  }

  return NextResponse.json({ jobId, estimatedSeconds: isDevMode() ? 60 : 120 });
}
