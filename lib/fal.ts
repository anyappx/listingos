import { fal } from "@fal-ai/client";
import * as fs from "fs";
import * as path from "path";
import type { VideoStyle } from "@/lib/types";

fal.config({ credentials: process.env.FAL_KEY });

const MOTION_STRENGTHS: Record<VideoStyle, number> = {
  modern: 0.7,
  luxury: 0.5,
  energetic: 0.9,
  minimal: 0.4,
};

interface FalClipResult {
  url: string;
  localPath: string;
}

export async function generateClip(
  imageUrl: string,
  style: VideoStyle,
  jobTmpDir: string,
  index: number
): Promise<FalClipResult> {
  const motionStrength = MOTION_STRENGTHS[style];

  async function attemptGenerate(): Promise<string> {
    const result = await fal.subscribe("fal-ai/seedance/v1/lite/image-to-video", {
      input: {
        image_url: imageUrl,
        duration: "4",
        resolution: "720p",
        motion_strength: motionStrength,
      },
      timeout: 90000,
      pollInterval: 3000,
    }) as { video?: { url?: string } };

    const videoUrl = result?.video?.url;
    if (!videoUrl) throw new Error("No video URL in fal.ai response");
    return videoUrl;
  }

  let videoUrl: string;
  try {
    videoUrl = await attemptGenerate();
  } catch {
    // Retry once
    try {
      videoUrl = await attemptGenerate();
    } catch {
      // Fallback: use Ken Burns FFmpeg effect on static image
      return kenBurnsFallback(imageUrl, jobTmpDir, index);
    }
  }

  // Download immediately (fal.ai URLs expire in 1 hour)
  const localPath = path.join(jobTmpDir, `clip-${index}.mp4`);
  const response = await fetch(videoUrl);
  if (!response.ok) throw new Error(`Failed to download clip: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(localPath, buffer);

  return { url: videoUrl, localPath };
}

async function kenBurnsFallback(
  imageUrl: string,
  jobTmpDir: string,
  index: number
): Promise<FalClipResult> {
  const { createKenBurnsClip } = await import("@/lib/ffmpeg");

  // Download the image first
  const imgPath = path.join(jobTmpDir, `img-${index}.jpg`);
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to download image for fallback: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(imgPath, buf);

  const outputPath = path.join(jobTmpDir, `clip-${index}.mp4`);
  await createKenBurnsClip(imgPath, outputPath, 4);
  return { url: "", localPath: outputPath };
}

export async function generateClipsParallel(
  imageUrls: string[],
  style: VideoStyle,
  jobTmpDir: string,
  onProgress?: (done: number, total: number) => void
): Promise<string[]> {
  const { default: pLimit } = await import("p-limit");
  const limit = pLimit(4); // max 4 concurrent fal.ai requests
  const results: string[] = new Array(imageUrls.length).fill("");
  let completed = 0;

  await Promise.all(
    imageUrls.map((url, i) =>
      limit(async () => {
        const result = await generateClip(url, style, jobTmpDir, i);
        results[i] = result.localPath;
        completed++;
        onProgress?.(completed, imageUrls.length);
      })
    )
  );

  return results.filter(Boolean);
}
