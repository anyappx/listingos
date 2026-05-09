# Agent: Architect
# Run this FIRST before all other agents

## Your Job
Generate the complete technical foundation. No other agent writes
code until your output files exist.

## Read First
- /docs/PRD.md
- /docs/DB_SCHEMA.sql (already written — verify + extend if needed)
- /docs/API_ROUTES.md

## Outputs You Must Create
1. /lib/types.ts — TypeScript interfaces for ALL DB tables
2. /lib/validations.ts — Zod schemas for ALL API inputs
3. /lib/supabase/client.ts — browser Supabase client
4. /lib/supabase/server.ts — server Supabase client
5. /lib/supabase/middleware.ts — auth middleware for Next.js
6. /app/middleware.ts — route protection (dashboard requires auth)

## Rules
- types.ts must match DB_SCHEMA.sql exactly
- Every API input in API_ROUTES.md needs a Zod schema in validations.ts
- Middleware protects all /dashboard/* routes
- Public routes: /, /login, /signup, /l/[slug], /api/leads, /api/webhooks/*

---

# Agent: Boilerplate Setup
# Run SECOND, after Architect

## Your Job
Set up the Next.js project base — layout, navigation, auth pages.

## Read First
- CLAUDE.md (stack + structure)
- /lib/types.ts (from Architect)

## Tasks
1. Install dependencies:
   - @supabase/supabase-js @supabase/ssr
   - @fal-ai/serverless-client
   - @anthropic-ai/sdk
   - fluent-ffmpeg @types/fluent-ffmpeg
   - bullmq
   - stripe
   - @aws-sdk/client-s3 (for R2)
   - cheerio playwright
   - p-limit
   - react-dropzone
   - color-thief-node
   - node-qrcode
   - resend react-email
   - zod
   - shadcn/ui (run: npx shadcn-ui@latest init)

2. shadcn/ui components to install:
   button, input, label, card, tabs, dialog, progress,
   badge, avatar, separator, toast, skeleton, toggle-group

3. Create layouts:
   - /app/layout.tsx (root, Toaster)
   - /app/(auth)/layout.tsx (centered card)
   - /app/(dashboard)/layout.tsx (sidebar + topbar)

4. Create sidebar component (/components/dashboard/sidebar.tsx):
   - Links: New Video, My Listings, Brand Kit, Music, Account
   - Usage bar (X/10 listings)
   - Plan badge

5. Auth pages:
   - /app/(auth)/login/page.tsx
   - /app/(auth)/signup/page.tsx
   - Both: email+password + Google OAuth button
   - After signup → redirect /dashboard/new

---

# Agent: Scraper
# Parallel with Brand-Kit and AI-Content after Boilerplate

## Your Job
Build listing import — URL scraping + manual upload.

## Read First
- /skills/all-skills.md (section: Scraping Patterns)
- /lib/validations.ts (ScrapeInputSchema)
- /lib/types.ts (Listing type)

## Tasks
1. /lib/scraper.ts
   - scrapeUrl(url) → tries Cheerio → falls back to Playwright
   - validateDomain(url) → only Zillow/Redfin/Realtor.com
   - downloadAndStorePhotos(photos[], userId, listingId)

2. /app/api/scrape/route.ts
   - POST handler per API_ROUTES.md spec
   - Rate limit: 5/min per user (Redis counter)
   - Returns structured listing data

3. /app/(dashboard)/dashboard/new/page.tsx — Step 1 UI:
   - URL input (large, centered)
   - Import button → loading state
   - Photo grid after import (drag to reorder, X to remove, star for cover)
   - Manual upload fallback (react-dropzone)
   - Editable fields: address, price, beds, baths, sqft
   - [Continue →] button → goes to Step 2

---

# Agent: Video Pipeline
# Parallel with Scraper, Brand-Kit, AI-Content

## Your Job
The core product — async video generation.

## Read First
- /skills/all-skills.md (sections: fal-api, FFmpeg Recipes)
- /docs/VIDEO_PIPELINE.md
- /lib/types.ts (VideoJob, Video types)

## Tasks
1. /lib/fal.ts — fal.ai client + generateClip()
2. /lib/ffmpeg.ts — assembleVideo(), cropTo9x16(), extractThumbnail()
3. /lib/r2.ts — uploadToR2(), getSignedUrl()
4. /lib/pexels.ts — fetchNeighborhoodClips(city, count)
5. /workers/queue.ts — BullMQ queue + job types
6. /workers/video.ts — main worker (full pipeline per VIDEO_PIPELINE.md)
7. /app/api/generate/route.ts — POST handler
8. /app/api/job/[id]/route.ts — GET polling handler

## Step 3 UI (loading screen):
- /app/(dashboard)/dashboard/new/generating/page.tsx
- Polls /api/job/[id] every 5s
- Shows progress steps with animated spinner
- After 15s: shows description tabs below progress
- On complete: auto-navigates to results page

## Step 4 UI (results):
- /app/(dashboard)/dashboard/new/done/page.tsx
- Two video players (9:16 left, 16:9 right on desktop; stacked on mobile)
- Download buttons below each
- Description tabs (MLS/Social/Luxury) with copy buttons
- Caption section per platform
- Share link + QR code download

---

# Agent: AI Content
# Parallel with Scraper, Video Pipeline, Brand-Kit

## Your Job
All Claude Haiku text generation.

## Read First
- /skills/all-skills.md (section: Claude Prompt Templates)
- /lib/types.ts (Listing type)

## Tasks
1. /lib/claude.ts — Claude client + all generation functions:
   - generateDescriptions(listing) → { mls, social, luxury }
   - generateCaptions(listing) → { instagram, tiktok, facebook }
   - fairHousingCheck(text) → { passed, flagged, suggestion }

2. /prompts/listing-description.ts — prompt template strings
3. /prompts/captions.ts — caption prompt templates
4. /prompts/fair-housing.ts — banned phrases list + prompt

5. Wire into video worker:
   - Called in parallel with fal.ai generation
   - Results saved to listings table when complete

## Cost guard
- Log token usage per call
- Alert if single call exceeds 600 tokens output
- Target: <$0.003 per full listing (descriptions + captions)

---

# Agent: Brand Kit UI
# Parallel with Scraper, Video Pipeline, AI-Content

## Your Job
Brand kit editor page + Step 2 video customization UI.

## Read First
- /lib/types.ts (BrandKit, MusicTrack types)
- /docs/APP_PAGES_ROUTES.md (Step 2 spec)

## Tasks
1. /app/(dashboard)/dashboard/brand/page.tsx
   - Logo upload (uploadthing → Supabase Storage)
   - color-thief auto-extract colors from logo
   - Font picker (10 Google Fonts)
   - Agent info fields
   - Headshot upload → browser-side bg removal (@imgly/background-removal)
   - Live lower-third preview (CSS mockup, updates on type)

2. /app/(dashboard)/dashboard/music/page.tsx
   - Grid of 20 tracks
   - Genre filter tabs
   - Play preview (HTML5 audio)
   - Favorite toggle (saved to localStorage)

3. Step 2 UI — /app/(dashboard)/dashboard/new/customize/page.tsx
   - Style picker (4 tiles with preview images)
   - Duration selector (15/30/45/60s)
   - Format selector (both/16x9/9x16)
   - Music picker (inline, same as music page)
   - Neighborhood B-roll toggle
   - RIGHT: live CSS mockup (phone + laptop side by side)
   - [Generate Video →] button

4. /app/api/brand/route.ts — POST to save brand kit

---

# Agent: Integrations
# Run after Video Pipeline is complete

## Your Job
External integrations + public pages + billing.

## Read First
- /docs/API_ROUTES.md (leads, view tracking, Stripe webhook)
- /lib/types.ts

## Tasks
1. /lib/stripe.ts — Stripe client + webhook handler helpers
2. /app/api/webhooks/stripe/route.ts — full webhook handler
3. /lib/resend.ts — email client
4. /emails/welcome.tsx — React Email welcome template
5. /emails/video-ready.tsx — "Your video is ready" template
6. /emails/trial-ending.tsx — Day 5 + Day 7 trial reminder

7. /app/l/[slug]/page.tsx — public listing page:
   - Agent header (headshot, name, brokerage, phone)
   - 16:9 video player (autoplay muted)
   - Property details
   - Photo gallery (swipeable, use embla-carousel)
   - Google Places neighborhood section
   - Lead capture form → POST /api/leads
   - View tracking (POST /api/listings/[id]/view on load)

8. /lib/places.ts — Google Places API for neighborhood data
9. /lib/qr.ts — QR code generation (node-qrcode)
10. /app/(dashboard)/dashboard/account/page.tsx:
    - Plan + usage display
    - [Manage Plan] → Stripe Customer Portal link
    - Profile tab (email, password change)

---

# Agent: QA
# Run LAST after all agents complete

## Your Job
Review all code before it ships. Fix critical issues.

## Checklist

### Security
- [ ] No hardcoded API keys anywhere (grep for sk-, pk-, re_, AIza)
- [ ] Stripe webhook verifies signature before processing
- [ ] All R2 video URLs are signed (grep for getPublicUrl on videos bucket)
- [ ] /api/scrape has rate limiting
- [ ] All API routes check auth session

### Database
- [ ] RLS enabled on all tables (check Supabase dashboard)
- [ ] Every query that should filter by user_id does so
- [ ] check_and_deduct_credit uses FOR UPDATE lock
- [ ] Credit refund runs on any job failure

### Business Logic
- [ ] Free/trial users get watermark (check worker code)
- [ ] Fair Housing filter runs before returning ANY description
- [ ] Video jobs are async — no API route awaits video completion
- [ ] Trial → paid plan upgrade resets listings_used_this_month

### UX
- [ ] Loading states on all async actions
- [ ] Error states shown (not silent failures)
- [ ] Mobile responsive: /, /dashboard/new all steps, /l/[slug]
- [ ] Toast notifications on success/error actions

### Performance
- [ ] Images use next/image
- [ ] No blocking operations in API routes
- [ ] Polling stops when job completes or fails

### Fix anything that fails these checks before declaring done.
