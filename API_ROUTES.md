# ListingOS — API Routes Specification

All routes under `/app/api/`. Auth via Supabase session cookie unless marked public.

---

## POST /api/scrape

**Auth**: Required  
**Purpose**: Scrape listing URL and store photos + data

### Input (Zod validated)
```ts
{
  url: string // Zillow | Redfin | Realtor.com URL
}
```

### Process
1. Validate URL is from allowed domain
2. Try Cheerio scrape → fallback Playwright
3. Download photos → upload to Supabase Storage at `listings/{userId}/{listingId}/photos/`
4. Generate slug (address-based, url-safe, unique)
5. Insert listing row (status: draft)
6. Return structured data

### Response
```ts
{
  listingId: string
  slug: string
  address: string
  city: string
  price: number
  beds: number
  baths: number
  sqft: number
  description: string
  photos: { url: string; order: number; isCover: boolean }[]
}
```

### Errors
```ts
400: { error: "Invalid URL" | "Unsupported domain" }
422: { error: "Could not extract listing data", fallback: "manual_upload" }
429: { error: "Rate limit: 5 scrapes per minute" }
402: { error: "No credits remaining", upgradeUrl: "/dashboard/account" }
```

---

## POST /api/generate

**Auth**: Required  
**Purpose**: Deduct credit, enqueue video generation job

### Input (Zod validated)
```ts
{
  listingId: string     // must belong to authed user
  style: "modern" | "luxury" | "energetic" | "minimal"
  durationSeconds: 15 | 30 | 45 | 60
  formats: "both" | "16x9" | "9x16"
  musicTrackId: string  // uuid from music_tracks table
  includeNeighborhoodBroll: boolean
}
```

### Process
1. Verify listing belongs to user
2. Call `check_and_deduct_credit(userId)` DB function (atomic)
3. Insert `video_jobs` row (status: queued)
4. Enqueue BullMQ job with all params
5. Trigger Claude description generation IN PARALLEL (non-blocking)
6. Return jobId immediately

### Response
```ts
{
  jobId: string
  estimatedSeconds: 120 // for UI progress estimate
}
```

### Errors
```ts
402: { error: "No credits remaining" }
404: { error: "Listing not found" }
409: { error: "Video already generating for this listing" }
```

---

## GET /api/job/[id]

**Auth**: Required  
**Purpose**: Poll video job status (frontend polls every 5s)

### Response (varies by status)
```ts
// Queued
{ status: "queued", progressStep: "Waiting to start...", progressPercent: 0 }

// Processing
{ status: "processing", progressStep: "Rendering cinematic motion...", progressPercent: 45 }

// Complete
{
  status: "complete",
  progressPercent: 100,
  video: {
    url16x9: string   // signed R2 URL (24h expiry)
    url9x16: string
    thumbnailUrl: string
    durationSeconds: number
  },
  listing: {
    descriptionMls: string
    descriptionSocial: string
    descriptionLuxury: string
    captionInstagram: string
    captionTiktok: string
    captionFacebook: string
    shareUrl: string  // listingos.com/l/[slug]
    qrCodeUrl: string
  }
}

// Failed
{ status: "failed", error: "Video generation failed. Credit refunded." }
```

---

## POST /api/brand

**Auth**: Required  
**Purpose**: Save brand kit

### Input
```ts
{
  logoUrl?: string
  primaryColor?: string    // hex
  accentColor?: string     // hex
  font?: string
  agentName?: string
  licenseNumber?: string
  brokerage?: string
  phone?: string
  headshotUrl?: string
}
```

### Response
```ts
{ success: true, brandKit: BrandKit }
```

---

## POST /api/upload

**Auth**: Required  
**Purpose**: Presigned URL for direct client → Supabase Storage upload

### Input
```ts
{
  filename: string
  contentType: "image/jpeg" | "image/png" | "image/webp"
  purpose: "logo" | "headshot" | "listing_photo"
}
```

### Response
```ts
{
  uploadUrl: string   // presigned Supabase Storage URL
  publicUrl: string   // URL after upload completes
}
```

---

## PATCH /api/listings/[id]

**Auth**: Required  
**Purpose**: Update listing text content (descriptions, captions)

### Input (all optional)
```ts
{
  descriptionMls?: string
  descriptionSocial?: string
  descriptionLuxury?: string
  captionInstagram?: string
  captionTiktok?: string
  captionFacebook?: string
  address?: string
  price?: number
}
```

---

## POST /api/leads

**Auth**: None (public)  
**Purpose**: Capture lead from public listing page

### Input
```ts
{
  listingId: string
  name: string
  email: string
  phone?: string
  message?: string
}
```

### Process
1. Insert lead row
2. Increment `listings.lead_count`
3. Send email to agent via Resend

### Response
```ts
{ success: true }
```

---

## POST /api/listings/[id]/view

**Auth**: None (public)  
**Purpose**: Track view on public listing page

### Process
- Increment `listings.view_count`
- Debounce: 1 view per IP per listing per hour (Redis)

---

## POST /api/webhooks/stripe

**Auth**: Stripe signature (no user auth)  
**Purpose**: Handle Stripe subscription events

### Events handled
```
customer.subscription.created  → set plan + status in users table
customer.subscription.updated  → update plan + status
customer.subscription.deleted  → set plan=trial, status=canceled
invoice.payment_failed         → set status=past_due, send email
invoice.payment_succeeded      → reset listings_used_this_month=0
```

### Critical
- Always verify `stripe-signature` header before processing
- Return 200 immediately, process async
- Idempotency: check event already processed

---

## Progress Steps (for UI)

The worker updates `video_jobs.progress_step` as it runs.
Frontend displays these strings verbatim.

```ts
const PROGRESS_STEPS = [
  { step: "Importing your listing photos",   percent: 10 },
  { step: "Fetching neighborhood clips",     percent: 20 },
  { step: "Rendering cinematic motion",      percent: 35 }, // fal.ai - longest
  { step: "Assembling your video",           percent: 70 },
  { step: "Adding your branding",            percent: 80 },
  { step: "Mixing music",                    percent: 88 },
  { step: "Creating your 9:16 version",      percent: 93 },
  { step: "Uploading final video",           percent: 97 },
  { step: "Done!",                           percent: 100 },
]
```
