# fal.ai Integration Patterns
# /skills/fal-api.md

## Setup
```ts
// /lib/fal.ts
import * as fal from "@fal-ai/serverless-client"
fal.config({ credentials: process.env.FAL_KEY })
export { fal }
```

## Image to Video (Seedance Fast — default)
```ts
const result = await fal.subscribe(
  "fal-ai/seedance/v1/lite/image-to-video",
  {
    input: {
      image_url: supabasePhotoUrl, // must be public URL
      duration: 4,                 // seconds per clip
      resolution: "720p",          // NOT 1080p — cost control
      motion_strength: 0.7,        // 0-1, sweet spot for RE
    },
    onQueueUpdate: (update) => {
      // optional: update job progress in DB
    },
    timeout: 90_000
  }
)
// result.video.url → temp URL, DOWNLOAD IMMEDIATELY (expires 1hr)
```

## Motion strength by style
```ts
const MOTION_BY_STYLE = {
  modern:    0.7,
  luxury:    0.5,
  energetic: 0.9,
  minimal:   0.4,
}
```

## Parallel calls (max 4 at once)
```ts
import pLimit from 'p-limit'
const limit = pLimit(4)
const clips = await Promise.all(
  photos.map(photo => limit(() => generateClip(photo.url, style)))
)
```

## On timeout: fallback
```ts
// Skip fal.ai, use FFmpeg Ken Burns on static image instead
// No credit cost, acceptable quality for 1-2 clips
ffmpeg()
  .input(photoPath)
  .videoFilter('zoompan=z=\'min(zoom+0.001,1.3)\':x=iw/2:y=ih/2:d=125:s=1280x720')
  .output(outputPath)
```

---

# FFmpeg Recipes
# /skills/ffmpeg-recipes.md

## 1. Concatenate clips
```ts
// Write filelist.txt first
const fileList = clips.map(c => `file '${c}'`).join('\n')
await fs.writeFile(`/tmp/${jobId}/filelist.txt`, fileList)

ffmpeg()
  .input(`/tmp/${jobId}/filelist.txt`)
  .inputOptions(['-f concat', '-safe 0'])
  .outputOptions(['-c:v libx264', '-crf 23', '-preset fast', '-an'])
  .output(outputPath)
```

## 2. Lower-third overlay
```ts
const text = `${agentName} | ${brokerage}`.replace(/'/g, "\\'")
ffmpeg()
  .input(inputPath)
  .videoFilter([
    `drawtext=text='${text}':`,
    `fontfile=/app/public/fonts/Inter-SemiBold.ttf:`,
    `fontsize=22:fontcolor=white:`,
    `x=40:y=h-70:`,
    `box=1:boxcolor=black@0.6:boxborderw=10`
  ].join(''))
  .output(outputPath)
```

## 3. Mix music + fade out
```ts
ffmpeg()
  .input(videoPath)
  .input(musicPath)
  .complexFilter([
    `[1:a]volume=0.35,afade=t=out:st=${duration - 3}:d=3[music]`
  ])
  .outputOptions(['-map 0:v', '-map [music]', '-shortest'])
  .output(outputPath)
```

## 4. Crop 16:9 → 9:16 (center crop)
```ts
ffmpeg()
  .input(input16x9)
  .videoFilter('crop=ih*9/16:ih:(iw-ih*9/16)/2:0')
  .output(output9x16)
```

## 5. Watermark (free/trial tier)
```ts
ffmpeg()
  .input(videoPath)
  .input('/app/public/watermark.png')
  .complexFilter(['overlay=W-w-20:H-h-20'])
  .output(outputPath)
```

## 6. Extract thumbnail
```ts
ffmpeg()
  .input(videoPath)
  .screenshots({ count: 1, timemarks: ['00:00:02'], filename: 'thumb.jpg', folder: tmpDir })
```

---

# Claude Prompt Templates
# /skills/claude-prompts.md

## Model
```ts
import Anthropic from '@anthropic-ai/sdk'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
// Always use: claude-haiku-4-5 (cheapest + fastest)
```

## Listing Description
```ts
const response = await client.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 600,
  messages: [{
    role: "user",
    content: `You write real estate listing descriptions.
CRITICAL: Comply with Fair Housing Act. Never mention:
families, children, schools nearby, religion, nationality,
disability, gender, age, safe area, quiet neighborhood,
exclusive, walking distance to schools, ideal for couples.

Write 3 descriptions for this property:
Address: ${address}
Price: $${price.toLocaleString()}
Beds: ${beds} | Baths: ${baths} | Sqft: ${sqft.toLocaleString()}
Agent notes: ${rawDescription}

Return ONLY valid JSON:
{
  "mls": "max 500 chars, factual, professional",
  "social": "max 150 chars, engaging, with 1 emoji",
  "luxury": "max 300 chars, aspirational, sensory language"
}`
  }]
})
const parsed = JSON.parse(response.content[0].text)
```

## Caption Generator
```ts
const response = await client.messages.create({
  model: "claude-haiku-4-5",
  max_tokens: 400,
  messages: [{
    role: "user",
    content: `Write social captions for a real estate listing.
Address: ${address}
Price: $${price.toLocaleString()}
Style: ${style}

Return ONLY valid JSON:
{
  "instagram": "engaging caption + 5 hashtags, max 200 chars total",
  "tiktok": "punchy opener, max 100 chars, no hashtags",
  "facebook": "conversational, max 180 chars, end with question"
}`
  }]
})
```

## Fair Housing Filter
```ts
const BANNED_PHRASES = [
  'perfect for families', 'great for kids', 'walking distance to schools',
  'quiet neighborhood', 'safe area', 'exclusive community', 'prestigious',
  'ideal for couples', 'bachelor', 'no kids', 'adults only',
  'near church', 'near mosque', 'near synagogue', 'near temple',
]

// Fast check — no API call needed
function quickFairHousingCheck(text: string): { passed: boolean; flagged: string[] } {
  const lower = text.toLowerCase()
  const flagged = BANNED_PHRASES.filter(phrase => lower.includes(phrase))
  return { passed: flagged.length === 0, flagged }
}

// If quick check flags → use Claude for nuanced review + suggestion
```

---

# Scraping Patterns
# /skills/scraping-patterns.md

## User Agents (rotate these)
```ts
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
]
const randomUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
```

## Cheerio (try first — no browser)
```ts
import * as cheerio from 'cheerio'

async function scrapeWithCheerio(url: string) {
  await sleep(1000 + Math.random() * 1000) // anti-bot delay

  const res = await fetch(url, {
    headers: {
      'User-Agent': randomUA(),
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const html = await res.text()
  const $ = cheerio.load(html)

  // Zillow selectors (update if they change)
  return {
    address: $('[data-testid="home-details-summary"] h1').text().trim(),
    price: parsePrice($('[data-testid="price"]').text()),
    // ... etc
  }
}
```

## Playwright (fallback for JS-rendered pages)
```ts
import { chromium } from 'playwright'

async function scrapeWithPlaywright(url: string) {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  await page.setExtraHTTPHeaders({ 'User-Agent': randomUA() })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.waitForTimeout(2000 + Math.random() * 1000)

  const data = await page.evaluate(() => {
    // Extract from window.__INITIAL_STATE__ or DOM
    return window?.__INITIAL_STATE__?.listing ?? null
  })

  await browser.close()
  return data
}
```

## Photo download + Supabase upload
```ts
async function downloadAndStorePhoto(photoUrl: string, userId: string, listingId: string, order: number) {
  const res = await fetch(photoUrl)
  const buffer = await res.arrayBuffer()
  const ext = 'jpg'
  const path = `listings/${userId}/${listingId}/photos/${order}.${ext}`

  await supabase.storage
    .from('listing-assets')
    .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })

  const { data } = supabase.storage.from('listing-assets').getPublicUrl(path)
  return data.publicUrl
}
```

---

# Supabase RLS Patterns
# /skills/supabase-rls.md

## Always use service role key on server, anon key on client
```ts
// /lib/supabase/server.ts — for API routes + workers
import { createClient } from '@supabase/supabase-js'
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // bypasses RLS when needed
)

// /lib/supabase/client.ts — for browser
import { createBrowserClient } from '@supabase/ssr'
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // respects RLS
)
```

## Always filter by user_id on server (defense in depth)
```ts
// Even though RLS enforces this, always explicit:
const { data } = await supabaseAdmin
  .from('listings')
  .select('*')
  .eq('user_id', userId) // always add this
  .order('created_at', { ascending: false })
```

## Public listing page (no auth)
```ts
// Use anon client — RLS policy allows public select on listings
const { data } = await supabase
  .from('listings')
  .select('*, videos(*)')
  .eq('slug', slug)
  .single()
```

## Stripe webhook (service role, bypasses RLS)
```ts
// Webhooks update users table based on Stripe customer ID
// Must use service role — no auth session in webhook
await supabaseAdmin
  .from('users')
  .update({ plan: newPlan, subscription_status: newStatus })
  .eq('stripe_customer_id', customerId)
```
