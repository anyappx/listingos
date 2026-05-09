# ListingOS — Product Requirements Document (PRD)

**Version**: 1.0  
**Date**: May 2026  
**Status**: Ready for development

---

## 1. Problem

Real estate agents need video content for every listing but:
- Professional videographers cost $300–$1,200 per listing
- DIY editing takes 2–4 hours per video
- Most agents post static photos and lose engagement to agents posting video

## 2. Solution

Paste a listing URL → get a branded cinematic video in under 2 minutes for $0.67 cost.

## 3. Target User

**Primary**: Solo US real estate agent, 5–30 listings/year, pays for their own marketing tools.  
**Secondary**: Small team (2–5 agents) sharing a subscription.

## 4. Success Metrics
- Trial → paid conversion: >25%
- Videos generated per paying agent per month: >3
- Monthly churn: <8%
- Time from signup to first video: <5 minutes

---

## 5. Phase 1 — MVP (Build This First)

### 5.1 Auth
- Email + password signup/login
- Google OAuth
- Supabase Auth
- After signup → redirect to `/dashboard/new` (not dashboard home)
- 7-day free trial, 1 video credit included

### 5.2 Listing Import
**URL scraping**:
- Accept: Zillow, Redfin, Realtor.com URLs
- Extract: photos (up to 40), address, price, beds, baths, sqft, description, city
- Download photos → store in Supabase Storage (not raw CDN URLs — they expire)
- Try Cheerio first, Playwright fallback if JS-rendered

**Manual upload**:
- Drag-and-drop photos (react-dropzone)
- Manual address/price/specs input form
- This is the fallback when scraping fails

**Photo management** (before generating):
- Drag to reorder photos
- Click X to remove
- Click star to set as cover (first frame)
- Minimum 3 photos required to generate

### 5.3 Video Customization (Before Generate)
Agent picks BEFORE clicking generate:

| Option | Choices | Default |
|--------|---------|---------|
| Style | Modern, Luxury, Energetic, Minimal | Modern |
| Duration | 15s, 30s, 45s, 60s | 30s |
| Format | Both, 16:9 only, 9:16 only | Both |
| Music | Pick from 20 tracks | Track 1 |
| Neighborhood B-roll | On/Off toggle | On |

Live preview mockup updates as agent picks (NOT actual video render — CSS mockup only).

### 5.4 Video Generation Pipeline (Async)
See `/docs/VIDEO_PIPELINE.md` for full spec.

Summary:
1. API route validates + checks credits + enqueues BullMQ job → returns `{ jobId }`
2. Worker runs async:
   - fal.ai Seedance Fast per photo (max 8 clips, parallel 4 at a time)
   - Pexels fetch 3 neighborhood clips by city name
   - FFmpeg: concatenate → overlay lower-third → mix music → crop to 9:16 → watermark if free
   - Upload both MP4s to Cloudflare R2
   - Update `video_jobs` table: `status = complete`
   - Send "video ready" email via Resend
3. Frontend polls `/api/job/[id]` every 5s

**Target render time**: under 3 minutes for 30s video

### 5.5 Loading Screen (Step 3)
While video renders, show agent:
- Animated progress steps (updating via job status polling)
- Claude-generated listing descriptions (3 variants) — appears after ~15s
- Agent can read/edit/copy descriptions while waiting
- This is productive dead time — critical for UX

### 5.6 Results Screen (Step 4)
After video ready:
- Both video players (9:16 + 16:9) with download buttons
- Listing descriptions (3 tabs: MLS / Social / Luxury) with copy buttons
- Captions per platform (Instagram, TikTok, Facebook) with copy buttons
- Shareable link: `listingos.com/l/[slug]`
- QR code download (links to public listing page)

### 5.7 Post-Generation Edits
Agent can edit WITHOUT re-generating (free):
- Lower-third text (agent name, price, address) → FFmpeg re-render overlay only
- Music change → FFmpeg re-mix only

Agent CAN re-generate (costs 1 credit):
- Style change
- New photos added
- Duration change

### 5.8 Brand Kit
- Logo upload → background-removal-js auto-cleans (browser-side, WASM)
- color-thief auto-extracts 2 colors from logo
- Font picker (10 Google Fonts options)
- Agent name, license #, brokerage, phone, headshot
- Preview: live lower-third mockup updates as agent types
- Saved to DB — applied to ALL future videos

### 5.9 Listing Description (Claude Haiku)
Generated during video render (parallel, not blocking):
- MLS version (max 500 chars, Fair Housing compliant)
- Social version (max 150 chars)
- Luxury version (max 300 chars)
- Fair Housing pre-screen on all outputs
- If violation detected → flag + suggest alternative

### 5.10 Captions (Claude Haiku)
- Instagram (with 5 hashtags)
- TikTok (short, punchy)
- Facebook (conversational)
- All Fair Housing screened

### 5.11 Public Listing Page (`/l/[slug]`)
- Agent headshot + name + brokerage + phone
- 16:9 video (autoplay muted)
- Address + price + specs
- MLS description
- Photo gallery (swipeable)
- Neighborhood: Walk Score (scraped), nearby places (Google Places)
- Lead capture form → email to agent + stored in DB
- View counter (shown to agent only)
- "Powered by ListingOS" footer — hidden on paid plans

### 5.12 Billing
- Stripe Checkout for plan selection
- Stripe Customer Portal for management (no custom billing UI)
- Webhooks: `customer.subscription.created/updated/deleted`
- Credit check + deduct in same DB transaction (atomic)
- Trial end → email reminder at day 5 and day 7

### 5.13 Dashboard
- Recent 3 videos with thumbnails
- Stats: videos this month, total views, leads captured
- Usage bar: X/10 listings used

---

## 6. Phase 2 — After 50 Paying Agents

- Social pack (IG carousel, Story, Just Listed/Sold/Open House variants)
- ElevenLabs AI voiceover
- Basic virtual staging (empty room → 3 style presets)
- Market update reel (agent inputs 3 stats → branded video)
- Open house pack (invite video + flyer PDF + QR)
- Analytics per listing (views, leads, shares)

## 7. Phase 3 — After 200 Paying Agents

- MLS auto-trigger (new listing → auto-generate)
- Follow Up Boss CRM integration
- Brokerage admin (seats, locked branding, approval workflow)
- Chrome browser extension
- White label ($49/mo add-on)
- Testimonial collection (SMS → client records video)

---

## 8. What We Are NOT Building

| Feature | Reason |
|---------|--------|
| AI talking head / avatar | HeyGen owns this |
| 360° virtual tours | Matterport owns this |
| Built-in CRM | Not competing with FUB/kvCORE |
| Full social media scheduler | Buffer exists |
| Drone footage AI | Liability + misleading |
| AI people in rooms | Fair Housing liability |
| Floor plan generation | Low retention, niche |
| Mobile app (Phase 1) | Web-first, PWA later |

---

## 9. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Video generation time | < 3 minutes (30s video) |
| Page load (dashboard) | < 1.5s |
| API response (scrape trigger) | < 500ms (async, returns jobId) |
| Uptime | 99.5% |
| Video storage cost | R2 at $0.015/GB/mo |
| Cost per video produced | < $1.00 |

## 10. Security Requirements

- All routes behind Supabase Auth middleware
- RLS on every DB table — users can only access their own data
- Signed URLs for all R2 video access (expire 24h)
- Stripe webhook signature verification
- Rate limiting on `/api/scrape` (5 req/min per user)
- Input sanitization on all user-provided text before Claude prompt injection
- Fair Housing violations logged for audit trail