# ListingOS

Real estate AI video SaaS. Agent pastes a listing URL → gets a branded
cinematic video with full content pack in under 3 minutes.

## Stack (LOCKED — do NOT change or suggest alternatives)

- **Framework**: Next.js 14 App Router + TypeScript strict
- **UI**: Tailwind CSS + shadcn/ui + Lucide icons + Sonner toasts
- **Auth + DB + Storage**: Supabase (auth, postgres, storage)
- **Payments**: Stripe (subscriptions + webhooks)
- **Video**: FFmpeg via fluent-ffmpeg + Python parallax (scripts/)
- **AI Text**: Claude Haiku via @anthropic-ai/sdk
- **Queue**: Supabase polling (scripts/worker-poll.js)
- **Email**: Resend + React Email
- **Video Storage**: Cloudflare R2 (fallback: /public/videos/)
- **Deploy**: Vercel (frontend) + Railway (worker)

## Commands

```bash
npm run dev          # local dev
npm run build        # production build
npm run typecheck    # TypeScript check (must pass, 0 errors)
npm run lint         # ESLint (must pass, 0 errors)
node scripts/worker-poll.js  # start pipeline worker
```

## Project Structure

```
app/
  (auth)/login, signup
  (dashboard)/dashboard/*, new/*, listings/*, brand, music, account, refer
  api/scrape, generate, job/[id], content/pack, brand, upload,
      listings/[id], leads, billing/*, webhooks/stripe
  l/[slug]            # public listing page
  auth/callback       # OAuth callback
components/
  ui/                 # shadcn components (DO NOT MODIFY)
  dashboard/          # dashboard-specific components
lib/
  claude.ts           # Claude Haiku client
  scraper.ts          # Zillow + Redfin scraper
  stripe.ts           # Stripe client
  r2.ts               # Cloudflare R2 client
  pexels.ts           # Pexels API (free B-roll)
  qr.ts               # QR code generation
  resend.ts           # Email client
  types.ts            # ALL TypeScript interfaces
  validations.ts      # ALL Zod schemas
  supabase/client.ts  # browser Supabase client
  supabase/server.ts  # server Supabase client
prompts/              # Claude prompt templates
scripts/
  pipeline.js         # THE video pipeline (CJS, not ESM)
  parallax-cpu.py     # depth-based parallax renderer
  worker-poll.js      # Supabase job polling worker
  models/             # ONNX model files (auto-downloaded)
public/music/         # 20 royalty-free tracks
public/skies/         # 10 CC0 sky replacement images
skills/               # Claude Code pattern files
tickets/              # Jira-style task tickets
docs/                 # PRD, decisions, architecture
```

## Absolute Rules (NEVER break these)

1. **No hardcoded secrets** — always process.env.VARIABLE_NAME
2. **No `any` types** — use proper TypeScript types from lib/types.ts
3. **No new dependencies** — unless the ticket explicitly says to add one
4. **No refactoring** — unless the ticket explicitly says to refactor
5. **No alternative suggestions** — use the locked stack above, period
6. **No inline styles** — use Tailwind classes only
7. **Every API route**: auth check → input validation → try/catch → error logging
8. **Every page**: loading skeleton → error state → empty state → data state
9. **Every form**: client-side validation + server-side validation
10. **Every async action**: loading indicator + error toast + success toast
11. **Mobile responsive**: every page must work at 375px width
12. **scripts/ directory**: uses require() (CJS), NOT import (ESM)
13. **Supabase queries**: always filter by user_id (defense in depth + RLS)
14. **Video jobs**: always async — never block API route
15. **Free/trial users**: always get watermark (server-side enforced)
16. **Fair Housing**: filter runs before EVERY text output to agents
17. **Git commit**: after every completed ticket with message "LOS-XXX: description"

## How to Read Tickets

Each ticket has:
- READ FIRST: files/skills to read before starting
- FILES: exact files to create or modify (touch NOTHING else)
- REQUIREMENTS: numbered list of exact behaviors
- ERROR HANDLING: what to do when things fail
- TEST: how to verify the ticket is done
- DONE: checklist that must all be true

Follow the ticket literally. Do not interpret. Do not expand scope.

## Plans & Limits

| Plan  | Price  | Listings/mo | Outputs per listing |
|-------|--------|-------------|---------------------|
| Trial | Free   | 1           | 2 (16:9+9:16 branded) |
| Solo  | $29/mo | 3           | 4 (branded+clean × 2 formats) |
| Agent | $79/mo | 10          | up to 8 (4 formats × branded+clean) |

## Key Env Vars (see docs/ENV_VARS.md for full list)

```
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_SOLO_PRICE_ID, STRIPE_AGENT_PRICE_ID
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
PEXELS_API_KEY
RESEND_API_KEY
NEXT_PUBLIC_APP_URL
```
