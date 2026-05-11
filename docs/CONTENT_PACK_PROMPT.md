# Content Pack — Implementation Prompt for Claude Code

You are adding a "Content Pack" feature to ListingOS.
Read this ENTIRE prompt before writing any code.

---

## WHAT THIS IS

When an agent generates a video for a listing, we ALREADY generate
descriptions + captions via Claude Haiku. We are now extending this
to generate a FULL content pack — hooks, shot list, platform posts,
engagement questions, feature extraction — in ONE additional Claude call.

This is NOT a new system. It is ONE new Claude call, ONE new DB column,
and ONE new UI tab. Nothing else changes.

---

## CURRENT STATE (read these files first)

1. `scripts/pipeline.js` lines 780-850 — where Claude content is generated
2. `lib/claude.ts` — existing Claude client + generateAllContent()
3. `prompts/listing-description.ts` — existing description prompts
4. `prompts/captions.ts` — existing caption prompts
5. `app/(dashboard)/dashboard/new/done/page.tsx` — results page
6. `app/(dashboard)/dashboard/listings/[id]/page.tsx` — listing detail
7. `lib/types.ts` — existing TypeScript types

---

## STEP 1: Add DB column

File: New migration OR run in Supabase SQL editor

```sql
ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS content_pack JSONB DEFAULT NULL;
```

That's it. One column. No new tables.

---

## STEP 2: Define the ContentPack type

File: `lib/types.ts` — ADD this interface (do not modify existing types)

```ts
export interface ContentPack {
  hooks: string[];           // 10 scroll-stopping hooks
  features: string[];        // extracted sellable features from listing
  shotList: ShotScene[];     // 6-scene Reel script
  captionStyles: {
    bold: string;
    storytelling: string;
    dataDriven: string;
    casual: string;
    luxury: string;
  };
  platformPosts: {
    instagram: string;
    tiktok: string;
    linkedin: string;
    facebook: string;
    twitter: string;
    youtubeShort: string;
    emailSnippet: string;
  };
  engagementQuestions: string[];  // 5 comment-driving questions
  generatedAt: string;           // ISO timestamp
}

export interface ShotScene {
  sceneNumber: number;
  duration: string;       // "0-3s"
  camera: string;         // "Walk toward front door"
  speak: string;          // "Wait till you see inside this one."
}
```

---

## STEP 3: Create the content pack prompt

File: `prompts/content-pack.ts` — NEW FILE

```ts
import type { ContentPack } from "@/lib/types";

export interface ContentPackInput {
  address: string;
  city: string;
  state?: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  features?: string;        // raw description or extracted features
  style: string;            // modern | luxury | energetic | minimal
  agentName?: string;
  voiceProfile?: string;    // brand voice description if set
}

export function buildContentPackPrompt(input: ContentPackInput): string {
  const priceStr = input.price ? `$${input.price.toLocaleString()}` : "Price TBD";
  const specsStr = [
    input.beds ? `${input.beds} beds` : null,
    input.baths ? `${input.baths} baths` : null,
    input.sqft ? `${input.sqft.toLocaleString()} sqft` : null,
  ].filter(Boolean).join(", ");

  const voiceInstructions = input.voiceProfile
    ? `\nIMPORTANT: Match this agent's writing voice: ${input.voiceProfile}`
    : "";

  return `You are a real estate content strategist.
Generate a complete content pack for this listing.
CRITICAL: Comply with Fair Housing Act in ALL outputs.
Never mention: families, children, religion, nationality, disability, gender, age, safe area.${voiceInstructions}

LISTING:
Address: ${input.address}
City: ${input.city}${input.state ? `, ${input.state}` : ""}
Price: ${priceStr}
Specs: ${specsStr}
Style: ${input.style}
${input.features ? `Notable features: ${input.features}` : ""}

Return ONLY valid JSON matching this exact structure:
{
  "hooks": [
    "10 scroll-stopping hooks for Reels/TikTok. Short. Punchy. Start with action verbs or POV. Under 15 words each. Mix emotional, data-driven, and curiosity hooks."
  ],
  "features": [
    "8-12 specific sellable features. Be precise: not 'nice kitchen' but 'quartz waterfall island with pendant lighting'. Infer from specs and common features at this price point."
  ],
  "shotList": [
    {
      "sceneNumber": 1,
      "duration": "0-3s",
      "camera": "specific camera direction: walk toward, pan across, push in, pull back, reveal",
      "speak": "exact words to say on camera. Or '[silence — let the space breathe]' for reveals"
    }
  ],
  "captionStyles": {
    "bold": "attention-grabbing, direct, urgency. Under 150 chars.",
    "storytelling": "paint a picture, 'imagine waking up to...'. Under 200 chars.",
    "dataDriven": "price per sqft, market comparison, school ratings. Under 150 chars.",
    "casual": "conversational, light humor, relatable. Under 150 chars.",
    "luxury": "refined language, sensory details, aspirational. Under 200 chars."
  },
  "platformPosts": {
    "instagram": "caption + 5 relevant hashtags + CTA. Under 300 chars total.",
    "tiktok": "spoken-word script, punchy, 15-second delivery. No hashtags in text.",
    "linkedin": "professional, market-insight angle, no emojis. 2-3 sentences.",
    "facebook": "conversational, end with question to drive comments. 2-3 sentences.",
    "twitter": "under 280 chars. Bold take or key stat. No hashtags.",
    "youtubeShort": "hook in first 2 seconds + tour highlights + CTA. 30-second script.",
    "emailSnippet": "subject line + 3-sentence body + CTA link placeholder."
  },
  "engagementQuestions": [
    "5 questions that drive comments/saves. Mix: polls, debates, opinions, save-worthy tips. Each under 80 chars."
  ]
}

IMPORTANT:
- shotList must have exactly 6 scenes totaling 30 seconds
- hooks must have exactly 10 items
- features must have 8-12 items
- engagementQuestions must have exactly 5 items
- ALL text must be Fair Housing compliant
- Do NOT use generic phrases like "beautiful home" or "must see"
- Be SPECIFIC to this listing's price point, location, and likely features`;
}

export function parseContentPack(raw: string): ContentPack | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields exist
    if (!parsed.hooks || !Array.isArray(parsed.hooks)) return null;
    if (!parsed.features || !Array.isArray(parsed.features)) return null;
    if (!parsed.shotList || !Array.isArray(parsed.shotList)) return null;
    if (!parsed.captionStyles || typeof parsed.captionStyles !== "object") return null;
    if (!parsed.platformPosts || typeof parsed.platformPosts !== "object") return null;
    if (!parsed.engagementQuestions || !Array.isArray(parsed.engagementQuestions)) return null;

    return {
      ...parsed,
      generatedAt: new Date().toISOString(),
    } as ContentPack;
  } catch {
    return null;
  }
}
```

---

## STEP 4: Add generateContentPack to Claude client

File: `lib/claude.ts` — ADD this function (do not modify existing functions)

```ts
import { buildContentPackPrompt, parseContentPack } from "@/prompts/content-pack";
import type { ContentPack } from "@/lib/types";
import type { ContentPackInput } from "@/prompts/content-pack";

export async function generateContentPack(
  input: ContentPackInput
): Promise<ContentPack | null> {
  const prompt = buildContentPackPrompt(input);

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0]?.type === "text" 
      ? response.content[0].text 
      : "";
    return parseContentPack(text);
  } catch (error) {
    console.error("[claude] Content pack generation failed:", error);
    return null;
  }
}
```

---

## STEP 5: Call it from the pipeline

File: `scripts/pipeline.js` — find the section where Claude content 
is generated (around line 780-850). ADD the content pack call 
IN PARALLEL with existing description/caption generation.

Find the code block that calls Claude for descriptions. Add nearby:

```js
// ─── Content Pack (parallel, non-blocking) ──────────────────────────────────
async function generateAndSaveContentPack(listing, brand) {
  try {
    const fetch = (await import("node-fetch")).default;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    
    // Call our own API route (keeps Claude logic in one place)
    const res = await fetch(`${appUrl}/api/content/pack`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "x-service-key": process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        listingId: listing.id,
        address: listing.address || "",
        city: listing.city || "",
        state: listing.state || "",
        price: listing.price,
        beds: listing.beds,
        baths: listing.baths,
        sqft: listing.sqft,
        features: listing.raw_description || "",
        style: style || "modern",
        agentName: brand?.agent_name || "",
      }),
    });

    if (!res.ok) {
      console.warn("[pipeline] Content pack generation returned:", res.status);
    }
  } catch (e) {
    console.warn("[pipeline] Content pack failed (non-blocking):", e.message);
  }
}
```

Then call it alongside existing Claude calls:

```js
// Fire content pack generation in parallel — do NOT await
generateAndSaveContentPack(listing, brand);
```

---

## STEP 6: API route for content pack generation

File: `app/api/content/pack/route.ts` — NEW FILE

```ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateContentPack } from "@/lib/claude";

export async function POST(request: NextRequest) {
  // Auth: either user session OR service key from pipeline
  const serviceKey = request.headers.get("x-service-key");
  const isServiceCall = serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!isServiceCall) {
    // Check user auth for manual regeneration
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { listingId, address, city, state, price, beds, baths, sqft, features, style, agentName } = body;

  if (!listingId) {
    return NextResponse.json({ error: "listingId required" }, { status: 400 });
  }

  // Fetch brand voice profile if exists
  const admin = createAdminClient();
  let voiceProfile: string | undefined;

  if (!isServiceCall) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: brandKit } = await admin
        .from("brand_kits")
        .select("voice_profile")
        .eq("user_id", user.id)
        .single();
      voiceProfile = brandKit?.voice_profile || undefined;
    }
  }

  const contentPack = await generateContentPack({
    address: address || "",
    city: city || "",
    state,
    price,
    beds,
    baths,
    sqft,
    features,
    style: style || "modern",
    agentName,
    voiceProfile,
  });

  if (!contentPack) {
    return NextResponse.json({ error: "Content generation failed" }, { status: 500 });
  }

  // Save to listing
  await admin
    .from("listings")
    .update({ content_pack: contentPack })
    .eq("id", listingId);

  return NextResponse.json({ contentPack });
}
```

---

## STEP 7: Content Pack UI component

File: `components/dashboard/content-pack.tsx` — NEW FILE

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Sparkles, Video, MessageCircle, Share2, HelpCircle,
  Copy, Check, RefreshCw, Instagram, Linkedin, Mail,
  Twitter, Youtube, Facebook
} from "lucide-react";
import type { ContentPack } from "@/lib/types";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="ml-2 text-muted-foreground hover:text-foreground">
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function CopyableItem({ text, index }: { text: string; index?: number }) {
  return (
    <div className="flex items-start justify-between py-2 px-3 rounded-lg hover:bg-muted/50 group">
      <span className="text-sm flex-1">
        {index !== undefined && (
          <span className="text-muted-foreground mr-2">{index + 1}.</span>
        )}
        {text}
      </span>
      <CopyButton text={text} />
    </div>
  );
}

interface ContentPackViewProps {
  contentPack: ContentPack | null;
  listingId: string;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

export function ContentPackView({
  contentPack,
  listingId,
  onRegenerate,
  isRegenerating,
}: ContentPackViewProps) {
  if (!contentPack) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p>Content pack not generated yet.</p>
          {onRegenerate && (
            <Button onClick={onRegenerate} className="mt-4" size="sm">
              Generate Now
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Content Pack</h3>
          <p className="text-sm text-muted-foreground">
            Generated {new Date(contentPack.generatedAt).toLocaleDateString()}
          </p>
        </div>
        {onRegenerate && (
          <Button onClick={onRegenerate} variant="outline" size="sm" disabled={isRegenerating}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`} />
            Regenerate
          </Button>
        )}
      </div>

      <Tabs defaultValue="hooks" className="w-full">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="hooks">
            <Sparkles className="h-4 w-4 mr-1" /> Hooks
          </TabsTrigger>
          <TabsTrigger value="script">
            <Video className="h-4 w-4 mr-1" /> Script
          </TabsTrigger>
          <TabsTrigger value="captions">
            <MessageCircle className="h-4 w-4 mr-1" /> Captions
          </TabsTrigger>
          <TabsTrigger value="platforms">
            <Share2 className="h-4 w-4 mr-1" /> Platforms
          </TabsTrigger>
          <TabsTrigger value="engage">
            <HelpCircle className="h-4 w-4 mr-1" /> Engage
          </TabsTrigger>
        </TabsList>

        {/* HOOKS TAB */}
        <TabsContent value="hooks" className="space-y-1">
          <p className="text-sm text-muted-foreground mb-3">
            Scroll-stopping hooks for Reels and TikTok. Tap to copy.
          </p>
          {contentPack.hooks.map((hook, i) => (
            <CopyableItem key={i} text={hook} index={i} />
          ))}
        </TabsContent>

        {/* SHOT LIST TAB */}
        <TabsContent value="script" className="space-y-3">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">
              Scene-by-scene Reel script. Film this at your next showing.
            </p>
            <CopyButton
              text={contentPack.shotList
                .map((s) => `SCENE ${s.sceneNumber} (${s.duration}): ${s.camera}\nSAY: "${s.speak}"`)
                .join("\n\n")}
            />
          </div>
          {contentPack.shotList.map((scene) => (
            <Card key={scene.sceneNumber}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="secondary">Scene {scene.sceneNumber}</Badge>
                  <span className="text-xs text-muted-foreground">{scene.duration}</span>
                </div>
                <p className="text-sm font-medium">📷 {scene.camera}</p>
                <p className="text-sm text-muted-foreground mt-1">🎤 "{scene.speak}"</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* CAPTIONS TAB */}
        <TabsContent value="captions" className="space-y-1">
          <p className="text-sm text-muted-foreground mb-3">
            Same listing, 5 different tones. Pick what fits your brand.
          </p>
          {Object.entries(contentPack.captionStyles).map(([tone, text]) => {
            const labels: Record<string, { emoji: string; label: string }> = {
              bold: { emoji: "🔥", label: "Bold" },
              storytelling: { emoji: "🏡", label: "Story" },
              dataDriven: { emoji: "📊", label: "Data" },
              casual: { emoji: "😂", label: "Casual" },
              luxury: { emoji: "💎", label: "Luxury" },
            };
            const { emoji, label } = labels[tone] || { emoji: "✍️", label: tone };
            return (
              <div key={tone} className="py-2 px-3 rounded-lg hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{emoji} {label}</Badge>
                  <CopyButton text={text} />
                </div>
                <p className="text-sm mt-1">{text}</p>
              </div>
            );
          })}
        </TabsContent>

        {/* PLATFORM POSTS TAB */}
        <TabsContent value="platforms" className="space-y-1">
          <p className="text-sm text-muted-foreground mb-3">
            Native post for each platform. Tap to copy and paste.
          </p>
          {Object.entries(contentPack.platformPosts).map(([platform, text]) => {
            const icons: Record<string, React.ReactNode> = {
              instagram: <Instagram className="h-4 w-4" />,
              tiktok: <Video className="h-4 w-4" />,
              linkedin: <Linkedin className="h-4 w-4" />,
              facebook: <Facebook className="h-4 w-4" />,
              twitter: <Twitter className="h-4 w-4" />,
              youtubeShort: <Youtube className="h-4 w-4" />,
              emailSnippet: <Mail className="h-4 w-4" />,
            };
            return (
              <div key={platform} className="py-2 px-3 rounded-lg hover:bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {icons[platform]}
                    <span className="text-sm font-medium capitalize">
                      {platform === "youtubeShort" ? "YouTube Short" : 
                       platform === "emailSnippet" ? "Email" : platform}
                    </span>
                  </div>
                  <CopyButton text={text} />
                </div>
                <p className="text-sm mt-1 text-muted-foreground">{text}</p>
              </div>
            );
          })}
        </TabsContent>

        {/* ENGAGEMENT TAB */}
        <TabsContent value="engage" className="space-y-1">
          <p className="text-sm text-muted-foreground mb-3">
            Questions that drive comments and saves. Use at end of posts.
          </p>
          {contentPack.engagementQuestions.map((q, i) => (
            <CopyableItem key={i} text={q} index={i} />
          ))}
        </TabsContent>
      </Tabs>

      {/* Features (always visible at bottom) */}
      <Card>
        <CardContent className="py-4">
          <h4 className="text-sm font-semibold mb-2">
            ✦ Extracted Features
            <CopyButton text={contentPack.features.join("\n")} />
          </h4>
          <div className="flex flex-wrap gap-2">
            {contentPack.features.map((feature, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {feature}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## STEP 8: Wire into existing pages

### A) Results page (after video generation)
File: `app/(dashboard)/dashboard/new/done/page.tsx`

Find the existing tabs (Video / Descriptions / Captions).
ADD a new tab: "Content Pack"

```tsx
import { ContentPackView } from "@/components/dashboard/content-pack";

// In the component, after fetching listing data:
const contentPack = listing?.content_pack as ContentPack | null;

// In the tabs:
<TabsTrigger value="content">Content Pack</TabsTrigger>

<TabsContent value="content">
  <ContentPackView 
    contentPack={contentPack} 
    listingId={listing.id}
    onRegenerate={handleRegenerate}
    isRegenerating={isRegenerating}
  />
</TabsContent>
```

### B) Listing detail page
File: `app/(dashboard)/dashboard/listings/[id]/page.tsx`

Same pattern — add Content Pack tab alongside existing content.

---

## STEP 9: Brand Voice Profile (optional, adds moat)

### A) Add DB column
```sql
ALTER TABLE public.brand_kits 
ADD COLUMN IF NOT EXISTS voice_profile TEXT DEFAULT NULL;
```

### B) Add to brand kit page
File: `app/(dashboard)/dashboard/brand/page.tsx`

Add a textarea at the bottom:

```tsx
<div className="space-y-2">
  <label className="text-sm font-medium">Brand Voice (optional)</label>
  <p className="text-sm text-muted-foreground">
    Paste 3-5 captions you've written that sound like YOU. 
    All generated content will match your voice.
  </p>
  <textarea
    value={voiceExamples}
    onChange={(e) => setVoiceExamples(e.target.value)}
    placeholder="Paste your favorite captions here..."
    className="w-full h-32 rounded-md border p-3 text-sm"
  />
  <Button onClick={analyzeVoice} size="sm" disabled={analyzing}>
    {analyzing ? "Analyzing..." : "Save Voice Profile"}
  </Button>
</div>
```

### C) Voice analysis prompt
When agent saves examples, Claude analyzes and stores a voice description:

```ts
const voiceAnalysisPrompt = `Analyze these real estate social media captions 
and describe the author's writing voice in 2-3 sentences. Note their:
- Sentence length and structure
- Tone (professional, casual, humorous, luxury)
- Use of emojis, slang, punctuation
- How they open and close posts
- Any catchphrases or patterns

Captions:
${examples}

Write a concise voice profile that another AI could follow to match this style.`;
```

Save the result to `brand_kits.voice_profile`. It gets prepended to
every content pack generation prompt automatically.

---

## STEP 10: Carousel Image Generator (bonus, browser-only)

File: `app/api/content/carousel/route.ts` — NEW FILE

Uses Puppeteer to screenshot 5 HTML templates → returns 5 PNG images.

```ts
// Template 1: Cover slide (listing photo + JUST LISTED + price)
// Template 2: Stats slide (beds/baths/sqft with icons)
// Template 3: Features slide (top 3 from content_pack.features)
// Template 4: Neighborhood slide (city + highlights)
// Template 5: CTA slide (agent photo + contact info)

// Each template is an HTML string → Puppeteer screenshots at 1080x1080
// Returns: ZIP of 5 PNGs
```

This is Phase 2. Skip for now. Add when agents ask for it.

---

## TEST PLAN

### Test 1: Content Pack Generation
```
1. Have a listing with photos + specs in DB
2. POST /api/content/pack with listing data
3. Verify: returns valid ContentPack JSON
4. Verify: all arrays have correct counts (10 hooks, 6 scenes, 5 questions)
5. Verify: saved to listings.content_pack in DB
6. Verify: no Fair Housing violations in any text
```

### Test 2: Pipeline Integration
```
1. Generate a video for a listing (POST /api/generate)
2. Wait for pipeline to complete
3. Verify: listings.content_pack is populated (not null)
4. Verify: content pack generated in parallel (didn't slow down video)
5. Verify: if content pack fails, video still succeeds
```

### Test 3: UI Rendering
```
1. Navigate to /dashboard/listings/[id]
2. Click Content Pack tab
3. Verify: all 5 sub-tabs render (Hooks, Script, Captions, Platforms, Engage)
4. Verify: copy buttons work on every item
5. Verify: features badges render
6. Verify: regenerate button triggers new generation
7. Verify: loading state shows during regeneration
```

### Test 4: Brand Voice
```
1. Go to /dashboard/brand
2. Paste 3 example captions
3. Click Save Voice Profile
4. Generate a new listing video
5. Verify: content pack output matches the voice profile
6. Compare: output with voice vs without voice — should be noticeably different
```

### Test 5: Edge Cases
```
1. Listing with no price → content still generates (uses "Contact for pricing")
2. Listing with no photos → features are inferred from specs only
3. Claude API timeout → content_pack stays null, video still completes
4. Regenerate on existing listing → overwrites old content_pack
5. Very long address → doesn't break UI layout
```

---

## FILES CHANGED (summary)

| File | Action | Lines |
|---|---|---|
| DB migration | ADD column `content_pack JSONB` | 1 |
| `lib/types.ts` | ADD ContentPack + ShotScene interfaces | ~30 |
| `prompts/content-pack.ts` | NEW — prompt + parser | ~120 |
| `lib/claude.ts` | ADD generateContentPack() | ~25 |
| `app/api/content/pack/route.ts` | NEW — API route | ~60 |
| `components/dashboard/content-pack.tsx` | NEW — UI component | ~200 |
| `scripts/pipeline.js` | ADD 1 non-blocking call | ~20 |
| `app/(dashboard)/dashboard/new/done/page.tsx` | ADD 1 tab | ~10 |
| `app/(dashboard)/dashboard/listings/[id]/page.tsx` | ADD 1 tab | ~10 |
| `app/(dashboard)/dashboard/brand/page.tsx` | ADD voice textarea | ~30 |

**Total new code: ~500 lines**
**Existing code modified: ~40 lines**
**Nothing deleted. Nothing restructured. Pure addition.**

---

## EXECUTION ORDER

```
1. Run SQL migration (1 min)
2. Create prompts/content-pack.ts (30 min)
3. Add generateContentPack to lib/claude.ts (15 min)
4. Create app/api/content/pack/route.ts (20 min)
5. Create components/dashboard/content-pack.tsx (45 min)
6. Wire into done page + listing detail page (15 min)
7. Add pipeline.js integration (10 min)
8. Add brand voice to brand page (20 min)
9. Test all 5 test cases (30 min)
```

**Total: ~3 hours. Ship same day.**
