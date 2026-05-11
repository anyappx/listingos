# ListingOS — Complete App Flow Map

Every page. Every state. Every error. Every redirect. Every edge case.
If it's not in this document, it doesn't exist in the app.

---

## ROUTE MAP (complete)

```
PUBLIC (no auth required):
  /                              → Landing page
  /l/[slug]                      → Public listing page (buyer-facing)
  /l/[slug]/rsvp                 → Open house RSVP form
  /[agent-slug]                  → Agent digital card (Phase 2)

AUTH:
  /login                         → Login page
  /signup                        → Signup page
  /signup?ref=[CODE]             → Signup with referral
  /signup?plan=solo              → Signup with pre-selected plan
  /signup?plan=agent             → Signup with pre-selected plan
  /auth/callback                 → Supabase OAuth callback
  /forgot-password               → Password reset request
  /reset-password                → Password reset form (from email link)

DASHBOARD (auth required — redirect to /login if no session):
  /dashboard                     → Home (recent videos + stats)
  /dashboard/new                 → Step 1: Import listing
  /dashboard/new/customize       → Step 2: Customize video
  /dashboard/new/generating      → Step 3: Generating (polling)
  /dashboard/new/done            → Step 4: Results + downloads
  /dashboard/listings            → All listings grid
  /dashboard/listings/[id]       → Single listing detail + edit
  /dashboard/listings/[id]/edit  → Quick re-edit (music/text swap)
  /dashboard/brand               → Brand kit editor
  /dashboard/music               → Music library browser
  /dashboard/account             → Plan + billing + profile
  /dashboard/refer               → Referral dashboard

API ROUTES:
  POST   /api/scrape             → Scrape listing URL
  POST   /api/generate           → Trigger video generation
  GET    /api/job/[id]           → Poll job status
  POST   /api/content/pack       → Generate content pack
  POST   /api/brand              → Save brand kit
  POST   /api/upload             → Presigned upload URL
  PATCH  /api/listings/[id]      → Update listing text/data
  POST   /api/listings/[id]/reedit → Quick re-edit (music/text swap)
  POST   /api/leads              → Capture lead (public, no auth)
  POST   /api/listings/[id]/view → Track view (public, no auth)
  POST   /api/billing/checkout   → Create Stripe checkout session
  POST   /api/billing/portal     → Create Stripe portal session
  POST   /api/webhooks/stripe    → Stripe webhook handler
  POST   /api/auth/forgot        → Trigger password reset email
```

---

## PAGE-BY-PAGE SPECIFICATION

---

### PAGE 1: `/` — Landing Page

**Purpose**: Convert visitor to signup.

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ HEADER                                          │
│  Logo          [Login] [Start Free Trial →]     │
├─────────────────────────────────────────────────┤
│ HERO                                            │
│  "Listing video in 2 minutes. Seriously."       │
│  "Paste your URL. Pick your style. Done."       │
│                                                 │
│  [ Paste listing URL here...        ] [Try →]   │
│                                                 │
│  Below input: "Works with Zillow & Redfin"      │
│                                                 │
│  [DEMO VIDEO PLAYING — autoplay, muted, loop]   │
│  Split: phone mockup (9:16) + laptop (16:9)     │
├─────────────────────────────────────────────────┤
│ BEFORE/AFTER                                    │
│  "From MLS photo to cinematic video"            │
│  Left: static listing photo                     │
│  Right: same photo as parallax video clip        │
│  Slider between them                            │
├─────────────────────────────────────────────────┤
│ HOW IT WORKS (3 steps)                          │
│  1. Paste URL → photos + data scraped           │
│  2. Pick style, music, adjust per-photo         │
│  3. Download 4 formats + content pack           │
├─────────────────────────────────────────────────┤
│ FEATURE GRID (what you get)                     │
│  [Cinematic Video] [Content Pack] [Lead Page]   │
│  [Brand Kit]       [4 Formats]   [MLS Ready]    │
│  Each card: icon + title + 1-line desc          │
├─────────────────────────────────────────────────┤
│ SAMPLE VIDEO                                    │
│  Real listing video playing (full pipeline       │
│  output with intro, overlays, music)            │
│  "Made with ListingOS in 2 minutes"             │
├─────────────────────────────────────────────────┤
│ PRICING (3 cards)                               │
│  Trial: Free / 1 video / watermarked            │
│  Solo: $29/mo / 3 listings / all formats        │
│  Agent: $79/mo / 10 listings / priority         │
│  Each: [Get Started →] button                   │
├─────────────────────────────────────────────────┤
│ FAQ (expandable)                                │
│  "What sites do you support?"                   │
│  "How long does generation take?"               │
│  "Can I use these on MLS?"                      │
│  "What's in the Content Pack?"                  │
│  "Is the video really free?"                    │
├─────────────────────────────────────────────────┤
│ FOOTER                                          │
│  © ListingOS · Terms · Privacy · Support email  │
└─────────────────────────────────────────────────┘
```

**Hero URL input behavior**:
- Agent pastes URL → clicks "Try" → redirect to /signup (stores URL in localStorage)
- After signup → auto-redirect to /dashboard/new with URL pre-filled
- This captures intent BEFORE asking for email

**States**:
- Default: hero section visible
- Mobile: single column, video stacked below text
- Error: none (static page)

**Edge cases**:
- Already logged in + visits `/` → show "Go to Dashboard" button instead of Login
- URL in hero input is invalid → redirect to signup anyway (validate later)

---

### PAGE 2: `/login`

**Layout**:
```
┌──────────────────────────────┐
│         ListingOS Logo       │
│                              │
│    [Continue with Google]    │
│                              │
│    ──── or ────              │
│                              │
│    Email: [              ]   │
│    Password: [           ]   │
│                              │
│    [Log In →]                │
│                              │
│    Forgot password?          │
│    Don't have an account?    │
│    Sign up →                 │
└──────────────────────────────┘
```

**States**:
- Default: form visible
- Loading: button shows spinner, inputs disabled
- Error: red text below form — "Invalid email or password"
- Success: redirect to /dashboard (or /dashboard/new if URL in localStorage)

**Error messages**:
```
"Invalid email or password" — wrong credentials
"Please enter a valid email" — client-side validation
"Account not found. Sign up instead?" — email doesn't exist
"Too many attempts. Try again in 5 minutes." — rate limited
"Check your email to confirm your account" — email not verified
```

**Redirects**:
- Already logged in → redirect to /dashboard
- After login → redirect to returnUrl (if set) or /dashboard
- If localStorage has pendingUrl → redirect to /dashboard/new

---

### PAGE 3: `/signup`

**Layout**: Same as login but with:
```
│    Full Name: [          ]   │
│    Email: [              ]   │
│    Password: [           ]   │
│                              │
│    [Create Account →]        │
│                              │
│    Already have an account?  │
│    Log in →                  │
```

**Query params**:
- `?plan=solo` → pre-select Solo plan (show badge: "You selected Solo — $29/mo")
- `?plan=agent` → pre-select Agent plan
- `?ref=ABC123` → store referral code in form hidden field

**After signup flow**:
1. Supabase creates auth user
2. Trigger `handle_new_user()` DB function → creates public.users row
3. Redirect to /dashboard/new (NOT /dashboard — get them creating immediately)
4. If pendingUrl in localStorage → pre-fill the URL input
5. If no brand kit exists → show toast: "Pro tip: Set up your brand kit for branded videos"

**Edge cases**:
- Password too short (<8 chars) → client-side error
- Email already registered → "Account exists. Log in instead?"
- Google OAuth fails → "Google sign-in failed. Try email instead."
- Referral code invalid → ignore silently (don't block signup)

---

### PAGE 4: `/auth/callback`

**Purpose**: Handle Supabase OAuth redirect after Google sign-in.

**Behavior**:
- Supabase exchanges code for session
- On success → redirect to /dashboard
- On failure → redirect to /login?error=auth_failed

**No UI**: This is a redirect-only route. Shows nothing.

---

### PAGE 5: `/dashboard` — Home

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ SIDEBAR              │ MAIN CONTENT              │
│                      │                            │
│ Logo                 │ "Welcome back, Sarah"      │
│                      │                            │
│ + New Video          │ ┌──────┬──────┬──────┐    │
│ 🏠 Listings          │ │Videos│Views │Leads │    │
│ 🎨 Brand Kit         │ │ 6    │ 142  │ 3    │    │
│ 🎵 Music             │ └──────┴──────┴──────┘    │
│ ⚙️ Account           │                            │
│ 🔗 Refer             │ Usage: ████░░░░░ 6/10     │
│                      │                            │
│ ─────────            │ RECENT VIDEOS              │
│ Solo Plan            │ ┌─────────────────────┐   │
│ 6/10 listings        │ │ [thumb] 123 Maple    │   │
│ Resets in 12d        │ │ May 8 · 847 views    │   │
│                      │ │ [Share] [Download]   │   │
│                      │ ├─────────────────────┤   │
│                      │ │ [thumb] 456 Oak Ave  │   │
│                      │ │ May 5 · 234 views    │   │
│                      │ │ [Share] [Download]   │   │
│                      │ ├─────────────────────┤   │
│                      │ │ [thumb] 789 Pine Dr  │   │
│                      │ │ May 2 · 91 views     │   │
│                      │ │ [Share] [Download]   │   │
│                      │ └─────────────────────┘   │
│                      │                            │
│                      │ [View All Listings →]      │
└──────────────────────┴────────────────────────────┘
```

**States**:
- **Empty state** (new user, 0 videos):
  ```
  "Create your first listing video"
  [🎬 New Video →]
  
  or try our sample listing:
  [Try Demo Listing →]
  ```
- **Has videos**: show recent 3 with thumbnails
- **Loading**: skeleton cards while fetching

**Sidebar states**:
- Plan badge: "Trial" (gray) / "Solo" (blue) / "Agent" (gold)
- Usage bar: green if <70%, yellow if <90%, red if ≥100%
- "Resets in Xd" countdown to next billing cycle

**Onboarding banner** (shows only if brand_kit is incomplete):
```
┌─────────────────────────────────────────────┐
│ ⚡ Complete your setup for branded videos    │
│ [Upload Logo] [Add Your Info] [Create Video]│
│ ████████░░ 2/3 complete                      │
└─────────────────────────────────────────────┘
```
Dismissable. Shows until brand kit has: logo + agent_name + phone.

**Data fetched**:
```ts
// Supabase queries on page load:
const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
const { data: listings } = await supabase.from('listings')
  .select('*, videos(*)')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
  .limit(3);
const { data: brandKit } = await supabase.from('brand_kits').select('*').eq('user_id', userId).single();
```

---

### PAGE 6: `/dashboard/new` — Step 1: Import Listing

**Purpose**: Agent provides listing data (URL or manual upload).

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ STEP INDICATOR                                   │
│ ●━━━━━○━━━━━○━━━━━○                              │
│ Import  Customize  Generate  Download             │
├─────────────────────────────────────────────────┤
│                                                   │
│         "Import your listing"                     │
│                                                   │
│  ┌───────────────────────────────────────┐       │
│  │ Paste Zillow or Redfin URL            │       │
│  │ [https://redfin.com/CA/...       ] [→]│       │
│  └───────────────────────────────────────┘       │
│                                                   │
│  ── or upload photos manually ──                  │
│                                                   │
│  ┌───────────────────────────────────────┐       │
│  │                                       │       │
│  │   📷 Drag & drop photos here          │       │
│  │   or click to browse                  │       │
│  │   JPEG, PNG, WebP · min 800×600       │       │
│  │                                       │       │
│  └───────────────────────────────────────┘       │
│                                                   │
│  ── or try a demo listing ──                      │
│  [🏠 Use Sample Listing]                          │
│                                                   │
└─────────────────────────────────────────────────┘
```

**After URL import succeeds**:
```
┌─────────────────────────────────────────────────┐
│ ✅ Found 37 photos · 123 Maple St, Austin TX     │
│                                                   │
│ PHOTOS (drag to reorder, click ★ for cover):      │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐      │
│ │ ★  │ │    │ │    │ │    │ │    │ │    │      │
│ │img1│ │img2│ │img3│ │img4│ │img5│ │img6│      │
│ │ ✕  │ │ ✕  │ │ ✕  │ │ ✕  │ │ ✕  │ │ ✕  │      │
│ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘      │
│ ... +31 more (scrollable)                        │
│                                                   │
│ LISTING DETAILS (editable):                       │
│ Address: [123 Maple St, Austin TX 78701   ]      │
│ Price:   [$485,000                         ]      │
│ Beds: [3]  Baths: [2]  Sqft: [1,842      ]      │
│ Description: [Charming 3-bed home...      ]      │
│                                                   │
│ ⚠️ 2 floor plan images detected and removed       │
│                                                   │
│                   [Continue to Customize →]        │
└─────────────────────────────────────────────────┘
```

**States**:
- **Default**: URL input + dropzone + demo button
- **Importing**: URL input disabled, spinner, "Scraping listing... (usually 10-15 seconds)"
- **Import success**: photo grid + editable fields
- **Import failed**: 
  ```
  "Couldn't scrape this URL. Try these options:"
  [Try Again] [Use Redfin URL Instead] [Upload Photos Manually]
  ```
- **Manual upload active**: dropzone highlighted, photos appear as uploaded
- **Demo listing**: pre-loaded with 12 sample photos + filled fields
- **Photo validation errors** (per photo, inline):
  ```
  "⚠️ Too small (400×300). Min 800×600." → photo shown grayed out, still selectable
  "⚠️ This looks like a floor plan." → auto-removed, shown in dismissed section
  ```

**Data flow**:
1. POST /api/scrape → returns listing data + photo URLs
2. Photos stored in Supabase Storage
3. Listing row created in DB (status: draft)
4. listingId stored in page state, passed to Step 2

**Edge cases**:
- Agent pastes Realtor.com URL → "Realtor.com support coming soon. Try Redfin or Zillow."
- Agent pastes non-real-estate URL → "This doesn't look like a listing. Check the URL."
- 0 photos scraped → "No photos found. Upload manually instead."
- 1-2 photos only → warning: "We recommend at least 5 photos for best results."
- >40 photos → auto-select first 40, dismiss rest with note
- Agent removes all photos → "Continue" button disabled
- Agent doesn't set cover photo → first photo auto-selected as cover

**Validation before Continue**:
- ≥3 photos selected (show count: "12 photos selected")
- Address field not empty
- Price is a positive number or empty (optional)

---

### PAGE 7: `/dashboard/new/customize` — Step 2: Customize Video

**Purpose**: Agent controls every aspect of the video before generating.

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ ●━━━━━●━━━━━○━━━━━○                                         │
│ Import  Customize  Generate  Download                        │
├────────────────────────────┬────────────────────────────────┤
│ LEFT PANEL (scrollable)    │ RIGHT PANEL (sticky)            │
│                            │                                 │
│ 🎨 THEME                   │  LIVE PREVIEW                   │
│ ┌────┐ ┌────┐ ┌────┐      │  ┌─────────────────────┐       │
│ │Cine│ │Mod │ │Lux │      │  │                     │       │
│ │    │ │    │ │    │      │  │  [Phone mockup 9:16] │       │
│ └────┘ └────┘ └────┘      │  │                     │       │
│ ┌────┐ ┌────┐ ┌────┐      │  │  Shows:             │       │
│ │Enrg│ │Mini│ │Cstl│      │  │  - Cover photo      │       │
│ └────┘ └────┘ └────┘      │  │  - Lower-third      │       │
│ ┌────┐ ┌────┐              │  │  - Color grade      │       │
│ │Rust│ │Urbn│              │  │  - Font preview      │       │
│ └────┘ └────┘              │  │                     │       │
│                            │  └─────────────────────┘       │
│ 🏷️ HEADLINE                │                                 │
│ [JUST LISTED        ▼]     │  Theme: Cinematic               │
│ Options:                   │  Duration: 30s                   │
│  JUST LISTED               │  Photos: 12                      │
│  OPEN HOUSE                │  Music: Golden Hour              │
│  COMING SOON               │                                 │
│  PRICE REDUCED             │                                 │
│  JUST SOLD                 │                                 │
│  BACK ON MARKET            │                                 │
│  NEW CONSTRUCTION          │                                 │
│  FOR RENT                  │                                 │
│  Custom: [_________]       │                                 │
│                            │                                 │
│ ⏱ DURATION                 │                                 │
│ [15s] [30s] [45s] [60s]   │                                 │
│                            │                                 │
│ 📐 OUTPUT FORMATS           │                                 │
│ ☑ 16:9 Landscape (YouTube) │                                 │
│ ☑ 9:16 Vertical (Reels)    │                                 │
│ ☐ 1:1 Square (IG Feed)     │                                 │
│ ☐ 4:5 Portrait (IG)        │                                 │
│                            │                                 │
│ ☑ Branded (with overlays)  │                                 │
│ ☑ Clean (MLS-ready, no     │                                 │
│   agent branding)          │                                 │
│                            │                                 │
│ 🎵 MUSIC                    │                                 │
│ Genre: [All ▼]             │                                 │
│ ┌──────────────────────┐   │                                 │
│ │▶ Modern Drift  98bpm │   │                                 │
│ │  ○ Golden Hour  72bpm│   │                                 │
│ │  ○ Upbeat Close 118bpm│  │                                 │
│ │  ... 17 more         │   │                                 │
│ └──────────────────────┘   │                                 │
│ Volume: [----●--------]    │                                 │
│                            │                                 │
│ 📷 PER-PHOTO CONTROLS      │                                 │
│ (expand each photo)        │                                 │
│                            │                                 │
│ Photo 1 (Cover) ★          │                                 │
│ ┌─────────────────────┐   │                                 │
│ │ [thumbnail]          │   │                                 │
│ │ Camera: [Push In  ▼] │   │                                 │
│ │ Intensity: [--●----] │   │                                 │
│ │ Duration: [2][3][4][5]│  │                                 │
│ │ ☐ Auto-Enhance       │   │                                 │
│ │ ☐ Replace Sky        │   │                                 │
│ │ ☐ Day-to-Dusk        │   │                                 │
│ └─────────────────────┘   │                                 │
│                            │                                 │
│ Photo 2                    │                                 │
│ ┌─────────────────────┐   │                                 │
│ │ [thumbnail]          │   │                                 │
│ │ Camera: [Pan Left ▼] │   │                                 │
│ │ ... same controls     │   │                                 │
│ └─────────────────────┘   │                                 │
│ ... all photos             │                                 │
│                            │                                 │
│                            │                                 │
│ [← Back]   [Generate Video →]                                │
└────────────────────────────┴────────────────────────────────┘
```

**Per-photo camera options** (dropdown):
```
Push In        — dolly toward (exterior, backyard)
Pull Back      — dolly away / reveal (bedrooms)
Pan Left       — horizontal left→right (living rooms)
Pan Right      — horizontal right→left (dining)
Slow Zoom      — gentle zoom in (entry, detail shots)
Orbit          — subtle rotation (kitchen island)
Gentle Drift   — very subtle Ken Burns (bathrooms, closets)
```

**Per-photo enhancement options**:
```
☐ Auto-Enhance   → Sharp: normalize + sharpen + slight warm (ALL photos)
☐ Replace Sky     → only visible if photo detected as exterior
                    Opens sky picker: 10 sky thumbnails to choose from
☐ Day-to-Dusk     → only visible if photo detected as exterior
                    Preview: shows before/after inline
☐ Brighten        → for dark interior photos
                    Slider: [----●--------] brightness 1.0→1.5
```

**Auto-detection**: Use Claude Vision or simple heuristic (first 2 photos = exterior, last 2 = outdoor) to auto-show exterior-only options.

**Preview panel** (right side):
- Shows cover photo with selected theme's color grade applied
- Lower-third preview with selected font + colors
- Updates in real-time as agent changes options
- On mobile: preview hidden, accessible via "Preview" toggle button

**States**:
- **Default**: all photos collapsed, only theme + headline + duration visible
- **Photo expanded**: shows per-photo controls for that photo
- **Music playing**: track highlighted, play/pause icon animated
- **Enhancement preview**: before/after slider appears inline below photo
- **Loading preview**: skeleton shimmer on preview panel while updating
- **Mobile**: single column, preview as collapsible section at top

**Validation before Generate**:
- At least 1 output format selected
- Music track selected
- Credits available (check user.listings_used_this_month < plan limit)
- If no credits: show "Upgrade your plan to generate more videos" with upgrade button

**Data saved to state** (NOT to DB yet — saved when Generate clicked):
```ts
interface VideoConfig {
  listingId: string;
  theme: string;
  headline: string;
  customHeadline?: string;
  durationSeconds: number;
  formats: ('16x9' | '9x16' | '1x1' | '4x5')[];
  includeBranded: boolean;
  includeClean: boolean;
  musicTrackId: string;
  musicVolume: number;  // 0.1 to 0.6
  photos: {
    id: string;
    url: string;
    order: number;
    isCover: boolean;
    camera: 'dolly-in' | 'dolly-out' | 'pan-left' | 'pan-right' | 'zoom' | 'orbit' | 'drift';
    intensity: number;  // 0.3 to 2.0
    clipDuration: number;  // 2 to 5
    enhance: boolean;
    skySrc?: string;  // sky replacement image name
    dayToDusk: boolean;
    brighten: number;  // 1.0 to 1.5
  }[];
}
```

**On "Generate Video →" click**:
1. Client-side validation (formats, music, credits)
2. POST /api/generate with VideoConfig
3. API checks auth, verifies listing, deducts credit
4. Returns { jobId }
5. Redirect to /dashboard/new/generating?jobId=XXX

---

### PAGE 8: `/dashboard/new/generating` — Step 3: Generating

**Purpose**: Show progress while pipeline runs. Keep agent engaged.

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ ●━━━━━●━━━━━●━━━━━○                              │
│ Import  Customize  Generate  Download             │
├─────────────────────────────────────────────────┤
│                                                   │
│         [Animated logo pulse]                     │
│                                                   │
│   "Creating your listing video..."                │
│                                                   │
│   ✅ Importing listing photos                     │
│   ✅ Enhancing photos                             │
│   ✅ Fetching neighborhood clips                  │
│   ⏳ Rendering cinematic motion...                │
│   ○  Assembling your video                        │
│   ○  Adding your branding                         │
│   ○  Mixing music                                 │
│   ○  Creating alternate formats                   │
│   ○  Uploading                                    │
│                                                   │
│   ████████████████░░░░░░░░░  62%                  │
│   Estimated: ~1 minute remaining                  │
│                                                   │
│ ─────────────────────────────────────             │
│                                                   │
│   📝 While you wait — your listing content:       │
│                                                   │
│   Tabs: [Descriptions] [Captions] [Hooks]         │
│                                                   │
│   MLS Description:                                │
│   "Beautifully maintained 3-bedroom..."           │
│   [Copy 📋]                                       │
│                                                   │
│   Social Caption:                                 │
│   "This Austin gem just hit the market ✨..."      │
│   [Copy 📋]                                       │
│                                                   │
│   (Content appears ~15s after generation starts,  │
│    while video still rendering)                   │
│                                                   │
└─────────────────────────────────────────────────┘
```

**Polling behavior**:
```ts
// Poll every 5 seconds
const poll = setInterval(async () => {
  const res = await fetch(`/api/job/${jobId}`);
  const data = await res.json();
  
  setProgress(data.progressPercent);
  setStep(data.progressStep);
  
  if (data.status === 'complete') {
    clearInterval(poll);
    router.push(`/dashboard/new/done?jobId=${jobId}`);
  }
  
  if (data.status === 'failed') {
    clearInterval(poll);
    setError(data.errorMessage);
  }
}, 5000);
```

**States**:
- **Generating**: progress bar advancing, steps ticking
- **Content ready** (while still generating): descriptions/captions tabs appear below progress
- **Complete**: auto-redirect to /dashboard/new/done
- **Failed**:
  ```
  "Something went wrong. Your credit has been refunded."
  Error: "Video generation timed out"
  
  [Try Again] [Try with Fewer Photos] [Contact Support]
  ```
  "Try Again" → redirect to /dashboard/new/customize (settings preserved)
- **Stuck** (>5 min, no progress change):
  ```
  "This is taking longer than usual..."
  [Keep Waiting] [Cancel and Retry]
  ```
  "Cancel" → mark job as failed, refund credit

**Edge cases**:
- Agent refreshes page → polling resumes from current job state
- Agent navigates away → job continues in background, can find video in /dashboard/listings later
- jobId invalid or doesn't belong to user → redirect to /dashboard with toast error

---

### PAGE 9: `/dashboard/new/done` — Step 4: Results

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ ●━━━━━●━━━━━●━━━━━●                                         │
│ Import  Customize  Generate  ✅ Done                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  "Your video is ready! 🎬"                                    │
│  123 Maple St, Austin TX · $485,000                           │
│                                                               │
│  ┌─ VIDEO OUTPUTS ─────────────────────────────────────────┐ │
│  │                                                         │ │
│  │  Tab: [16:9 Branded] [16:9 Clean] [9:16 Branded]       │ │
│  │       [9:16 Clean]                                      │ │
│  │                                                         │ │
│  │  ┌──────────────────────────────────────┐              │ │
│  │  │                                      │              │ │
│  │  │         [VIDEO PLAYER]               │              │ │
│  │  │    (autoplay muted, custom controls) │              │ │
│  │  │                                      │              │ │
│  │  └──────────────────────────────────────┘              │ │
│  │                                                         │ │
│  │  [⬇ Download MP4] [⬇ Download GIF] [⬇ Download All ZIP]│ │
│  │  [🔗 Copy Share Link] [📱 QR Code]                      │ │
│  │                                                         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  THUMBNAIL (pick one):                                        │
│  [frame1] [frame2] [frame3] [frame4] [frame5]                │
│  ✓ Selected                                                   │
│                                                               │
│  SOCIAL PREVIEW:                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ [IG mock]│  │[TikTok  ]│  │[YouTube ]│                   │
│  │ phone    │  │ phone    │  │ browser  │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
│                                                               │
│  ── Quick Edit (no credit) ──                                 │
│  [🎵 Try Different Music] [✏️ Change Headline]                │
│                                                               │
│  ─── Content Pack ──────────────────────────────────────────  │
│  Tabs: [Hooks] [Script] [Captions] [Platforms] [Engage]       │
│  (full ContentPackView component here)                        │
│                                                               │
│  ─── Descriptions ──────────────────────────────────────────  │
│  Tabs: [MLS] [Social] [Luxury]                                │
│  (existing description tabs with copy buttons)                │
│                                                               │
│  [← Create Another Video]  [View Listing Page →]              │
└─────────────────────────────────────────────────────────────┘
```

**Video player requirements**:
- Custom styled (not browser default)
- Large centered play button overlay
- Autoplay muted on page load
- Controls: play/pause, volume, progress scrubber, fullscreen
- Rounded corners + shadow
- Tap to unmute on mobile

**Download buttons**:
- "Download MP4" → direct download of currently selected format
- "Download GIF" → 3-second animated GIF preview (~500KB)
- "Download All ZIP" → all formats + thumbnail + GIF in one ZIP
- "Copy Share Link" → copies listingos.com/l/[slug] to clipboard + toast
- "QR Code" → downloads PNG of QR code linking to /l/[slug]

**Quick Edit behavior**:
- "Try Different Music" → opens music picker modal → agent selects → FFmpeg re-mixes audio only → ~10 seconds → video updates → NO credit cost
- "Change Headline" → opens text input → agent types new headline → re-renders intro card SVG + FFmpeg re-composites → ~10 seconds → NO credit cost

**Thumbnail selector**:
- Extract 5 frames at evenly spaced intervals
- Agent clicks one → saves as listing thumbnail
- Used on dashboard cards, OG image, share previews

**Social preview mockups**:
- 3 device frames (CSS only) showing the video thumbnail
- Instagram: phone frame with IG Reels UI elements overlaid
- TikTok: phone frame with TikTok UI
- YouTube: browser frame with YT Short UI
- Agent can screenshot these for their own promotional use

**States**:
- **Default**: video playing, all sections visible
- **Quick edit loading**: small spinner on the button, video grayed
- **Quick edit done**: video updates, toast "Music updated!"
- **Content pack loading**: skeleton on content pack section
- **Content pack failed**: "Content couldn't be generated. [Retry]"
- **Mobile**: single column, video full-width, sections stacked

---

### PAGE 10: `/dashboard/listings` — All Listings

**Layout**:
```
┌─────────────────────────────────────────────────┐
│ "Your Listings"                [+ New Video]     │
│                                                   │
│ Filter: [All ▼]  Sort: [Newest ▼]  Search: [__]  │
│                                                   │
│ ┌────────────────────────────────────────────┐   │
│ │ [thumb] 123 Maple St, Austin TX            │   │
│ │ $485,000 · 3bd 2ba · May 8, 2026           │   │
│ │ 847 views · 3 leads                        │   │
│ │ Status: ✅ Complete                         │   │
│ │ [View] [Edit] [Share] [Download] [Delete]  │   │
│ ├────────────────────────────────────────────┤   │
│ │ [thumb] 456 Oak Ave, Austin TX             │   │
│ │ $325,000 · 2bd 1ba · May 5, 2026           │   │
│ │ 234 views · 1 lead                         │   │
│ │ Status: ✅ Complete                         │   │
│ │ [View] [Edit] [Share] [Download] [Delete]  │   │
│ ├────────────────────────────────────────────┤   │
│ │ [thumb] 789 Pine Dr, Austin TX             │   │
│ │ $599,000 · 4bd 3ba · May 2, 2026           │   │
│ │ Status: ⏳ Processing...                    │   │
│ │ [View Progress]                             │   │
│ └────────────────────────────────────────────┘   │
│                                                   │
│ Empty state:                                      │
│ "No listings yet. Create your first video!"       │
│ [+ New Video]                                     │
└─────────────────────────────────────────────────┘
```

**Filter options**: All, Complete, Processing, Failed, Draft
**Sort options**: Newest, Oldest, Most Views, Most Leads

**Delete behavior**:
- Confirm dialog: "Delete 123 Maple St and all associated videos?"
- On confirm: soft delete (mark as deleted, don't purge R2 files immediately)

---

### PAGE 11: `/dashboard/listings/[id]` — Listing Detail

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Listings                                           │
│                                                               │
│ 123 Maple St, Austin TX 78701                                │
│ $485,000 · 3 bd · 2 ba · 1,842 sqft                         │
│ Created: May 8, 2026 · 847 views · 3 leads                  │
│                                                               │
│ Tabs: [Video] [Content Pack] [Photos] [Leads] [Analytics]    │
│                                                               │
│ ── VIDEO TAB ──                                               │
│ Same as done page: video player, downloads, quick edit,       │
│ social previews, thumbnail selector                           │
│                                                               │
│ ── CONTENT PACK TAB ──                                        │
│ Full ContentPackView component                                │
│ [Regenerate Content Pack] button                              │
│                                                               │
│ ── PHOTOS TAB ──                                              │
│ All listing photos in a grid                                  │
│ Can still reorder/add/remove                                  │
│ [Regenerate Video with Updated Photos] (costs 1 credit)       │
│                                                               │
│ ── LEADS TAB ──                                               │
│ Table: Name | Email | Phone | Date | Source                   │
│ [Export CSV]                                                   │
│                                                               │
│ ── ANALYTICS TAB ──                                           │
│ Views over time (simple line chart)                            │
│ Lead conversion rate                                          │
│ Share link clicks                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### PAGE 12: `/dashboard/brand` — Brand Kit

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ "Your Brand Kit"                                              │
│ "Applied to all your videos automatically"                    │
│                                                               │
│ ┌─ LEFT: EDIT ──────────────┬─ RIGHT: LIVE PREVIEW ────────┐│
│ │                            │                               ││
│ │ Logo:                      │  ┌───────────────────┐       ││
│ │ [Upload area] [Remove]     │  │                   │       ││
│ │ Auto-extracted colors:     │  │ LOWER-THIRD       │       ││
│ │ [■ #1A2E4A] [■ #F5A623]  │  │ PREVIEW:          │       ││
│ │                            │  │                   │       ││
│ │ Primary Color:             │  │ ┌───────────────┐ │       ││
│ │ [■ #1A2E4A] [color picker]│  │ │Sarah Johnson  │ │       ││
│ │                            │  │ │KW Austin      │ │       ││
│ │ Accent Color:              │  │ └───────────────┘ │       ││
│ │ [■ #F5A623] [color picker]│  │                   │       ││
│ │                            │  └───────────────────┘       ││
│ │ Font:                      │                               ││
│ │ [Inter           ▼]       │  ┌───────────────────┐       ││
│ │                            │  │ INTRO CARD        │       ││
│ │ Agent Name:                │  │ PREVIEW:          │       ││
│ │ [Sarah Johnson       ]    │  │                   │       ││
│ │                            │  │  JUST LISTED      │       ││
│ │ License #:                 │  │  123 Maple St     │       ││
│ │ [TX-0123456          ]    │  │  $485,000          │       ││
│ │                            │  │                   │       ││
│ │ Brokerage:                 │  └───────────────────┘       ││
│ │ [Keller Williams     ]    │                               ││
│ │                            │                               ││
│ │ Phone:                     │                               ││
│ │ [(512) 555-0192      ]    │                               ││
│ │                            │                               ││
│ │ Headshot:                  │                               ││
│ │ [Upload] → auto bg-remove │                               ││
│ │                            │                               ││
│ │ ── Brand Voice (optional)──│                               ││
│ │ "Paste 3-5 captions you've│                               ││
│ │  written to train your    │                               ││
│ │  content voice"           │                               ││
│ │ [                         ]│                               ││
│ │ [                         ]│                               ││
│ │ [Analyze & Save Voice]     │                               ││
│ │                            │                               ││
│ │ [Save Brand Kit]           │                               ││
│ └────────────────────────────┴───────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Live preview updates**: Every field change instantly updates the preview panel (client-side rendering, no API call).

---

### PAGE 13: `/dashboard/music` — Music Library

```
┌─────────────────────────────────────────────────┐
│ "Music Library"                                   │
│                                                   │
│ Filter: [All] [Modern] [Luxury] [Upbeat]         │
│         [Calm] [Bold] [Coastal]                  │
│                                                   │
│ ┌──────────────────────────────────────────────┐ │
│ │ ▶  Modern Drift     Modern    98 BPM   3:00  │ │
│ │    ═══════════════════░░░░░░░░             │ │
│ ├──────────────────────────────────────────────┤ │
│ │ ○  Golden Hour       Luxury    72 BPM   3:00  │ │
│ ├──────────────────────────────────────────────┤ │
│ │ ○  Upbeat Close      Upbeat   118 BPM   3:00  │ │
│ ├──────────────────────────────────────────────┤ │
│ │ ... 17 more tracks                            │ │
│ └──────────────────────────────────────────────┘ │
│                                                   │
│ Tap any track to preview.                         │
│ Tracks are auto-selected when creating a video.   │
└─────────────────────────────────────────────────┘
```

---

### PAGE 14: `/dashboard/account`

```
┌─────────────────────────────────────────────────┐
│ "Account"                                         │
│                                                   │
│ Tabs: [Plan] [Profile] [Billing]                  │
│                                                   │
│ ── PLAN TAB ──                                    │
│ Current Plan: Solo ($29/mo)                       │
│ Usage: ████████░░ 6/10 listings this month        │
│ Resets: May 28, 2026 (12 days)                    │
│                                                   │
│ [Upgrade to Agent ($79/mo) →]                     │
│                                                   │
│ ── PROFILE TAB ──                                 │
│ Email: sarah@email.com                            │
│ [Change Password]                                 │
│ Notifications:                                    │
│   ☑ Email when video is ready                     │
│   ☑ Email when a lead is captured                 │
│   ☐ Weekly content ideas                          │
│                                                   │
│ ── BILLING TAB ──                                 │
│ [Manage Billing → Stripe Portal]                  │
│ (opens Stripe's hosted billing page)              │
│                                                   │
│ ── DANGER ZONE ──                                 │
│ [Delete Account]                                  │
│ "This will delete all your data permanently."     │
└─────────────────────────────────────────────────┘
```

---

### PAGE 15: `/dashboard/refer`

```
┌─────────────────────────────────────────────────┐
│ "Refer an Agent"                                  │
│                                                   │
│ "Give a friend 1 free listing credit.             │
│  You get 1 free credit when they sign up."        │
│                                                   │
│ Your referral link:                               │
│ ┌──────────────────────────────────────────┐     │
│ │ listingos.com/signup?ref=SARAH2026  [📋] │     │
│ └──────────────────────────────────────────┘     │
│                                                   │
│ Referred: 3 agents                                │
│ Credits earned: 2                                 │
│                                                   │
│ ┌──────────────────────────────────────┐         │
│ │ Mike T. — signed up May 3 — ✅ active │         │
│ │ Lisa R. — signed up May 1 — ✅ active │         │
│ │ John K. — invited May 5 — ⏳ pending  │         │
│ └──────────────────────────────────────┘         │
└─────────────────────────────────────────────────┘
```

---

### PAGE 16: `/l/[slug]` — Public Listing Page

```
┌─────────────────────────────────────────────────────────────┐
│ AGENT HEADER                                                 │
│ [Headshot] Sarah Johnson · KW Austin · (512) 555-0192       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ [VIDEO PLAYER — 16:9, autoplay muted]                        │
│                                                               │
│ 123 Maple St, Austin TX 78701                                │
│ $485,000    3 🛏    2 🛁    1,842 sqft                       │
│                                                               │
│ DESCRIPTION                                                   │
│ "Beautifully maintained 3-bedroom home in the heart          │
│  of Austin's most walkable neighborhood..."                  │
│                                                               │
│ PHOTOS (swipeable carousel — embla)                          │
│ [photo1] [photo2] [photo3] ... ← →                          │
│                                                               │
│ NEIGHBORHOOD                                                  │
│ Walk Score: 82  Transit: 65  Bike: 71                        │
│ Nearby: 🍕 Joe's Pizza · ☕ Fleet Coffee · 🏫 Travis ES     │
│                                                               │
│ ── INTERESTED? ──                                             │
│ Name:  [              ]                                       │
│ Email: [              ]                                       │
│ Phone: [              ]                                       │
│ Message: [            ]                                       │
│ [Send to Agent →]                                             │
│                                                               │
│ Footer: Powered by ListingOS (free plan) / hidden on paid    │
└─────────────────────────────────────────────────────────────┘
```

**Meta tags** (OG + Twitter + Schema.org):
```html
<meta property="og:title" content="123 Maple St — $485,000" />
<meta property="og:description" content="3 bed, 2 bath, 1,842 sqft in Austin TX" />
<meta property="og:image" content="[thumbnail URL]" />
<meta property="og:video" content="[video URL]" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "RealEstateListing",
  "name": "123 Maple St",
  "address": { "@type": "PostalAddress", ... },
  "price": "$485,000",
  "numberOfBedrooms": 3,
  "numberOfBathrooms": 2
}
</script>
```

**Lead capture behavior**:
1. Visitor fills form → POST /api/leads
2. Lead saved to DB
3. listings.lead_count incremented
4. Email sent to agent via Resend
5. Visitor sees: "Thanks! Sarah will be in touch soon."

**View tracking**:
- On page load: POST /api/listings/[id]/view
- Debounced: 1 view per IP per hour (Redis or simple DB check)

---

## GLOBAL ELEMENTS

### Sidebar (all dashboard pages)
```
Logo
─────
+ New Video      ← primary CTA, always visible
🏠 My Listings   ← badge with count
🎨 Brand Kit     ← dot indicator if incomplete
🎵 Music
⚙️ Account
🔗 Refer         ← badge with credits earned
─────
Plan: Solo
6/10 listings
Resets in 12d
─────
[Logout]
```

### Toast notifications (global)
```
✅ "Video generated successfully!"
✅ "Brand kit saved"
✅ "Link copied to clipboard"
✅ "Music updated (no credit used)"
✅ "Lead captured — check your email"
❌ "Generation failed. Credit refunded."
❌ "Couldn't scrape this URL."
⚠️ "You have 1 listing credit remaining"
⚠️ "Your trial expires in 2 days"
ℹ️ "Pro tip: Complete your brand kit for branded videos"
```

### Loading states (every page)
- Dashboard: skeleton cards (3 card placeholders)
- Listings: skeleton rows
- Listing detail: skeleton video player + tabs
- Brand kit: skeleton form
- All data-fetching pages: never show empty white screen

### Auth guard (middleware.ts)
```ts
// Protected routes: /dashboard/*
// Public routes: /, /login, /signup, /auth/callback, /l/*, /api/leads, /api/webhooks/*
// If no session on protected route → redirect to /login?returnUrl=current
// If session on /login or /signup → redirect to /dashboard
```

### Mobile responsive rules
- Sidebar → collapsible hamburger menu
- Step 2 (Customize): single column, preview as collapsible top section
- Video players: full-width
- Photo grids: 2 columns on mobile (3 on tablet, 4+ on desktop)
- Per-photo controls: full-width accordion
- All buttons: min 44px tap target
- All text: min 14px
