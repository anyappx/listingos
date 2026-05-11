# ListingOS v1.0 — Production PRD for Claude Code

**Read this ENTIRE document before writing any code.**
**Do NOT skip sections. Do NOT say "done" until Section 10 passes.**

---

## 0. CURRENT STATE (verified May 11, 2026)

### What exists and works:
- Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui
- Supabase auth + postgres + storage (REAL keys, live DB)
- Stripe billing (TEST mode — sk_test keys)
- scripts/pipeline.js (906 lines) — intro card, lower-third, stats overlay,
  outro CTA, music mixing, xfade transitions, 16:9+9:16 output, Ken Burns
- lib/claude.ts — description + caption generation via Claude Haiku
- BullMQ + Redis job queue (workers/queue.ts, workers/video.ts)
- Brand kit editor, music library (8 real MP3 tracks, 41MB in /public/music/)
- Dashboard: /dashboard, /dashboard/new (4-step wizard), /dashboard/listings,
  /dashboard/brand, /dashboard/music, /dashboard/account
- Public listing page /l/[slug] + QR code + lead capture
- Landing page app/page.tsx (functional, 225 lines)
- All API routes: /api/scrape, /api/generate, /api/job/[id], /api/brand,
  /api/content, /api/leads, /api/listings/[id], /api/billing/*, /api/webhooks/stripe

### What is BROKEN:
- Scraper: Zillow ❌ (rate-limited/blocked), Redfin ⚠️ (was working, untested recently)
- FAL_KEY=placeholder → no AI video, all Ken Burns (flat, slideshow quality)
- R2_ACCESS_KEY_ID=placeholder → videos saved to /public/videos/ (local only)
- lib/dev-pipeline.ts — DEAD CODE (generate route never calls it)
- workers/video.ts — has fal.ai + R2 + email but NO overlays
- No deployment (no Vercel, no Railway — localhost only)

### Budget constraints:
- Total monthly spend: $20 maximum
- Vercel: has paid account (another app on it — stay within plan limits)
- Railway: $5/mo starter
- Supabase: free tier (already live)
- Cloudflare R2: free tier (10GB/mo)
- Claude API: $100 credit (existing)
- Stripe: test mode for now (go live when first agent pays)
- NO GPU budget — CPU-only pipeline

---

## 1. WHAT WE'RE SHIPPING

### 1A. Fix the scraper (Zillow + Redfin)
### 1B. Replace Ken Burns with CPU depth-parallax
### 1C. Add Content Pack (auto-generated with every video)
### 1D. Add film grain + warm color grade to FFmpeg pipeline
### 1E. Merge R2 upload + Claude content from workers/video.ts into pipeline.js
### 1F. Delete dead code (lib/dev-pipeline.ts)
### 1G. Deploy to Vercel (frontend) + Railway (pipeline worker)

**That's it. Nothing else. Do not add features not on this list.**

---

## 2. FEATURE 1A: FIX THE SCRAPER

### Problem
lib/scraper.ts has Zillow + Redfin scrapers but both are broken/unreliable.
Zillow uses PerimeterX bot detection. Redfin sometimes works but is fragile.

### Root cause (from code review)
- scraper.ts line 40-100: Playwright warmup strategy is correct pattern
  but uses hardcoded Chrome paths that may not exist on deploy target
- Cheerio fallback (line 120+) doesn't work for Zillow (JS-rendered)
- No retry logic on transient failures
- User agent list is from Chrome 124 (outdated, fingerprinted)

### Solution

**File: lib/scraper.ts — REWRITE the scraping core**

Step 1: Update user agents to Chrome 130+ (May 2026 current)
```
const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
];
```

Step 2: Fix Playwright browser detection
- Remove hardcoded Chrome paths
- Use `playwright.chromium.launch()` with bundled Chromium (works on Railway)
- Add `--disable-blink-features=AutomationControlled` launch arg
- Set viewport to 1920x1080 (not headless default 800x600 — triggers bot flags)

Step 3: Redfin strategy (primary — more reliable)
- Navigate to redfin.com first (warmup, let JS load)
- Wait 2s
- Navigate to listing URL
- Wait for `[data-rf-test-id="abp-price"]` selector (Redfin's price element)
- Extract from DOM, not from window.__INITIAL_STATE__ (changes frequently)
- Photos: find all `img[src*="ssl.cdn-redfin.com"]` with width > 400

Step 4: Zillow strategy (fallback)
- Use got-scraping (already in package.json) instead of Playwright for Zillow
- got-scraping rotates TLS fingerprints automatically
- Extract from `<script id="__NEXT_DATA__">` JSON blob
- If blocked: return error with message "Try Redfin URL instead"

Step 5: Photo download + Supabase upload
- Download each photo to tmp/
- Use Sharp to resize to 1920x1080 (cover, attention-based crop)
- Upload to Supabase Storage at `listings/{userId}/{listingId}/photos/{i}.jpg`
- Store the Supabase public URL (not the original CDN URL which expires)

Step 6: Retry logic
- Retry scrape 2x with 3s delay between attempts
- On final failure: return `{ error: "scrape_failed", fallback: "manual_upload" }`

### Files to modify:
- `lib/scraper.ts` — rewrite core scraping functions
- `app/api/scrape/route.ts` — add retry wrapper + better error responses

### Test cases (MUST ALL PASS):
```
TEST 1A-1: Redfin URL → returns ≥5 photos + address + price + beds/baths/sqft
  Input: https://www.redfin.com/CA/San-Jose/[any-active-listing]
  Assert: result.photoUrls.length >= 5
  Assert: result.address is non-empty string
  Assert: result.price is number > 0

TEST 1A-2: Zillow URL → returns ≥3 photos OR returns fallback error
  Input: https://www.zillow.com/homedetails/[any-active-listing]
  Assert: result.photoUrls.length >= 3 OR result.error === "scrape_failed"

TEST 1A-3: Invalid URL → returns 400 error
  Input: https://example.com/not-a-listing
  Assert: HTTP 400, body.error === "Unsupported domain"

TEST 1A-4: Photos are stored in Supabase (not raw CDN URLs)
  Assert: every photo URL starts with process.env.NEXT_PUBLIC_SUPABASE_URL
```

---

## 3. FEATURE 1B: REPLACE KEN BURNS WITH CPU DEPTH-PARALLAX

### Problem
Current Ken Burns (scripts/pipeline.js lines 72-87) produces flat, amateur
slideshow-quality video rated 4/10. Competitors charge $44/mo for depth-parallax
which is 9/10. We need 7-8/10 at $0.

### Solution
Add a Python script (scripts/parallax-cpu.py) that uses:
- Depth Anything V2 Small (ONNX, 24.8M params, Apache-2.0) for depth maps
- OpenCV remap for depth-based pixel displacement
- Renders parallax at ~600ms per 4-second clip on CPU

**NEW FILE: scripts/parallax-cpu.py**

This file already exists in the ZERO_COST_VIDEO_ARCHITECTURE.md doc.
Copy the exact code from that doc. Then make these adjustments:

1. Accept command-line args: image_path, output_path, motion, intensity, duration, fps, width, height
2. Support motion types: dolly, horizontal, circle, zoom, orbital
3. Output h264 MP4 (not raw cv2 VideoWriter mp4v codec)
   - After cv2 renders frames, use ffmpeg to re-encode:
   ```python
   subprocess.run([
     'ffmpeg', '-y', '-i', raw_output,
     '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
     '-pix_fmt', 'yuv420p', '-an', output_path
   ], check=True)
   ```
4. Download ONNX model on first run if not present:
   ```python
   MODEL_URL = "https://github.com/fabio-sim/Depth-Anything-ONNX/releases/download/v2.0.0/depth_anything_v2_vits.onnx"
   MODEL_PATH = os.path.join(os.path.dirname(__file__), 'models', 'depth_anything_v2_vits.onnx')
   ```

**MODIFIED FILE: scripts/pipeline.js**

Replace the Ken Burns clip generation with parallax:

1. Add ROOM_PRESETS array (line ~72, replacing KB_PATTERNS):
```js
const ROOM_PRESETS = [
  { motion: 'dolly',      intensity: 1.5 },  // 0: exterior/cover
  { motion: 'zoom',       intensity: 0.8 },  // 1: entry
  { motion: 'horizontal', intensity: 0.6 },  // 2: living room
  { motion: 'horizontal', intensity: 0.6 },  // 3: dining
  { motion: 'orbital',    intensity: 0.4 },  // 4: kitchen
  { motion: 'orbital',    intensity: 0.4 },  // 5: kitchen 2
  { motion: 'dolly',      intensity: 1.0 },  // 6: bedroom (reverse)
  { motion: 'dolly',      intensity: 1.0 },  // 7: bedroom 2
  { motion: 'circle',     intensity: 0.3 },  // 8: bathroom
  { motion: 'dolly',      intensity: 2.0 },  // 9: backyard
  { motion: 'zoom',       intensity: 0.5 },  // 10: garage
  { motion: 'horizontal', intensity: 0.5 },  // 11: other
];
```

2. Replace the Ken Burns clip generation function.
   Find where zoompan filter is applied and replace with:
```js
async function generateParallaxClip(preprocessedPath, outputPath, index, clipDuration) {
  const preset = ROOM_PRESETS[index % ROOM_PRESETS.length];
  const python = process.platform === 'win32' ? 'python' : 'python3';
  const scriptPath = path.join(__dirname, 'parallax-cpu.py');

  return new Promise((resolve, reject) => {
    const child = require('child_process').spawn(python, [
      scriptPath,
      preprocessedPath,
      outputPath,
      preset.motion,
      String(preset.intensity),
      String(clipDuration),
      '30',   // fps
      '1920', // width
      '1080', // height
    ]);
    child.stdout.on('data', (d) => process.stdout.write(`[parallax] ${d}`));
    child.stderr.on('data', (d) => process.stderr.write(`[parallax:err] ${d}`));
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`parallax exit ${code}`)));
    child.on('error', reject);
  });
}
```

3. Keep Ken Burns as FALLBACK if Python fails:
```js
async function generateClip(preprocessedPath, outputPath, index, clipDuration) {
  try {
    await generateParallaxClip(preprocessedPath, outputPath, index, clipDuration);
  } catch (e) {
    console.warn(`[pipeline] Parallax failed for clip ${index}, falling back to Ken Burns:`, e.message);
    await generateKenBurnsClip(preprocessedPath, outputPath, index, clipDuration);
  }
}
```

### Dependencies to install:
```bash
# Python deps (Railway Dockerfile or buildpack)
pip install opencv-python-headless numpy onnxruntime

# ONNX model (auto-downloaded on first run by parallax-cpu.py)
```

### Files to create:
- `scripts/parallax-cpu.py` — new Python parallax renderer
- `scripts/models/.gitkeep` — model directory (model auto-downloads)

### Files to modify:
- `scripts/pipeline.js` — replace Ken Burns with parallax call + fallback

### Test cases:
```
TEST 1B-1: parallax-cpu.py generates valid MP4 from a JPEG
  Run: python3 scripts/parallax-cpu.py test-photo.jpg test-clip.mp4 dolly 1.0
  Assert: test-clip.mp4 exists
  Assert: ffprobe reports duration ~4s, codec h264, resolution 1920x1080

TEST 1B-2: Each motion type produces different output
  Run 5 times with: dolly, horizontal, circle, zoom, orbital
  Assert: all 5 files exist and have different file sizes (different motion = different bytes)

TEST 1B-3: Pipeline falls back to Ken Burns if Python unavailable
  Temporarily rename parallax-cpu.py → parallax-cpu.py.bak
  Run pipeline
  Assert: video still generates (Ken Burns fallback)
  Rename back

TEST 1B-4: Full pipeline produces parallax video (not Ken Burns)
  Generate a video from a scraped listing
  Assert: visual inspection — foreground objects move differently than background
  (Parallax separates depth layers; Ken Burns moves everything uniformly)
```

---

## 4. FEATURE 1C: CONTENT PACK

### What it is
ONE additional Claude Haiku call per listing that generates:
- 10 hooks (scroll-stopping Reels/TikTok openers)
- 6-scene shot list + script (what to film, what to say)
- 5 caption styles (bold, storytelling, data, casual, luxury)
- 7 platform posts (IG, TikTok, LinkedIn, FB, X, YouTube, email)
- 5 engagement questions (comment-driving)
- 8-12 extracted features from listing data

### Implementation
Follow CONTENT_PACK_PROMPT.md exactly. It has:
- Step 1: SQL migration (1 line)
- Step 2: TypeScript types (lib/types.ts)
- Step 3: Prompt template (prompts/content-pack.ts)
- Step 4: Claude function (lib/claude.ts)
- Step 5: Pipeline integration (scripts/pipeline.js)
- Step 6: API route (app/api/content/pack/route.ts)
- Step 7: UI component (components/dashboard/content-pack.tsx)
- Step 8: Wire into done page + listing detail page
- Step 9: Brand voice profile (app/(dashboard)/dashboard/brand/page.tsx)

### Files to create:
- `prompts/content-pack.ts`
- `app/api/content/pack/route.ts`
- `components/dashboard/content-pack.tsx`

### Files to modify:
- `lib/types.ts` — add ContentPack + ShotScene interfaces
- `lib/claude.ts` — add generateContentPack()
- `scripts/pipeline.js` — add non-blocking content pack call
- `app/(dashboard)/dashboard/new/done/page.tsx` — add Content Pack tab
- `app/(dashboard)/dashboard/listings/[id]/page.tsx` — add Content Pack tab
- `app/(dashboard)/dashboard/brand/page.tsx` — add voice profile textarea

### DB migration:
```sql
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS content_pack JSONB DEFAULT NULL;
ALTER TABLE public.brand_kits ADD COLUMN IF NOT EXISTS voice_profile TEXT DEFAULT NULL;
```

### Test cases:
```
TEST 1C-1: POST /api/content/pack returns valid ContentPack JSON
  Input: { listingId, address: "123 Maple St", city: "Austin", price: 485000, beds: 3, baths: 2, sqft: 1842, style: "modern" }
  Assert: response.contentPack.hooks is array of length 10
  Assert: response.contentPack.shotList is array of length 6
  Assert: response.contentPack.engagementQuestions is array of length 5
  Assert: response.contentPack.captionStyles has keys: bold, storytelling, dataDriven, casual, luxury

TEST 1C-2: Content pack saved to listings.content_pack
  After calling /api/content/pack
  Assert: SELECT content_pack FROM listings WHERE id = $listingId → non-null JSONB

TEST 1C-3: Content Pack tab renders on done page
  Navigate to /dashboard/new/done?jobId=XXX after video completes
  Assert: "Content Pack" tab exists
  Assert: clicking it shows Hooks, Script, Captions, Platforms, Engage sub-tabs
  Assert: copy buttons work (navigator.clipboard.writeText called)

TEST 1C-4: Content pack generation does NOT block video generation
  Generate a video
  Assert: video completes even if content pack Claude call is slow/fails
  Assert: if content pack fails, content_pack column is NULL (not error state)

TEST 1C-5: Fair Housing compliance
  Assert: no content pack output contains "perfect for families", "great schools",
          "safe area", "quiet neighborhood", "exclusive", "walking distance to schools"
```

---

## 5. FEATURE 1D: FILM GRAIN + WARM COLOR GRADE

### What it is
Two FFmpeg filters added to the final assembly step in pipeline.js.
Makes digital footage feel organic and warm (standard real estate color grade).

### Implementation

**File: scripts/pipeline.js**

Find the final FFmpeg assembly step where 16:9 video is output.
Add these filters to the video filter chain:

```js
const CINEMA_FILTERS = [
  // Subtle film grain
  "noise=alls=3:allf=t",
  // Warm real estate color grade
  "eq=saturation=1.12:contrast=1.04:brightness=0.01",
  // Very slight vignette
  "vignette=PI/5",
].join(",");
```

Apply in the final output command:
```js
.videoFilter(CINEMA_FILTERS)
```

### Files to modify:
- `scripts/pipeline.js` — add CINEMA_FILTERS to final assembly

### Test cases:
```
TEST 1D-1: Output video has warm tone (not raw/cold)
  Generate a video
  Extract frame at 5s: ffmpeg -i output.mp4 -ss 5 -frames:v 1 frame.png
  Assert: frame.png exists and is viewable
  Visual: colors should look warm, not clinical/blue

TEST 1D-2: Film grain is subtle (not distracting)
  Visual inspection: grain should be barely noticeable at 1080p
  Assert: file size increased by <15% vs without grain (grain adds noise = larger file)
```

---

## 6. FEATURE 1E: MERGE R2 + CLAUDE + EMAIL INTO PIPELINE.JS

### Problem
workers/video.ts has R2 upload, Claude content, and email notification.
scripts/pipeline.js saves to /public/videos/ (local only).
These must merge so pipeline.js handles everything.

### Implementation

**File: scripts/pipeline.js — ADD these sections:**

1. R2 upload (move from workers/video.ts lines 184-195):
```js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

function getR2Client() {
  const r2Key = process.env.R2_ACCESS_KEY_ID || "";
  if (r2Key.startsWith("placeholder") || !r2Key) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

async function uploadToR2(key, filePath, contentType) {
  const client = getR2Client();
  if (!client) {
    // Fallback: save to /public/videos/ (dev mode)
    const publicDir = path.join(process.cwd(), "public", "videos", jobId);
    fs.mkdirSync(publicDir, { recursive: true });
    fs.copyFileSync(filePath, path.join(publicDir, path.basename(key)));
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    return `${appUrl}/videos/${jobId}/${path.basename(key)}`;
  }
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: fs.readFileSync(filePath),
    ContentType: contentType,
  }));
  return key; // return R2 key, not URL (signed URLs generated on-demand)
}
```

2. After video assembly completes, upload:
```js
const r2Key16x9 = `videos/${userId}/${listingId}/${jobId}-16x9.mp4`;
const r2Key9x16 = `videos/${userId}/${listingId}/${jobId}-9x16.mp4`;
const r2KeyThumb = `videos/${userId}/${listingId}/${jobId}-thumb.jpg`;

const [url16x9, url9x16, urlThumb] = await Promise.all([
  uploadToR2(r2Key16x9, finalPath16x9, "video/mp4"),
  uploadToR2(r2Key9x16, finalPath9x16, "video/mp4"),
  thumbnailPath ? uploadToR2(r2KeyThumb, thumbnailPath, "image/jpeg") : Promise.resolve(""),
]);
```

3. Content Pack call (non-blocking):
```js
// Fire and forget — do NOT await
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
fetch(`${appUrl}/api/content/pack`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-service-key": process.env.SUPABASE_SERVICE_ROLE_KEY },
  body: JSON.stringify({ listingId, address: listing.address, city: listing.city, state: listing.state, price: listing.price, beds: listing.beds, baths: listing.baths, sqft: listing.sqft, style }),
}).catch(e => console.warn("[pipeline] Content pack call failed (non-blocking):", e.message));
```

4. Email notification (non-blocking):
```js
// Only if RESEND_API_KEY is set
if (process.env.RESEND_API_KEY) {
  fetch(`${appUrl}/api/email/video-ready`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-service-key": process.env.SUPABASE_SERVICE_ROLE_KEY },
    body: JSON.stringify({ userId, listingId, address: listing.address }),
  }).catch(e => console.warn("[pipeline] Email failed (non-blocking):", e.message));
}
```

### Files to modify:
- `scripts/pipeline.js` — add R2 upload + content pack call + email

### Files to DELETE:
- `lib/dev-pipeline.ts` — dead code, generate route never calls it

### Files to KEEP but mark as Phase 2:
- `workers/video.ts` — keep for future GPU pipeline, but do NOT call it
- `lib/fal.ts` — keep for future AI video, but do NOT call it

### Test cases:
```
TEST 1E-1: Dev mode (placeholder R2 keys) → saves to /public/videos/
  Assert: /public/videos/{jobId}/16x9.mp4 exists after generation

TEST 1E-2: Prod mode (real R2 keys) → uploads to Cloudflare R2
  Assert: R2 bucket contains videos/{userId}/{listingId}/{jobId}-16x9.mp4
  Assert: video_jobs row has url_16x9 set to R2 key

TEST 1E-3: Content pack call fires but doesn't block video
  Assert: video completes in <3 minutes regardless of content pack status

TEST 1E-4: lib/dev-pipeline.ts is deleted
  Assert: file does not exist
  Assert: no import of dev-pipeline anywhere in codebase
```

---

## 7. DEPLOYMENT

### 7A: Vercel (Frontend)

**Constraints**: User has paid Vercel account with another app. Stay within plan.

Steps:
1. Connect GitHub repo (anyappx/listingos) to Vercel
2. Set framework preset to Next.js
3. Add ALL environment variables from .env.local to Vercel:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - ANTHROPIC_API_KEY
   - STRIPE_SECRET_KEY (test key for now)
   - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
   - STRIPE_WEBHOOK_SECRET
   - R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
   - PEXELS_API_KEY
   - GOOGLE_PLACES_API_KEY (if set)
   - RESEND_API_KEY (if set)
   - NEXT_PUBLIC_APP_URL (set to Vercel deployment URL)
4. Build settings: default Next.js (no changes)
5. Ignore scripts/ and workers/ in Vercel build (they run on Railway)

**IMPORTANT**: Vercel serverless functions have 10s timeout (hobby) or 60s (pro).
The video pipeline CANNOT run on Vercel. It runs on Railway.
The generate route must spawn pipeline.js on Railway, not on Vercel.

**Architecture for deploy:**
- Vercel: serves Next.js frontend + API routes (except /api/generate)
- Railway: runs pipeline.js as a long-running worker process
- Communication: /api/generate writes job to Supabase → Railway polls Supabase for new jobs → runs pipeline.js

### 7B: Railway (Pipeline Worker)

Create a new Railway service:
1. Connect same GitHub repo
2. Set start command: `node scripts/worker-poll.js`
3. Add same environment variables
4. Add Python buildpack (for parallax-cpu.py):
   - Nixpacks will auto-detect requirements.txt
   - Create `requirements.txt`:
     ```
     opencv-python-headless==4.10.0.84
     numpy==2.0.2
     onnxruntime==1.19.2
     ```
5. Install ffmpeg: add to railway.toml or Dockerfile
   ```toml
   [build]
   nixpacksPlan.phases.setup.nixPkgs = ["ffmpeg"]
   ```

**NEW FILE: scripts/worker-poll.js**
A simple Supabase polling worker (avoids Redis/BullMQ on Railway free tier):
```js
#!/usr/bin/env node
/**
 * Polls Supabase for queued video jobs and runs pipeline.js.
 * Simpler than BullMQ — no Redis needed.
 * Runs on Railway as a long-running process.
 */
const { createClient } = require("@supabase/supabase-js");
const { spawn } = require("child_process");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const POLL_INTERVAL = 5000; // 5 seconds
let isProcessing = false;

async function pollForJobs() {
  if (isProcessing) return;

  const { data: job } = await supabase
    .from("video_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (!job) return;

  isProcessing = true;
  console.log(`[worker] Found job ${job.id}, starting pipeline...`);

  // Mark as processing to prevent double-pickup
  await supabase.from("video_jobs").update({ status: "processing" }).eq("id", job.id);

  const scriptPath = path.join(__dirname, "pipeline.js");
  const child = spawn(process.execPath, [
    scriptPath,
    job.id,
    job.listing_id,
    job.user_id,
    String(job.duration_seconds || 30),
    job.style || "modern",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  child.stdout.on("data", (d) => process.stdout.write(`[pipeline] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[pipeline:err] ${d}`));

  child.on("close", (code) => {
    console.log(`[worker] Pipeline exited with code ${code}`);
    isProcessing = false;
  });

  child.on("error", (err) => {
    console.error(`[worker] Pipeline spawn error:`, err.message);
    isProcessing = false;
  });
}

// Poll loop
setInterval(pollForJobs, POLL_INTERVAL);
console.log(`[worker] Polling for jobs every ${POLL_INTERVAL / 1000}s...`);
```

**MODIFIED FILE: app/api/generate/route.ts**
Remove the dev/prod split. Always insert job into Supabase with status "queued".
Railway worker-poll.js will pick it up.

Replace lines 87-104:
```ts
// Remove dev mode spawn + prod BullMQ enqueue
// Just insert the job row (already done above) and return
// Railway worker polls Supabase and picks up queued jobs

return NextResponse.json({ jobId, estimatedSeconds: 120 });
```

### 7C: Cloudflare R2

1. Create Cloudflare account (if not exists)
2. Go to R2 → Create bucket → name: `listingos-videos`
3. R2 → Manage R2 API Tokens → Create API Token → Object Read & Write
4. Copy: Account ID, Access Key ID, Secret Access Key
5. Add to Vercel + Railway env vars
6. Free tier: 10GB storage, 10M reads, 1M writes/month

### Test cases:
```
TEST 7-1: Vercel frontend loads at https://listingos.vercel.app (or custom domain)
  Assert: landing page renders
  Assert: /login page renders
  Assert: /signup page renders

TEST 7-2: Railway worker is running and polling
  Assert: Railway logs show "[worker] Polling for jobs every 5s..."

TEST 7-3: Full end-to-end on production
  1. Sign up at Vercel URL
  2. Paste a Redfin listing URL
  3. Photos appear + listing data extracted
  4. Pick style + music → click Generate
  5. Loading screen shows progress (polling /api/job/[id])
  6. Video completes within 5 minutes
  7. Both 16:9 and 9:16 downloads work
  8. Content Pack tab shows hooks/scripts/captions
  9. Public listing page at /l/[slug] loads with video
  10. Lead capture form submits successfully

TEST 7-4: Video is stored on R2 (not local /public/videos/)
  Assert: R2 bucket has the video file
  Assert: video plays when accessed via signed URL
```

---

## 8. FILES SUMMARY

### NEW FILES (create these):
| File | Purpose |
|------|---------|
| `scripts/parallax-cpu.py` | CPU depth-parallax renderer |
| `scripts/models/.gitkeep` | ONNX model directory |
| `scripts/worker-poll.js` | Supabase polling worker for Railway |
| `prompts/content-pack.ts` | Content pack prompt template |
| `app/api/content/pack/route.ts` | Content pack API endpoint |
| `components/dashboard/content-pack.tsx` | Content pack UI component |
| `requirements.txt` | Python dependencies for Railway |
| `railway.toml` | Railway config (ffmpeg, Python) |

### MODIFIED FILES (edit these):
| File | What changes |
|------|-------------|
| `lib/scraper.ts` | Rewrite scraper core (UA, Playwright, Redfin/Zillow strategy) |
| `app/api/scrape/route.ts` | Add retry wrapper |
| `scripts/pipeline.js` | Replace Ken Burns → parallax, add R2 upload, add cinema filters, add content pack call |
| `app/api/generate/route.ts` | Remove dev/prod split, always write to Supabase |
| `lib/types.ts` | Add ContentPack, ShotScene interfaces |
| `lib/claude.ts` | Add generateContentPack() |
| `app/(dashboard)/dashboard/new/done/page.tsx` | Add Content Pack tab |
| `app/(dashboard)/dashboard/listings/[id]/page.tsx` | Add Content Pack tab |
| `app/(dashboard)/dashboard/brand/page.tsx` | Add voice profile textarea |

### DELETED FILES:
| File | Why |
|------|-----|
| `lib/dev-pipeline.ts` | Dead code — never called |

### UNTOUCHED FILES (do NOT modify):
- `workers/video.ts` — Phase 2 (GPU pipeline)
- `lib/fal.ts` — Phase 2 (AI video)
- `lib/ffmpeg.ts` — Phase 2 (used by workers/video.ts)
- All UI pages except the ones listed above
- `app/page.tsx` (landing page) — works fine as-is
- All shadcn/ui components

---

## 9. EXECUTION ORDER

**Do these in EXACTLY this order. Run test cases after EACH step.**

```
STEP 1: Run DB migrations (2 SQL ALTER TABLE statements)
        → Verify columns exist in Supabase dashboard

STEP 2: Delete lib/dev-pipeline.ts
        → Verify no import errors: npm run typecheck

STEP 3: Fix scraper (lib/scraper.ts + app/api/scrape/route.ts)
        → Run TEST 1A-1 through 1A-4

STEP 4: Create scripts/parallax-cpu.py + scripts/models/.gitkeep
        → Run TEST 1B-1, 1B-2

STEP 5: Modify scripts/pipeline.js (parallax + cinema filters + R2 + content pack)
        → Run TEST 1B-3, 1B-4, 1D-1, 1D-2

STEP 6: Create content pack files (prompts, API route, UI component)
        → Run TEST 1C-1 through 1C-5

STEP 7: Wire content pack into done page + listing detail page
        → Visual inspection in browser

STEP 8: Modify app/api/generate/route.ts (remove dev/prod split)
        → Run npm run typecheck
        → Run npm run build

STEP 9: Create deployment files (worker-poll.js, requirements.txt, railway.toml)

STEP 10: Full local end-to-end test
         → Paste Redfin URL → scrape → customize → generate → video + content pack

STEP 11: Deploy to Vercel + Railway + R2
         → Run TEST 7-1 through 7-4

STEP 12: Production end-to-end test
         → Full flow on live URLs with real Redfin listing
```

---

## 10. DEFINITION OF DONE

**Claude Code: You are NOT done until ALL of these are true.**

### Build checks:
- [ ] `npm run typecheck` — zero errors
- [ ] `npm run lint` — zero errors
- [ ] `npm run build` — builds successfully
- [ ] No TypeScript `any` types added (use proper types)
- [ ] No hardcoded API keys anywhere (grep for sk-, pk-, re_, AIza, placeholder)

### File checks:
- [ ] `lib/dev-pipeline.ts` is deleted
- [ ] `scripts/parallax-cpu.py` exists and is executable
- [ ] `scripts/worker-poll.js` exists
- [ ] `requirements.txt` exists with Python deps
- [ ] `railway.toml` exists with ffmpeg nixpkg

### Functional checks (must run and pass):
- [ ] TEST 1A-1: Redfin scrape returns ≥5 photos
- [ ] TEST 1A-3: Invalid URL returns 400
- [ ] TEST 1A-4: Photos stored in Supabase
- [ ] TEST 1B-1: parallax-cpu.py generates valid MP4
- [ ] TEST 1B-2: Different motions produce different outputs
- [ ] TEST 1C-1: Content pack API returns valid JSON with correct array lengths
- [ ] TEST 1C-4: Content pack doesn't block video generation
- [ ] TEST 1C-5: No Fair Housing violations in content

### Deployment checks:
- [ ] Vercel: frontend loads, auth works, dashboard renders
- [ ] Railway: worker is polling, picks up queued jobs
- [ ] R2: videos upload successfully
- [ ] Full end-to-end: Redfin URL → video + content pack on production

### Security checks:
- [ ] All API routes check auth (except /api/leads, /api/webhooks/*)
- [ ] Stripe webhook verifies signature
- [ ] Supabase RLS enabled on all tables
- [ ] R2 videos served via signed URLs (not public)
- [ ] Rate limiting on /api/scrape (5 req/min per user)

**If ANY checkbox above is unchecked, you are NOT done. Keep going.**
