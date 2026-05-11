# How to Get Senior-Dev Quality From Claude Code

This is not about Claude Code features. This is about how YOU
structure the work so Claude Code can't produce garbage.

---

## The 7 Rules

### Rule 1: Never Give Claude Code a Big Job

❌ "Build the ListingOS app"
❌ "Implement the video pipeline"  
❌ "Create all the dashboard pages"

✅ "Create the Redfin scraper function in lib/scraper.ts that extracts
   photos, address, price, beds, baths, sqft. Read skills/scraping-patterns.md
   first. Run TEST 1A-1 when done."

**Why**: Claude Code has a context window. Big jobs = it forgets
the beginning by the time it reaches the end. Small atomic tasks
= it holds the entire task in focus.

**Max task size**: 1-3 files changed, 1 clear outcome, 1 test to verify.

---

### Rule 2: CLAUDE.md Is the Constitution

Claude Code reads CLAUDE.md on EVERY session start. Put these in it:

```markdown
## LOCKED DECISIONS (do NOT change these)

Stack: Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui
DB: Supabase (not Prisma, not Drizzle, not raw SQL)
Auth: Supabase Auth (not NextAuth, not Clerk, not Auth0)
Styling: Tailwind + shadcn/ui (not MUI, not Chakra, not CSS modules)
State: React useState + searchParams (not Redux, not Zustand, not Jotai)
Validation: Zod (not Yup, not Joi, not class-validator)
API: Next.js route handlers (not tRPC, not GraphQL)
Video: FFmpeg + Python parallax (not Remotion, not Anime.js)
AI Text: Claude Haiku via @anthropic-ai/sdk (not LangChain, not Vercel AI SDK)
Queue: Supabase polling (not BullMQ, not Redis, not SQS)
Email: Resend (not SendGrid, not Nodemailer, not Postmark)
Payments: Stripe (not Lemon Squeezy, not Paddle)
Deploy: Vercel + Railway (not AWS, not Fly.io, not Docker)

## DO NOT (ever, under any circumstances)

- Do NOT add new npm dependencies without asking first
- Do NOT refactor existing working code unless the task says to
- Do NOT change the file structure
- Do NOT use `any` type in TypeScript
- Do NOT use inline styles (use Tailwind classes)
- Do NOT create new API routes unless the task specifies one
- Do NOT suggest alternative tools, libraries, or approaches
- Do NOT skip error handling
- Do NOT skip loading states
- Do NOT skip mobile responsive
- Do NOT import from @/ paths in scripts/ directory (use require, it's CJS)
- Do NOT modify package.json unless the task says to
```

**This prevents 80% of Claude Code going off-script.**

---

### Rule 3: Jira-Style Tickets (Not Conversations)

Don't have a conversation with Claude Code. Give it a TICKET.

**Ticket format**:
```
TICKET: LOS-014 — Redfin Scraper
STATUS: TODO
PRIORITY: P0 (blocks everything)
DEPENDS ON: LOS-001 (project setup)

## WHAT
Create the Redfin listing scraper in lib/scraper.ts.

## READ FIRST
- CLAUDE.md (stack rules)
- skills/scraping-patterns.md (exact code patterns)
- lib/types.ts (ScrapedData interface)

## FILES TO CREATE/MODIFY
- MODIFY: lib/scraper.ts → add scrapeRedfin() function
- MODIFY: app/api/scrape/route.ts → wire scrapeRedfin into POST handler

## EXACT REQUIREMENTS
1. Accept a Redfin URL string
2. Launch Playwright with bundled Chromium (not system Chrome)
3. Navigate to redfin.com first (warmup 2s)
4. Navigate to listing URL
5. Wait for [data-rf-test-id="abp-price"] selector
6. Extract: address, price, beds, baths, sqft, description
7. Find all img[src*="ssl.cdn-redfin.com"] with width > 400
8. Download each photo to tmp/
9. Sharp resize to 1920x1080 (cover, attention)
10. Upload to Supabase Storage at listings/{userId}/{listingId}/photos/{i}.jpg
11. Return ScrapedData object (from lib/types.ts)

## ERROR HANDLING
- Playwright timeout (30s) → throw with message "Listing page didn't load"
- No price found → set price to null (don't throw)
- No photos found → throw with message "No photos found"
- Photo download fails → skip that photo, continue with rest
- Less than 3 photos → warn but don't throw

## TEST (run this when done)
Input: https://www.redfin.com/CA/San-Jose/ + any active listing
Assert:
  - result.photoUrls.length >= 5
  - result.address is non-empty
  - result.price is number or null
  - every photo URL starts with Supabase URL
  - photos are 1920x1080 when downloaded

## WHAT DONE LOOKS LIKE
- npm run typecheck passes
- Test case above passes
- No new dependencies added
- No existing code broken
```

**Every ticket has**: READ FIRST, FILES, REQUIREMENTS, ERROR HANDLING, TEST, DONE CRITERIA.

Claude Code cannot "interpret" what you want. It follows the ticket literally.

---

### Rule 4: Session Management (Save Tokens, Save Context)

**Problem**: Claude Code sessions have token limits. Long sessions
= context overflow = it forgets your CLAUDE.md rules = garbage output.

**Solution**: One ticket per session. Here's the workflow:

```
SESSION 1: Open Claude Code
  → "Read CLAUDE.md. Then read tickets/LOS-014.md. Execute it."
  → Claude Code works on ONE ticket
  → When done: "Run the test case. Show me the output."
  → If pass: "Commit with message 'LOS-014: Redfin scraper'"
  → Close session

SESSION 2: Open Claude Code (fresh context)
  → "Read CLAUDE.md. Then read tickets/LOS-015.md. Execute it."
  → Works on next ticket
  → Test → Commit → Close

SESSION 3: ...
```

**Why this works**:
- Fresh context every session = full attention on current task
- CLAUDE.md re-read every time = rules never forgotten
- Git commit after each ticket = rollback point if next ticket breaks things
- Tickets reference exact files = Claude Code knows what to read

**Anti-pattern**: Starting a session, giving 5 tasks, then saying "also fix this other thing." By task 3, Claude Code has forgotten the constraints from CLAUDE.md.

---

### Rule 5: Checkpoint Files (Context That Survives Sessions)

When Claude Code makes a decision during a session that other sessions
need to know, it writes it to a file. Not the chat. A FILE.

**File: docs/DECISIONS.md** (append-only log)
```markdown
## Decision Log

### 2026-05-11: LOS-014 — Scraper approach
- Using Playwright bundled Chromium (not system Chrome)
- Redfin primary, Zillow fallback (Zillow blocks more aggressively)
- Photos stored at listings/{userId}/{listingId}/photos/{i}.jpg

### 2026-05-11: LOS-017 — Parallax motion
- Using cosine ease-in-out for all motion types
- Overscan 10% to hide edge artifacts
- BORDER_REFLECT_101 for edge handling
```

**File: docs/KNOWN_ISSUES.md**
```markdown
## Known Issues (do not fix unless assigned)

- Zillow scraper returns 0 photos on some listings (rate limiting)
- Pipeline takes >3 min on listings with >20 photos
- Music preview doesn't work on Safari (autoplay policy)
```

**Why**: Next session, Claude Code reads these files and doesn't
re-make decisions or accidentally reintroduce fixed bugs.

---

### Rule 6: Pattern Files (Code the Same Way Every Time)

**Problem**: Claude Code writes a Supabase query differently every time.
Session 1: `const { data } = await supabase.from('x').select('*')`
Session 3: `const result = await supabase.from('x').select()`
Session 7: Uses the service role key where it should use the anon key.

**Solution**: skills/ files with EXACT patterns. Claude Code copies these.

**File: skills/supabase-patterns.md**
```markdown
## Server-side query (API routes, pipeline)
Always use admin client. Always filter by user_id.
```ts
import { createAdminClient } from "@/lib/supabase/server";
const supabase = createAdminClient();
const { data, error } = await supabase
  .from("listings")
  .select("*")
  .eq("user_id", userId)
  .order("created_at", { ascending: false });
if (error) throw new Error(`DB error: ${error.message}`);
```

## Client-side query (React components)
Always use browser client. RLS enforces user_id.
```ts
import { createBrowserClient } from "@/lib/supabase/client";
const supabase = createBrowserClient();
const { data } = await supabase
  .from("listings")
  .select("*, videos(*)")
  .order("created_at", { ascending: false });
```

## Insert pattern
```ts
const { data, error } = await supabase
  .from("listings")
  .insert({ ...values, user_id: userId })
  .select()
  .single();
if (error) throw new Error(`Insert failed: ${error.message}`);
```
```

**File: skills/api-route-pattern.md**
```markdown
## Every API route follows this exact structure:

```ts
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  // 1. Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse + validate input
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = SomeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 }
    );
  }

  // 3. Business logic
  try {
    // ... do the thing
    return NextResponse.json({ result });
  } catch (err) {
    console.error("[api/route-name]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
```

NEVER skip: auth check, input validation, try/catch, error logging.
NEVER use: res.send(), res.status() (those are Pages Router).
```

**File: skills/component-pattern.md**
```markdown
## Every dashboard page follows this pattern:

```tsx
"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function PageName() {
  const [data, setData] = useState<DataType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createBrowserClient();
        const { data, error } = await supabase.from("table").select("*");
        if (error) throw error;
        setData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!data || data.length === 0) return <EmptyState />;

  return <div>...</div>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <p className="text-destructive mb-4">{message}</p>
        <Button onClick={onRetry} variant="outline">Try Again</Button>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="py-12 text-center text-muted-foreground">
        <p>Nothing here yet.</p>
      </CardContent>
    </Card>
  );
}
```

EVERY page must have: loading skeleton, error state, empty state.
NEVER show a blank white screen.
NEVER show raw error objects to users.
```

---

### Rule 7: The Ticket Board (Complete Task List)

Here's every ticket in execution order. One ticket per Claude Code session.

```
BATCH 1: Foundation (do these first, in order)
──────────────────────────────────────────────
LOS-001  Project health check
         Read CLAUDE.md. Run npm run typecheck. Run npm run build.
         List every error. Fix type errors only. Do NOT refactor.

LOS-002  Delete dead code
         Delete lib/dev-pipeline.ts.
         Remove any imports of it. Run npm run typecheck.

LOS-003  DB migrations
         Run 2 ALTER TABLE statements in Supabase SQL editor.
         Add content_pack JSONB to listings.
         Add voice_profile TEXT to brand_kits.
         Verify columns exist.

BATCH 2: Scraper Fix (do in order)
──────────────────────────────────
LOS-010  Fix Redfin scraper
         Modify lib/scraper.ts scrapeRedfin() function.
         Read skills/scraping-patterns.md first.
         Test with real Redfin URL.

LOS-011  Fix Zillow scraper (or graceful fallback)
         Modify lib/scraper.ts scrapeZillow() function.
         If Zillow blocks: return useful error "Try Redfin instead".
         Test with real Zillow URL.

LOS-012  Photo validation
         Add to lib/scraper.ts: validate file type, min resolution,
         floor plan detection. Show per-photo warnings in UI.

LOS-013  Scrape route error handling
         Modify app/api/scrape/route.ts: retry logic, rate limiting,
         specific error messages per failure type.

BATCH 3: Video Quality (do in order)
─────────────────────────────────────
LOS-020  Create parallax-cpu.py
         New file: scripts/parallax-cpu.py
         Read ZERO_COST_VIDEO_ARCHITECTURE.md.
         Include: ease-in-out, overscan, BORDER_REFLECT, depth-of-field.
         Test: generate 1 clip from 1 photo, verify MP4 output.

LOS-021  Integrate parallax into pipeline.js
         Modify scripts/pipeline.js: replace Ken Burns with parallax call.
         Keep Ken Burns as fallback if Python fails.
         Add ROOM_PRESETS array.
         Test: full pipeline produces parallax video (not flat zoom).

LOS-022  Add cinema post-processing
         Modify scripts/pipeline.js: add film grain, warm color grade,
         vignette to final FFmpeg assembly.
         Test: output video has warm tone, subtle grain.

LOS-023  Beat-sync transitions
         Modify scripts/pipeline.js: add BPM map per music track.
         Calculate clip durations to land on beat boundaries.
         Test: transitions feel rhythmic, not random.

LOS-024  Real-ESRGAN upscaling
         Add photo upscaling step before parallax in pipeline.js.
         Download realesrgan-ncnn-vulkan binary for target platform.
         Test: output is noticeably sharper than without upscaling.

BATCH 4: Per-Photo Controls + Themes (do in order)
───────────────────────────────────────────────────
LOS-030  Update VideoConfig type
         Modify lib/types.ts: add per-photo camera, intensity,
         duration, enhance options. Add VideoTheme interface.
         Add 8 theme definitions as JSON.

LOS-031  Step 2 UI — theme picker
         Modify app/(dashboard)/dashboard/new/customize/page.tsx:
         Replace 4 text buttons with 8 visual theme cards.
         Show preview thumbnail per theme.

LOS-032  Step 2 UI — per-photo controls
         Add per-photo dropdown (camera), slider (intensity),
         duration buttons, enhancement toggles.
         Expandable accordion per photo.

LOS-033  Step 2 UI — headline picker
         Add headline dropdown with 8 options + custom text input.
         Wire into pipeline.js intro card SVG.

LOS-034  Step 2 UI — output format multi-select
         Add 4 format checkboxes + branded/clean toggles.
         Wire into pipeline.js to generate selected formats.

LOS-035  Step 2 UI — music improvements
         Add genre filter, BPM labels, volume slider.
         Wire volume into pipeline.js FFmpeg audio.

LOS-036  Sky replacement
         Create scripts/sky-replace.py: depth mask → composite sky.
         Bundle 10 CC0 sky images in public/skies/.
         Wire into Step 2 per-photo "Replace Sky" toggle.

LOS-037  Day-to-dusk
         Create scripts/day-to-dusk.py: darken + sky swap + window glow.
         Wire into Step 2 per-photo "Day-to-Dusk" toggle.

LOS-038  Pipeline reads per-photo config
         Modify scripts/pipeline.js: read per-photo camera/intensity/
         duration from job data instead of auto-assigning.
         Modify app/api/generate/route.ts: pass full VideoConfig.

BATCH 5: Content Pack
─────────────────────
LOS-040  Content pack prompt + parser
         Create prompts/content-pack.ts.
         Read CONTENT_PACK_PROMPT.md for exact implementation.

LOS-041  Content pack API route
         Create app/api/content/pack/route.ts.
         Test: POST with listing data → valid ContentPack JSON.

LOS-042  Content pack UI component
         Create components/dashboard/content-pack.tsx.
         5 tabs: Hooks, Script, Captions, Platforms, Engage.
         Copy buttons on every item.

LOS-043  Wire content pack into done page
         Modify app/(dashboard)/dashboard/new/done/page.tsx:
         Add Content Pack section below video.

LOS-044  Wire content pack into listing detail
         Modify app/(dashboard)/dashboard/listings/[id]/page.tsx:
         Add Content Pack tab.

LOS-045  Brand voice profile
         Modify app/(dashboard)/dashboard/brand/page.tsx:
         Add voice examples textarea + analyze button.
         Save to brand_kits.voice_profile.

LOS-046  Pipeline triggers content pack
         Modify scripts/pipeline.js: fire content pack API call
         non-blocking alongside video generation.

BATCH 6: Results + Post-Generation
──────────────────────────────────
LOS-050  Styled video player component
         Create components/dashboard/video-player.tsx.
         Custom controls, autoplay muted, fullscreen, rounded corners.

LOS-051  4-format output (branded + clean)
         Modify scripts/pipeline.js: generate clean versions
         (skip intro/lower-third/outro). Output up to 8 files.

LOS-052  Thumbnail selector
         Extract 5 frames after generation. Show on done page.
         Agent clicks → updates listing.thumbnail_url.

LOS-053  GIF preview
         After generation: extract 3s GIF via FFmpeg.
         Download button on done page.

LOS-054  ZIP download all
         Create app/api/listings/[id]/download-all/route.ts.
         Bundle all formats + thumbnail + GIF into ZIP.

LOS-055  Quick re-edit (music swap)
         Create app/api/listings/[id]/reedit/route.ts.
         FFmpeg audio re-mux only. No parallax re-render. No credit.

LOS-056  Quick re-edit (headline swap)
         Re-generate intro card SVG → FFmpeg re-composite.
         No parallax re-render. No credit.

LOS-057  Social preview mockups
         CSS-only phone/browser frames on done page.
         Show video thumbnail inside IG/TikTok/YouTube mockup.

BATCH 7: Infrastructure + Deployment
─────────────────────────────────────
LOS-060  R2 integration
         Modify scripts/pipeline.js: upload to R2 when keys are real.
         Fallback to /public/videos/ when placeholder.
         Test with real R2 keys.

LOS-061  Worker-poll.js
         Create scripts/worker-poll.js: Supabase polling worker.
         Add stuck job recovery (>10 min → fail + refund).

LOS-062  Modify generate route
         Modify app/api/generate/route.ts: remove dev/prod split.
         Always insert job as "queued". Worker picks up.

LOS-063  OG tags + Schema.org
         Modify app/l/[slug]/page.tsx: add generateMetadata().
         Add og:image, og:video, twitter:card, JSON-LD.

LOS-064  Deploy prep
         Create requirements.txt (Python deps).
         Create railway.toml (ffmpeg nixpkg).
         Verify npm run build passes.

LOS-065  Deploy to Vercel
         Connect repo. Set env vars. Verify frontend loads.

LOS-066  Deploy to Railway
         Create service. Set env vars. Verify worker polls.

LOS-067  Production end-to-end test
         Full flow on live URLs: signup → scrape → customize →
         generate → download → share link → lead capture.

BATCH 8: Polish + UX
─────────────────────
LOS-070  Demo listing
         Create seed data: 12 sample photos + listing data.
         "Try Demo Listing" button on /dashboard/new.

LOS-071  Onboarding banner
         Show on /dashboard if brand kit incomplete.
         Progress indicator: 0/3, 1/3, 2/3, 3/3.
         Dismiss after brand kit has logo + name + phone.

LOS-072  Error recovery UX
         On generation failure: show "Try Again" button.
         Confirm credit was refunded. Preserve settings.

LOS-073  Referral system
         Add referral_code to users table.
         Create /dashboard/refer page.
         Track signups via ?ref= query param.
         Credit both users on referee's first paid month.

LOS-074  Mobile responsive pass
         Test every page on 375px width.
         Fix: sidebar collapse, photo grid columns,
         per-photo controls, video player, public listing page.

LOS-075  Final QA
         Run full test suite.
         Check every error state.
         Check every loading state.
         Check every empty state.
         Verify no hardcoded keys.
         Verify RLS on all tables.
         Verify Stripe webhook signature check.
```

---

## How to Run Each Session

```bash
# Start of EVERY session — paste this first:

"Read CLAUDE.md completely. Then read the ticket file I'm about to give you.
Do not suggest alternative approaches. Do not add dependencies.
Do not refactor code outside the ticket scope. Follow the patterns
in skills/ files exactly. When the ticket is done, run the test case
and show me the output. Do not say 'done' until the test passes."

# Then paste the ticket content.
```

---

## Context Token Budget Per Session

| What | Tokens | When |
|------|--------|------|
| CLAUDE.md | ~1,500 | Every session |
| Ticket file | ~500-800 | Every session |
| Skills file(s) | ~500-1,000 | When ticket says "Read first" |
| Source files being edited | ~2,000-5,000 | Auto-read by Claude Code |
| **Total context used** | **~5,000-8,000** | Per session |
| **Context available** | **~100,000+** | Claude Code limit |

You're using <10% of context per session. Plenty of room.
The key is NOT letting it accumulate across 20 tasks in one session.

---

## Quality Checklist (Verify After Every Batch)

After completing each batch, run these before moving to next batch:

```bash
# Build check
npm run typecheck    # 0 errors
npm run lint         # 0 errors  
npm run build        # succeeds

# Security check
grep -r "sk_live\|sk_test\|placeholder" --include="*.ts" --include="*.tsx" --include="*.js" .
# Should return 0 matches in source code (only .env files)

# Pattern check
grep -r "any" --include="*.ts" --include="*.tsx" lib/ app/ components/ | grep -v node_modules | grep -v ".d.ts"
# Review each `any` — should be 0

# Dead code check
grep -r "dev-pipeline\|devPipeline\|isDevMode" --include="*.ts" --include="*.tsx" .
# Should return 0 after LOS-002
```

---

## Anti-Patterns to Watch For

| Claude Code Does This | You Say This |
|---|---|
| "Let me refactor the scraper to use a cleaner pattern" | "No. Follow the ticket. Only change files listed." |
| "I suggest using tRPC for type-safe routes" | "No. We use Next.js route handlers. Read CLAUDE.md." |
| "Let me add zustand for state management" | "No. We use useState. Read CLAUDE.md." |
| "I'll install this helper library" | "No. No new dependencies. Use what's installed." |
| "This is done!" (without running test) | "Run the test case from the ticket. Show output." |
| "I'll also fix this other thing I noticed" | "No. File a new ticket. Only do what's assigned." |
| Writes code without error handling | "Add try/catch. Read skills/api-route-pattern.md." |
| Writes page without loading state | "Add skeleton. Read skills/component-pattern.md." |
| Uses different Supabase query style | "Use the exact pattern from skills/supabase-patterns.md." |
