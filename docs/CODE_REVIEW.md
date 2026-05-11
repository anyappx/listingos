# ListingOS Code Review — May 2026

## Verdict: 70% Built. 3 Critical Issues Blocking Launch.

---

## What's Actually Built (Impressive)

| Area | Status | Files |
|---|---|---|
| Auth (Supabase) | ✅ Working | lib/supabase/, middleware.ts |
| URL Scraper (Redfin + Zillow) | ✅ Working | lib/scraper.ts (527 lines, Playwright + Cheerio + anti-bot) |
| Dashboard home | ✅ Built | app/(dashboard)/dashboard/page.tsx |
| Step 1: Import listing | ✅ Built | app/(dashboard)/dashboard/new/page.tsx |
| Step 2: Customize video | ✅ Built | app/(dashboard)/dashboard/new/customize/page.tsx |
| Step 3: Generating | ✅ Built | app/(dashboard)/dashboard/new/generating/page.tsx |
| Step 4: Done/Download | ✅ Built | app/(dashboard)/dashboard/new/done/page.tsx |
| Brand kit editor | ✅ Built | app/(dashboard)/dashboard/brand/ |
| Music library | ✅ Built | app/(dashboard)/dashboard/music/ + 41MB real tracks |
| Listings manager | ✅ Built | app/(dashboard)/dashboard/listings/ |
| Account/billing | ✅ Built | app/(dashboard)/dashboard/account/ |
| Public listing page | ✅ Built | app/l/[slug]/ |
| Landing page | ✅ Built | app/page.tsx (225 lines) |
| API: scrape | ✅ Working | app/api/scrape/route.ts |
| API: generate | ✅ Working | app/api/generate/route.ts |
| API: job polling | ✅ Working | app/api/job/[id]/ |
| API: billing | ✅ Built | app/api/billing/ |
| API: leads | ✅ Built | app/api/leads/ |
| API: webhooks | ✅ Built | app/api/webhooks/stripe/ |
| Stripe integration | ✅ Built | lib/stripe.ts |
| Claude AI content | ✅ Working | lib/claude.ts + prompts/* |
| Fair Housing filter | ✅ Built | prompts/fair-housing.ts |
| QR code generation | ✅ Built | lib/qr.ts |
| BullMQ job queue | ✅ Built | workers/queue.ts |
| Pipeline (overlays, music, transitions) | ✅ Working | scripts/pipeline.js (906 lines!) |

**This is a LOT of working code.** Far more than most MVPs.

---

## 3 Critical Issues

### CRITICAL 1: Three Competing Pipelines (Kill Two)

You have THREE separate video generation paths:

```
1. scripts/pipeline.js (906 lines)
   ✅ Intro card, lower-third, stats, outro, music, xfade, 16:9+9:16
   ✅ Ken Burns with 6 directions
   ✅ Sharp photo preprocessing
   ✅ Floor plan filtering
   ❌ Ken Burns only (no parallax)
   
2. lib/dev-pipeline.ts (218 lines)
   ❌ Basic Ken Burns + simple concat
   ❌ NO overlays, NO intro/outro, NO music
   ❌ Dead code — generate route NEVER calls this

3. workers/video.ts (293 lines)
   ✅ fal.ai integration
   ✅ Pexels B-roll
   ✅ R2 upload
   ❌ NO overlays, NO intro/outro, NO stats
   ❌ Uses lib/ffmpeg.ts which has basic assembly only
```

**The generate route** (app/api/generate/route.ts line 87-102):
- Dev mode → spawns `scripts/pipeline.js` as child process ← GOOD
- Prod mode → enqueues BullMQ → `workers/video.ts` ← BAD (no overlays)

**FIX**: 
- DELETE `lib/dev-pipeline.ts` entirely (dead code)
- MERGE `workers/video.ts` features INTO `scripts/pipeline.js`
- Make `scripts/pipeline.js` the SINGLE pipeline for both dev and prod
- In prod: spawn pipeline.js from BullMQ worker (same as dev does via spawn)

### CRITICAL 2: Ken Burns = Slideshow Quality

`scripts/pipeline.js` lines 72-87 use FFmpeg `zoompan` — basic Ken Burns.
This is what AutoReel gets complaints about on cheap tiers.

**FIX**:
Replace zoompan with DepthFlow 2.5D parallax (per ZERO_COST_VIDEO_ARCHITECTURE.md).
Change ~15 lines in pipeline.js. Everything else stays.

### CRITICAL 3: No Deployment

Everything runs on localhost. No Vercel, no Railway. Agents can't use it.

**FIX**:
- Vercel: deploy frontend (free hobby tier)
- Railway: deploy pipeline.js as worker ($5/mo)
- R2: replace placeholder keys with real ones (free 10GB)
- That's it. $5/mo total.

---

## File-by-File Issues

### lib/dev-pipeline.ts — DELETE
Dead code. The generate route never calls `runLocalPipeline()`.
The route spawns `scripts/pipeline.js` directly via `child_process.spawn`.
This file just adds confusion.

### workers/video.ts — MERGE INTO pipeline.js
Good features to move into pipeline.js:
- Line 100-113: Pexels B-roll fetching
- Line 184-195: R2 upload logic
- Line 217-236: Claude content generation (non-blocking)
- Line 247-259: Resend email notification
Bad patterns to NOT copy:
- Line 36-48: `refundCredit()` has a race condition (read-then-write instead of atomic decrement)
- Line 161-171: `assembleVideo()` from lib/ffmpeg.ts — no overlays

### scripts/pipeline.js — THE KEEPER (but needs upgrades)
**Line 74-87** — KB_PATTERNS: Replace with DepthFlow presets
**Line 138-154** — preprocessPhoto: Good. Keep Sharp preprocessing.
**Line 238-298** — createIntroCard: Excellent SVG → Sharp → PNG. Keep.
**Line 302-340** — createStatsOverlayPng: Good. Keep.
**Line 343-355** — overlayTimedStats: Good FFmpeg overlay timing. Keep.

Missing from pipeline.js:
- R2 upload (currently saves to /public/videos/ which is local-only)
- Claude content generation (currently in workers/video.ts)
- Email notification (currently in workers/video.ts)
- Pexels B-roll (currently in workers/video.ts)

### lib/fal.ts — KEEP AS OPTIONAL
Line 29: `fal-ai/seedance/v1/lite/image-to-video` — cheapest model.
Good as Phase 2 "hero shot" upgrade. Not needed for Phase 1.
Ken Burns fallback on line 68-85 is correct pattern.

### lib/scraper.ts — SOLID, Minor Issues
- Line 40-100: Playwright with system Chrome + anti-bot warmup — smart
- Line 12-14: `validateDomain` uses `includes()` — could match "zillow.com.evil.com"
  **Fix**: Use `new URL(url).hostname.endsWith('zillow.com')` instead
- 527 lines total — well-structured, handles Redfin + Zillow

### lib/stripe.ts — Check Webhook Signature
Verify that `app/api/webhooks/stripe/route.ts` verifies `stripe-signature` header
before processing events. Common security gap.

### app/page.tsx — FUNCTIONAL Landing Page
225 lines, has pricing cards, steps, CTA. Needs design polish but functional.
Missing: before/after video demo, which is the #1 converter.

---

## What to Do This Week (Ordered)

| # | Task | Hours | Impact |
|---|---|---|---|
| 1 | Delete `lib/dev-pipeline.ts` | 0.1h | Remove confusion |
| 2 | Add R2 upload + Claude content + email into `pipeline.js` | 3h | Unify pipeline |
| 3 | Replace Ken Burns with DepthFlow in `pipeline.js` | 2h | 4/10 → 9/10 quality |
| 4 | Get real R2 keys (free tier) | 0.5h | Enable cloud storage |
| 5 | Deploy to Vercel + Railway | 2h | Go live |
| 6 | Fix scraper domain validation | 0.1h | Security |
| 7 | Add before/after video to landing page | 1h | Conversion |
| 8 | Test full flow end-to-end on production | 1h | Verify everything |

**Total: ~10 hours to production-ready.**

---

## Architecture After Cleanup

```
BEFORE (messy):
  route.ts → dev? → spawn pipeline.js (good overlays, Ken Burns)
           → prod? → BullMQ → workers/video.ts (fal.ai, NO overlays)
           → (dead) → lib/dev-pipeline.ts (never called)

AFTER (clean):
  route.ts → always → spawn pipeline.js
             pipeline.js does:
               1. Download photos from Supabase
               2. DepthFlow parallax per photo (or fal.ai if FAL_KEY real)
               3. Pexels B-roll (moved from workers/video.ts)
               4. FFmpeg: intro + clips + xfade + overlays + music + outro
               5. Upload to R2 (moved from workers/video.ts)
               6. Claude content (moved from workers/video.ts)
               7. Resend email (moved from workers/video.ts)
               8. Update job status: complete
```

Single pipeline. Single truth. Works in dev AND prod.

---

## What's NOT Needed Yet (Don't Build)

Per our PRD, these are Phase 2/3 — don't touch them:
- MLS API integration
- CRM integrations (Follow Up Boss etc)
- ElevenLabs voiceover
- Virtual staging
- PWA / iOS app
- Social content pack beyond captions
- Brokerage admin
- Browser extension
- White label
