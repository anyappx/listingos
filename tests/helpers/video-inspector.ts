/**
 * Video quality inspection utilities using FFmpeg/ffprobe.
 * Extracts stream metadata, frames for overlay verification, audio presence.
 */
import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

// ─── ffprobe binary resolution ─────────────────────────────────────────────────
function findFfprobe(): string | null {
  // Try system ffprobe first
  try {
    execSync("ffprobe -version", { stdio: "pipe" });
    return "ffprobe";
  } catch {}

  // Try Homebrew locations
  const candidates = [
    "/opt/homebrew/bin/ffprobe",
    "/usr/local/bin/ffprobe",
    "/usr/bin/ffprobe",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function findFfmpeg(): string | null {
  // Try ffmpeg-static from node_modules
  try {
    const ffmpegStatic = require("ffmpeg-static");
    if (ffmpegStatic && fs.existsSync(ffmpegStatic)) return ffmpegStatic;
  } catch {}

  // System ffmpeg
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
    return "ffmpeg";
  } catch {}

  const candidates = [
    "/opt/homebrew/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// ─── Download helper ────────────────────────────────────────────────────────────
export function downloadVideo(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const client = url.startsWith("https") ? https : http;
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
    }).on("error", reject);
  });
}

// ─── Video metadata ─────────────────────────────────────────────────────────────
export interface VideoMetadata {
  width: number;
  height: number;
  fps: number;
  duration: number;
  videoCodec: string;
  audioCodec: string | null;
  audioBitrate: number | null;
  hasAudio: boolean;
}

export function getVideoMetadata(filePath: string): VideoMetadata | null {
  const ffprobe = findFfprobe();
  if (!ffprobe) {
    console.warn("[video-inspector] ffprobe not found — skipping metadata check");
    return null;
  }

  try {
    const result = spawnSync(
      ffprobe,
      ["-v", "quiet", "-print_format", "json", "-show_streams", filePath],
      { encoding: "utf8", timeout: 15000 }
    );
    const data = JSON.parse(result.stdout);
    const streams: any[] = data.streams || [];

    const videoStream = streams.find((s: any) => s.codec_type === "video");
    const audioStream = streams.find((s: any) => s.codec_type === "audio");

    if (!videoStream) return null;

    const [numStr, denStr] = (videoStream.r_frame_rate || "30/1").split("/");
    const fps = Number(numStr) / Number(denStr);

    return {
      width: videoStream.width,
      height: videoStream.height,
      fps,
      duration: parseFloat(videoStream.duration || "0"),
      videoCodec: videoStream.codec_name,
      audioCodec: audioStream?.codec_name || null,
      audioBitrate: audioStream?.bit_rate ? parseInt(audioStream.bit_rate) : null,
      hasAudio: !!audioStream,
    };
  } catch (e) {
    console.error("[video-inspector] ffprobe failed:", e);
    return null;
  }
}

// ─── Frame extraction ───────────────────────────────────────────────────────────
export interface FrameInfo {
  filePath: string;
  timestamp: number;
  /** Whether the frame appears to have overlay content (non-uniform colors in overlay zone) */
  hasOverlayContent: boolean;
  /** Average brightness 0–255 */
  avgBrightness: number;
  /** Standard deviation of pixel values (high = more detail/content) */
  pixelStdDev: number;
}

export function extractFrame(
  videoPath: string,
  timestamp: number,
  outputPath: string
): boolean {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) {
    console.warn("[video-inspector] ffmpeg not found — skipping frame extraction");
    return false;
  }

  try {
    spawnSync(
      ffmpeg,
      ["-y", "-ss", String(timestamp), "-i", videoPath, "-vframes", "1", "-q:v", "2", outputPath],
      { stdio: "pipe", timeout: 15000 }
    );
    return fs.existsSync(outputPath);
  } catch {
    return false;
  }
}

/**
 * Analyze a frame PNG for overlay presence using pixel statistics.
 * The lower-third zone is bottom 15% of frame.
 * The stats zone is top 18% of frame.
 */
export function analyzeFrame(framePath: string, zone: "lower-third" | "stats" | "full" = "full"): {
  avgBrightness: number;
  pixelStdDev: number;
  hasContent: boolean;
} {
  // Use Python's cv2 for pixel analysis (avoids adding more Node.js deps)
  try {
    const script = `
import cv2, numpy as np, sys, json
img = cv2.imread("${framePath.replace(/\\/g, "\\\\")}")
if img is None: print(json.dumps({"error": "cannot read"})); sys.exit(1)
h, w = img.shape[:2]
zone = "${zone}"
if zone == "lower-third":
    region = img[int(h*0.85):, :]
elif zone == "stats":
    region = img[:int(h*0.20), :]
else:
    region = img
gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
mean = float(np.mean(gray))
std = float(np.std(gray))
print(json.dumps({"mean": mean, "std": std}))
    `.trim();

    const result = spawnSync("python3", ["-c", script], { encoding: "utf8", timeout: 10000 });
    const parsed = JSON.parse(result.stdout.trim());
    return {
      avgBrightness: parsed.mean ?? 0,
      pixelStdDev: parsed.std ?? 0,
      // std > 15 means there's meaningful content (not black/solid background)
      hasContent: (parsed.std ?? 0) > 15,
    };
  } catch {
    return { avgBrightness: 0, pixelStdDev: 0, hasContent: false };
  }
}
