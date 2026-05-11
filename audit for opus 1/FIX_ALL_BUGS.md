# FIX ALL 12 BUGS — Paste Into Claude Code

Read CLAUDE.md first. Then fix these 12 bugs IN ORDER.
After EACH fix, tell me "Bug X fixed. Testing..." and run the test.
Do NOT move to the next bug until the current one passes.

---

## Bug 1: ONNX Model Auto-Download

File: `scripts/parallax-cpu.py`

Add auto-download at the top of main(). Insert this BEFORE the model existence check:

```python
MODEL_URL = "https://github.com/fabio-sim/Depth-Anything-ONNX/releases/download/v2.0.0/depth_anything_v2_vits.onnx"

def ensure_model():
    if os.path.exists(MODEL_PATH):
        return
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    print(f"[parallax] Downloading depth model (~25MB)...", flush=True)
    import urllib.request
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    print(f"[parallax] Model ready at {MODEL_PATH}", flush=True)
```

Call `ensure_model()` as the first line of `main()`, BEFORE the existing `if not os.path.exists(MODEL_PATH)` check. Then remove that old check since ensure_model handles it.

Also create the directory: `mkdir -p scripts/models`

Test: `python3 scripts/parallax-cpu.py` should print "Downloading..." on first run.

---

## Bug 2: Allow Upload Without Scraping First

File: `app/(dashboard)/dashboard/new/page.tsx`

Find the `onDrop` callback (around line 126). Change the guard:

OLD: `if (!listing) return;`

NEW: If no listing exists, create one on-the-fly for manual uploads.

The key insight: when agent uploads photos without scraping, we still need a listing row in the DB. Create it with empty address/price (agent fills in later).

```ts
const onDrop = useCallback(async (acceptedFiles: File[]) => {
    let currentListing = listing;

    // Create listing row for manual uploads if none exists
    if (!currentListing) {
        const listingId = crypto.randomUUID();
        const slug = `upload-${listingId.slice(0, 8)}`;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { toast.error("Please log in"); return; }

        const admin = createAdminClient ? createAdminClient() : supabase;
        const { error } = await supabase.from("listings").insert({
            id: listingId,
            user_id: user.id,
            slug,
            address: "",
            city: "",
            state: "",
            zip: "",
            photos: [],
        });

        if (error) {
            toast.error("Failed to create listing: " + error.message);
            return;
        }

        currentListing = {
            listingId,
            slug,
            address: "",
            city: "",
            price: null,
            beds: null,
            baths: null,
            sqft: null,
            description: "",
            photos: [],
            warnings: [],
            noPhotos: true,
        };
        setListing(currentListing);
        toast.info("Listing created — add your details below");
    }

    // ... rest of upload logic, but use currentListing.listingId instead of listing.listingId
```

IMPORTANT: Make sure the Supabase insert uses the browser client (not admin), because this runs client-side. Use RLS to allow authenticated users to insert their own listings.

Test: Without scraping any URL, drag photos into dropzone → photos appear in grid.

---

## Bug 3: .env.example

Create NEW file: `.env.example`

```bash
# ── REQUIRED ──────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
ANTHROPIC_API_KEY=sk-ant-...

# ── VIDEO STORAGE (Cloudflare R2 — free tier) ─────────
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=listingos-videos

# ── PAYMENTS (use sk_test_ for dev) ───────────────────
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SOLO_PRICE_ID=price_...
STRIPE_AGENT_PRICE_ID=price_...

# ── OPTIONAL (app works without these) ────────────────
PEXELS_API_KEY=
RESEND_API_KEY=
GOOGLE_PLACES_API_KEY=

# ── AUTO-SET ──────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Test: File exists at repo root.

---

## Bug 4: Zillow — Loud Failure Instead of Silent Empty

File: `lib/scraper.ts`

Find the `scrapeUrl` function (around line 389). Change the Zillow catch block:

OLD:
```ts
catch (err) {
    console.warn("[scraper] Zillow scrape failed, falling back to URL parse:", err);
    const fromUrl = parseZillowUrl(url);
    return {
        address: fromUrl.address || "",
        // ... returns empty data silently
    };
}
```

NEW:
```ts
catch (err) {
    console.warn("[scraper] Zillow blocked:", err);
    // Extract what we can from URL, but throw to show user the real error
    const fromUrl = parseZillowUrl(url);
    if (fromUrl.address) {
        // Got partial data from URL — return it but with warning
        return {
            address: fromUrl.address || "",
            city: fromUrl.city || "",
            state: fromUrl.state || "",
            zip: fromUrl.zip || "",
            price: null, beds: null, baths: null, sqft: null,
            description: "",
            photoUrls: [],
            warnings: [{ photoIndex: -1, warning: "Zillow blocked automated access. Photos must be uploaded manually." }],
        };
    }
    // Complete failure — throw so the API route shows a clear error
    throw new Error(
        "Zillow blocked this request. Try a Redfin URL instead, or upload photos manually."
    );
}
```

Test: Paste Zillow URL → see clear error message (not empty page).

---

## Bug 5: Python + FFmpeg Startup Checks

File: `scripts/pipeline.js`

Add at the very top of the main function (the async IIFE at the bottom of the file), BEFORE any processing:

```js
// ─── Dependency checks ──────────────────────────────────────────────────────
function checkDependencies() {
    const { execSync } = require("child_process");
    const python = process.platform === "win32" ? "python" : "python3";

    // Check Python
    try {
        execSync(`${python} --version`, { stdio: "pipe" });
    } catch {
        console.error("[pipeline] ERROR: Python 3 not found.");
        console.error("  Install: brew install python3 (mac) or apt install python3 (linux)");
        console.error("  Pipeline will use Ken Burns fallback (lower quality).");
    }

    // Check Python packages
    try {
        execSync(`${python} -c "import cv2; import numpy; import onnxruntime"`, { stdio: "pipe" });
    } catch {
        console.error("[pipeline] WARNING: Python packages missing.");
        console.error("  Run: pip3 install -r requirements.txt");
        console.error("  Pipeline will use Ken Burns fallback (lower quality).");
    }

    // Check FFmpeg
    try {
        execSync("ffmpeg -version", { stdio: "pipe" });
    } catch {
        if (!ffmpegStatic) {
            console.error("[pipeline] ERROR: FFmpeg not found and ffmpeg-static failed.");
            console.error("  Install: brew install ffmpeg (mac) or apt install ffmpeg (linux)");
            process.exit(1);
        }
    }
}

checkDependencies();
```

Test: Remove ffmpeg temporarily → see clear error message.

---

## Bug 6: Dev Script for Running Both Processes

File: `package.json`

Add to "scripts":
```json
"dev:worker": "node scripts/worker-poll.js",
"dev:all": "next dev & node scripts/worker-poll.js"
```

NOTE: `&` works on Mac/Linux. For Windows, use `concurrently`:
```json
"dev:all": "npx concurrently \"next dev\" \"node scripts/worker-poll.js\""
```

Test: `npm run dev:all` starts both Next.js and worker.

---

## Bug 7: Demo Listing — Create Real DB Row

File: `app/(dashboard)/dashboard/new/page.tsx`

The current `loadDemoListing()` function just sets state. It needs to:
1. Create a real listing row in Supabase
2. Use real sample photos (from Pexels, already downloaded to Supabase storage)

Replace the function:

```ts
async function loadDemoListing() {
    setImporting(true);
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { toast.error("Please log in"); return; }

        const listingId = crypto.randomUUID();
        const slug = `demo-${listingId.slice(0, 8)}`;

        // Demo listing data
        const demoData = {
            id: listingId,
            user_id: user.id,
            slug,
            address: "742 Evergreen Terrace",
            city: "Austin",
            state: "TX",
            zip: "78701",
            price: 485000,
            beds: 3,
            baths: 2,
            sqft: 1842,
            raw_description: "Charming 3-bedroom home in the heart of Austin",
            source_url: null,
            photos: [],
        };

        const { error } = await supabase.from("listings").insert(demoData);
        if (error) { toast.error("Failed to create demo: " + error.message); return; }

        // Use placeholder photos from Pexels (these are reliable public URLs)
        const demoPhotos = [
            "https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg?w=1920",
            "https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?w=1920",
            "https://images.pexels.com/photos/2724749/pexels-photo-2724749.jpeg?w=1920",
            "https://images.pexels.com/photos/2062426/pexels-photo-2062426.jpeg?w=1920",
            "https://images.pexels.com/photos/1643384/pexels-photo-1643384.jpeg?w=1920",
            "https://images.pexels.com/photos/3935350/pexels-photo-3935350.jpeg?w=1920",
        ];

        const photos = demoPhotos.map((url, i) => ({
            url,
            order: i,
            is_cover: i === 0,
        }));

        await supabase.from("listings").update({ photos }).eq("id", listingId);

        setListing({
            listingId, slug,
            address: demoData.address, city: demoData.city,
            price: demoData.price, beds: demoData.beds,
            baths: demoData.baths, sqft: demoData.sqft,
            description: demoData.raw_description || "",
            photos, warnings: [], noPhotos: false,
        });
        setPhotos(photos);
        setEditAddress(demoData.address);
        setEditPrice(String(demoData.price));
        setEditBeds(String(demoData.beds));
        setEditBaths(String(demoData.baths));
        setEditSqft(String(demoData.sqft));
        toast.success("Demo listing loaded!");
    } catch (err) {
        toast.error("Demo failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
        setImporting(false);
    }
}
```

NOTE: These Pexels URLs are publicly accessible and don't require download to Supabase storage. The pipeline's downloadFile function can fetch them directly.

Test: Click "Try Demo" → photos load → click Generate → video generates.

---

## Bug 8: Pipeline — Store Photos Locally Before Processing

File: `scripts/pipeline.js`

The pipeline downloads photos from their URLs. If photos are Pexels URLs or Supabase URLs, they need to be accessible. Check the downloadFile function works with HTTPS URLs.

The existing downloadFile (line 88) already handles HTTPS. But verify it handles redirects (Pexels 302s). The current code handles redirects on line 93. Good.

However, for Supabase storage URLs: make sure the bucket is public OR the pipeline uses a service role key. The current pipeline creates a Supabase client with SERVICE_ROLE_KEY (line 32-36), so it can access private buckets. Good.

No code change needed here — but verify the Supabase storage bucket exists (Bug 3 in the infrastructure section).

---

## Bug 9: Pipeline Upload — Fallback Path Must Work

File: `scripts/pipeline.js`

Find the `uploadOutput` function (around line 684). Verify the dev fallback works:

The current code at line 684+ already has a dev/R2 split. Check that:
1. Dev mode creates the directory: `fs.mkdirSync(publicDir, { recursive: true })`
2. The URL returned uses the correct base URL
3. Videos table gets the correct URL

Look at the videos table insert (around line 960-995) and verify the URL stored is accessible from the browser.

For local dev: URLs should be `/videos/{jobId}/16x9.mp4` (served by Next.js static).
For R2: URLs should be R2 keys that get signed on-demand.

Verify the done page's job polling endpoint (`/api/job/[id]`) correctly handles both cases. Check line 58+ in `app/api/job/[id]/route.ts`:
- If URL starts with `/` or `http://localhost` → serve directly
- If URL is an R2 key → generate signed URL

Test: Generate a video locally → done page shows playable video.

---

## Bug 10: RLS Policies — Ensure Listings Insert Works Client-Side

For Bug 2 (manual upload) to work, the user needs to insert a listing from the client. Check that listings table has an INSERT policy for authenticated users:

```sql
-- Run in Supabase SQL Editor:
CREATE POLICY IF NOT EXISTS "users can insert own listings"
ON public.listings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
```

Also verify the existing policies allow SELECT and UPDATE for own rows.

Test: From browser console, insert a listing row → should succeed.

---

## Bug 11: Content Pack Not Wired In Pipeline

File: `scripts/pipeline.js`

Check if the content pack generation call exists. Search for "content/pack" in pipeline.js.

If it's missing, add non-blocking call after video assembly completes (around line 950, after "Uploading" progress update):

```js
// Fire content pack generation (non-blocking — video already done at this point)
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
try {
    fetch(`${appUrl}/api/content/pack`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-service-key": process.env.SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
            listingId,
            address: listing.address || "",
            city: listing.city || "",
            state: listing.state || "",
            price: listing.price,
            beds: listing.beds,
            baths: listing.baths,
            sqft: listing.sqft,
            features: listing.raw_description || "",
            style: style || "modern",
        }),
    }).catch(e => console.warn("[pipeline] Content pack call failed (non-blocking):", e.message));
} catch {}
```

DO NOT await this. Video is already complete. Content pack can generate async.

---

## Bug 12: README — Document How to Run

File: `README.md`

Replace with clear setup instructions:

```markdown
# ListingOS

## Quick Start

1. Copy environment file:
   ```bash
   cp .env.example .env.local
   # Fill in your keys (see .env.example for descriptions)
   ```

2. Create Supabase storage bucket:
   - Go to Supabase dashboard → Storage → New bucket
   - Name: `listing-photos`, Public: Yes

3. Run database migrations:
   - Go to Supabase SQL Editor
   - Paste and run `DB_SCHEMA.sql`

4. Install dependencies:
   ```bash
   npm install
   pip3 install -r requirements.txt
   ```

5. Start the app (runs Next.js + video worker):
   ```bash
   npm run dev:all
   ```

6. Open http://localhost:3000

## Troubleshooting

**Video won't generate?**
- Make sure worker is running: `node scripts/worker-poll.js`
- Check terminal for errors

**Photos won't upload?**
- Create the "listing-photos" bucket in Supabase Storage

**Zillow blocked?**
- Use Redfin URLs instead, or upload photos manually
```

---

## FINAL VERIFICATION

After all 12 bugs are fixed, run this checklist:

```
[ ] npm run typecheck — 0 errors
[ ] npm run build — succeeds
[ ] Start app: npm run dev:all
[ ] Paste Redfin URL → photos appear
[ ] Zillow URL → shows clear error (not silent fail)
[ ] Upload photos manually (without scraping) → photos appear
[ ] Click "Try Demo" → demo listing loads with real photos
[ ] Fill in listing details → Continue to Customize
[ ] Pick theme + music → Click Generate
[ ] Loading screen shows progress (worker processing)
[ ] Video completes → plays on done page
[ ] Download MP4 → file plays locally
[ ] Content Pack tab → shows hooks/scripts/captions
```

If ALL pass, we're done. If any fail, tell me WHICH one and the error message.
