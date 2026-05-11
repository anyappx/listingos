# ListingOS Ticket Board
# One ticket per Claude Code session.
# Copy the ticket section into Claude Code, NOT the whole file.
# Always start session with: "Read CLAUDE.md first. Then execute this ticket."

═══════════════════════════════════════════════════════════
BATCH 1: FOUNDATION (do first, in order)
═══════════════════════════════════════════════════════════

## LOS-001: Project Health Check
READ FIRST: CLAUDE.md
DO:
  1. Run `npm run typecheck` — list every error
  2. Run `npm run build` — list every error
  3. Fix ONLY type errors (do not refactor logic)
  4. Run both commands again — must be 0 errors
DO NOT: refactor, rename, restructure anything
TEST: `npm run typecheck && npm run build` exits 0
COMMIT: "LOS-001: fix type errors"

---

## LOS-002: Delete Dead Code
READ FIRST: CLAUDE.md
DO:
  1. Delete lib/dev-pipeline.ts
  2. Search entire codebase for imports of dev-pipeline — remove them
  3. In app/api/generate/route.ts: remove `isDevMode` import and the
     dev/prod branching logic. Keep only the job insert + return jobId.
  4. Run npm run typecheck — 0 errors
DO NOT: modify any other files
TEST: `grep -r "dev-pipeline\|isDevMode\|devPipeline" --include="*.ts" --include="*.tsx" .` returns 0 results
COMMIT: "LOS-002: remove dead code"

---

## LOS-003: DB Migrations
DO: Run in Supabase SQL editor:
  ```sql
  ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS content_pack JSONB DEFAULT NULL;
  ALTER TABLE public.brand_kits ADD COLUMN IF NOT EXISTS voice_profile TEXT DEFAULT NULL;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE DEFAULT NULL;
  ALTER TABLE public.users ADD COLUMN IF NOT EXISTS referred_by TEXT DEFAULT NULL;

  -- Auto-generate referral code on user creation
  CREATE OR REPLACE FUNCTION generate_referral_code()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.referral_code := UPPER(SUBSTRING(NEW.id::text, 1, 4) || SUBSTRING(md5(random()::text), 1, 4));
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS set_referral_code ON public.users;
  CREATE TRIGGER set_referral_code
    BEFORE INSERT ON public.users
    FOR EACH ROW EXECUTE FUNCTION generate_referral_code();

  -- Update existing users who don't have codes
  UPDATE public.users SET referral_code = UPPER(SUBSTRING(id::text, 1, 4) || SUBSTRING(md5(random()::text), 1, 4))
  WHERE referral_code IS NULL;
  ```
TEST: Verify columns exist in Supabase Table Editor
COMMIT: "LOS-003: add content_pack, voice_profile, referral columns"

---

## LOS-004: Update Types
READ FIRST: CLAUDE.md, lib/types.ts
DO: Add to lib/types.ts:
  - ContentPack interface (hooks string[], features string[], shotList ShotScene[], captionStyles, platformPosts, engagementQuestions string[], generatedAt string)
  - ShotScene interface (sceneNumber, duration, camera, speak)
  - VideoConfig interface (listingId, theme, headline, customHeadline?, durationSeconds, formats string[], includeBranded, includeClean, musicTrackId, musicVolume, photos PhotoConfig[])
  - PhotoConfig interface (id, url, order, isCover, camera, intensity, clipDuration, enhance, skySrc?, dayToDusk, brighten)
  - VideoTheme interface (name, previewImage, colorGrade, transitionType, transitionDuration, overlayFont, overlayColor, motionDefault, grainAmount, vignetteStrength)
  - 8 theme definitions as const array
DO NOT: modify existing types
TEST: npm run typecheck — 0 errors
COMMIT: "LOS-004: add ContentPack, VideoConfig, VideoTheme types"


═══════════════════════════════════════════════════════════
BATCH 2: SCRAPER FIX (do in order)
═══════════════════════════════════════════════════════════

## LOS-010: Fix Redfin Scraper
READ FIRST: CLAUDE.md, skills/all-skills.md (Supabase Patterns section)
FILES: lib/scraper.ts
DO:
  1. Update USER_AGENTS to Chrome 130+
  2. Fix Playwright launch: use bundled Chromium, add --disable-blink-features=AutomationControlled, viewport 1920x1080
  3. Redfin strategy: warmup on redfin.com → navigate to listing → wait for price selector → extract DOM
  4. Photo extraction: all img[src*="ssl.cdn-redfin.com"] width>400
  5. Download photos → Sharp resize 1920x1080 → upload Supabase Storage
  6. Return ScrapedData with Supabase URLs (not CDN URLs)
TEST:
  - Scrape any active Redfin listing URL
  - Assert: ≥5 photos, non-empty address, numeric price
  - Assert: photo URLs start with Supabase URL
COMMIT: "LOS-010: fix Redfin scraper"

---

## LOS-011: Zillow Scraper (Graceful Fallback)
FILES: lib/scraper.ts
DO:
  1. Try got-scraping (already in package.json) for Zillow
  2. Extract from __NEXT_DATA__ JSON blob
  3. If blocked: return specific error "Zillow blocked this request. Try a Redfin URL instead."
  4. Never crash — always return structured error
TEST:
  - Zillow URL returns data OR returns {error: "scrape_failed", message: "...Try Redfin..."}
  - Invalid URL returns {error: "invalid_domain"}
COMMIT: "LOS-011: Zillow scraper with graceful fallback"

---

## LOS-012: Photo Validation
FILES: lib/scraper.ts, app/api/scrape/route.ts
DO:
  1. Validate file type: only JPEG/PNG/WebP
  2. Validate min resolution: 800×600
  3. Floor plan detection: >60% white pixels → flag (don't block)
  4. Corrupted file: Sharp throws → skip with warning
  5. Return warnings array alongside photos: [{photoIndex: 3, warning: "Low resolution"}]
TEST: Upload a 100×100 image → warning returned, photo still included but flagged
COMMIT: "LOS-012: photo validation"

---

## LOS-013: Scrape Route Error Handling
FILES: app/api/scrape/route.ts
READ FIRST: skills/all-skills.md (API Route Pattern)
DO:
  1. Add retry: 2 attempts with 3s delay
  2. Rate limit: 5 requests/min per user (track in Supabase or simple Map)
  3. Specific error messages per failure type
  4. On final failure: {error: "scrape_failed", fallback: "manual_upload", message: "..."}
TEST:
  - Invalid URL → 400
  - Unsupported domain → 400
  - Scrape fails → 422 with fallback message
  - 6th request in 1 minute → 429
COMMIT: "LOS-013: scrape route error handling"


═══════════════════════════════════════════════════════════
BATCH 3: VIDEO QUALITY (do in order)
═══════════════════════════════════════════════════════════

## LOS-020: Create parallax-cpu.py
READ FIRST: skills/all-skills.md (Parallax Patterns)
FILES: scripts/parallax-cpu.py (NEW), scripts/models/.gitkeep (NEW)
DO:
  1. Accept args: image_path, output_path, motion, intensity, duration, fps, width, height
  2. Auto-download ONNX model on first run
  3. Depth estimation via Depth Anything V2 Small ONNX
  4. 6 motion types: dolly, horizontal, circle, zoom, orbital, drift
  5. Ease-in-out (cosine), overscan 10%, BORDER_REFLECT_101
  6. Depth-of-field (background blur weighted by depth)
  7. Re-encode output with FFmpeg (not cv2 codec)
TEST:
  ```bash
  python3 scripts/parallax-cpu.py test.jpg /tmp/clip.mp4 dolly 1.0 4 30 1920 1080
  ffprobe -v quiet -show_streams /tmp/clip.mp4  # h264, 1920x1080, ~4s
  ```
COMMIT: "LOS-020: CPU depth-parallax renderer"

---

## LOS-021: Integrate Parallax into Pipeline
READ FIRST: skills/all-skills.md (Pipeline Patterns)
FILES: scripts/pipeline.js
DO:
  1. Add ROOM_PRESETS array (12 entries mapping room index to motion+intensity)
  2. Replace Ken Burns clip generation with parallax-cpu.py subprocess call
  3. Keep Ken Burns as FALLBACK if Python fails
  4. Log which method was used per clip
TEST:
  - Generate full video → inspect clips show depth-separated motion (not flat zoom)
  - Rename parallax-cpu.py → test Ken Burns fallback works
COMMIT: "LOS-021: parallax integration with Ken Burns fallback"

---

## LOS-022: Cinema Post-Processing
FILES: scripts/pipeline.js
DO:
  1. Add film grain: noise=alls=3:allf=t
  2. Add warm color grade: eq=saturation=1.12:contrast=1.04:brightness=0.01
  3. Add vignette: vignette=PI/5
  4. Apply to final 16:9 output BEFORE cropping to other formats
TEST: Output video visually warmer/grainier than before
COMMIT: "LOS-022: film grain + warm color grade + vignette"

---

## LOS-023: Beat-Sync Transitions
FILES: scripts/pipeline.js
DO:
  1. Add TRACK_BPM map for all music tracks (manually listen + record BPM)
  2. Calculate clip duration to nearest beat boundary
  3. Adjust xfade offset to land on beats
TEST: Watch output with audio — cuts should feel rhythmic
COMMIT: "LOS-023: beat-synced transitions"

---

## LOS-024: Photo Upscaling
FILES: scripts/pipeline.js
DO:
  1. Before parallax: check if photo resolution < 1920x1080
  2. If yes: upscale with Sharp (resize 2x with lanczos3)
  3. Sharp already installed — no new dependency needed
  4. If Sharp upscale fails: use photo as-is (never crash)
TEST: Low-res photo (800x600) → output video still 1920x1080 and visibly sharper
COMMIT: "LOS-024: photo upscaling before parallax"


═══════════════════════════════════════════════════════════
BATCH 4: PER-PHOTO CONTROLS + THEMES
═══════════════════════════════════════════════════════════

## LOS-030: Step 2 — Theme Picker UI
FILES: app/(dashboard)/dashboard/new/customize/page.tsx
DO:
  1. Replace 4 text style buttons with 8 visual theme cards
  2. Each card: thumbnail image + name + 1-line description
  3. Selected card highlighted with border
  4. Theme selection updates preview panel (color grade preview on cover photo)
TEST: All 8 themes render, selection highlights, preview updates
COMMIT: "LOS-030: theme picker UI"

---

## LOS-031: Step 2 — Per-Photo Controls
FILES: app/(dashboard)/dashboard/new/customize/page.tsx
DO:
  1. Each photo in scrollable strip: expandable accordion
  2. Expanded: camera dropdown (7 options), intensity slider, duration buttons (2-5s)
  3. Enhancement toggles: Auto-Enhance, Replace Sky (exterior only), Day-to-Dusk (exterior only), Brighten slider
  4. Cover photo star marker + remove button
  5. Drag handle for reorder (or keep existing reorder from Step 1)
TEST: Expand photo → change camera → collapse → expand again → camera persisted
COMMIT: "LOS-031: per-photo controls UI"

---

## LOS-032: Step 2 — Headline Picker
FILES: app/(dashboard)/dashboard/new/customize/page.tsx
DO:
  1. Dropdown: JUST LISTED, OPEN HOUSE, COMING SOON, PRICE REDUCED, JUST SOLD, BACK ON MARKET, NEW CONSTRUCTION, FOR RENT
  2. "Custom" option: shows text input
  3. Stored in VideoConfig.headline / VideoConfig.customHeadline
TEST: Select "OPEN HOUSE" → state updated. Select Custom → type "LUXURY HOME" → state updated
COMMIT: "LOS-032: headline picker"

---

## LOS-033: Step 2 — Output Format Selector
FILES: app/(dashboard)/dashboard/new/customize/page.tsx
DO:
  1. Checkboxes: 16:9, 9:16, 1:1, 4:5 (default: 16:9+9:16 checked)
  2. Checkboxes: Branded (with overlays), Clean (MLS-ready, no branding)
  3. At least 1 format required (disable Generate if none selected)
TEST: Uncheck all → Generate button disabled. Check 1:1 → enabled
COMMIT: "LOS-033: output format selector"

---

## LOS-034: Step 2 — Music Improvements
FILES: app/(dashboard)/dashboard/new/customize/page.tsx
DO:
  1. Genre filter tabs (All, Modern, Luxury, Upbeat, Calm, Bold)
  2. BPM label on each track
  3. Volume slider: maps 0.1–0.6
  4. Preview button: HTML5 audio plays 10-second clip
TEST: Filter by Luxury → only luxury tracks shown. Play preview. Adjust volume.
COMMIT: "LOS-034: music genre filter + BPM + volume"

---

## LOS-035: Step 2 — Live Preview Panel
FILES: app/(dashboard)/dashboard/new/customize/page.tsx
DO:
  1. Right panel (desktop) or collapsible top section (mobile)
  2. Shows cover photo with selected theme's color grade applied via CSS filters
  3. Lower-third mockup with selected font and colors
  4. Updates when theme/font/colors change
  5. Sticky on scroll
TEST: Change theme → preview color grade changes. Change font → lower-third updates.
COMMIT: "LOS-035: live preview panel"

---

## LOS-036: Sky Replacement
FILES: scripts/sky-replace.py (NEW), public/skies/ (NEW — 10 images)
DO:
  1. Python script: takes photo + depth map → masks sky (depth > 0.85)
  2. Composites replacement sky with gradient edge blend
  3. 10 CC0 sky images: clear blue, sunset, dramatic clouds, twilight, dawn, etc.
  4. Accept sky name as argument
  5. Output enhanced photo (not video — applied before parallax)
TEST: Exterior photo with gray sky → run with "sunset" → sky replaced, edges smooth
COMMIT: "LOS-036: sky replacement"

---

## LOS-037: Day-to-Dusk
FILES: scripts/day-to-dusk.py (NEW)
DO:
  1. Darken entire image (multiply 0.4)
  2. Add warm orange to highlights
  3. Replace sky with twilight sky
  4. Detect bright rectangles (windows) → add warm yellow glow
  5. Add blue tone to shadows
TEST: Daytime exterior → run → looks like dusk/evening photo
COMMIT: "LOS-037: day-to-dusk conversion"

---

## LOS-038: Pipeline Reads Per-Photo Config
FILES: scripts/pipeline.js, app/api/generate/route.ts
DO:
  1. Generate route: pass full VideoConfig JSON to pipeline (write to tmp file)
  2. Pipeline: read VideoConfig from tmp file (not just CLI args)
  3. Per photo: use agent's chosen camera/intensity/duration instead of ROOM_PRESETS
  4. Per photo: run sky-replace.py or day-to-dusk.py if enabled
  5. Pipeline: generate selected formats only (not always 16:9+9:16)
  6. Pipeline: generate clean (no overlays) versions if requested
TEST: Set photo 3 to "Pan Left" intensity 2.0, set photo 5 to Day-to-Dusk → output reflects
COMMIT: "LOS-038: per-photo config in pipeline"


═══════════════════════════════════════════════════════════
BATCH 5: CONTENT PACK
═══════════════════════════════════════════════════════════

## LOS-040: Content Pack Prompt + Parser
FILES: prompts/content-pack.ts (NEW)
READ FIRST: Content Pack section in CONTENT_PACK_PROMPT.md
DO: Create buildContentPackPrompt() and parseContentPack() exactly as specified
TEST: Call buildContentPackPrompt with test data → valid prompt string
COMMIT: "LOS-040: content pack prompt template"

---

## LOS-041: Content Pack API Route
FILES: app/api/content/pack/route.ts (NEW), lib/claude.ts
READ FIRST: skills/all-skills.md (API Route Pattern, Claude Patterns)
DO:
  1. Add generateContentPack() to lib/claude.ts
  2. Create route: auth check OR service-key check
  3. Call Claude Haiku → parse → save to listings.content_pack
TEST: POST with listing data → response has 10 hooks, 6 scenes, 5 questions
COMMIT: "LOS-041: content pack API"

---

## LOS-042: Content Pack UI
FILES: components/dashboard/content-pack.tsx (NEW)
READ FIRST: skills/all-skills.md (Component Pattern)
DO: Create ContentPackView with 5 tabs (Hooks, Script, Captions, Platforms, Engage)
  - Copy button on every item
  - Regenerate button
  - Loading/empty/error states
TEST: Render with sample ContentPack data → all tabs work, copy buttons fire toast
COMMIT: "LOS-042: content pack component"

---

## LOS-043: Wire Content Pack into Done Page
FILES: app/(dashboard)/dashboard/new/done/page.tsx
DO: Add ContentPackView below video section
TEST: After video generation → Content Pack section visible with data
COMMIT: "LOS-043: content pack on done page"

---

## LOS-044: Wire Content Pack into Listing Detail
FILES: app/(dashboard)/dashboard/listings/[id]/page.tsx
DO: Add Content Pack tab
TEST: Navigate to listing detail → Content Pack tab shows data
COMMIT: "LOS-044: content pack on listing detail"

---

## LOS-045: Brand Voice Profile
FILES: app/(dashboard)/dashboard/brand/page.tsx, lib/claude.ts
DO:
  1. Add textarea: "Paste 3-5 captions you've written"
  2. "Analyze & Save" button → Claude analyzes voice → saves to brand_kits.voice_profile
  3. Voice profile prepended to all content pack generation
TEST: Paste 3 captions → click analyze → voice_profile saved → next content pack matches voice
COMMIT: "LOS-045: brand voice profile"

---

## LOS-046: Pipeline Triggers Content Pack
FILES: scripts/pipeline.js
DO: After video assembly, fire non-blocking fetch to /api/content/pack
  - Pass listing data + style
  - Do NOT await — video must complete regardless
TEST: Video completes + content_pack column populated. If Claude is slow, video still finishes.
COMMIT: "LOS-046: pipeline content pack trigger"


═══════════════════════════════════════════════════════════
BATCH 6: RESULTS + POST-GENERATION
═══════════════════════════════════════════════════════════

## LOS-050: Styled Video Player
FILES: components/dashboard/video-player.tsx (NEW)
DO: Custom HTML5 video player with: autoplay muted, large centered play button overlay, custom controls (play/pause, volume, scrubber, fullscreen), rounded corners + shadow
TEST: Video plays on page load (muted), controls work, fullscreen works
COMMIT: "LOS-050: styled video player"

---

## LOS-051: 4-Format Output (Branded + Clean)
FILES: scripts/pipeline.js
DO:
  1. After assembling branded 16:9: create clean 16:9 (skip intro/lower-third/stats/outro, just clips+music+transitions)
  2. Crop both to 9:16
  3. If 1:1 requested: crop from 16:9 center
  4. If 4:5 requested: crop from 16:9 center
  5. Upload all to R2
  6. Store all URLs in videos table (add url_1x1, url_4x5, url_16x9_clean, url_9x16_clean columns if needed)
TEST: Generate with all 4 formats + branded+clean → 8 files produced
COMMIT: "LOS-051: multi-format output"

---

## LOS-052: Thumbnail Selector
FILES: app/(dashboard)/dashboard/new/done/page.tsx, scripts/pipeline.js
DO:
  1. Pipeline: extract 5 frames at evenly spaced intervals → upload to R2
  2. Done page: show 5 thumbnails → agent clicks one → PATCH listing.thumbnail_url
TEST: 5 thumbnails shown, clicking one updates the selection
COMMIT: "LOS-052: thumbnail selector"

---

## LOS-053: GIF Preview
FILES: scripts/pipeline.js, app/(dashboard)/dashboard/new/done/page.tsx
DO:
  1. Pipeline: after video assembly, extract 3s GIF (480px wide, 12fps)
  2. Upload to R2
  3. Done page: "Download GIF" button
TEST: GIF exists, downloads correctly, is <1MB
COMMIT: "LOS-053: GIF preview download"

---

## LOS-054: ZIP Download All
FILES: app/api/listings/[id]/download-all/route.ts (NEW)
DO:
  1. Fetch all video URLs for listing from DB
  2. Stream files from R2 → archiver ZIP → response stream
  3. Include: all MP4s + thumbnail + GIF
TEST: Click "Download All" → ZIP downloads with all files
COMMIT: "LOS-054: ZIP download"

---

## LOS-055: Quick Re-Edit (Music Swap)
FILES: app/api/listings/[id]/reedit/route.ts (NEW), scripts/pipeline.js
DO:
  1. API: accept {listingId, musicTrackId, musicVolume}
  2. Pipeline function: ffmpeg re-mux audio only (no parallax re-render)
  3. Re-upload to R2
  4. NO credit deduction
  5. Update videos table with new URL
TEST: Change music → video updates in <15 seconds, no credit used
COMMIT: "LOS-055: quick music swap"

---

## LOS-056: Quick Re-Edit (Headline Swap)
FILES: app/api/listings/[id]/reedit/route.ts, scripts/pipeline.js
DO:
  1. API: accept {listingId, headline, customHeadline}
  2. Re-generate intro card SVG → FFmpeg re-composite intro only
  3. NO credit deduction
TEST: Change headline to "OPEN HOUSE" → intro card updates, no credit used
COMMIT: "LOS-056: quick headline swap"

---

## LOS-057: Social Preview Mockups
FILES: components/dashboard/social-previews.tsx (NEW)
DO:
  1. CSS-only phone/browser frames
  2. 3 mockups: Instagram Reel, TikTok, YouTube Short
  3. Show video thumbnail inside each device frame with platform UI elements
TEST: 3 mockups render correctly on desktop and mobile
COMMIT: "LOS-057: social preview mockups"


═══════════════════════════════════════════════════════════
BATCH 7: INFRASTRUCTURE + DEPLOYMENT
═══════════════════════════════════════════════════════════

## LOS-060: R2 Upload in Pipeline
FILES: scripts/pipeline.js
READ FIRST: skills/all-skills.md (Pipeline Patterns — R2 upload)
DO: Add uploadOutput() with dev/prod fallback exactly as shown in skills
TEST: With placeholder keys → saves to /public/videos/. With real keys → uploads to R2.
COMMIT: "LOS-060: R2 upload with local fallback"

---

## LOS-061: Worker Poll Script
FILES: scripts/worker-poll.js (NEW)
DO:
  1. Poll Supabase every 5s for status="queued" jobs
  2. Pick oldest first (ORDER BY created_at ASC)
  3. Mark as "processing" immediately (prevent double-pickup)
  4. Spawn pipeline.js with job params
  5. On startup: recover stuck jobs (processing > 10 min → fail + refund)
TEST: Insert a job row with status "queued" → worker picks it up within 5s
COMMIT: "LOS-061: Supabase polling worker"

---

## LOS-062: Simplify Generate Route
FILES: app/api/generate/route.ts
DO:
  1. Remove ALL dev/prod branching
  2. Remove BullMQ import
  3. Remove child_process spawn
  4. Keep: auth check → credit check → job insert → return {jobId}
  5. Worker-poll.js handles everything from here
TEST: POST /api/generate → job row created with status "queued" → 200 response
COMMIT: "LOS-062: simplify generate route"

---

## LOS-063: OG Tags + Schema.org
FILES: app/l/[slug]/page.tsx
DO:
  1. Export async generateMetadata() with og:title, og:image, og:video, og:description
  2. Add twitter:card = summary_large_image
  3. Add JSON-LD script with @type RealEstateListing
TEST: Share URL on any platform → preview card appears with thumbnail
COMMIT: "LOS-063: OG tags and structured data"

---

## LOS-064: Deploy Prep
FILES: requirements.txt (NEW), railway.toml (NEW), .gitignore
DO:
  1. requirements.txt: opencv-python-headless, numpy, onnxruntime
  2. railway.toml: [build] nixpacksPlan.phases.setup.nixPkgs = ["ffmpeg", "python3"]
  3. .gitignore: add scripts/models/*.onnx, public/videos/, tmp/
  4. npm run build must pass
TEST: npm run build exits 0
COMMIT: "LOS-064: deployment config files"

---

## LOS-065: Deploy Vercel
DO:
  1. Connect anyappx/listingos to Vercel
  2. Framework: Next.js (auto-detected)
  3. Add ALL env vars from .env.local
  4. Set NEXT_PUBLIC_APP_URL to Vercel URL
  5. Deploy
TEST: https://[your-domain].vercel.app loads landing page + login works
COMMIT: no code change — deployment only

---

## LOS-066: Deploy Railway
DO:
  1. Create Railway service from same repo
  2. Start command: node scripts/worker-poll.js
  3. Add ALL env vars
  4. Verify Python + FFmpeg available in build environment
TEST: Railway logs show "[worker] Polling for jobs every 5s..."
COMMIT: no code change — deployment only

---

## LOS-067: Production E2E Test
DO: On live URLs, complete this EXACT flow:
  1. Sign up with new email at Vercel URL
  2. Complete brand kit (upload logo, enter name/phone)
  3. Paste a real Redfin listing URL
  4. Verify photos scrape correctly
  5. Customize: pick theme, music, adjust 1 photo camera direction
  6. Click Generate → loading screen shows progress
  7. Video completes → download 16:9 MP4 → verify it plays
  8. Content Pack tab → verify hooks/scripts/captions present
  9. Copy share link → open in incognito → public page loads
  10. Submit lead capture form → verify lead appears in dashboard
  11. Quick re-edit: change music → verify video updates (no credit used)
PASS/FAIL: All 11 steps must succeed


═══════════════════════════════════════════════════════════
BATCH 8: POLISH + UX
═══════════════════════════════════════════════════════════

## LOS-070: Demo Listing
FILES: app/(dashboard)/dashboard/new/page.tsx, seed data
DO:
  1. Create 12 sample photos (use Pexels, download CC0 house photos, store in Supabase)
  2. Create seed listing data (address, price, beds, baths, sqft)
  3. "Try Demo Listing" button on Step 1 → pre-fills everything
TEST: New user clicks Demo → photos + data appear → can generate immediately
COMMIT: "LOS-070: demo listing for onboarding"

---

## LOS-071: Onboarding Banner
FILES: app/(dashboard)/dashboard/page.tsx, components/dashboard/onboarding-banner.tsx (NEW)
DO:
  1. Show banner if brand kit missing logo OR agent_name OR phone
  2. Progress: "Setup: 1/3 complete" with links to each step
  3. Dismissable (store in localStorage)
  4. Disappears permanently after brand kit complete
TEST: New user → banner shows. Complete brand kit → banner gone.
COMMIT: "LOS-071: onboarding banner"

---

## LOS-072: Error Recovery UX
FILES: app/(dashboard)/dashboard/new/generating/page.tsx
DO:
  1. On job failed: show error message + "Your credit was refunded"
  2. [Try Again] button → redirect to /dashboard/new/customize (preserve settings)
  3. [Try with Fewer Photos] → redirect to Step 1 with existing photos
  4. Stuck detection: if no progress change in 3 minutes, show "Taking longer than usual" + [Keep Waiting] [Cancel]
TEST: Force job failure → see recovery UI. Credit refunded in DB.
COMMIT: "LOS-072: error recovery UX"

---

## LOS-073: Referral Page
FILES: app/(dashboard)/dashboard/refer/page.tsx (NEW), app/api/refer/route.ts (NEW)
DO:
  1. Show agent's referral link: listingos.com/signup?ref=[CODE]
  2. Copy button with toast
  3. List referred agents (from users where referred_by = current user's code)
  4. Show credits earned count
  5. Signup page: store ref code → on first paid month, credit both
TEST: Copy link → share → new user signs up with ?ref= → appears in referral list
COMMIT: "LOS-073: referral system"

---

## LOS-074: Mobile Responsive Pass
FILES: ALL dashboard pages, landing page, public listing page
DO: Test every page at 375px width. Fix:
  1. Sidebar → hamburger menu
  2. Step 2: single column, preview as collapsible section
  3. Photo grid: 2 columns on mobile
  4. Per-photo controls: full-width accordion
  5. Video players: full-width
  6. Done page: stack vertically
  7. Public listing page: all sections full-width
  8. Buttons: min 44px tap target
TEST: Every page renders correctly at 375px with no horizontal scroll
COMMIT: "LOS-074: mobile responsive"

---

## LOS-075: Final QA Checklist
DO: Go through EVERY item below. Fix anything that fails.
  BUILD:
  - [ ] npm run typecheck — 0 errors
  - [ ] npm run lint — 0 errors
  - [ ] npm run build — succeeds
  SECURITY:
  - [ ] grep for hardcoded keys — 0 matches in source
  - [ ] Stripe webhook verifies signature
  - [ ] All protected routes check auth
  - [ ] RLS enabled on all tables
  - [ ] R2 URLs are signed (not public)
  EVERY PAGE HAS:
  - [ ] Loading skeleton
  - [ ] Error state
  - [ ] Empty state
  - [ ] Mobile responsive (375px)
  - [ ] Toast on success/error actions
  FUNCTIONAL:
  - [ ] Redfin scrape works on production
  - [ ] Video generation completes on production
  - [ ] Content pack generates
  - [ ] Download MP4 works
  - [ ] Share link → OG preview works
  - [ ] Lead capture → agent gets email
  - [ ] Quick re-edit works (no credit)
  - [ ] Referral link works
  - [ ] Stripe checkout works (test mode)
COMMIT: "LOS-075: final QA fixes"
