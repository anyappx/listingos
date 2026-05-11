# ListingOS — Full Diagnostic Report

**Date**: May 11, 2026
**Repo**: github.com/anyappx/listingos (latest commit reviewed)

---

## DIAGNOSIS: 12 Blocking Bugs

Every feature that "doesn't work" traces back to one of these 12 root causes.

---

### BUG 1: ONNX Model Missing — Parallax Can't Run

**Symptom**: Video generation fails or falls back to flat Ken Burns
**Root cause**: `scripts/models/` directory doesn't exist in repo. The depth model
file `depth_anything_v2_vits.onnx` (25MB) was never committed or auto-downloaded.

**Where it breaks**: `scripts/parallax-cpu.py` line 169:
```python
if not os.path.exists(MODEL_PATH):
    print(f"ERROR: depth model not found at {MODEL_PATH}", file=sys.stderr)
    sys.exit(1)  # ← CRASHES
```

**Fix**: Add auto-download to parallax-cpu.py:
```python
MODEL_URL = "https://github.com/fabio-sim/Depth-Anything-ONNX/releases/download/v2.0.0/depth_anything_v2_vits.onnx"

def ensure_model():
    if not os.path.exists(MODEL_PATH):
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        print(f"[parallax] Downloading depth model...", flush=True)
        import urllib.request
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print(f"[parallax] Model saved to {MODEL_PATH}", flush=True)
```
Call `ensure_model()` at the top of `main()`.

**Files**: `scripts/parallax-cpu.py`
**Effort**: 10 minutes

---

### BUG 2: Upload Requires Listing First — Can't Upload Without Scraping

**Symptom**: "Upload photos" dropzone does nothing if scraping failed
**Root cause**: `app/(dashboard)/dashboard/new/page.tsx` line 127:
```ts
const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!listing) return;  // ← SILENTLY RETURNS if no listing exists
```
The `listing` state is only set after a successful scrape. If scraping fails,
`listing` is null, and the dropzone silently refuses all files.

**Fix**: Allow manual upload WITHOUT scraping. Create a "manual listing" row
when agent uploads photos directly:
```ts
const onDrop = useCallback(async (acceptedFiles: File[]) => {
    let currentListing = listing;
    // Create listing on first manual upload if none exists
    if (!currentListing) {
        const listingId = crypto.randomUUID();
        const slug = `manual-${listingId.slice(0, 8)}`;
        const { error } = await supabase.from("listings").insert({
            id: listingId, user_id: user.id, slug,
            address: "", city: "", state: "", zip: "",
            photos: [],
        });
        if (error) { toast.error("Failed to create listing"); return; }
        currentListing = { listingId, slug, ... };
        setListing(currentListing);
    }
    // ... rest of upload logic using currentListing
```

**Files**: `app/(dashboard)/dashboard/new/page.tsx`
**Effort**: 30 minutes

---

### BUG 3: Supabase Storage Bucket Not Created

**Symptom**: Photo uploads fail silently (no error shown to user)
**Root cause**: The code uses `supabase.storage.from("listing-photos")` but
this bucket must be manually created in Supabase dashboard.

**Fix**: In Supabase dashboard:
1. Go to Storage → New bucket
2. Name: `listing-photos`
3. Public: YES (photos need public URLs for video pipeline)
4. File size limit: 15MB
5. Allowed MIME types: `image/jpeg, image/png, image/webp`

Also add RLS policy:
```sql
CREATE POLICY "Users can upload to their own listing folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'listing-photos');

CREATE POLICY "Anyone can read listing photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing-photos');
```

**Files**: Supabase dashboard (not code)
**Effort**: 5 minutes

---

### BUG 4: Worker Not Running — Jobs Stay "Queued" Forever

**Symptom**: Agent clicks Generate → loading screen → spins forever → nothing happens
**Root cause**: `app/api/generate/route.ts` inserts a job with status "queued" (line 62).
`scripts/worker-poll.js` polls Supabase for queued jobs and spawns pipeline.js.
**But nobody told the user to run the worker.**

On local dev, agent needs TWO terminal tabs:
```
Tab 1: npm run dev          # Next.js frontend
Tab 2: node scripts/worker-poll.js  # Video worker
```

**Fix (for local dev)**: Add to package.json scripts:
```json
"dev:all": "npm run dev & node scripts/worker-poll.js"
```
And document in README.

**Fix (for production)**: Worker runs on Railway as a separate service.
But until Railway is set up, the worker must be running locally.

**Files**: `package.json`, `README.md`
**Effort**: 5 minutes

---

### BUG 5: Zillow Scraper Blocked

**Symptom**: Zillow URLs return 0 photos and empty data
**Root cause**: `lib/scraper.ts` lines 49-61 try hardcoded Chrome paths:
```ts
const executablePaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
];
```
If none exist (common on deploy), `executablePath` is undefined.
Playwright then uses bundled Chromium, which Zillow detects and blocks.

Even with Chrome, Zillow's PerimeterX bot detection blocks most automated requests.
The fallback (line 393-404) returns empty data silently.

**Fix**: Make Zillow failure LOUD and helpful:
```ts
// In scrapeUrl(), change the Zillow catch:
catch (err) {
    console.warn("[scraper] Zillow blocked:", err);
    throw new Error(
        "Zillow blocked this request. Please use a Redfin URL instead, " +
        "or upload photos manually."
    );
}
```
Don't silently return empty data. Tell the agent what happened.

**Files**: `lib/scraper.ts`
**Effort**: 10 minutes

---

### BUG 6: Python Not Installed / Not Configured

**Symptom**: Pipeline crashes when trying to run parallax-cpu.py
**Root cause**: Python 3, opencv, numpy, onnxruntime may not be installed.
The pipeline just crashes with no helpful error.

**Fix**: Add a Python check at pipeline.js startup:
```js
// At the top of pipeline.js main():
try {
    require("child_process").execSync("python3 --version", { stdio: "pipe" });
    require("child_process").execSync("python3 -c \"import cv2; import numpy; import onnxruntime\"", { stdio: "pipe" });
} catch (e) {
    console.error("[pipeline] Python dependencies missing. Run:");
    console.error("  pip3 install opencv-python-headless numpy onnxruntime");
    console.error("  Or: pip3 install -r requirements.txt");
    // Continue with Ken Burns fallback instead of crashing
}
```

**Files**: `scripts/pipeline.js`
**Effort**: 10 minutes

---

### BUG 7: Video Downloads Don't Work on Deployed App

**Symptom**: "Download" buttons open empty page or 404
**Root cause**: Videos are saved to `/public/videos/{jobId}/` which is local filesystem.
On Vercel, this path doesn't persist between deployments. On Railway, the filesystem
is ephemeral.

The pipeline has R2 upload code (line 684) but R2 keys are likely placeholder,
so it falls back to local /public/videos/.

**Fix**: Must set up real R2 keys (free tier). See BUG 8.

For local dev without R2, the /public/videos/ path DOES work because Next.js
serves static files from /public. But the user must:
1. Ensure `/public/videos/` directory exists
2. Be aware videos disappear on `npm run build` (cleaned)

**Files**: None (infrastructure setup)
**Effort**: 15 minutes to set up R2

---

### BUG 8: R2 Not Configured

**Symptom**: All video storage falls back to local, which breaks on deploy
**Root cause**: R2 env vars are placeholder or missing.

**Fix**: Set up Cloudflare R2:
1. https://dash.cloudflare.com → R2 → Create bucket → "listingos-videos"
2. R2 → Manage R2 API Tokens → Create API Token (Read/Write)
3. Add to .env.local:
```
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_key_id
R2_SECRET_ACCESS_KEY=your_secret
R2_BUCKET_NAME=listingos-videos
```
4. Free tier: 10GB storage, 10M reads, 1M writes/month

**Files**: `.env.local`
**Effort**: 10 minutes

---

### BUG 9: Demo Listing Doesn't Actually Create DB Row

**Symptom**: Agent clicks "Try Demo" → sees sample data → clicks Generate → fails
**Root cause**: `loadDemoListing()` (line 107-123) only sets React state:
```ts
function loadDemoListing() {
    setListing({ listingId: "demo-listing-001", ... });
    setPhotos([...]);  // URLs point to images that don't exist
    // NEVER creates a row in listings table
    // NEVER uploads real photos to Supabase storage
```
When Generate is called, it checks `listings.eq("id", listingId)` → not found → 404.

**Fix**: Demo listing needs to:
1. Insert a real listing row in Supabase
2. Use real stock photos (download from Pexels, store in Supabase)
3. Return a real listingId

**Files**: `app/(dashboard)/dashboard/new/page.tsx`
**Effort**: 1 hour

---

### BUG 10: No .env.example — User Doesn't Know What Keys Are Needed

**Symptom**: User runs the app, nothing works, no idea why
**Root cause**: No `.env.example` file in repo.

**Fix**: Create `.env.example`:
```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
ANTHROPIC_API_KEY=sk-ant-...

# Required for video storage (free tier)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=listingos-videos

# Required for payments (use test keys for dev)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SOLO_PRICE_ID=price_...
STRIPE_AGENT_PRICE_ID=price_...

# Optional (works without these)
PEXELS_API_KEY=
RESEND_API_KEY=
GOOGLE_PLACES_API_KEY=

# Auto-set
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Files**: `.env.example` (NEW)
**Effort**: 5 minutes

---

### BUG 11: FFmpeg Not Installed

**Symptom**: Pipeline crashes at any FFmpeg operation
**Root cause**: `ffmpeg-static` npm package is installed (provides binary)
but line 27 in pipeline.js:
```js
if (ffmpegStatic) ffmpegLib.setFfmpegPath(ffmpegStatic);
```
This should work. BUT ffmpeg-static may not have the right binary for
the current platform (especially Apple Silicon or Linux ARM).

**Fix**: Check FFmpeg at startup:
```js
try {
    require("child_process").execSync("ffmpeg -version", { stdio: "pipe" });
} catch {
    if (!ffmpegStatic) {
        console.error("[pipeline] FFmpeg not found. Install: brew install ffmpeg (mac) or apt install ffmpeg (linux)");
        process.exit(1);
    }
}
```

**Files**: `scripts/pipeline.js`
**Effort**: 5 minutes

---

### BUG 12: Redfin Scraper Fragile — Selectors Change

**Symptom**: Redfin scrape returns partial data (no address, no price)
**Root cause**: Redfin changes their DOM selectors frequently.
The scraper uses `[data-rf-test-id="abp-price"]` and similar selectors
that may have changed since the code was written.

**Fix**: Add multiple fallback strategies:
1. DOM selectors (current)
2. JSON-LD structured data
3. `__NEXT_DATA__` or Redfin's `window.__reactServerState`
4. Regex extraction from HTML as last resort

Also: log exactly what was extracted so debugging is easier:
```ts
console.log("[scraper] Extracted:", JSON.stringify({
    address: data.address, price: data.price,
    photoCount: data.photoUrls.length
}));
```

**Files**: `lib/scraper.ts`
**Effort**: 1 hour

---

## FIX ORDER (do this EXACTLY)

```
STEP 1 (5 min):  Create .env.example + verify .env.local has all keys
STEP 2 (5 min):  Create Supabase storage bucket "listing-photos" + RLS
STEP 3 (10 min): Set up Cloudflare R2 (free) + add real keys to .env.local
STEP 4 (10 min): Fix parallax-cpu.py — add auto-download for ONNX model
STEP 5 (5 min):  Install Python deps: pip3 install -r requirements.txt
STEP 6 (10 min): Fix Zillow scraper — loud errors instead of silent fail
STEP 7 (30 min): Fix upload — allow manual upload WITHOUT scraping first
STEP 8 (10 min): Add Python + FFmpeg checks to pipeline.js startup
STEP 9 (5 min):  Add "dev:all" script to package.json
STEP 10 (5 min): Start worker: node scripts/worker-poll.js

→ TEST: Paste a Redfin URL → scrape → customize → generate → video plays
→ TEST: Upload photos manually → customize → generate → video plays
```

**Total: ~1.5 hours to get everything working.**

---

## WHY CLAUDE CODE DIDN'T FIX THESE

Claude Code built the code structure correctly but missed:
1. **Infrastructure setup** — bucket creation, R2 keys, model downloads
2. **Runtime dependencies** — Python, FFmpeg, ONNX model are external
3. **Two-process requirement** — Next.js + worker must run simultaneously
4. **Silent failures** — errors swallowed by catch blocks, no user feedback
5. **State dependencies** — upload requires listing first (logical bug)

The code LOOKS complete but the ENVIRONMENT isn't set up.
80% of the bugs are environment/config, not code logic.
