#!/usr/bin/env node
/**
 * Batch Video Quality Test
 *
 * - 20 real US listing URLs → scraped photos match that exact property
 * - 5 rotating agent brand kits (name, colors, brokerage)
 * - Full parallax pipeline: preprocess → depth → parallax clips → xfade → overlays → music
 * - Output: public/batch-test/index.html — open in browser to compare
 *
 * Usage:
 *   node scripts/batch-quality-test.js
 *   node scripts/batch-quality-test.js --limit 5
 *   node scripts/batch-quality-test.js --style luxury --duration 20
 */

// Polyfill for Node.js < 20 (undici references global File)
if (typeof File === "undefined") {
  global.File = class File extends (globalThis.Blob || require("buffer").Blob) {
    constructor(bits, name, opts = {}) { super(bits, opts); this.name = name; this.lastModified = opts.lastModified || Date.now(); }
  };
}

const fs   = require("fs");
const path = require("path");
const https = require("https");
const http  = require("http");
const { execSync } = require("child_process");
const crypto = require("crypto");

require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const getArg  = (f, d) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : d; };
const STYLE    = getArg("--style", "modern");
const DURATION = parseInt(getArg("--duration", "20"), 10);
const LIMIT    = parseInt(getArg("--limit", "20"), 10);

// ─── Agent brands (5 distinct identities, cycling across 20 listings) ────────
const AGENTS = [
  { name: "Sarah Johnson",   phone: "415-555-0101", brokerage: "Compass",         primary: "#1A2E4A", accent: "#2563eb" },
  { name: "Marcus Rivera",   phone: "310-555-0202", brokerage: "Sotheby's Realty", primary: "#2D1B00", accent: "#c9a84c" },
  { name: "Priya Patel",     phone: "212-555-0303", brokerage: "Coldwell Banker",  primary: "#003087", accent: "#e31837" },
  { name: "James Whitfield", phone: "512-555-0404", brokerage: "Keller Williams",  primary: "#B40101", accent: "#000000" },
  { name: "Lisa Chen",       phone: "305-555-0505", brokerage: "Douglas Elliman",  primary: "#0F172A", accent: "#8B5CF6" },
];

// ─── 20 diverse US listings (real Redfin URLs — photos SCRAPPED from each) ───
const LISTINGS = [
  { label: "Beverly Hills Estate",    url: "https://www.redfin.com/CA/Beverly-Hills/9507-Sunset-Blvd-90210/home/6788417" },
  { label: "SF Victorian",            url: "https://www.redfin.com/CA/San-Francisco/2660-21st-St-94110/home/1005717" },
  { label: "Santa Monica Beach",      url: "https://www.redfin.com/CA/Santa-Monica/101-Ocean-Ave-90402/home/6839862" },
  { label: "Malibu Cliff View",       url: "https://www.redfin.com/CA/Malibu/24108-PCH-90265/home/7157802" },
  { label: "Palo Alto Modern",        url: "https://www.redfin.com/CA/Palo-Alto/444-Bryant-St-94301/home/1384600" },
  { label: "Manhattan Penthouse",     url: "https://www.redfin.com/NY/New-York/432-Park-Ave-10022/unit-65A/home/166143699" },
  { label: "Brooklyn Brownstone",     url: "https://www.redfin.com/NY/Brooklyn/152-Lincoln-Pl-11217/home/49048803" },
  { label: "Hamptons Beach House",    url: "https://www.redfin.com/NY/East-Hampton/95-Further-Ln-11937/home/55013600" },
  { label: "Austin Hill Country",     url: "https://www.redfin.com/TX/Austin/4005-Redbud-Trl-78746/home/36087617" },
  { label: "Houston River Oaks",      url: "https://www.redfin.com/TX/Houston/3910-Chevy-Chase-Dr-77019/home/12551534" },
  { label: "Miami Beach Waterfront",  url: "https://www.redfin.com/FL/Miami-Beach/4701-N-Meridian-Ave-33140/home/67095428" },
  { label: "Naples Gulf Views",       url: "https://www.redfin.com/FL/Naples/1930-Gulf-Shore-Blvd-N-34102/home/65131218" },
  { label: "Seattle Lake View",       url: "https://www.redfin.com/WA/Seattle/2717-Broadmoor-Dr-E-98112/home/205044" },
  { label: "Portland Craftsman",      url: "https://www.redfin.com/OR/Portland/2411-SW-Cheltenham-Blvd-97201/home/8083497" },
  { label: "Aspen Mountain Chalet",   url: "https://www.redfin.com/CO/Aspen/845-Meadows-Rd-81611/home/56803217" },
  { label: "Denver Capitol Hill",     url: "https://www.redfin.com/CO/Denver/1575-Race-St-80206/home/7427088" },
  { label: "Nashville Historic",      url: "https://www.redfin.com/TN/Nashville/704-Lynnwood-Blvd-37205/home/7527706" },
  { label: "Atlanta Buckhead",        url: "https://www.redfin.com/GA/Atlanta/3500-Habersham-Rd-NW-30305/home/6729018" },
  { label: "Chicago Lincoln Park",    url: "https://www.redfin.com/IL/Chicago/2123-N-Burling-St-60614/home/12048762" },
  { label: "Scottsdale Desert Modern",url: "https://www.redfin.com/AZ/Scottsdale/7175-E-Camelback-Rd-85251/home/128621892" },
].slice(0, LIMIT);

// ─── Paths ────────────────────────────────────────────────────────────────────
const ROOT        = path.join(__dirname, "..");
const OUT_DIR     = path.join(ROOT, "public", "batch-test");
const TMP_BASE    = path.join(ROOT, "tmp", "batch");
// On Apple Silicon macs where Node runs under Rosetta (x86_64), python3 would
// also spawn as x86_64 — but arm64 numpy is installed. Force arm64 slice.
const PYTHON3     = process.env.PYTHON3_PATH ||
  (process.platform === "darwin" && process.arch === "x64"
    ? "arch -arm64 python3"
    : "python3");
const PARALLAX_PY = path.join(__dirname, "parallax-cpu.py");
const FFMPEG_BIN  = require("ffmpeg-static");
const ffmpegLib   = require("fluent-ffmpeg");
if (FFMPEG_BIN) ffmpegLib.setFfmpegPath(FFMPEG_BIN);

fs.mkdirSync(OUT_DIR,  { recursive: true });
fs.mkdirSync(TMP_BASE, { recursive: true });

// ─── Parallax presets ─────────────────────────────────────────────────────────
const PARALLAX_PRESETS = [
  { motion: "dolly",      intensity: 1.4, reverse: false },
  { motion: "zoom",       intensity: 1.0, reverse: false },
  { motion: "horizontal", intensity: 1.2, reverse: false },
  { motion: "orbital",    intensity: 1.0, reverse: false },
  { motion: "circle",     intensity: 1.1, reverse: false },
  { motion: "zoom",       intensity: 1.0, reverse: true  },
  { motion: "horizontal", intensity: 1.0, reverse: true  },
  { motion: "dolly",      intensity: 1.2, reverse: true  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const mod = url.startsWith("https") ? https : http;
    mod.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); fs.unlink(dest, () => {});
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) { file.close(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve()));
    }).on("error", e => { fs.unlink(dest, () => {}); reject(e); });
  });
}

function ffrun(cmd) {
  return new Promise((r, j) => cmd.on("end", r).on("error", j).run());
}

function escapeXml(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

async function preprocessPhoto(inp, out) {
  const sharp = require("sharp");
  await sharp(inp).rotate()
    .resize(1920, 1080, { fit: "cover", position: "attention" })
    .normalise()
    .sharpen({ sigma: 0.8 })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(out);
}

async function generateParallaxClip(imgPath, outPath, duration, presetIdx) {
  const p = PARALLAX_PRESETS[presetIdx % PARALLAX_PRESETS.length];
  const rawOut = outPath.replace(".mp4", "-raw.mp4");
  const cmd = `${PYTHON3} "${PARALLAX_PY}" "${imgPath}" "${rawOut}" ${p.motion} ${p.intensity} ${duration} ${p.reverse}`;
  execSync(cmd, { stdio: "pipe", timeout: 90_000 });
  // Re-encode to H.264 for xfade compatibility (Python outputs mpeg4)
  await ffrun(ffmpegLib(rawOut)
    .outputOptions(["-c:v libx264", "-preset fast", "-crf 20", "-pix_fmt yuv420p", "-an", "-movflags +faststart"])
    .output(outPath)
  );
  fs.unlink(rawOut, () => {});
}

// durs: array of per-clip durations; xfade between each = 0.5s
function concatWithXfade(clips, durs, outPath) {
  return new Promise((resolve, reject) => {
    if (clips.length === 1) { fs.copyFileSync(clips[0], outPath); return resolve(); }
    const XFADE = 0.5;
    const cmd = ffmpegLib();
    clips.forEach(c => cmd.input(c));
    const filters = [];
    let prev = "[0:v]";
    let offset = 0;
    for (let i = 1; i < clips.length; i++) {
      offset += durs[i - 1] - XFADE;
      const lbl = i === clips.length - 1 ? "vout" : `v${i}`;
      filters.push(`${prev}[${i}:v]xfade=transition=fade:duration=${XFADE}:offset=${Math.max(0, offset).toFixed(3)}[${lbl}]`);
      prev = `[${lbl}]`;
    }
    const total = durs.reduce((a, b) => a + b, 0) - XFADE * (clips.length - 1);
    cmd.complexFilter(filters)
      .outputOptions(["-map [vout]", "-c:v libx264", "-preset fast", "-crf 20", "-pix_fmt yuv420p", "-an", "-movflags +faststart", `-t ${total.toFixed(3)}`])
      .output(outPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

// Intro card SVG → PNG → MP4
async function createIntroCard(listing, agent, outPng) {
  const sharp = require("sharp");
  const W = 1920, H = 1080, cx = W / 2;
  const address = listing.address || listing.label;
  const city    = listing.city ? `${listing.city}${listing.state ? ", " + listing.state : ""}` : "";
  const price   = listing.price ? `$${Number(listing.price).toLocaleString()}` : "";

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${agent.primary}"/>
      <stop offset="100%" stop-color="#0a0a0a"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="${cx-110}" y="${H/2-145}" width="220" height="42" rx="4" fill="${agent.accent}"/>
  <text x="${cx}" y="${H/2-114}" font-family="Arial" font-size="22" font-weight="700" fill="white" text-anchor="middle" letter-spacing="3">JUST LISTED</text>
  <text x="${cx}" y="${H/2-40}"  font-family="Arial" font-size="52" font-weight="800" fill="white" text-anchor="middle">${escapeXml(address)}</text>
  ${city  ? `<text x="${cx}" y="${H/2+30}"  font-family="Arial" font-size="30" fill="rgba(255,255,255,0.75)" text-anchor="middle">${escapeXml(city)}</text>` : ""}
  ${price ? `<text x="${cx}" y="${H/2+100}" font-family="Arial" font-size="48" font-weight="700" fill="${agent.accent}" text-anchor="middle">${escapeXml(price)}</text>` : ""}
  <text x="${cx}" y="${H-60}" font-family="Arial" font-size="22" fill="rgba(255,255,255,0.55)" text-anchor="middle">${escapeXml(agent.name)} · ${escapeXml(agent.brokerage)}</text>
</svg>`;

  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } } })
    .composite([{ input: Buffer.from(svg), blend: "over" }]).png().toFile(outPng);
}

async function createOutroCard(listing, agent, outPng) {
  const sharp = require("sharp");
  const W = 1920, H = 1080, cx = W / 2;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="${agent.primary}"/>
      <stop offset="100%" stop-color="#080808"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <text x="${cx}" y="${H/2-55}" font-family="Arial" font-size="60" font-weight="800" fill="white" text-anchor="middle">${escapeXml(agent.name)}</text>
  <text x="${cx}" y="${H/2+10}" font-family="Arial" font-size="28" fill="rgba(255,255,255,0.7)" text-anchor="middle">${escapeXml(agent.brokerage)}</text>
  <text x="${cx}" y="${H/2+70}" font-family="Arial" font-size="36" font-weight="600" fill="${agent.accent}" text-anchor="middle">${escapeXml(agent.phone)}</text>
  <text x="${cx}" y="${H/2+140}" font-family="Arial" font-size="24" fill="rgba(255,255,255,0.5)" text-anchor="middle">Contact me today to schedule a showing</text>
</svg>`;

  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } } })
    .composite([{ input: Buffer.from(svg), blend: "over" }]).png().toFile(outPng);
}

async function createLowerThird(listing, agent, outPng) {
  const sharp = require("sharp");
  const W = 1920, H = 1080, cx = W / 2;
  const address = listing.address || listing.label;
  const price = listing.price ? `$${Number(listing.price).toLocaleString()}` : "";
  const line2 = [agent.name, price].filter(Boolean).join("  ·  ");

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <rect x="0" y="${H-170}" width="${W}" height="170" fill="url(#g)"/>
  <rect x="${cx-300}" y="${H-112}" width="6" height="65" fill="${agent.accent}" rx="3"/>
  <text x="${cx-286}" y="${H-78}"  font-family="Arial" font-size="30" font-weight="700" fill="white">${escapeXml(address)}</text>
  ${line2 ? `<text x="${cx-286}" y="${H-38}" font-family="Arial" font-size="19" fill="rgba(255,255,255,0.85)">${escapeXml(line2)}</text>` : ""}
</svg>`;

  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: Buffer.from(svg), blend: "over" }]).png().toFile(outPng);
}

function loopImageToVideo(imgPath, duration, outPath) {
  return ffrun(ffmpegLib(imgPath)
    .inputOptions(["-loop 1", `-t ${duration}`])
    .outputOptions(["-c:v libx264", "-preset fast", "-crf 20", "-pix_fmt yuv420p", "-r 30", "-an", `-t ${duration}`])
    .output(outPath)
  );
}

function overlayLowerThird(videoPath, pngPath, slideInAt, fadeOutAt, outPath) {
  const slideEnd = slideInAt + 0.4;
  const xExpr = `if(lt(t,${slideInAt}),-1920,if(lt(t,${slideEnd}),-1920+(1920*(t-${slideInAt})/0.4),0))`;
  return ffrun(ffmpegLib(videoPath).input(pngPath)
    .complexFilter([`[0:v][1:v]overlay=x='${xExpr}':y=0:enable='between(t,${slideInAt},${fadeOutAt})'[vout]`])
    .outputOptions(["-map [vout]", "-map 0:a?", "-c:v libx264", "-preset fast", "-crf 20", "-pix_fmt yuv420p", "-c:a copy", "-movflags +faststart"])
    .output(outPath)
  );
}

function addMusic(videoPath, outPath, totalSec) {
  const musicDir = path.join(ROOT, "public", "music");
  let musicFile = null;
  try {
    const files = fs.readdirSync(musicDir).filter(f => f.endsWith(".mp3"));
    if (files.length) musicFile = path.join(musicDir, files[Math.floor(Math.random() * files.length)]);
  } catch {}
  if (!musicFile) { fs.copyFileSync(videoPath, outPath); return Promise.resolve(); }
  const fadeStart = Math.max(0, totalSec - 2.5);
  return ffrun(ffmpegLib(videoPath).input(musicFile).inputOptions(["-stream_loop -1"])
    .complexFilter([[`[1:a]volume=0.28,afade=t=out:st=${fadeStart}:d=2.5[aout]`]])
    .outputOptions(["-map 0:v", "-map [aout]", "-c:v copy", "-c:a aac", "-b:a 192k", "-movflags +faststart", `-t ${totalSec}`])
    .output(outPath)
  );
}

// ─── Inline Redfin / Zillow scraper (no API auth needed) ─────────────────────
function parsePrice(t) {
  if (!t) return null;
  const m = String(t).replace(/,/g, "").match(/\$?([\d.]+)([KkMm]?)/);
  if (!m) return null;
  let n = parseFloat(m[1]);
  const s = m[2].toUpperCase();
  if (s === "K") n *= 1000;
  if (s === "M") n *= 1_000_000;
  return Math.round(n) || null;
}
function parseNum(t) {
  if (!t) return null;
  const m = String(t).replace(/,/g, "").match(/[\d.]+/);
  return m ? parseFloat(m[0]) || null : null;
}

function extractRedfinPhotos(html) {
  const seen = new Set();
  const re = /https?:\/\/ssl\.cdn-redfin\.com\/photo\/[^\s"']+bigphoto[^\s"']+\.jpg/gi;
  let m;
  while ((m = re.exec(html)) !== null) seen.add(m[0].split("?")[0]);
  return [...seen];
}

function extractZillowPhotos(html) {
  const seen = new Map();
  const re = /https?:\/\/photos\.zillowstatic\.com\/fp\/([a-zA-Z0-9_-]+)-cc_ft_(\d+)\.jpg/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const [url, hash, sz] = m;
    const size = parseInt(sz, 10);
    if (!seen.has(hash) || size > seen.get(hash).size) seen.set(hash, { size, url });
  }
  return [...seen.values()].map(v => v.url);
}

// Native https fetch with browser-like headers (no third-party deps needed)
function fetchHtml(targetUrl, referer) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(targetUrl);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": referer ? "same-origin" : "none",
        ...(referer ? { "Referer": referer } : {}),
      },
    };
    const mod = require("https");
    const zlib = require("zlib");
    const req = mod.get(opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHtml(new URL(res.headers.location, targetUrl).href, referer).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${targetUrl}`));
      let stream = res;
      const enc = res.headers["content-encoding"];
      if (enc === "gzip")    stream = res.pipe(zlib.createGunzip());
      else if (enc === "br") stream = res.pipe(zlib.createBrotliDecompress());
      else if (enc === "deflate") stream = res.pipe(zlib.createInflate());
      const chunks = [];
      stream.on("data", c => chunks.push(c));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      stream.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(30_000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

async function scrapePhotos(url) {
  const cheerio = require("cheerio");
  const isZillow = url.includes("zillow.com");
  const referer = isZillow ? "https://www.zillow.com/" : "https://www.redfin.com/";

  const html = await fetchHtml(url, referer);
  const $ = cheerio.load(html);

  let address = "", city = "", state = "", zip = "";
  let price = null, beds = null, baths = null, sqft = null;
  let photoUrls = [];

  if (!isZillow) {
    // Redfin
    address = $('[data-rf-test-id="abp-streetLine"]').text().trim() || $(".street-address").text().trim();
    const csz = $('[data-rf-test-id="abp-cityStateZip"]').text().trim();
    const cszM = csz.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5})?/);
    if (cszM) { city = cszM[1]; state = cszM[2]; zip = cszM[3] || ""; }
    if (!city) {
      const titleM = $("title").text().match(/,\s*([^,]+),\s*([A-Z]{2})\s+(\d{5})/);
      if (titleM) { city = titleM[1].trim(); state = titleM[2]; zip = titleM[3]; }
    }
    price = parsePrice($('[data-rf-test-id="abp-price"] .statsValue').text() || $('[data-rf-test-id="abp-price"]').text());
    beds  = parseNum($('[data-rf-test-id="abp-beds"] .statsValue').text() || $('[data-rf-test-id="abp-beds"]').text());
    baths = parseNum($('[data-rf-test-id="abp-baths"] .statsValue').text() || $('[data-rf-test-id="abp-baths"]').text());
    sqft  = parseNum($('[data-rf-test-id="abp-sqFt"] .statsValue').text() || $('[data-rf-test-id="abp-sqFt"]').text());
    photoUrls = extractRedfinPhotos(html);
  } else {
    // Zillow
    const nextM = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>({.+?})<\/script>/s);
    if (nextM) {
      try {
        const nd = JSON.parse(nextM[1]);
        const cp = nd?.props?.pageProps?.componentProps || {};
        address = String(cp.streetAddress || "");
        city = String(cp.city || ""); state = String(cp.state || ""); zip = String(cp.zipcode || "");
        price = parsePrice(String(cp.price || ""));
        beds = parseNum(String(cp.bedrooms || "")); baths = parseNum(String(cp.bathrooms || ""));
        sqft = parseNum(String(cp.livingArea || ""));
      } catch {}
    }
    photoUrls = extractZillowPhotos(html);
  }

  // Address from URL slug if scrape missed it
  if (!address) {
    const parts = url.split("/");
    const addrPart = parts.find(s => /-[A-Z]{2}-\d/.test(s)) || parts.find(s => /\d{5}/.test(s)) || "";
    address = addrPart.replace(/-\d{5}.*/, "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()).trim();
  }

  if (photoUrls.length === 0) {
    throw new Error(`No photos found (html: ${html.length} chars, may be blocked)`);
  }

  return {
    address, city, state, zip, price, beds, baths, sqft,
    photos: photoUrls.map((u, i) => ({ url: u, order: i, is_cover: i === 0 })),
  };
}

// ─── Process one listing ──────────────────────────────────────────────────────
async function processListing(listing, idx) {
  const agent   = AGENTS[idx % AGENTS.length];
  const id      = `${idx + 1}`;
  const tmpDir  = path.join(TMP_BASE, id);
  fs.mkdirSync(tmpDir, { recursive: true });

  const t0 = Date.now();
  process.stdout.write(`\n[${id}/${LISTINGS.length}] ${listing.label}  (Agent: ${agent.name})\n`);
  process.stdout.write(`  Scraping: ${listing.url}\n`);

  let scraped;
  try {
    scraped = await scrapePhotos(listing.url);
  } catch (e) {
    console.error(`  ✗ Scrape failed: ${e.message}`);
    return { label: listing.label, agent: agent.name, error: `Scrape: ${e.message}`, idx };
  }

  const photos = (scraped.photos || []).slice(0, 6);
  if (!photos.length) return { label: listing.label, agent: agent.name, error: "No photos", idx };

  process.stdout.write(`  ✓ ${scraped.address || "?"} · ${photos.length} photos\n`);

  // Per-clip duration
  const INTRO = 2.5, OUTRO = 2.5, XFADE = 0.5;
  const clipDur = Math.max(3, parseFloat(((DURATION - INTRO - OUTRO + XFADE * (1 + photos.length)) / photos.length).toFixed(2)));
  const clipPaths = [];

  // Download + preprocess + parallax for each photo
  for (let i = 0; i < photos.length; i++) {
    const rawPath  = path.join(tmpDir, `raw-${i}.jpg`);
    const procPath = path.join(tmpDir, `proc-${i}.jpg`);
    const clipPath = path.join(tmpDir, `clip-${i}.mp4`);

    try {
      await downloadFile(photos[i].url, rawPath);
      await preprocessPhoto(rawPath, procPath);

      const preset = PARALLAX_PRESETS[i % PARALLAX_PRESETS.length];
      await generateParallaxClip(procPath, clipPath, clipDur, i);
      process.stdout.write(`  ✓ Clip ${i + 1}/${photos.length} → ${preset.motion}\n`);
      clipPaths.push(clipPath);
    } catch (e) {
      process.stdout.write(`  ✗ Clip ${i + 1} failed: ${e.message}\n`);
    }
  }

  if (!clipPaths.length) return { label: listing.label, agent: agent.name, error: "All clips failed", idx };

  // Intro + outro cards
  const introImgPath = path.join(tmpDir, "intro.png");
  const introClipPath = path.join(tmpDir, "intro.mp4");
  const outroImgPath = path.join(tmpDir, "outro.png");
  const outroClipPath = path.join(tmpDir, "outro.mp4");

  await createIntroCard(scraped, agent, introImgPath);
  await loopImageToVideo(introImgPath, INTRO, introClipPath);
  await createOutroCard(scraped, agent, outroImgPath);
  await loopImageToVideo(outroImgPath, OUTRO, outroClipPath);

  // Concat: [intro, ...photos, outro]
  const allClips    = [introClipPath, ...clipPaths, outroClipPath];
  const allDurs     = [INTRO, ...clipPaths.map(() => clipDur), OUTRO];
  const totalSec    = allDurs.reduce((a, b) => a + b, 0) - XFADE * (allClips.length - 1);
  const assembledPath = path.join(tmpDir, "assembled.mp4");

  process.stdout.write(`  ✓ Assembling ${allClips.length} clips (${totalSec.toFixed(1)}s total)\n`);
  await concatWithXfade(allClips, allDurs, assembledPath);

  // Lower-third overlay
  const lowerPngPath  = path.join(tmpDir, "lower.png");
  const lowerVideoPath = path.join(tmpDir, "with-lower.mp4");
  await createLowerThird(scraped, agent, lowerPngPath);
  const lowerThirdIn  = INTRO + 1.0;   // slides in 1s into first photo
  const lowerThirdOut = totalSec - OUTRO - 0.5;
  await overlayLowerThird(assembledPath, lowerPngPath, lowerThirdIn, lowerThirdOut, lowerVideoPath);

  // Music
  const finalPath = path.join(tmpDir, "final.mp4");
  await addMusic(lowerVideoPath, finalPath, totalSec).catch(() => fs.copyFileSync(lowerVideoPath, finalPath));

  // Copy to output dir
  const slug = listing.label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const outFile = `${idx + 1}-${slug}.mp4`;
  fs.copyFileSync(finalPath, path.join(OUT_DIR, outFile));

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  process.stdout.write(`  ✅ ${elapsed}s → batch-test/${outFile}\n`);

  return {
    idx, label: listing.label, agent: agent.name, agentColor: agent.accent,
    address: scraped.address, city: scraped.city, state: scraped.state,
    price: scraped.price, beds: scraped.beds, baths: scraped.baths, sqft: scraped.sqft,
    photos: photos.length, clips: clipPaths.length,
    videoFile: outFile, elapsed,
  };
}

// ─── HTML viewer ─────────────────────────────────────────────────────────────
function buildHTML(results) {
  const done = results.filter(r => !r.error).length;
  const cards = results.map(r => {
    if (r.error) return `
    <div class="card err">
      <div class="badge">${r.idx + 1}</div>
      <div class="info"><div class="title">${r.label}</div><div class="fail">✗ ${r.error}</div></div>
    </div>`;

    return `
    <div class="card">
      <div class="badge">${r.idx + 1}</div>
      <div class="agent-tag" style="background:${r.agentColor}">${r.agent}</div>
      <video controls muted playsinline>
        <source src="/batch-test/${r.videoFile}" type="video/mp4">
      </video>
      <div class="info">
        <div class="title">${r.label}</div>
        <div class="addr">${r.address || ""}${r.city ? ", " + r.city : ""}${r.state ? " " + r.state : ""}</div>
        <div class="meta">
          ${r.price ? "<span>$" + Number(r.price).toLocaleString() + "</span>" : ""}
          ${r.beds ? "<span>" + r.beds + " bd</span>" : ""}
          ${r.baths ? "<span>" + r.baths + " ba</span>" : ""}
          ${r.sqft ? "<span>" + Number(r.sqft).toLocaleString() + " sqft</span>" : ""}
          <span class="dim">${r.photos} photos · ${r.elapsed}s</span>
        </div>
      </div>
    </div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ListingOS Quality Test — ${done}/${results.length} videos</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#080808;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh}
header{padding:20px 28px;border-bottom:1px solid #1a1a1a;display:flex;align-items:center;justify-content:space-between}
header h1{font-size:20px;font-weight:700;letter-spacing:-0.3px}
header p{color:#555;font-size:13px;margin-top:3px}
.bar{padding:12px 28px;border-bottom:1px solid #111;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.bar button{background:#1a1a1a;border:1px solid #2a2a2a;color:#ccc;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:12px}
.bar button:hover{background:#2563eb;border-color:#2563eb;color:#fff}
.bar .stat{font-size:12px;color:#555;margin-left:auto}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(460px,1fr));gap:20px;padding:20px 28px}
.card{background:#111;border:1px solid #1e1e1e;border-radius:12px;overflow:hidden;position:relative}
.card.err{padding:16px;opacity:0.4;display:flex;gap:12px;align-items:center}
.badge{position:absolute;top:8px;left:8px;background:rgba(0,0,0,0.75);color:#666;font-size:10px;padding:2px 7px;border-radius:4px;z-index:2}
.agent-tag{position:absolute;top:8px;right:8px;color:#fff;font-size:10px;font-weight:600;padding:2px 8px;border-radius:4px;z-index:2;opacity:0.92}
video{width:100%;aspect-ratio:16/9;display:block;background:#000}
.info{padding:10px 14px 14px}
.title{font-size:14px;font-weight:600;margin-bottom:2px}
.addr{font-size:11px;color:#666;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.meta span{font-size:11px;color:#444;background:#161616;padding:2px 7px;border-radius:4px}
.meta .dim{color:#333}
.fail{font-size:12px;color:#c44;margin-top:6px}
</style>
</head>
<body>
<header>
  <div>
    <h1>🎬 ListingOS · Parallax Quality Test</h1>
    <p>${done}/${results.length} generated · ${STYLE} style · ${DURATION}s · ${new Date().toLocaleString()}</p>
  </div>
</header>
<div class="bar">
  <button onclick="document.querySelectorAll('video').forEach(v=>v.play())">▶ Play All</button>
  <button onclick="document.querySelectorAll('video').forEach(v=>v.pause())">⏸ Pause All</button>
  <button onclick="document.querySelectorAll('video').forEach(v=>{v.muted=!v.muted})">🔇 Mute Toggle</button>
  <button onclick="document.querySelectorAll('video').forEach(v=>{v.currentTime=0;v.play()})">↺ Restart All</button>
  <span class="stat">${results.filter(r=>!r.error).length} succeeded · ${results.filter(r=>r.error).length} failed</span>
</div>
<div class="grid">${cards}</div>
</body>
</html>`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🎬 Batch Quality Test`);
  console.log(`   ${LISTINGS.length} listings · ${STYLE} style · ${DURATION}s each`);
  console.log(`   Photos: scraped live from each address URL`);
  console.log(`   Agents: ${AGENTS.length} rotating brand kits\n`);

  try {
    const ping = await fetch("http://localhost:3000");
    if (!ping.ok) throw new Error();
  } catch {
    console.error("❌  localhost:3000 is not running.\n    Start it: npm run dev\n");
    process.exit(1);
  }

  const results = [];
  const t0 = Date.now();

  // Process sequentially (parallax is CPU-heavy; parallel would saturate the machine)
  for (let i = 0; i < LISTINGS.length; i++) {
    const r = await processListing(LISTINGS[i], i);
    results.push(r);
    // Write HTML after every video so you can watch in-progress
    fs.writeFileSync(path.join(OUT_DIR, "index.html"), buildHTML(results));
  }

  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  const ok   = results.filter(r => !r.error).length;

  console.log(`\n─────────────────────────────────────────`);
  console.log(`✅  ${ok}/${results.length} videos · ${mins} min total`);
  console.log(`\n📺  View now:`);
  console.log(`    http://localhost:3000/batch-test/index.html\n`);
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
