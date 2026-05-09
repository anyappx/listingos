# ListingOS — Environment Variables

Copy to `.env.local` for development. Add all to Railway + Vercel for production.

---

## Core App
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Production: https://listingos.com
```

---

## Supabase
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
# Get from: supabase.com → project → Settings → API

NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
# Get from: same page — anon/public key

SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
# Get from: same page — service_role key (NEVER expose client-side)
```

---

## Stripe
```bash
STRIPE_SECRET_KEY=sk_live_...
# Get from: dashboard.stripe.com → Developers → API keys
# Use sk_test_ for development

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
# Same page — publishable key

STRIPE_WEBHOOK_SECRET=whsec_...
# Get from: Stripe → Developers → Webhooks → your endpoint → Signing secret

STRIPE_SOLO_PRICE_ID=price_...
# Create in Stripe: Products → Add product → $29/mo recurring
# Copy the Price ID

STRIPE_AGENT_PRICE_ID=price_...
# Same — $79/mo recurring
```

---

## fal.ai
```bash
FAL_KEY=xxxxx-xxxx-xxxx-xxxx
# Get from: fal.ai → Dashboard → API Keys → Create
```

---

## Anthropic (Claude Haiku)
```bash
ANTHROPIC_API_KEY=sk-ant-...
# Get from: console.anthropic.com → API Keys
```

---

## Cloudflare R2
```bash
R2_ACCOUNT_ID=xxxxxxxxxxxx
# Get from: dash.cloudflare.com → R2 → Overview

R2_ACCESS_KEY_ID=xxxxxxxxxxxx
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxx
# Get from: R2 → Manage R2 API Tokens → Create API Token
# Permissions: Object Read & Write

R2_BUCKET_NAME=listingos-videos
# Create bucket first in R2 dashboard

R2_PUBLIC_URL=https://pub-xxxx.r2.dev
# Enable public access on bucket (for thumbnails only)
# Videos use signed URLs
```

---

## Upstash Redis (BullMQ)
```bash
UPSTASH_REDIS_URL=rediss://default:xxxx@xxxx.upstash.io:6379
UPSTASH_REDIS_TOKEN=xxxx
# Get from: console.upstash.com → Create Database → REST API
```

---

## Pexels (B-roll)
```bash
PEXELS_API_KEY=xxxxxxxxxxxx
# Get from: pexels.com/api → Your API Key (free)
```

---

## Google Places (Neighborhood)
```bash
GOOGLE_PLACES_API_KEY=AIzaSy...
# Get from: console.cloud.google.com → APIs & Services → Credentials
# Enable: Places API (New)
# Free: $200/mo credit — more than enough
```

---

## Resend (Email)
```bash
RESEND_API_KEY=re_xxxx
# Get from: resend.com → API Keys → Create API Key (free tier: 3K/mo)

RESEND_FROM_EMAIL=noreply@listingos.com
# Must be verified domain in Resend
```

---

## Worker (Railway only)
```bash
WORKER_CONCURRENCY=3
# Max parallel video jobs. Keep at 3 on Railway free tier.
```

---

## Development Only
```bash
PLAYWRIGHT_HEADLESS=true
# Keep true in prod, set false locally to debug scraping
```

---

## Setup Order
1. Supabase — create project, run DB_SCHEMA.sql, copy keys
2. Stripe — create products + prices, set up webhook endpoint
3. fal.ai — create account, get API key
4. Anthropic — get API key
5. Cloudflare R2 — create bucket, create API token
6. Upstash — create Redis DB
7. Pexels — get free API key
8. Google Cloud — enable Places API, get key
9. Resend — verify domain, get API key
