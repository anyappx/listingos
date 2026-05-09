#!/usr/bin/env node
/**
 * Standalone video pipeline — runs as a child process outside Next.js.
 * Called by app/api/generate/route.ts via child_process.spawn.
 * No Turbopack/Next.js bundling — pure Node.js CJS.
 *
 * v3 — Professional quality rebuild:
 *  M1: 1920×1080 HD, 6-direction Ken Burns, corrected xfade offsets
 *  M2: Intro title card (2.5s SVG → MP4, dark gradient, address/price)
 *  M3: Stats overlay PNG (beds/baths/sqft, timed 6.5→9.0s)
 *  M4: Animated lower-third (slide-in from left at 3.5s)
 *  M5: Outro CTA card (agent headshot circular, name/phone/brokerage)
 *  M6: TTS narration via OpenAI (ducked under music, skips if no key)
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

const { createClient } = require("@supabase/supabase-js");
const ws = require("ws");
const ffmpegLib = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");

if (ffmpegStatic) ffmpegLib.setFfmpegPath(ffmpegStatic);

const [, , jobId, listingId, userId, durationSecondsStr, style] = process.argv;
const durationSeconds = parseInt(durationSecondsStr, 10) || 30;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { realtime: { transport: ws } }
);

// ─── Constants ───────────────────────────────────────────────────────────────
const W = 1920;
const H = 1080;
const INTRO_DURATION = 2.5;    // intro card
const OUTRO_DURATION = 2.5;    // outro card
const XFADE_DURATION = 0.5;    // crossfade between each segment
const LOWER_THIRD_IN = 3.5;    // seconds into full video (after intro)
const STATS_START = 6.5;       // seconds into full video
const STATS_END = 9.0;

// Adaptive timing: use all available photos while keeping clip duration >= 2.5s
// Returns { photoCount, clipDuration }
function calcPhotoTiming(totalPhotos, targetDuration) {
  const FIXED = INTRO_DURATION + OUTRO_DURATION; // 5s
  const MIN_CLIP_D = 2.5;
  const MAX_PHOTOS = totalPhotos; // use ALL photos

  // clip_d = (targetDuration - FIXED + XFADE × (1 + photos)) / photos
  for (let n = MAX_PHOTOS; n >= 1; n--) {
    const clipD = (targetDuration - FIXED + XFADE_DURATION * (1 + n)) / n;
    if (clipD >= MIN_CLIP_D) return { photoCount: n, clipDuration: parseFloat(clipD.toFixed(2)) };
  }
  return { photoCount: 1, clipDuration: targetDuration - FIXED };
}

// Standard room type labels for listing photo sequences
// Real estate photos are always ordered: exterior first, interior middle, yard last
const ROOM_LABELS = [
  "Exterior", "Entry", "Living Room", "Kitchen", "Dining Room",
  "Primary Bedroom", "Primary Bath", "Bedroom", "Bedroom", "Bathroom",
  "Office / Den", "Laundry", "Garage", "Backyard", "Deck / Patio",
  "Pool Area", "Yard", "View", "Neighborhood",
];

// ─── Ken Burns Patterns (6 distinct directions) ───────────────────────────────
// Using fractional pixel offsets to avoid stuck frames
const KB_PATTERNS = [
  // zoom in from center
  { z: "min(zoom+0.0015,1.5)", x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" },
  // zoom in from top-left
  { z: "min(zoom+0.0015,1.4)", x: "0", y: "0" },
  // zoom in from top-right
  { z: "min(zoom+0.0015,1.4)", x: "iw/zoom*0.5", y: "0" },
  // pan right + slight zoom (fractional offset)
  { z: "min(zoom+0.0008,1.2)", x: "if(eq(on,1),0,min(x+(iw/zoom*0.004),iw-(iw/zoom)))", y: "ih/2-(ih/zoom/2)" },
  // pan left + slight zoom (fractional offset)
  { z: "min(zoom+0.0008,1.2)", x: "if(eq(on,1),iw-(iw/zoom),max(x-(iw/zoom*0.004),0))", y: "ih/2-(ih/zoom/2)" },
  // zoom out from center
  { z: "if(eq(on,1),1.4,max(zoom-0.0015,1.001))", x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function updateProgress(step, percent) {
  await supabase.from("video_jobs").update({
    status: "processing",
    progress_step: step,
    progress_percent: percent,
  }).eq("id", jobId);
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const client = url.startsWith("https") ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlink(dest, () => {});
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function ffrun(cmd) {
  return new Promise((resolve, reject) => {
    cmd.on("end", () => resolve()).on("error", reject).run();
  });
}

// ─── M1: Photo preprocessing (1920×1080) ─────────────────────────────────────
async function preprocessPhoto(inputPath, outputPath) {
  try {
    const sharp = require("sharp");
    await sharp(inputPath)
      .rotate()
      .resize(W, H, { fit: "cover", position: "attention" })
      .normalise()
      .sharpen({ sigma: 0.8, m1: 1.0, m2: 2.0 })
      .jpeg({ quality: 95, mozjpeg: true })
      .toFile(outputPath);
    return outputPath;
  } catch (e) {
    console.warn("[pipeline] sharp preprocessing failed:", e.message);
    return inputPath;
  }
}

// ─── M1: Bake room label into photo using Sharp (drawtext not in ffmpeg-static) ─
async function addRoomLabelToPhoto(inputPath, outputPath, roomLabel) {
  const sharp = require("sharp");
  const text = roomLabel || "";
  // Approximate pill width based on character count
  const pillW = Math.min(text.length * 15 + 48, 320);
  // Place pill in top-right of 9:16 safe zone (max x=1263): right edge = 1240
  const pillX = 1240 - pillW;
  const pillY = 28;
  const pillH = 52;

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${pillX}" y="${pillY}" width="${pillW}" height="${pillH}" rx="8" fill="rgba(0,0,0,0.65)"/>
    <text x="${pillX + pillW / 2}" y="${pillY + 35}" font-family="Arial, Helvetica, sans-serif"
          font-size="24" font-weight="600" fill="white" text-anchor="middle">${escapeXml(text)}</text>
  </svg>`;

  await sharp(inputPath)
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .jpeg({ quality: 95, mozjpeg: true })
    .toFile(outputPath);
  return outputPath;
}

// ─── M1: Ken Burns clip (1920×1080) ──────────────────────────────────────────
function createKenBurnsClip(imagePath, outputPath, duration, patternIndex) {
  const p = KB_PATTERNS[patternIndex % KB_PATTERNS.length];
  const fps = 25;
  const frames = duration * fps;

  const videoFilter = `scale=8000:-1,zoompan=z='${p.z}':d=${frames}:x='${p.x}':y='${p.y}':s=${W}x${H}:fps=${fps}`;

  return ffrun(
    ffmpegLib(imagePath)
      .inputOptions([`-loop 1`, `-t ${duration + 0.5}`])
      .videoFilter(videoFilter)
      .outputOptions(["-c:v libx264", "-preset fast", "-crf 18", "-pix_fmt yuv420p", "-an", `-t ${duration}`])
      .output(outputPath)
  );
}

// ─── M1: xfade concat (accepts per-clip durations array) ─────────────────────
function concatWithXfade(clipPaths, durations, outputPath, targetSeconds) {
  return new Promise((resolve, reject) => {
    if (clipPaths.length === 1) {
      fs.copyFileSync(clipPaths[0], outputPath);
      return resolve();
    }

    const cmd = ffmpegLib();
    clipPaths.forEach((p) => cmd.input(p));

    const fadeDuration = XFADE_DURATION;
    const filters = [];
    let prevOut = "[0:v]";
    let cumulativeOffset = 0;

    for (let i = 1; i < clipPaths.length; i++) {
      cumulativeOffset += durations[i - 1];
      const offset = Math.max(0, cumulativeOffset - fadeDuration * i);
      const outLabel = i === clipPaths.length - 1 ? "vout" : `v${i}`;
      filters.push(
        `${prevOut}[${i}:v]xfade=transition=fade:duration=${fadeDuration}:offset=${offset.toFixed(3)}[${outLabel}]`
      );
      prevOut = `[${outLabel}]`;
    }

    cmd
      .complexFilter(filters)
      .outputOptions([
        "-map [vout]",
        "-c:v libx264", "-preset fast", "-crf 18", "-pix_fmt yuv420p", "-an",
        "-movflags +faststart",
        `-t ${targetSeconds}`,
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

// ─── M2: Intro title card ─────────────────────────────────────────────────────
async function createIntroCard(listing, brand, outputPath) {
  const sharp = require("sharp");
  const address = listing.address || "Premier Property";
  const city = listing.city ? `${listing.city}${listing.state ? ", " + listing.state : ""}` : "";
  const price = listing.price ? `$${Number(listing.price).toLocaleString()}` : "";
  const primaryColor = brand?.primary_color || "#1A2E4A";
  const accentColor = brand?.accent_color || "#2563eb";
  const agentName = brand?.agent_name || "";
  const brokerage = brand?.brokerage || "";

  // Center all text around W/2=960 so it's visible in both 16:9 AND 9:16 crop (safe zone x=656-1263)
  const cx = W / 2;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${primaryColor}"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="60%">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <!-- Accent badge — centered -->
  <rect x="${cx - 110}" y="${H / 2 - 145}" width="220" height="42" rx="4" fill="${accentColor}"/>
  <text x="${cx}" y="${H / 2 - 114}" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700"
        fill="white" text-anchor="middle" letter-spacing="3">JUST LISTED</text>
  <!-- Decorative line -->
  <rect x="${cx - 40}" y="${H / 2 - 160}" width="80" height="4" fill="${accentColor}" rx="2"/>
  <!-- Address line -->
  <text x="${cx}" y="${H / 2 - 40}" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="800"
        fill="white" text-anchor="middle" letter-spacing="-1">${escapeXml(address)}</text>
  <!-- City/State -->
  ${city ? `<text x="${cx}" y="${H / 2 + 30}" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="400"
        fill="rgba(255,255,255,0.75)" text-anchor="middle">${escapeXml(city)}</text>` : ""}
  <!-- Price -->
  ${price ? `<text x="${cx}" y="${H / 2 + 100}" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="700"
        fill="${accentColor}" text-anchor="middle">${escapeXml(price)}</text>` : ""}
  <!-- Agent credit -->
  ${agentName ? `<text x="${cx}" y="${H - 60}" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="400"
        fill="rgba(255,255,255,0.6)" text-anchor="middle">${escapeXml(agentName)}${brokerage ? "  ·  " + escapeXml(brokerage) : ""}</text>` : ""}
</svg>`;

  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } } })
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .png()
    .toFile(outputPath);
  return outputPath;
}

// Loop static image into a video clip
function loopCardToVideo(imagePath, duration, outputPath) {
  return ffrun(
    ffmpegLib(imagePath)
      .inputOptions(["-loop 1", `-t ${duration}`])
      .outputOptions(["-c:v libx264", "-preset fast", "-crf 18", "-pix_fmt yuv420p", "-an", `-t ${duration}`])
      .output(outputPath)
  );
}

// ─── M3: Stats overlay PNG (full-frame transparent) ──────────────────────────
async function createStatsOverlayPng(listing, outputPath) {
  const sharp = require("sharp");
  const beds = listing.beds != null ? String(listing.beds) : "—";
  const baths = listing.baths != null ? String(listing.baths) : "—";
  const sqft = listing.sqft != null ? Number(listing.sqft).toLocaleString() : "—";

  // Card centered around W/2=960 — visible in both 16:9 and 9:16 (safe zone x=656-1263)
  const cardW = 520;
  const cardH = 160;
  const cardX = W / 2 - cardW / 2;  // x=700, center=960, right=1220 — fully in safe zone
  const cardY = 50;

  const colW = cardW / 3;
  const labels = ["BEDS", "BATHS", "SQ FT"];
  const values = [beds, baths, sqft];

  const cols = labels.map((lbl, i) => {
    const cx = cardX + colW * i + colW / 2;
    return `
    <text x="${cx}" y="${cardY + 75}" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="800"
          fill="white" text-anchor="middle">${escapeXml(values[i])}</text>
    <text x="${cx}" y="${cardY + 115}" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="600"
          fill="rgba(255,255,255,0.7)" text-anchor="middle" letter-spacing="2">${lbl}</text>
    ${i < 2 ? `<line x1="${cardX + colW * (i + 1)}" y1="${cardY + 30}" x2="${cardX + colW * (i + 1)}" y2="${cardY + cardH - 20}"
          stroke="rgba(255,255,255,0.25)" stroke-width="1"/>` : ""}`;
  }).join("");

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="12"
        fill="rgba(0,0,0,0.72)"/>
  ${cols}
</svg>`;

  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .png()
    .toFile(outputPath);
  return outputPath;
}

// Burn stats overlay onto video at a specific time window
function overlayTimedStats(videoPath, statsPng, startTime, endTime, outputPath) {
  return ffrun(
    ffmpegLib(videoPath)
      .input(statsPng)
      .complexFilter([
        `[0:v][1:v]overlay=0:0:enable='between(t,${startTime},${endTime})'[vout]`
      ])
      .outputOptions([
        "-map [vout]", "-map 0:a?",
        "-c:v libx264", "-preset fast", "-crf 18", "-pix_fmt yuv420p",
        "-c:a copy", "-movflags +faststart",
      ])
      .output(outputPath)
  );
}

// ─── M4: Animated lower-third (slide in from left) ────────────────────────────
async function createLowerThirdPng(address, agentName, price, outputPath) {
  const sharp = require("sharp");
  const priceStr = price ? `$${Number(price).toLocaleString()}` : "";
  const line1 = address || "Premier Property";
  const line2 = [agentName, priceStr].filter(Boolean).join("  ·  ");

  // Center lower-third around W/2=960 so it shows in 9:16 crop (safe zone x=656-1263)
  const cx = W / 2;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${H - 170}" width="${W}" height="170" fill="url(#grad)"/>
  <!-- Accent bar centered -->
  <rect x="${cx - 300}" y="${H - 112}" width="6" height="65" fill="#2563eb" rx="3"/>
  <text x="${cx - 286}" y="${H - 78}" font-family="Arial, Helvetica, sans-serif" font-size="32" font-weight="700"
        fill="white" letter-spacing="0.5">${escapeXml(line1)}</text>
  ${line2 ? `<text x="${cx - 286}" y="${H - 38}" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="400"
        fill="rgba(255,255,255,0.85)" letter-spacing="0.3">${escapeXml(line2)}</text>` : ""}
</svg>`;

  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from(svg), blend: "over" }])
    .png()
    .toFile(outputPath);
  return outputPath;
}

function overlayAnimatedLowerThird(videoPath, lowerThirdPng, slideInAt, fadeOutAt, outputPath) {
  // Slide in from left over 0.4s, stay until fadeOutAt, then disappear
  const slideEnd = slideInAt + 0.4;
  const xExpr = `if(lt(t,${slideInAt}),-${W},if(lt(t,${slideEnd}),-${W}+(${W}*(t-${slideInAt})/0.4),0))`;
  return ffrun(
    ffmpegLib(videoPath)
      .input(lowerThirdPng)
      .complexFilter([
        `[0:v][1:v]overlay=x='${xExpr}':y=0:enable='between(t,${slideInAt},${fadeOutAt})'[vout]`
      ])
      .outputOptions([
        "-map [vout]", "-map 0:a?",
        "-c:v libx264", "-preset fast", "-crf 18", "-pix_fmt yuv420p",
        "-c:a copy", "-movflags +faststart",
      ])
      .output(outputPath)
  );
}

// ─── M5: Outro CTA card ───────────────────────────────────────────────────────
async function createOutroCard(brand, headshotPath, outputPath) {
  const sharp = require("sharp");
  const primaryColor = brand?.primary_color || "#1A2E4A";
  const accentColor = brand?.accent_color || "#2563eb";
  const agentName = brand?.agent_name || "Your Agent";
  const phone = brand?.phone || "";
  const brokerage = brand?.brokerage || "";

  // Circular headshot
  let headshotComposite = null;
  if (headshotPath && fs.existsSync(headshotPath)) {
    try {
      const size = 280;
      const circleBuffer = Buffer.from(
        `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/></svg>`
      );
      headshotComposite = await sharp(headshotPath)
        .resize(size, size, { fit: "cover", position: "attention" })
        .composite([{ input: circleBuffer, blend: "dest-in" }])
        .png()
        .toBuffer();
    } catch (e) {
      console.warn("[pipeline] Headshot processing failed:", e.message);
    }
  }

  // Always center text around W/2 so it's visible in 9:16 crop (safe zone x=656-1263)
  // If headshot: place it left of center, text right of center, all within safe zone
  const hasHeadshot = !!headshotComposite;
  const textX = hasHeadshot ? W / 2 + 10 : W / 2;
  const textAnchor = hasHeadshot ? "start" : "middle";
  const headshotX = W / 2 - 310;  // x=650, within safe zone
  const headshotY = (H - 280) / 2;

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="${primaryColor}"/>
      <stop offset="100%" stop-color="#080808"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <!-- Agent name -->
  <text x="${textX}" y="${H / 2 - 55}" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="800"
        fill="white" text-anchor="${textAnchor}">${escapeXml(agentName)}</text>
  <!-- Brokerage -->
  ${brokerage ? `<text x="${textX}" y="${H / 2 + 10}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="400"
        fill="rgba(255,255,255,0.7)" text-anchor="${textAnchor}">${escapeXml(brokerage)}</text>` : ""}
  <!-- Phone -->
  ${phone ? `<text x="${textX}" y="${H / 2 + 70}" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="600"
        fill="${accentColor}" text-anchor="${textAnchor}">${escapeXml(phone)}</text>` : ""}
  <!-- CTA -->
  <text x="${textX}" y="${H / 2 + 145}" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="400"
        fill="rgba(255,255,255,0.55)" text-anchor="${textAnchor}">Contact me today to schedule a showing</text>
  <!-- Decorative top line -->
  <rect x="${hasHeadshot ? 620 : W / 2 - 60}" y="${H / 2 - 105}" width="120" height="4" fill="${accentColor}" rx="2"/>
</svg>`;

  const composites = [{ input: Buffer.from(svg), blend: "over" }];
  if (headshotComposite) {
    composites.push({ input: headshotComposite, left: headshotX, top: headshotY });
  }

  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } } })
    .composite(composites)
    .png()
    .toFile(outputPath);
  return outputPath;
}

// ─── M6: TTS Narration (OpenAI) ───────────────────────────────────────────────
async function generateTTSNarration(listing, outputPath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("[pipeline] No OPENAI_API_KEY — skipping TTS");
    return null;
  }
  try {
    const addr = listing.address || "this property";
    const city = listing.city || "";
    const price = listing.price ? `$${Number(listing.price).toLocaleString()}` : "";
    const beds = listing.beds ? `${listing.beds} bedroom` : "";
    const baths = listing.baths ? `${listing.baths} bathroom` : "";
    const sqft = listing.sqft ? `${Number(listing.sqft).toLocaleString()} square foot` : "";

    const details = [beds, baths, sqft].filter(Boolean).join(", ");
    const text = `Welcome to ${addr}${city ? " in " + city : ""}. This stunning ${details} home${price ? " is listed at " + price : ""} and is ready for its next owner. Schedule your private showing today.`;

    const body = JSON.stringify({ model: "tts-1", voice: "alloy", input: text, speed: 0.92 });

    const audioBuffer = await new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: "api.openai.com",
          path: "/v1/audio/speech",
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`OpenAI TTS HTTP ${res.statusCode}`));
            return;
          }
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve(Buffer.concat(chunks)));
        }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });

    fs.writeFileSync(outputPath, audioBuffer);
    console.log("[pipeline] TTS narration generated:", outputPath);
    return outputPath;
  } catch (e) {
    console.warn("[pipeline] TTS generation failed:", e.message);
    return null;
  }
}

// ─── Music + audio mix ────────────────────────────────────────────────────────
function mixAudio(videoPath, musicPath, narrationPath, outputPath, totalSeconds) {
  return new Promise((resolve, reject) => {
    const fadeStart = Math.max(0, totalSeconds - 2.5);
    const cmd = ffmpegLib(videoPath);
    // Music input with loop
    cmd.input(musicPath).inputOptions(["-stream_loop -1"]);

    let audioFilter;
    let maps;

    if (narrationPath && fs.existsSync(narrationPath)) {
      cmd.input(narrationPath);
      audioFilter = [
        `[1:a]volume=0.22,afade=t=out:st=${fadeStart}:d=2.5[music]`,
        `[2:a]adelay=2500|2500,volume=0.9,afade=t=out:st=${Math.max(0, totalSeconds - 3)}:d=2[narr]`,
        `[music][narr]amix=inputs=2:duration=first[aout]`,
      ];
      maps = ["-map 0:v", "-map [aout]"];
    } else {
      audioFilter = [
        `[1:a]volume=0.28,afade=t=out:st=${fadeStart}:d=2.5[aout]`,
      ];
      maps = ["-map 0:v", "-map [aout]"];
    }

    cmd
      .complexFilter(audioFilter)
      .outputOptions([
        ...maps,
        "-c:v copy",
        "-c:a aac", "-b:a 192k",
        "-movflags +faststart",
        `-t ${totalSeconds}`,
      ])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

// ─── Crop to 9:16 ─────────────────────────────────────────────────────────────
function cropTo9x16(inputPath, outputPath) {
  return ffrun(
    ffmpegLib(inputPath)
      .videoFilter("crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920")
      .outputOptions([
        "-c:v libx264", "-preset fast", "-crf 18", "-pix_fmt yuv420p",
        "-c:a copy", "-movflags +faststart",
      ])
      .output(outputPath)
  );
}

// ─── Extract thumbnail ────────────────────────────────────────────────────────
function extractThumbnail(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpegLib(videoPath)
      .screenshots({
        timestamps: ["3"],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: `${W}x${H}`,
      })
      .on("end", () => resolve())
      .on("error", reject);
  });
}

// ─── Watermark auto-generate ─────────────────────────────────────────────────
async function ensureWatermarkPng(publicDir) {
  const wmPath = path.join(publicDir, "watermark.png");
  if (fs.existsSync(wmPath)) return wmPath;
  try {
    const sharp = require("sharp");
    const svg = `<svg width="400" height="120" xmlns="http://www.w3.org/2000/svg">
      <text x="200" y="80" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="700"
            fill="rgba(255,255,255,0.35)" text-anchor="middle" transform="rotate(-20,200,60)">ListingOS</text>
    </svg>`;
    await sharp({ create: { width: 400, height: 120, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: Buffer.from(svg), blend: "over" }])
      .png()
      .toFile(wmPath);
    console.log("[pipeline] Watermark generated:", wmPath);
    return wmPath;
  } catch (e) {
    console.warn("[pipeline] Could not generate watermark:", e.message);
    return null;
  }
}

// ─── Brand kit / helpers ──────────────────────────────────────────────────────
async function getBrandKit(userId) {
  try {
    const { data } = await supabase.from("brand_kits").select("*").eq("user_id", userId).single();
    return data || null;
  } catch { return null; }
}

function getMusicPath(style) {
  const styleMap = {
    modern: ["track-01.mp3", "track-02.mp3"],
    luxury: ["track-03.mp3", "track-04.mp3"],
    energetic: ["track-05.mp3", "track-06.mp3"],
    minimal: ["track-07.mp3", "track-08.mp3"],
  };
  const tracks = styleMap[style?.toLowerCase()] || styleMap.modern;
  const musicDir = path.join(__dirname, "../public/music");
  for (const track of tracks) {
    const trackPath = path.join(musicDir, track);
    if (fs.existsSync(trackPath)) return trackPath;
  }
  try {
    const files = fs.readdirSync(musicDir).filter((f) => f.endsWith(".mp3"));
    if (files.length > 0) return path.join(musicDir, files[0]);
  } catch {}
  return null;
}

async function generateMockContent(listing) {
  const addr = listing.address || "this property";
  const city = listing.city || "a prime location";
  const price = listing.price ? `$${listing.price.toLocaleString()}` : "";
  const beds = listing.beds || "";
  const baths = listing.baths || "";
  return {
    descriptions: {
      mls: `Welcome to ${addr}. This exceptional home offers ${beds} bedrooms and ${baths} bathrooms in ${city}.${price ? ` Listed at ${price}.` : ""} Don't miss this remarkable opportunity.`,
      social: `Stunning ${beds}bd/${baths}ba in ${city}.${price ? ` Listed at ${price}` : " Contact for pricing"}.`,
      luxury: `An exceptional residence in ${city}.${listing.sqft ? ` ${listing.sqft.toLocaleString()} sq ft` : " Generous proportions"} of refined living space await.`,
    },
    captions: {
      instagram: `✨ Just listed: ${addr} in ${city}${price ? ` · ${price}` : ""}. Swipe to see more! 🏡 #JustListed #RealEstate`,
      tiktok: `New listing just dropped! ${addr}${price ? ` at ${price}` : ""}. DM for details!`,
      facebook: `🏡 NEW LISTING: ${addr}, ${city}${price ? ` — ${price}` : ""}. Contact me today to schedule a showing!`,
    },
  };
}

// ─── Main pipeline ────────────────────────────────────────────────────────────
async function run() {
  const tmpDir = path.join(__dirname, "../tmp", jobId);
  fs.mkdirSync(tmpDir, { recursive: true });
  const publicRoot = path.join(__dirname, "../public");

  try {
    // Step 0: Fetch listing + brand kit
    await updateProgress("Importing your listing photos", 10);
    const { data: listing, error: listingErr } = await supabase
      .from("listings").select("*").eq("id", listingId).single();
    if (listingErr || !listing) throw new Error("Listing not found: " + (listingErr?.message || ""));

    const brand = await getBrandKit(userId);
    console.log(`[pipeline] Listing: ${listing.address}, Brand: ${brand?.agent_name || "none"}`);

    // Use ALL available photos — adaptive clip duration keeps total ≈ durationSeconds
    const allPhotos = (listing.photos || []);
    if (allPhotos.length === 0) throw new Error("No photos on listing");

    const { photoCount, clipDuration: CLIP_DURATION } = calcPhotoTiming(allPhotos.length, durationSeconds);
    const photos = allPhotos.slice(0, photoCount);
    console.log(`[pipeline] Using ${photos.length}/${allPhotos.length} photos at ${CLIP_DURATION}s each`);

    // Step 1: Download + preprocess photos + generate Ken Burns clips
    await updateProgress("Rendering cinematic motion", 25);
    const clipPaths = [];

    for (let i = 0; i < photos.length; i++) {
      const rawPath = path.join(tmpDir, `raw-${i}.jpg`);
      const processedPath = path.join(tmpDir, `photo-${i}.jpg`);
      const clipPath = path.join(tmpDir, `clip-${i}.mp4`);
      try {
        await downloadFile(photos[i].url, rawPath);
        const preprocessedPath = await preprocessPhoto(rawPath, processedPath);
        await createKenBurnsClip(preprocessedPath, clipPath, CLIP_DURATION, i);
        console.log(`[pipeline] Clip ${i} done (pattern ${i % KB_PATTERNS.length})`);
        clipPaths.push(clipPath);
      } catch (e) {
        console.error(`[pipeline] Clip ${i} failed:`, e.message);
      }
      await updateProgress("Rendering cinematic motion", 25 + Math.floor((i / photos.length) * 30));
    }

    if (clipPaths.length === 0) throw new Error("All photo clips failed");

    // Step 2: M2 — Create intro card → video
    await updateProgress("Assembling your video", 60);
    const introImgPath = path.join(tmpDir, "intro.png");
    const introClipPath = path.join(tmpDir, "intro.mp4");
    await createIntroCard(listing, brand, introImgPath);
    await loopCardToVideo(introImgPath, INTRO_DURATION, introClipPath);
    console.log("[pipeline] Intro card created");

    // Step 3: M5 — Create outro card → video
    // Headshot: download if brand has headshot_url
    let headshotPath = null;
    if (brand?.headshot_url) {
      try {
        headshotPath = path.join(tmpDir, "headshot.jpg");
        await downloadFile(brand.headshot_url, headshotPath);
      } catch { headshotPath = null; }
    }

    const outroImgPath = path.join(tmpDir, "outro.png");
    const outroClipPath = path.join(tmpDir, "outro.mp4");
    await createOutroCard(brand, headshotPath, outroImgPath);
    await loopCardToVideo(outroImgPath, OUTRO_DURATION, outroClipPath);
    console.log("[pipeline] Outro card created");

    // Step 4: Assemble all clips [intro, ...photos, outro] with xfade
    const allClips = [introClipPath, ...clipPaths, outroClipPath];
    const allDurations = [INTRO_DURATION, ...clipPaths.map(() => CLIP_DURATION), OUTRO_DURATION];
    const totalVideoDuration = allDurations.reduce((a, b) => a + b, 0) - XFADE_DURATION * (allClips.length - 1);

    const assembledPath = path.join(tmpDir, "assembled.mp4");
    await concatWithXfade(allClips, allDurations, assembledPath, totalVideoDuration);
    console.log("[pipeline] All clips assembled, duration:", totalVideoDuration.toFixed(1), "s");

    // Step 5: M3 — Stats overlay (beds/baths/sqft at 6.5→9.0s)
    await updateProgress("Adding your branding", 72);
    const statsPngPath = path.join(tmpDir, "stats.png");
    await createStatsOverlayPng(listing, statsPngPath);
    const withStatsPath = path.join(tmpDir, "with-stats.mp4");
    await overlayTimedStats(assembledPath, statsPngPath, STATS_START, STATS_END, withStatsPath);
    console.log("[pipeline] Stats overlay applied");

    // Step 6: M4 — Animated lower-third
    const lowerThirdPngPath = path.join(tmpDir, "lower-third.png");
    await createLowerThirdPng(listing.address, brand?.agent_name, listing.price, lowerThirdPngPath);
    const outroStart = totalVideoDuration - OUTRO_DURATION;
    const lowerThirdOut = outroStart - 0.5;
    const withLowerPath = path.join(tmpDir, "with-lower.mp4");
    await overlayAnimatedLowerThird(withStatsPath, lowerThirdPngPath, LOWER_THIRD_IN, lowerThirdOut, withLowerPath);
    console.log("[pipeline] Lower-third animated overlay applied");

    // Step 7: Watermark (free/trial users)
    await updateProgress("Adding your branding", 80);
    const { data: userRow } = await supabase.from("users").select("plan").eq("id", userId).single();
    const needsWatermark = !userRow || userRow.plan === "trial";
    let withWatermarkPath = withLowerPath;

    if (needsWatermark) {
      const wmPath = await ensureWatermarkPng(publicRoot);
      if (wmPath) {
        const wmOutPath = path.join(tmpDir, "with-watermark.mp4");
        try {
          await ffrun(
            ffmpegLib(withLowerPath)
              .input(wmPath)
              .complexFilter([
                `[1:v]scale=400:-1[wm]`,
                `[0:v][wm]overlay=W-w-40:H-h-40[vout]`,
              ])
              .outputOptions(["-map [vout]", "-map 0:a?", "-c:v libx264", "-preset fast", "-crf 18", "-pix_fmt yuv420p", "-c:a copy", "-movflags +faststart"])
              .output(wmOutPath)
          );
          withWatermarkPath = wmOutPath;
          console.log("[pipeline] Watermark applied");
        } catch (e) {
          console.warn("[pipeline] Watermark overlay failed:", e.message);
        }
      }
    }

    // Step 8: M6 — TTS narration
    await updateProgress("Mixing music", 88);
    const narrationPath = path.join(tmpDir, "narration.mp3");
    const ttsResult = await generateTTSNarration(listing, narrationPath);

    // Step 9: Mix music (+ optional narration)
    const musicPath = getMusicPath(style);
    let finalPath = path.join(tmpDir, "final-16x9.mp4");
    if (musicPath) {
      try {
        await mixAudio(withWatermarkPath, musicPath, ttsResult, finalPath, totalVideoDuration);
        console.log("[pipeline] Audio mixed:", musicPath);
      } catch (e) {
        console.warn("[pipeline] Audio mix failed:", e.message);
        finalPath = withWatermarkPath;
      }
    } else {
      finalPath = withWatermarkPath;
      console.log("[pipeline] No music track found");
    }

    // Step 10: Crop 9:16
    await updateProgress("Creating your 9:16 version", 93);
    const output9x16 = path.join(tmpDir, "9x16.mp4");
    await cropTo9x16(finalPath, output9x16);
    console.log("[pipeline] 9:16 version created");

    // Step 11: Thumbnail
    const thumbPath = path.join(tmpDir, "thumb.jpg");
    await extractThumbnail(finalPath, thumbPath).catch((e) => console.warn("[pipeline] Thumbnail failed:", e.message));

    // Step 12: Copy to /public/videos/
    await updateProgress("Uploading final video", 95);
    const publicDir = path.join(publicRoot, "videos", jobId);
    fs.mkdirSync(publicDir, { recursive: true });
    fs.copyFileSync(finalPath, path.join(publicDir, "16x9.mp4"));
    fs.copyFileSync(output9x16, path.join(publicDir, "9x16.mp4"));
    if (fs.existsSync(thumbPath)) fs.copyFileSync(thumbPath, path.join(publicDir, "thumb.jpg"));

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4000";
    const url16x9 = `${appUrl}/videos/${jobId}/16x9.mp4`;
    const url9x16 = `${appUrl}/videos/${jobId}/9x16.mp4`;
    const thumbnailUrl = fs.existsSync(thumbPath) ? `${appUrl}/videos/${jobId}/thumb.jpg` : "";

    // Step 13: Generate content descriptions
    const { descriptions, captions } = await generateMockContent(listing);

    // Step 14: Save video row
    await supabase.from("videos").insert({
      job_id: jobId,
      listing_id: listingId,
      user_id: userId,
      url_16x9: url16x9,
      url_9x16: url9x16,
      thumbnail_url: thumbnailUrl,
      duration_seconds: Math.round(totalVideoDuration),
      is_watermarked: needsWatermark,
    });

    // Step 15: Update listing descriptions
    await supabase.from("listings").update({
      description_mls: descriptions.mls,
      description_social: descriptions.social,
      description_luxury: descriptions.luxury,
      caption_instagram: captions.instagram,
      caption_tiktok: captions.tiktok,
      caption_facebook: captions.facebook,
      fair_housing_passed: true,
    }).eq("id", listingId);

    // Step 16: Mark complete
    await supabase.from("video_jobs").update({
      status: "complete",
      progress_step: "Done!",
      progress_percent: 100,
    }).eq("id", jobId);

    console.log("[pipeline] DONE", jobId, "—", url16x9);
  } catch (err) {
    console.error("[pipeline] FAILED:", err.message);
    await supabase.from("video_jobs").update({
      status: "failed",
      error_message: err.message,
    }).eq("id", jobId);

    // Refund credit
    try {
      const { data: user } = await supabase.from("users")
        .select("listings_used_this_month").eq("id", userId).single();
      if (user && user.listings_used_this_month > 0) {
        await supabase.from("users").update({
          listings_used_this_month: user.listings_used_this_month - 1,
        }).eq("id", userId);
      }
    } catch {}
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

run().catch((e) => {
  console.error("[pipeline] Unhandled:", e.message);
  process.exit(1);
});
