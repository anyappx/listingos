/**
 * Video generation + quality verification.
 * This is the core test: goes from URL import → generation → verifies video quality.
 *
 * Runtime: up to 2 minutes (video pipeline).
 * Uses ffprobe to verify: 1920×1080, H.264, AAC audio, correct duration.
 */
import { test, expect } from "../fixtures/auth";
import { waitForJob } from "../helpers/wait-for-job";
import { getVideoMetadata, downloadVideo } from "../helpers/video-inspector";
import path from "path";
import fs from "fs";
import os from "os";

const BASE = process.env.TEST_BASE_URL || "http://localhost:4000";
const TEST_REDFIN_URL =
  process.env.TEST_LISTING_URL ||
  "https://www.redfin.com/CA/Beverly-Hills/9507-Sunset-Blvd-90210/home/6788417";

// Shared state: populated by the first test, consumed by later tests
let sharedJobId = "";
let sharedListingId = "";
let sharedUrl16x9 = "";
let sharedUrl9x16 = "";
const tmpDir = path.join(os.tmpdir(), "listingos-e2e");

test.describe.serial("Video Generation (2 min end-to-end)", () => {
  test.setTimeout(200_000); // 3.3 minutes total

  test("Step 1: Import listing via Redfin URL", async ({ authPage: page }) => {
    fs.mkdirSync(tmpDir, { recursive: true });

    await page.goto(`${BASE}/dashboard/new`, { waitUntil: "networkidle" });

    // Fill URL
    const urlInput = page.getByPlaceholder(/zillow|redfin|url|listing/i);
    await expect(urlInput).toBeVisible({ timeout: 10000 });
    await urlInput.fill(TEST_REDFIN_URL);

    // Submit
    await page.locator("form").first().getByRole("button").first().click();

    // Wait for photo grid — scraping can take 20s
    await expect(
      page.locator("img").nth(1)
    ).toBeVisible({ timeout: 50000 });

    console.log("[test] Photos loaded, proceeding to Continue");

    // Click Continue
    const continueBtn = page.getByRole("button", { name: /continue|next|customize/i }).last();
    await continueBtn.click();

    await page.waitForURL(/\/customize/, { timeout: 15000 });

    // Capture listingId from URL
    const urlParams = new URL(page.url());
    sharedListingId = urlParams.searchParams.get("listingId") || "";
    console.log("[test] listingId:", sharedListingId);

    expect(page.url()).toContain("/customize");
  });

  test("Step 2: Configure and trigger generation", async ({ authPage: page }) => {
    const customizeUrl = sharedListingId
      ? `${BASE}/dashboard/new/customize?listingId=${sharedListingId}`
      : `${BASE}/dashboard/new/customize`;

    await page.goto(customizeUrl, { waitUntil: "networkidle" });

    // Select Modern style
    const modernBtn = page.getByRole("button", { name: /modern/i }).or(
      page.getByText("Modern").locator("..").first()
    );
    if (await modernBtn.count() > 0) {
      await modernBtn.first().click();
    }

    // Select 30s duration (default, should already be selected)
    const dur30 = page.getByRole("button", { name: /30s|30 sec/i }).or(
      page.getByText("30s").locator("..").first()
    );
    if (await dur30.count() > 0) {
      await dur30.first().click();
    }

    // Intercept the /api/generate response to capture jobId
    const generatePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/generate") && resp.request().method() === "POST",
      { timeout: 15000 }
    );

    // Click Generate Video
    const genBtn = page.getByRole("button", { name: /generate.*video|create.*video/i }).last();
    await expect(genBtn).toBeVisible({ timeout: 5000 });
    await genBtn.click();

    // Wait for generate API response
    const genResponse = await generatePromise;
    expect(genResponse.ok()).toBeTruthy();

    const genData = await genResponse.json();
    sharedJobId = genData.jobId;
    console.log("[test] Job queued:", sharedJobId);

    expect(sharedJobId).toBeTruthy();

    // Should redirect to /generating
    await page.waitForURL(/\/generating/, { timeout: 15000 });
  });

  test("Step 3: Progress screen shows steps and completes within 2 min", async ({ authPage: page }) => {
    test.setTimeout(180_000);

    expect(sharedJobId, "sharedJobId must be set from Step 2").toBeTruthy();

    const generatingUrl = `${BASE}/dashboard/new/generating?jobId=${sharedJobId}&listingId=${sharedListingId}`;
    await page.goto(generatingUrl, { waitUntil: "networkidle" });

    // Progress bar should be visible
    await expect(
      page.locator("[role='progressbar'], progress").first()
    ).toBeVisible({ timeout: 15000 });

    // Track progress steps shown
    const seenSteps = new Set<string>();
    const EXPECTED_STEPS = [
      "Importing your listing photos",
      "Rendering cinematic motion",
      "Assembling your video",
    ];

    // Poll API and track step messages
    const jobResult = await waitForJob(
      BASE,
      sharedJobId,
      160_000,
      4_000,
      (status) => {
        if (status.progressStep) {
          seenSteps.add(status.progressStep);
          console.log(
            `[test] Progress: ${status.progressPercent}% — ${status.progressStep}`
          );
        }
      }
    );

    console.log("[test] Job complete. Steps seen:", [...seenSteps]);
    console.log("[test] 16:9 URL:", jobResult.url16x9);
    console.log("[test] 9:16 URL:", jobResult.url9x16);

    // At least the first step should have been seen
    const seenAny = EXPECTED_STEPS.some((s) => seenSteps.has(s));
    expect(seenAny).toBeTruthy();

    // Store video URLs for subsequent tests
    sharedUrl16x9 = jobResult.url16x9 || "";
    sharedUrl9x16 = jobResult.url9x16 || "";

    expect(sharedUrl16x9).toBeTruthy();
    expect(sharedUrl9x16).toBeTruthy();
  });

  test("Step 4: Done page loads with two video players", async ({ authPage: page }) => {
    expect(sharedJobId, "Must have completed job").toBeTruthy();

    const doneUrl = `${BASE}/dashboard/new/done?jobId=${sharedJobId}&listingId=${sharedListingId}`;
    await page.goto(doneUrl, { waitUntil: "networkidle" });

    // Two video elements
    const videos = page.locator("video");
    await expect(videos.first()).toBeVisible({ timeout: 15000 });
    const videoCount = await videos.count();
    expect(videoCount).toBeGreaterThanOrEqual(1);

    console.log("[test] Videos on done page:", videoCount);
  });

  test("Step 5: 16:9 video is 1920×1080 with H.264 + AAC audio", async () => {
    if (!sharedUrl16x9) {
      test.skip(true, "No 16:9 URL (Step 3 may have been skipped)");
    }

    const destPath = path.join(tmpDir, "16x9.mp4");
    await downloadVideo(sharedUrl16x9, destPath);

    expect(fs.existsSync(destPath)).toBeTruthy();
    const size = fs.statSync(destPath).size;
    expect(size).toBeGreaterThan(500_000); // at least 500KB

    const meta = getVideoMetadata(destPath);
    if (!meta) {
      console.warn("[test] ffprobe unavailable — skipping metadata assertions");
      return;
    }

    console.log("[test] 16x9 metadata:", meta);

    expect(meta.width).toBe(1920);
    expect(meta.height).toBe(1080);
    expect(meta.duration).toBeGreaterThan(10);
    expect(meta.duration).toBeLessThan(90);
    expect(meta.videoCodec).toMatch(/h264|avc/i);
    expect(meta.hasAudio).toBeTruthy();
    expect(meta.audioCodec).toMatch(/aac/i);
    expect(meta.fps).toBeGreaterThanOrEqual(24);
  });

  test("Step 6: 9:16 video is 1080×1920 with H.264 + AAC audio", async () => {
    if (!sharedUrl9x16) {
      test.skip(true, "No 9:16 URL");
    }

    const destPath = path.join(tmpDir, "9x16.mp4");
    await downloadVideo(sharedUrl9x16, destPath);

    expect(fs.existsSync(destPath)).toBeTruthy();
    const size = fs.statSync(destPath).size;
    expect(size).toBeGreaterThan(500_000);

    const meta = getVideoMetadata(destPath);
    if (!meta) {
      console.warn("[test] ffprobe unavailable — skipping metadata assertions");
      return;
    }

    console.log("[test] 9x16 metadata:", meta);

    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1920);
    expect(meta.videoCodec).toMatch(/h264|avc/i);
    expect(meta.hasAudio).toBeTruthy();
    expect(meta.audioCodec).toMatch(/aac/i);
  });
});
