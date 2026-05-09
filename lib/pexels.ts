interface PexelsVideo {
  id: number;
  video_files: { link: string; quality: string; width: number; height: number }[];
}

interface PexelsResponse {
  videos: PexelsVideo[];
}

export async function fetchNeighborhoodClips(
  city: string,
  count = 3
): Promise<string[]> {
  if (!process.env.PEXELS_API_KEY) return [];

  try {
    const query = encodeURIComponent(`${city} neighborhood lifestyle`);
    const res = await fetch(
      `https://api.pexels.com/videos/search?query=${query}&per_page=${count * 2}&orientation=landscape`,
      {
        headers: { Authorization: process.env.PEXELS_API_KEY },
      }
    );

    if (!res.ok) return [];

    const data = (await res.json()) as PexelsResponse;
    const videoUrls: string[] = [];

    for (const video of data.videos || []) {
      if (videoUrls.length >= count) break;

      // Prefer SD quality, at least 720p wide
      const sdFile = video.video_files.find(
        (f) => f.quality === "sd" && f.width >= 1280
      );
      const hdFile = video.video_files.find(
        (f) => f.quality === "hd" && f.width >= 1280
      );
      const chosen = sdFile || hdFile;

      if (chosen) videoUrls.push(chosen.link);
    }

    return videoUrls;
  } catch {
    return [];
  }
}

export async function downloadPexelsClip(
  url: string,
  outputPath: string
): Promise<boolean> {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const { createWriteStream } = await import("fs");
    const { Readable } = await import("stream");
    const writer = createWriteStream(outputPath);
    const readable = Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]);
    await new Promise<void>((resolve, reject) => {
      readable.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
    return true;
  } catch {
    return false;
  }
}
