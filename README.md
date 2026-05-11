# ListingOS

Real estate AI video SaaS. Paste a listing URL → get a branded cinematic video + full content pack in under 3 minutes.

## Quick Start

### 1. Environment

```bash
cp .env.example .env.local
# Fill in at minimum: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#                     SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
```

### 2. Supabase Setup

- Go to Supabase dashboard → **Storage** → **New bucket**
- Name: `listing-photos`, Public: **Yes**
- Run migrations in SQL Editor: paste `docs/migrations/LOS-003-add-columns.sql`

### 3. Install Dependencies

```bash
npm install
pip3 install -r requirements.txt   # Python deps for parallax video (optional — falls back to Ken Burns)
```

### 4. Run

Two terminals are required:

```bash
# Terminal 1 — Next.js frontend
npm run dev

# Terminal 2 — Video pipeline worker
npm run dev:worker
```

Or run both together:

```bash
npm run dev:all
```

Open **http://localhost:3000**

---

## How It Works

1. **Import** — Paste a Redfin/Realtor.com URL (Zillow is bot-blocked — use Redfin) or upload photos manually
2. **Customize** — Pick style, duration, music, headline, output formats
3. **Generate** — Worker picks up the job, runs FFmpeg + parallax pipeline (~2 min)
4. **Done** — Download MP4, copy captions, share QR code, view Content Pack

## Troubleshooting

**Video won't generate?**
- Make sure the worker is running: `npm run dev:worker` in a second terminal
- Check worker terminal for errors

**Photos won't upload?**
- Create the `listing-photos` bucket in Supabase Storage (Public: Yes)

**Zillow URL doesn't get photos?**
- Zillow blocks all automated access. Use a **Redfin** URL instead, or drag-and-drop photos manually. Set `SCRAPER_API_KEY` to bypass via residential proxy.

**Parallax not working / Ken Burns fallback?**
- Run: `pip3 install -r requirements.txt`
- The depth model (~25MB) downloads automatically on first run

**Content Pack empty?**
- Requires `ANTHROPIC_API_KEY` in `.env.local`

## Stack

- **Frontend**: Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui
- **Database**: Supabase (Postgres + Auth + Storage)
- **Video**: FFmpeg (`ffmpeg-static`) + Python depth-parallax (`scripts/parallax-cpu.py`)
- **AI**: Claude Haiku (`@anthropic-ai/sdk`) — descriptions, captions, content pack
- **Queue**: Supabase polling worker (`scripts/worker-poll.js`)
- **Payments**: Stripe
- **Storage**: Cloudflare R2 (dev falls back to `/public/videos/`)
- **Deploy**: Vercel (frontend) + Railway (worker)

## Deploy

```bash
# Frontend
vercel --prod

# Worker (Railway)
# Start command: node scripts/worker-poll.js
# Set all env vars from .env.example in Railway dashboard
```
