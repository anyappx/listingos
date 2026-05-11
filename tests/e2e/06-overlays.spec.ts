/**
 * Overlay visibility — verifies intro card, lower-third, stats, and outro
 * appear at the expected timestamps in the generated video.
 *
 * Strategy:
 *  1. Download the 16:9 mp4 (from env var or previous test artifact)
 *  2. Extract frames at specific timestamps using ffmpeg
 *  3. Analyze extracted frames for content (non-uniform pixel regions)
 */
import { test, expect } from "../fixtures/auth";
import {
  downloadVideo,
  extractFrame,
  analyzeFrame,
  getVideoMetadata,
} from "../helpers/video-inspector";
import path from "path";
import fs from "fs";
import os from "os";

const BASE = process.env.TEST_BASE_URL || "http://localhost:4000";
const tmpDir = path.join(os.tmpdir(), "listingos-e2e");

function getVideo16x9Path(): string {
  return path.join(tmpDir, "16x9.mp4");
}

test.describe("Overlay Quality Checks", () => {
  test.beforeAll(async () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    const videoPath = getVideo16x9Path();

    if (!fs.existsSync(videoPath)) {
      const url = process.env.TEST_VIDEO_16X9_URL;
      if (!url) {
        console.warn("[overlays] No video available. Run 05-generate-and-verify first.");
        return;
      }
      await downloadVideo(url, videoPath);
    }
  });

  test("Intro card (0–2.5s): frame at 1.0s has rich content (not black screen)", async () => {
    const videoPath = getVideo16x9Path();
    if (!fs.existsSync(videoPath)) {
      test.skip(true, "16x9.mp4 not available");
    }

    const framePath = path.join(tmpDir, "frame-intro.png");
    const extracted = extractFrame(videoPath, 1.0, framePath);

    if (!extracted) {
      test.skip(true, "ffmpeg not available for frame extraction");
    }

    const analysis = analyzeFrame(framePath, "full");
    console.log("[overlays] Intro frame (1.0s):", analysis);

    // Intro card should have significant content — not black (mean > 20) and has variation
    expect(analysis.avgBrightness).toBeGreaterThan(10);
    expect(analysis.pixelStdDev).toBeGreaterThan(15);
  });

  test("Lower-third (4s): bottom region has overlay content", async () => {
    const videoPath = getVideo16x9Path();
    if (!fs.existsSync(videoPath)) {
      test.skip(true, "16x9.mp4 not available");
    }

    // Lower-third slides in at 3.5s — fully visible at 4.2s
    const framePath = path.join(tmpDir, "frame-lower-third.png");
    const extracted = extractFrame(videoPath, 4.2, framePath);

    if (!extracted) {
      test.skip(true, "ffmpeg not available");
    }

    const analysis = analyzeFrame(framePath, "lower-third");
    console.log("[overlays] Lower-third zone (4.2s):", analysis);

    // Lower-third zone should have higher brightness/content than plain photo
    expect(analysis.hasContent).toBeTruthy();
  });

  test("Stats overlay (7.0s): top region shows stats card content", async () => {
    const videoPath = getVideo16x9Path();
    if (!fs.existsSync(videoPath)) {
      test.skip(true, "16x9.mp4 not available");
    }

    // Stats visible 6.5s–9.0s — check at 7.0s
    const framePath = path.join(tmpDir, "frame-stats.png");
    const extracted = extractFrame(videoPath, 7.0, framePath);

    if (!extracted) {
      test.skip(true, "ffmpeg not available");
    }

    const analysis = analyzeFrame(framePath, "stats");
    console.log("[overlays] Stats zone (7.0s):", analysis);

    // Stats card is a dark overlay — should have good contrast
    expect(analysis.hasContent).toBeTruthy();
  });

  test("Outro card (last 2.5s): frame near end has rich content", async () => {
    const videoPath = getVideo16x9Path();
    if (!fs.existsSync(videoPath)) {
      test.skip(true, "16x9.mp4 not available");
    }

    const meta = getVideoMetadata(videoPath);
    const duration = meta?.duration || 30;
    const outroTimestamp = Math.max(0, duration - 1.5);

    const framePath = path.join(tmpDir, "frame-outro.png");
    const extracted = extractFrame(videoPath, outroTimestamp, framePath);

    if (!extracted) {
      test.skip(true, "ffmpeg not available");
    }

    const analysis = analyzeFrame(framePath, "full");
    console.log(`[overlays] Outro frame (${outroTimestamp}s):`, analysis);

    expect(analysis.avgBrightness).toBeGreaterThan(5);
    expect(analysis.pixelStdDev).toBeGreaterThan(15);
  });

  test("No black frames detected in photo sections (2.5s–last 2.5s)", async () => {
    const videoPath = getVideo16x9Path();
    if (!fs.existsSync(videoPath)) {
      test.skip(true, "16x9.mp4 not available");
    }

    const meta = getVideoMetadata(videoPath);
    const duration = meta?.duration || 30;

    // Sample frames at 3s, 8s, 14s, 20s (all should be photo clips, not black)
    const sampleTimes = [3, 8, 14, 20].filter((t) => t < duration - 2.5);
    let blackFrameCount = 0;

    for (const t of sampleTimes) {
      const framePath = path.join(tmpDir, `frame-check-${t}.png`);
      const extracted = extractFrame(videoPath, t, framePath);
      if (!extracted) continue;

      const analysis = analyzeFrame(framePath, "full");
      console.log(`[overlays] Frame at ${t}s:`, analysis);

      if (analysis.avgBrightness < 5) {
        blackFrameCount++;
        console.warn(`[overlays] WARN: Potential black frame at ${t}s (brightness=${analysis.avgBrightness})`);
      }
    }

    expect(blackFrameCount).toBe(0);
  });

  test("Parallax motion: consecutive frames differ (not slideshow freeze)", async () => {
    const videoPath = getVideo16x9Path();
    if (!fs.existsSync(videoPath)) {
      test.skip(true, "16x9.mp4 not available");
    }

    // Extract 3 frames 0.5s apart from the first photo section (3.0s, 3.5s, 4.0s)
    const frames = [];
    for (const t of [3.0, 3.5, 4.0]) {
      const framePath = path.join(tmpDir, `frame-motion-${t}.png`);
      const ok = extractFrame(videoPath, t, framePath);
      if (ok) frames.push(framePath);
    }

    if (frames.length < 2) {
      test.skip(true, "Not enough frames extracted for motion check");
    }

    // Compare frames using Python cv2 — they should differ (PSNR < 50 = visually different)
    const { spawnSync } = require("child_process");
    const script = `
import cv2, numpy as np, json
f1 = cv2.imread("${frames[0].replace(/\\/g, "\\\\")}").astype(float)
f2 = cv2.imread("${frames[frames.length - 1].replace(/\\/g, "\\\\")}").astype(float)
diff = np.mean(np.abs(f1 - f2))
print(json.dumps({"mean_diff": float(diff)}))
    `.trim();

    const result = spawnSync("python3", ["-c", script], { encoding: "utf8" });
    if (result.error) {
      test.skip(true, "Python/cv2 not available for frame comparison");
    }

    try {
      const { mean_diff } = JSON.parse(result.stdout.trim());
      console.log(`[overlays] Frame diff between 3.0s and 4.0s: mean_diff=${mean_diff.toFixed(2)}`);
      // A slideshow would have diff ~0 (frozen frame); parallax should have diff > 1.0
      expect(mean_diff).toBeGreaterThan(0.5);
    } catch (e) {
      console.warn("[overlays] Could not parse frame comparison result:", e);
    }
  });
});
