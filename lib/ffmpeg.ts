import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import * as fs from "fs";
import * as path from "path";

// Use bundled ffmpeg-static binary (works without system ffmpeg install)
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export interface AssembleOptions {
  clipPaths: string[];
  musicPath: string;
  outputPath: string;
  durationSeconds: number;
  agentName: string;
  brokerage: string;
  primaryColor: string;
  font: string;
  watermarkPath?: string;
}

export async function assembleVideo(options: AssembleOptions): Promise<void> {
  const {
    clipPaths,
    musicPath,
    outputPath,
    durationSeconds,
    agentName,
    brokerage,
    primaryColor,
    watermarkPath,
  } = options;

  // Write file list for concat demuxer
  const fileListPath = outputPath.replace(".mp4", "-filelist.txt");
  const fileListContent = clipPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  fs.writeFileSync(fileListPath, fileListContent);

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}/${g}/${b}`;
  };

  const bgColor = hexToRgb(primaryColor);
  const fadeStart = Math.max(0, durationSeconds - 3);
  const lowerThirdText = `${agentName} | ${brokerage}`;

  return new Promise((resolve, reject) => {
    let cmd = ffmpeg()
      .input(fileListPath)
      .inputOptions(["-f concat", "-safe 0"])
      .input(musicPath)
      .audioFilter(`volume=0.35,afade=t=out:st=${fadeStart}:d=3`)
      .videoFilter([
        // Lower-third: box + text
        `drawbox=x=0:y=ih-70:w=iw:h=70:color=${bgColor}@0.7:t=fill`,
        `drawtext=text='${lowerThirdText.replace(/'/g, "\\'")}':fontfile=/System/Library/Fonts/Helvetica.ttc:fontsize=22:fontcolor=white:x=40:y=h-48`,
      ])
      .outputOptions([
        "-c:v libx264",
        "-preset fast",
        "-crf 23",
        "-c:a aac",
        "-b:a 128k",
        "-shortest",
        `-t ${durationSeconds}`,
        "-map 0:v:0",
        "-map 1:a:0",
        "-movflags +faststart",
      ])
      .output(outputPath);

    if (watermarkPath && fs.existsSync(watermarkPath)) {
      cmd = ffmpeg()
        .input(fileListPath)
        .inputOptions(["-f concat", "-safe 0"])
        .input(musicPath)
        .input(watermarkPath)
        .complexFilter([
          `[0:v]drawbox=x=0:y=ih-70:w=iw:h=70:color=${bgColor}@0.7:t=fill,drawtext=text='${lowerThirdText.replace(/'/g, "\\'")}':fontfile=/System/Library/Fonts/Helvetica.ttc:fontsize=22:fontcolor=white:x=40:y=h-48[v_lower]`,
          "[v_lower][2:v]overlay=W-w-20:H-h-20[v_out]",
          `[1:a]volume=0.35,afade=t=out:st=${fadeStart}:d=3[a_out]`,
        ])
        .outputOptions([
          "-map [v_out]",
          "-map [a_out]",
          "-c:v libx264",
          "-preset fast",
          "-crf 23",
          "-c:a aac",
          "-b:a 128k",
          "-shortest",
          `-t ${durationSeconds}`,
          "-movflags +faststart",
        ])
        .output(outputPath);
    }

    cmd
      .on("end", () => {
        fs.unlinkSync(fileListPath);
        resolve();
      })
      .on("error", (err) => {
        try { fs.unlinkSync(fileListPath); } catch {}
        reject(err);
      })
      .run();
  });
}

export async function cropTo9x16(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilter("crop=ih*9/16:ih:(iw-ih*9/16)/2:0")
      .outputOptions(["-c:v libx264", "-preset fast", "-crf 23", "-c:a copy", "-movflags +faststart"])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

export async function extractThumbnail(videoPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        timestamps: ["2"],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: "1280x720",
      })
      .on("end", () => resolve())
      .on("error", reject);
  });
}

export async function createKenBurnsClip(
  imagePath: string,
  outputPath: string,
  durationSeconds: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(imagePath)
      .inputOptions([`-loop 1`, `-t ${durationSeconds}`])
      .videoFilter(
        `scale=8000:-1,zoompan=z='min(zoom+0.001,1.3)':d=${durationSeconds * 25}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720`
      )
      .outputOptions(["-c:v libx264", "-preset fast", "-crf 23", "-an", `-t ${durationSeconds}`])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}
