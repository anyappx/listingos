# ListingOS — Claude Code Root Context

## What We're Building
Real estate AI video SaaS. Agent pastes a Zillow/Redfin URL →
gets a branded cinematic video in under 2 minutes.
Target: US real estate agents. Price: $29–$79/mo.

## Stack
- **Framework**: Next.js (App Router) + TypeScript
- **Auth + DB**: Supabase (auth, postgres, storage)
- **Payments**: Stripe (subscriptions + webhooks)
- **Video AI**: fal.ai → Seedance Fast v1.5 ($0.66/video)
- **Text AI**: Claude Haiku 4.5 (descriptions, captions, fair housing)
- **Video Assembly**: FFmpeg via fluent-ffmpeg
- **Job Queue**: BullMQ + Upstash Redis
- **Video Storage**: Cloudflare R2
- **B-roll**: Pexels API (free, commercial use)
- **Neighborhood**: Google Places API (free $200/mo credit)
- **Email**: Resend + React Email
- **UI**: shadcn/ui + Tailwind CSS
- **Hosting**: Vercel (frontend) + Railway (workers)

## Commands
```bash
npm run dev          # local dev server
npm run build        # production build
npm run worker       # start BullMQ video worker (Railway)
npm run typecheck    # TypeScript check
npm run lint         # ESLint
```

## Project Structure
```
/app
  /api
    /scrape/route.ts
    /generate/route.ts
    /job/[id]/route.ts
    /webhooks/stripe/route.ts
    /brand/route.ts
    /content/route.ts
    /leads/route.ts
    /listings/[id]/route.ts
    /listings/[id]/view/route.ts
  /(auth)
    /login/page.tsx
    /signup/page.tsx
  /(dashboard)
    /dashboard/page.tsx
    /dashboard/new/page.tsx
    /dashboard/new/customize/page.tsx
    /dashboard/new/generating/page.tsx
    /dashboard/new/done/page.tsx
    /dashboard/listings/page.tsx
    /dashboard/listings/[id]/page.tsx
    /dashboard/brand/page.tsx
    /dashboard/music/page.tsx
    /dashboard/account/page.tsx
  /l/[slug]/page.tsx

/components
  /ui/                      # shadcn/ui components
  /dashboard/               # dashboard-specific components

/lib
  /fal.ts
  /supabase/client.ts
  /supabase/server.ts
  /supabase/middleware.ts
  /claude.ts
  /ffmpeg.ts
  /stripe.ts
  /r2.ts
  /pexels.ts
  /places.ts
  /qr.ts
  /resend.ts
  /scraper.ts
  /types.ts
  /validations.ts

/workers
  /video.ts
  /queue.ts

/prompts
  /listing-description.ts
  /captions.ts
  /fair-housing.ts

/emails
  /welcome.tsx
  /video-ready.tsx
  /trial-ending.tsx

/public
  /music/                   # 20 pre-cleared MP3 tracks
  /watermark.png
```

## Absolute Rules (Never Break These)
1. **No hardcoded secrets** — always `process.env.VARIABLE_NAME`
2. **RLS on every table** — check `DB_SCHEMA.sql` for policies
3. **Video jobs are ASYNC** — queue with BullMQ, never block API route
4. **Watermark on free/trial** — enforced server-side in worker, never client
5. **Fair Housing filter** — runs before EVERY description/caption output
6. **Signed URLs only** — never expose public R2 bucket URLs to client
7. **Zod validates everything** — all API inputs, all scraped data
8. **Credit check before generation** — check + deduct atomically in DB

## Plan Limits
| Plan   | Price  | Listings/mo | Videos/listing |
|--------|--------|-------------|----------------|
| Trial  | Free   | 1 total     | 1              |
| Solo   | $29/mo | 3           | 2 (16:9+9:16)  |
| Agent  | $79/mo | 10          | 2 (16:9+9:16)  |
