#!/usr/bin/env node
/**
 * Supabase polling worker — polls for queued video jobs every 5s and spawns pipeline.js.
 * Run: node scripts/worker-poll.js
 * Deploy: Railway with start command "node scripts/worker-poll.js"
 */

const path = require("path");
const { spawn } = require("child_process");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const POLL_INTERVAL_MS = 5000;
const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

let isRunning = false;

async function recoverStuckJobs() {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MS).toISOString();
  const { data: stuck } = await supabase
    .from("video_jobs")
    .select("id, user_id")
    .eq("status", "processing")
    .lt("updated_at", cutoff);

  if (!stuck || stuck.length === 0) return;

  for (const job of stuck) {
    console.log(`[worker] Recovering stuck job ${job.id}`);
    await supabase
      .from("video_jobs")
      .update({ status: "failed", error_message: "Job timed out after 10 minutes" })
      .eq("id", job.id);

    // Refund credit
    try {
      const { data: user } = await supabase
        .from("users")
        .select("listings_used_this_month")
        .eq("id", job.user_id)
        .single();
      if (user && user.listings_used_this_month > 0) {
        await supabase
          .from("users")
          .update({ listings_used_this_month: user.listings_used_this_month - 1 })
          .eq("id", job.user_id);
        console.log(`[worker] Credit refunded for user ${job.user_id}`);
      }
    } catch (e) {
      console.warn(`[worker] Credit refund failed for job ${job.id}:`, e.message);
    }
  }
}

async function pickAndRun() {
  if (isRunning) return;

  // Fetch oldest queued job
  const { data: job, error } = await supabase
    .from("video_jobs")
    .select("id, listing_id, user_id, duration_seconds, style")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !job) return;

  // Immediately claim it to prevent double-pickup
  const { error: claimErr } = await supabase
    .from("video_jobs")
    .update({ status: "processing", progress_step: "Starting...", progress_percent: 0 })
    .eq("id", job.id)
    .eq("status", "queued"); // optimistic lock

  if (claimErr) {
    console.warn(`[worker] Failed to claim job ${job.id} (race):`, claimErr.message);
    return;
  }

  isRunning = true;
  console.log(`[worker] Picked up job ${job.id} (listing: ${job.listing_id})`);

  const pipelinePath = path.join(__dirname, "pipeline.js");
  const child = spawn("node", [
    pipelinePath,
    job.id,
    job.listing_id,
    job.user_id,
    String(job.duration_seconds || 30),
    job.style || "modern",
  ], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("close", (code) => {
    if (code !== 0) {
      console.error(`[worker] Job ${job.id} exited with code ${code}`);
    } else {
      console.log(`[worker] Job ${job.id} completed`);
    }
    isRunning = false;
  });

  child.on("error", (err) => {
    console.error(`[worker] Failed to spawn pipeline for job ${job.id}:`, err.message);
    supabase
      .from("video_jobs")
      .update({ status: "failed", error_message: `Spawn error: ${err.message}` })
      .eq("id", job.id)
      .then(() => {})
      .catch(() => {});
    isRunning = false;
  });
}

async function poll() {
  try {
    await recoverStuckJobs();
    await pickAndRun();
  } catch (e) {
    console.error("[worker] Poll error:", e.message);
  }
}

console.log("[worker] Polling for jobs every 5s...");
poll();
setInterval(poll, POLL_INTERVAL_MS);
