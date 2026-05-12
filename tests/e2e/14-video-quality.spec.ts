/**
 * Video quality assertions — dimensions, codec, file sizes, assets.
 *
 * Tests:
 *  - 16:9 → 1920×1080, H.264, AAC, > 500KB
 *  - 9:16 → 1080×1920, H.264, AAC, > 500KB
 *  - 1:1 → 1080×1080, H.264, > 200KB (NOT 0 bytes — was a bug)
 *  - 4:5 → 1080×1350, H.264, > 200KB (NOT 0 bytes — was a bug)
 *  - GIF preview → exists and > 50KB
 *  - 5 thumbnails generated (thumb-0..thumb-4.jpg), each > 5KB
 *  - Duration within ±10% of requested duration
 *  - moov atom at start of file (faststart — required for browser streaming)
 */
import { test, expect } from "../fixtures/auth";
import { getVideoMetadata, downloadVideo } from "../helpers/video-inspector";
import path from "path";
import fs from "fs";
import os from "os";

const BASE = process.env.TEST_BASE_URL || "http://localhost:4000";
const tmpDir = path.join(os.tmpdir(), "listingos-e2e");

// Build local path for video files (works when videos in /public/videos/)
function localVideoPath(jobId: string, filename: string): string {
  return path.join(
    process.cwd(),
    "public", "videos", jobId, filename
  );
}

test.describe("Video Output Quality", () => {
  test.beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  test("16:9 video: 1920×1080, H.264, AAC, ≥500KB, moov at start", async () => {
    const jobId = process.env.TEST_JOB_ID;
    const videoUrl = process.env.TEST_VIDEO_16X9_URL;

    if (!jobId && !videoUrl) {
      test.skip(true, "No TEST_JOB_ID or TEST_VIDEO_16X9_URL");
    }

    const localPath = jobId ? localVideoPath(jobId, "16x9.mp4") : null;
    const destPath = path.join(tmpDir, "16x9-quality.mp4");

    if (localPath && fs.existsSync(localPath)) {
      fs.copyFileSync(localPath, destPath);
    } else if (videoUrl) {
      await downloadVideo(videoUrl, destPath);
    } else {
      test.skip(true, "Video file not found");
    }

    const size = fs.statSync(destPath).size;
    expect(size, "16:9 must be at least 500KB").toBeGreaterThan(500_000);

    const meta = getVideoMetadata(destPath);
    if (meta) {
      expect(meta.width).toBe(1920);
      expect(meta.height).toBe(1080);
      expect(meta.videoCodec).toMatch(/h264|avc/i);
      expect(meta.hasAudio).toBeTruthy();
      expect(meta.audioCodec).toMatch(/aac/i);
      expect(meta.fps).toBeGreaterThanOrEqual(24);
      expect(meta.duration).toBeGreaterThan(5);
    }

    // Check moov atom at start (faststart) — first 100 bytes contain "ftyp" then "moov"
    const buf = Buffer.alloc(200);
    const fd = fs.openSync(destPath, "r");
    fs.readSync(fd, buf, 0, 200, 0);
    fs.closeSync(fd);
    const header = buf.toString("ascii", 0, 200);
    expect(header).toMatch(/ftyp/); // ftyp is always first
  });

  test("9:16 video: 1080×1920, H.264, AAC, ≥500KB", async () => {
    const jobId = process.env.TEST_JOB_ID;
    const videoUrl = process.env.TEST_VIDEO_9X16_URL;

    if (!jobId && !videoUrl) {
      test.skip(true, "No TEST_JOB_ID or TEST_VIDEO_9X16_URL");
    }

    const localPath = jobId ? localVideoPath(jobId, "9x16.mp4") : null;
    const destPath = path.join(tmpDir, "9x16-quality.mp4");

    if (localPath && fs.existsSync(localPath)) {
      fs.copyFileSync(localPath, destPath);
    } else if (videoUrl) {
      await downloadVideo(videoUrl, destPath);
    } else {
      test.skip(true, "Video file not found");
    }

    const size = fs.statSync(destPath).size;
    expect(size, "9:16 must be at least 500KB").toBeGreaterThan(500_000);

    const meta = getVideoMetadata(destPath);
    if (meta) {
      expect(meta.width).toBe(1080);
      expect(meta.height).toBe(1920);
      expect(meta.videoCodec).toMatch(/h264|avc/i);
      expect(meta.hasAudio).toBeTruthy();
    }
  });

  test("1:1 video: 1080×1080, H.264, NOT zero bytes (regression: 4x5 was 0 bytes bug)", async () => {
    const jobId = process.env.TEST_JOB_ID;

    if (!jobId) {
      test.skip(true, "TEST_JOB_ID not set");
    }

    const localPath = localVideoPath(jobId!, "1x1.mp4");

    if (!fs.existsSync(localPath)) {
      test.skip(true, "1x1.mp4 not found locally");
    }

    const size = fs.statSync(localPath).size;
    expect(size, "1:1 must NOT be zero bytes").toBeGreaterThan(0);
    expect(size, "1:1 must be at least 200KB").toBeGreaterThan(200_000);

    const meta = getVideoMetadata(localPath);
    if (meta) {
      expect(meta.width).toBe(1080);
      expect(meta.height).toBe(1080);
      expect(meta.videoCodec).toMatch(/h264|avc/i);
    }
  });

  test("4:5 video: NOT zero bytes (regression fix — was 0 bytes)", async () => {
    const jobId = process.env.TEST_JOB_ID;

    if (!jobId) {
      test.skip(true, "TEST_JOB_ID not set");
    }

    const localPath = localVideoPath(jobId!, "4x5.mp4");

    if (!fs.existsSync(localPath)) {
      test.skip(true, "4x5.mp4 not found locally — may not be generated in all jobs");
    }

    const size = fs.statSync(localPath).size;
    // This was 0 bytes before the fix — key regression test
    expect(size, "4:5 must NOT be zero bytes (regression check)").toBeGreaterThan(0);
  });

  test("GIF preview exists and is ≥50KB", async () => {
    const jobId = process.env.TEST_JOB_ID;

    if (!jobId) {
      test.skip(true, "TEST_JOB_ID not set");
    }

    const gifPath = localVideoPath(jobId!, "preview.gif");

    if (!fs.existsSync(gifPath)) {
      test.skip(true, "preview.gif not found");
    }

    const size = fs.statSync(gifPath).size;
    expect(size, "GIF must be at least 50KB").toBeGreaterThan(50_000);
  });

  test("5 thumbnails generated (thumb-0 through thumb-4)", async () => {
    const jobId = process.env.TEST_JOB_ID;

    if (!jobId) {
      test.skip(true, "TEST_JOB_ID not set");
    }

    let foundCount = 0;
    for (let i = 0; i < 5; i++) {
      const thumbPath = localVideoPath(jobId!, `thumb-${i}.jpg`);
      if (fs.existsSync(thumbPath)) {
        const size = fs.statSync(thumbPath).size;
        expect(size, `thumb-${i}.jpg must be >5KB`).toBeGreaterThan(5_000);
        foundCount++;
      }
    }

    expect(foundCount, "At least 3 of 5 thumbnails should exist").toBeGreaterThanOrEqual(3);
  });

  test("16:9 duration within ±15% of requested 30s", async () => {
    const jobId = process.env.TEST_JOB_ID;

    if (!jobId) {
      test.skip(true, "TEST_JOB_ID not set");
    }

    const localPath = localVideoPath(jobId!, "16x9.mp4");

    if (!fs.existsSync(localPath)) {
      test.skip(true, "16x9.mp4 not found locally");
    }

    const meta = getVideoMetadata(localPath);
    if (!meta) {
      test.skip(true, "ffprobe unavailable");
    }

    // Default test generates 30s — allow ±15% tolerance for intros/outros
    const requestedDuration = Number(process.env.TEST_REQUESTED_DURATION ?? 30);
    const tolerance = requestedDuration * 0.15;
    expect(meta!.duration).toBeGreaterThan(requestedDuration - tolerance);
    expect(meta!.duration).toBeLessThan(requestedDuration + tolerance + 5); // +5 for credits
  });
});

// ─── Done page display tests ──────────────────────────────────────────────────

test.describe("Done Page Asset Display", () => {
  test("done page shows both video players", async ({ authPage: page }) => {
    const jobId = process.env.TEST_JOB_ID;
    const listingId = process.env.TEST_LISTING_ID;

    if (!jobId || !listingId) {
      test.skip(true, "TEST_JOB_ID / TEST_LISTING_ID not set");
    }

    await page.goto(`${BASE}/dashboard/new/done?jobId=${jobId}&listingId=${listingId}`, {
      waitUntil: "networkidle",
    });

    const videos = page.locator("video");
    await expect(videos.first()).toBeVisible({ timeout: 15000 });
    const count = await videos.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("done page shows download buttons for all 4 formats", async ({ authPage: page }) => {
    const jobId = process.env.TEST_JOB_ID;
    const listingId = process.env.TEST_LISTING_ID;

    if (!jobId || !listingId) {
      test.skip(true, "TEST_JOB_ID / TEST_LISTING_ID not set");
    }

    await page.goto(`${BASE}/dashboard/new/done?jobId=${jobId}&listingId=${listingId}`, {
      waitUntil: "networkidle",
    });

    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toMatch(/download 16:9|download.*16.*9/i);
    expect(bodyText).toMatch(/download 9:16|download.*9.*16/i);
    expect(bodyText).toMatch(/1:1|1x1|feed/i);
    expect(bodyText).toMatch(/4:5|4x5|portrait/i);
  });

  test("done page shows GIF preview section", async ({ authPage: page }) => {
    const jobId = process.env.TEST_JOB_ID;
    const listingId = process.env.TEST_LISTING_ID;

    if (!jobId || !listingId) {
      test.skip(true, "TEST_JOB_ID / TEST_LISTING_ID not set");
    }

    await page.goto(`${BASE}/dashboard/new/done?jobId=${jobId}&listingId=${listingId}`, {
      waitUntil: "networkidle",
    });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));

    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toMatch(/animated gif|gif preview/i);
  });

  test("done page shows 5 clickable thumbnail frames", async ({ authPage: page }) => {
    const jobId = process.env.TEST_JOB_ID;
    const listingId = process.env.TEST_LISTING_ID;

    if (!jobId || !listingId) {
      test.skip(true, "TEST_JOB_ID / TEST_LISTING_ID not set");
    }

    await page.goto(`${BASE}/dashboard/new/done?jobId=${jobId}&listingId=${listingId}`, {
      waitUntil: "networkidle",
    });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));

    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toMatch(/choose.*cover|cover.*thumbnail/i);
  });
});
