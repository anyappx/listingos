# Real Estate AI Video Generation SaaS — Product + Go-to-Market Blueprint (May 2026)

## TL;DR

- **Build a real-estate-native content OS — not just another photo-to-video tool.** Wholesale AI video costs collapsed in 2026 (Seedance v1.5 Fast at $0.022/sec on Atlas Cloud, Veo 3.1 Lite at $0.05/sec, Sora 2 at $0.10/sec for 720p), so a 30-second cinematic listing video now costs ~$0.99–$2.50 to produce against a $9–$45 market price; that gap is what makes a 95%+ variable-margin SaaS realistic. The winners will not be the cheapest AI; they will own the workflow (MLS → CRM → social → analytics → brokerage governance).
- **Recommended pricing**: $29 Lite (3 listings) / $79 Agent (10) / $149 Pro Agent (25) / $349 Team / $999 Brokerage / Custom Enterprise + $2,499/mo + $0.50/render White-Label, with 20% annual discount, 7-day trial that includes one fully branded video. This undercuts Reel-E at the entry tier while matching feature breadth that Pedra/AutoReel/Amplifiles cannot.
- **0-budget GTM in 60 days**: realistic landing zone is **80–150 paying agents** (200 only with above-average execution), via three reinforcing channels — disclosure-compliant AI-persona Instagram/TikTok accounts ("homes you can afford on $X salary in [city]"), a photographer reseller program at a $50–$100 add-on per shoot (the same channel AutoReel scaled with), and trigger-based cold email at ~600 sends/day across warmed sub-domains. The biggest single moat to chase early is a 12-month exclusivity deal with one mid-market brokerage (eXp regional, Real, Side, or Anywhere franchise) and a co-branded "Coach Edition" with Tom Ferry or Jimmy Mackin's Listing Leads (which generated $3.1B in listing volume across 2,120 agents in 100 days in 2023).

---

## Key Findings

1. **The category has at least eight live players but no winner** — Reel-E, AutoReel, Pedra, PhotoAIVideo, VideoTour.ai, Amplifiles, Animoto, plus Aryeo/Spiro on the photographer side and Coffee & Contracts/LCA Marketing Center on the template side. None bundles MLS + CRM + brokerage governance + social pack + video; that gap is the blueprint.
2. **AI cost compression is the dominant 2026 trend.** Three independent provider sets (BytePlus/Atlas Seedance, Google Veo 3.1, OpenAI Sora 2) all sit at $0.05–$0.15/sec for 720p, an order of magnitude cheaper than Runway Gen-4.5 ($0.30/sec) and Kling 2.1 Master ($0.28/sec). The optimal stack for unit economics: Seedance Fast for the bulk of frames, Veo 3.1 Fast or Kling 2.6 Pro selectively for "hero" shots with fire/water/atmospherics.
3. **Web-first PWA + iOS thin client beats app-first.** App Store/Play 15–30% IAP fees destroy SaaS margins; Stripe is 2.9%+$0.30. NAR data confirms 70% of buyers use mobile/tablet during search and 60%+ of property searches start on mobile, so mobile capture is essential — but billing should always live on web.
4. **The structural growth lever is the brokerage, not the agent.** PropTech monthly churn averages 4.7% (Dollarpocket benchmark); SMB/solo segment is 5–8%; enterprise <2%. BombBomb VP of Finance Clint Jackson disclosed in a Bigfoot Capital Medium guest post that "the company is consistently churning 30% of subscriptions up for renewal" annually — and BombBomb's lower-churn cohort is the brokerage-embedded one. Brokerage bundling is the single highest-leverage retention move.
5. **AI-influencer GTM is viable but heavily regulated in 2026.** FTC Endorsement Guides explicitly cover "virtual endorsers"; Meta requires AI-Info labels (auto-applied via C2PA) and rolled out optional "AI Creator" profile labels in May 2026; TikTok auto-detects via C2PA and TikTok Newsroom reports having cumulatively labeled "over 1.3 billion AI-generated videos" through H1 2025; FTC Consumer Reviews Rule (effective Oct 21, 2024) bans AI-generated testimonials misrepresenting reviewer identity at up to $51,744/violation; NY Synthetic Performer Disclosure adds $1,000 first-offense penalties; EU AI Act Article 50 deepfake rules apply Aug 2, 2026. Build for transparency from day one — disclosure is not optional, but it does NOT preclude scale.
6. **Tom Ferry-class coach partnerships and Lab Coat Agents (165,000+ FB members) are the highest-conversion distribution channels in real estate.** Coffee & Contracts (Haley Ingram's bio states the platform "has successfully assisted over 16,000 agents") proved subscription template products at $74/mo work in this audience; the gap is video.
7. **NAR membership is shrinking.** As of May 31, 2025 NAR membership stood at 1,453,690, above its forecast 1.4M; per Inman News (Nov 18, 2025), "NAR's 2026 budget is based on falling to 1.2 million members next year" with a $41M expense reduction. TAM is shrinking ~20% in two years, but the agents who survive are exactly the full-time professionals who pay for marketing automation.

---

## Details

### SECTION 1: Competitor Deep Analysis

**Reel-E** (reel-e.ai) — Founded ~2024; markets "18,000+ agents." Pricing: Essential $44/mo (3 listings), Growth $97/mo (10), Pro $449/mo (50, 4K). All plans include 4 output variants (16:9 + 9:16, branded + unbranded). 7-day free trial; first video free. Custom inference stack with optional "AI+" Veo toggle for fire/water; beat-synced transitions, speed ramps, music cleared for commercial use, up to 4K. UX: upload 5–40 photos OR paste Zillow/Redfin/Realtor.com URL → choose music + branding → 4 videos in <2 min. **Strengths**: best-in-class motion vs slideshow tools, both vertical/horizontal in one render, data-privacy positioning. **Weaknesses**: no virtual staging, no CRM integrations, no AI voiceover, no mobile app, expensive at Pro ($8.98/listing). **Marketing**: heavy SEO via vs-X comparison articles, Capterra listing.

**AutoReel** (autoreelapp.com) — Founded 2024, NYC. Founder Alok Gupta (ex-Facebook/Instagram/Snapchat product). "Thousands of realtors" across Compass, eXp, KW per company press. Pricing: Free (2 watermarked videos/mo), Starter ~$19/mo, Growth, Pro tiers. Each image = 3-second clip; videos up to 60 seconds. Trustpilot 219 reviews, 4.5★+. **Strengths**: highest social proof, photographer reseller economics ($50–$100 markup), affordable entry. **Weaknesses**: "AI" is partly preset zoom/pan + Ken Burns on cheaper tiers per third-party tests; processing 10–15 min during peak; image-count caps; "only have 3 properties this year" pricing complaint pattern. **Marketing**: Instagram-first organic, affiliate creator codes (e.g., "SHOWINGATX 40% off first month"), photographer reseller channel as their primary acquisition lever. **Caveat**: AutoReel press releases on Barchart and marketersmedia read as paid PR, not independent reporting; specific user-count and reply-rate numbers are not independently audited.

**Pedra** (pedra.ai) — EU-led (Spain/France/Portugal), 20,000+ agencies expanding to NA. Pricing: ~€29 Pro / €59 Premium / €89 Business. 1 image = 1 credit; 1 video = 5 credits; floor plans, virtual tours, social media content unlimited. 7-image free trial. Features: virtual staging (1-click), empty-room/declutter, renovation, facade/garden/pool, sky replacement, watermark removal, lighting/perspective correction, floor plan→3D, 360° virtual tours with hotspots, video, API. **Strengths**: broadest feature set, founder-led ("talk directly with the founder in a 15-min demo"), API access. **Weaknesses**: video is a *feature*, not core; less cinematic motion; primarily EU support; limited US-MLS integrations.

**PhotoAIVideo** (photoaivideo.com) — "4.9★ from 2,000+ professionals," CloudPano integration. Image→cinematic motion (parallax, dolly, lateral track, ceiling-fan animation), MLS-friendly horizontal export, white-label, mobile + desktop. "$100–200 average increase in order value per listing" is the photographer-reseller pitch. Opaque pricing.

**VideoTour.ai** (videotour.ai) — "10,000+ agents." Photo→2-min cinematic, AI avatar add-on (one photo + voice clone → presenter), AI lifestyle videos (photorealistic people inserted into rooms — fair-housing risk if not governed).

**Amplifiles** (amplifiles.ai) — Pure pay-per-image: **$1.50/image** (e.g., 7-image video = $10.50). 1,200 free credits at signup; no credit card. Voiceover in 30+ languages, automated captions, 16:9/9:16/1:1, branding, Zillow/MLS URL import, ~5-min render, 1080p. Lowest per-listing floor; no subscription = lower LTV.

**Animoto** — Established 2006; general-purpose; ~$33/mo Pro. Templates, not 3D motion.

**Adjacents**: **Aryeo** (Zillow Group / ShowingTime+; $49–$179/mo, no per-listing fees; AI virtual staging + Zillow Showcase delivery + Zillow 3D Home; "nation's largest real estate photography software platform"). **Spiro** ($5/listing, podcast-driven). **LCA Marketing Center** (Lab Coat Agents — 165,000+ FB members; templates only, no video — direct partnership opportunity). **Coffee & Contracts** ($74/mo+ since 2019, weekly Reels/scripts/lead magnets — Haley Ingram's bio states the platform "has successfully assisted over 16,000 agents"). **HeyGen** ($29–$149+/mo; talking-head avatars; used for "agent intro" content but not listings). **Matterport / CloudPano / Asteroom / Zillow 3D Home** (360° tours, separate category). **Listing Leads** (Jimmy Mackin + Tom Ferry; their 2023 "100-day program" partnership "helped 2,120 agents generate more than $3,100,000,000 in listing volume in 100 days"). **CRM ecosystem** agents already pay: Follow Up Boss (~$69+/mo), kvCORE/Lofty, Sierra Interactive, Chime, BoomTown, LionDesk, Real Geeks, HubSpot/Salesforce. **Lead-gen**: Ylopo, Real Geeks, CINC, Market Leader, BoomTown, Curaytor.

**Side-by-side feature/pricing matrix:**

| Tool | Core Output | Mobile App | MLS Import | Virtual Staging | AI Voiceover | CRM Integration | Brokerage Mgmt | Floor | Ceiling |
|---|---|---|---|---|---|---|---|---|---|
| Reel-E | Cinematic listing video (4 formats) | ❌ | ✅ URL | ❌ | ❌ | ❌ | Limited | $44 | $449 |
| AutoReel | Cinematic + Studio | ❌ | ✅ URL | beta | beta | ❌ | Marketing tier | ~$19 | Custom |
| Pedra | Staging + video + 360 + plans | ❌ | ❌ direct | ✅ best | ❌ | API | ❌ | €29 | €89+ |
| PhotoAIVideo | Photo→video + 360 | ✅ mobile-friendly | Limited | ❌ | ❌ | via CloudPano | ❌ | Custom | Custom |
| VideoTour.ai | Video + avatar + lifestyle | ❌ | ✅ URL | ❌ | ✅ avatar | ❌ | ❌ | Custom | Custom |
| Amplifiles | Per-image video | ❌ | ✅ URL | ❌ | ✅ 30+ langs | ❌ | ❌ | $1.50/img | n/a |
| Animoto | Templates | ❌ | ❌ | ❌ | TTS | ❌ | ❌ | Free | $33 |
| Aryeo | Photographer ops + Showcase | ❌ | ✅ Zillow | ✅ AI staging | ❌ | Limited | ✅ photog teams | $49 | $179 |
| HeyGen | Talking-head avatars | ❌ | ❌ | ❌ | ✅ best | ❌ | ✅ Business | $29 | $149+ |
| **ListingOS (proposed)** | **Full content OS** | **✅ iOS+Android** | **✅ RESO Web API + URL** | **✅** | **✅ ElevenLabs/Veo** | **✅ FUB/kvCORE/Sierra/Chime/HubSpot** | **✅** | **$29** | **$349+ + WL** |

**Recurring complaints**: Reel-E — credit confusion across plans, 1080p limit on lower tiers. AutoReel — processing spikes during peak, low-volume pricing pain, free-tier 2-videos/mo too restrictive to evaluate. Pedra — credit drain for video (5 credits/video), limited US-MLS workflow. Animoto — slideshow look, non-native templates.

**First-1000 strategies (sourced + caveated)**: AutoReel scaled via photographer reseller channel, affiliate creator codes, and Instagram-first organic; Reel-E via SEO comparison content and Capterra; Pedra via founder-led demos and free tools as SEO lead magnets; VideoTour.ai via YouTube channel + creative differentiation. None has published independently audited cold-email or paid-ads numbers.

### SECTION 2: Complete Feature Set

**Video Engine**: composition-aware camera moves (orbit, push-in, pull-out, lateral track, dolly, parallax 2.5D); AI+ toggle (Veo 3.1, Seedance 2.0) for fire, water, fog, ceiling-fan rotation, tree sway; 8 simultaneous outputs per render (16:9, 9:16, 1:1, 4:5 × branded/unbranded); ElevenLabs voiceover in 30+ languages including Spanish, Mandarin, Vietnamese, Tagalog; 800+ commercially cleared music tracks with beat-synced transitions and speed ramps; AI-generated establishing shots / Google Earth fly-throughs; auto-captions with brand styling; 8 cinematic style presets (Modern, Luxury, Energy/Reels, New Construction, Rustic, Coastal, Minimal, Architectural Digest); 15s/30s/45s/60s/90s durations; drone-style exterior reveal from a single front-of-house photo (clearly labeled "AI-enhanced").

**Photo Enhancement / Virtual Staging**: 1-click staging in 6 styles (Modern, Mediterranean, Scandinavian, Mid-Century, Farmhouse, Luxury), empty-room/declutter, day-to-dusk, sky replacement, grass greening, lighting/perspective/color correction, watermark removal, pool restoration, garden staging, renovation visualization. Optional "Virtually Staged" disclosure watermark (some state real-estate boards require).

**Social Pack (per listing)**: 5-frame IG carousel, Story-template pack, 60s + 15s Reels, TikTok-native edit, FB post, LinkedIn post, YouTube Short, email-blast hero + 3 subject lines, plus Just-Listed/Just-Sold/Open-House/Price-Reduction/Coming-Soon variants.

**Listing Description Writing**: MLS-compliant from address + photos + specs; **Fair Housing pre-screen** scans for illegal language ("perfect for families" etc.) per Section 3604 and NAR Code of Ethics Article 10; suggests alternatives. Variants: MLS-long (2,500 char), MLS-short (1,000), Zillow lead-gen, Luxury narrative. Multilingual: ES, ZH, VI, TL, KO, RU, AR, PT.

**Agent Personal Branding**: AI headshot generation (~$0.50/headshot wholesale via Aragon-class API); bio video (HeyGen API at $0.05–$0.10/sec); 30s "Meet [Agent]" intro reel; SMS-driven testimonial collection ("client texts → AI auto-edits with caption/music/branding"); written testimonial → AI avatar speaks them.

**Open House**: 4×6, 8.5×11, tri-fold flyers; A-frame yard signs; social invites; QR codes → single-property landing pages with lead capture; follow-up videos to attendees; digital sign-in sheet → CRM.

**Just Listed / Just Sold**: one-click across video, carousel, Story, postcard, email; door-knock radius generator (300/500/1,000 home radius via Lob.com/PostGrid); "Coming Soon" pre-listing teaser.

**Market Update Videos (MLS-driven)**: weekly auto-reel from RESO Web API ("avg price ↑X%, DOM ↓Y, X new listings, X sold"); monthly YoY deeper-dive with chart animations; quarterly state-of-market PDF; hyperlocal by ZIP/neighborhood/school district.

**Neighborhood Showcase**: address → autopopulate Walk Score, restaurants, schools (GreatSchools API), parks, transit, demographics (US Census API), commute times; AI B-roll + animated map + Google Earth fly-in.

**Lead Generation**: CTA overlays ("Tour this home — text TOUR to 555-XXXX"); single-property IDX-compliant landing pages; embedded QR codes on print and end-cards; SMS lead intake → CRM; "Want a video like this for your home?" seller-lead funnel on every public-shared video.

**Analytics**: per-video (views, watch time, shares, saves, CTA conversions via IG Graph, TikTok Business, YouTube, Meta Business Manager); per-listing (total reach across platforms, leads attributed, contracts/closes); per-agent ROI ($ subscription / $ commission attributable); brokerage leaderboards; A/B testing on music tracks.

**Team & Brokerage Mgmt**: seat management, role permissions (Admin/Agent/Marketing Coord/Read-Only), locked brand controls (logos/colors/fonts/license #), approval workflows, CSV/HRIS bulk import, SSO (SAML/SCIM).

**White Label**: custom domain, branding, email-from; API at volume-discounted per-render pricing.

**Mobile App**: iOS + Android native; capture-to-video <60 sec (framing guides → on-device or cloud cinematic stitch); voice memo → AI listing description; address scan (text-recognition) for MLS lookup; push notifications.

**Browser Extension**: right-click any MLS, Zillow, Redfin, Realtor.com, LoopNet listing → generate video; works on private MLS portals via RESO Web API auth.

**MLS Integration**: RESO Web API + Data Dictionary (NAR-mandated since 2016; 800+ certified MLSs); auto-pull listings; auto-generate when new listing goes live; IDX/VOW compliance via Realtyna MLS Router or SimplyRETS abstraction.

**CRM Integration priority**: Follow Up Boss (P0 — most-used premium CRM, native two-way pixel + tag sync + auto-action plans); kvCORE/Lofty + Sierra Interactive (P0 two-way matching FUB pattern); Chime, BoomTown, LionDesk, RealScout, Curb Hero (P1 lead push); HubSpot/Salesforce (P2 enterprise custom-object sync); Zapier + Make.com universal fallback.

### SECTION 3: Pricing Strategy (95% gross-margin math)

**Wholesale AI cost benchmarks (May 2026)**:

| Model | Per-second wholesale | Best access | Notes |
|---|---|---|---|
| **Veo 3.1 Lite** | **$0.05/sec** (720p) / $0.08 (1080p) | Gemini API, fal.ai | Cheapest tier; April 2026 cut |
| **Veo 3.1 Fast** | **$0.10/sec audio-off / $0.15 audio-on** | Gemini API, fal.ai, Vertex | Post-April price cut |
| Veo 3.1 Standard | $0.30–$0.40/sec | Gemini API | 1080p, full audio |
| Veo 3 (audio-on) | $0.40/sec | fal.ai | $2 for 5s |
| **Sora 2** | **$0.10/sec** (720p) | OpenAI API | $1 for 10s |
| Sora 2 Pro | $0.30 (720p) / $0.50 (1024p) | OpenAI | $5 for 10s 1024p |
| **Kling 2.1 Standard** | **$0.056/sec** | fal.ai | $0.28 for 5s |
| Kling 2.1 Pro | $0.098/sec | fal.ai | $0.49 for 5s |
| Kling 2.6 Pro audio-off/on | $0.07 / $0.14/sec | fal.ai | |
| **Seedance v1.5 Fast (Atlas)** | **$0.022/sec** | Atlas Cloud | Cheapest reliable image-to-video |
| Seedance 2.0 (BytePlus) | ~$0.014–$0.05/sec @720p | BytePlus | Multimodal, 2K, 15s max |
| Hailuo 02 Pro | $0.096/sec ($0.48/5s) | WaveSpeedAI | 1080p |
| Pika 2.x | ~$0.03/generation | Pika API | |
| Luma Dream Machine | $0.08/sec | Luma API | |
| Runway Gen-4 Turbo | ~$0.06/sec credit equiv (5 credits/sec @ $0.012 annual Pro) | Runway API | |
| Runway Gen-4 std | $0.144/sec (12 credits/sec) | Runway API | |
| Runway Gen-4.5 | $0.30/sec (25 credits/sec) | Runway API | |
| ElevenLabs voiceover | ~$0.30 per 1,000 char | ElevenLabs | |
| Cloudflare R2 egress | ~$0.02/GB | | per delivered video |

**Cost-to-produce one ListingOS video (30s, 10 × 3-sec clips)**: best-cost stack uses Seedance v1.5 Fast at $0.022/sec image-to-video → 30 × $0.022 = **$0.66**. Plus ElevenLabs voiceover (~120 words ≈ 600 char ≈ $0.18). Plus storage/CDN for 4 variants (~50MB ≈ $0.05). Plus GPU compositing/cuts (~$0.10). **Total marginal cost per video ≈ $0.99 at 720p.** Veo 3.1 Lite-tier ≈ $1.65/video. Veo 3.1 Fast (audio-on) ≈ $4.50/video. Premium "AI+" hero shots via Kling 2.6 Pro at $0.14/sec for 6 sec = $0.84 extra. **Blended target: $1.50–$2.50/video at scale.**

**Recommended pricing tiers**:

| Tier | Monthly | Annual (20% off) | Listings/mo | Outputs/listing | Cost/listing | Revenue/listing | Var GM |
|---|---|---|---|---|---|---|---|
| Solo Lite | $29 | $279 ($23/mo) | 3 | 4 | ~$10 | $9.67 | 96% |
| Agent | $79 | $759 ($63/mo) | 10 | 8 | ~$28 | $7.90 | 95% |
| Pro Agent | $149 | $1,432 ($119/mo) | 25 | 8 + 1 AI+ hero | ~$80 | $5.96 | 95% |
| Team (2–5) | $349 | $3,348 ($279/mo) | 60 | 8 | ~$160 | $5.82 | 95% |
| Brokerage (10–50) | $999 | $9,590 ($799/mo) | 250 | 8 | ~$650 | $4.00 | 93% |
| Enterprise (50+) | Custom (~$25–$50/seat/mo) | Custom | Unlimited | All | Variable | $30–50/seat | 92–95% |
| White Label | $2,499/mo + $0.50/render | Custom | Unlimited | All | $0.50–2 | Variable | 75–90% |

At >5,000 paying users, net-of-support gross margin = 90%+ assuming self-serve onboarding and AI-driven Tier-1 support.

**Credits vs unlimited**: Use **listings-based** ("3 listings/mo includes everything") rather than credits, except for AI+ hero shots and AI voiceover minutes (which become credits). Why: credits are the #1 complaint about Reel-E and Pedra. Listings = the unit of value for a Realtor.

**Add-ons**: Extra listing pack $9 / $39 / $69; AI+ hero credits $5 per 30-sec hero (~4× margin on $0.84 wholesale); Custom voice clone $19/mo + 5,000 minutes; postcards pass-through Lob.com + $0.10 markup; SMS lead-capture line $9/mo.

**White-label pricing**: $2,499/mo + $0.50/render base, OR $4,999/mo all-inclusive up to 5,000 renders/mo. 30% discount on 12-month MSAs. Tom Ferry coach licensee: $99/mo "Coach Edition."

**Founding-member**: Founding 100 at $499 lifetime for Pro Agent tier (caps 3 years, then $79/yr). ~$50K capital. **Avoid AppSumo / lifetime deals at scale** — destroys unit economics on per-render variable cost.

**Conversion vs retention sweet spot**: 7-day free trial + 1 free fully-branded video (Reel-E's "first video free" converts best; AutoReel's "2 videos/mo free" generates frustration). $29 Solo + $79 Agent maximizes conversion (under FUB's $69, comparable to Coffee & Contracts $74). 20% annual discount + 1 free month + locked lifetime price drives 60%+ Pro+ tier annual; PropTech median monthly churn is 4.7% (Dollarpocket benchmark), and locking annual cuts that to ~25% gross-annual.

**Pricing comparison**:

| Product | Entry | Mid-tier | High-tier | Annual disc. |
|---|---|---|---|---|
| Reel-E | $44 (3 listings) | $97 (10) | $449 (50, 4K) | yes |
| AutoReel | ~$19 Starter | Growth | Pro/custom | 7-day trial |
| Pedra | €29 | €59 | €89 | yes |
| Amplifiles | $1.50/image | n/a | n/a | n/a |
| Animoto | Free | $33 | Custom | yes |
| HeyGen | $29 | $89 | $149+ | yes |
| Aryeo | $49 | $99 | $179 | n/a |
| Coffee & Contracts | $74 | n/a | n/a | yes |
| **ListingOS** | **$29 / $79** | **$149 / $349** | **$999 / Custom** | **20%** |

### SECTION 4: Mobile vs Web Strategy

**The data**: NAR 2025 Profile of Home Buyers and Sellers — 70% of buyers use mobile/tablet during search, 60%+ of property searches start on mobile. NAR 2025 REALTORS® Technology Survey (1,200 agents) — mobile-first behavior confirmed; e-signatures, marketing, and prospecting are top tech categories. Top competitors are mostly web-only: Reel-E, AutoReel, Pedra, Amplifiles, Animoto. PhotoAIVideo claims mobile-friendly. Runway and HeyGen are iOS-only.

**App Store economics**: Apple — 30% IAP first year, 15% after; auto-renew 15% from year 2; Small Business Program 15% day-one for <$1M proceeds. Google Play — 15% on first $1M annually; auto-renew subs 15% day-1. Stripe (web) = 2.9% + $0.30. EU DMA (March 2026) allows third-party app stores at 17%/10% reduced commissions for EU users only.

**Recommendation: Web-first PWA + native iOS thin client + Android in Phase 2**. Web is where money is collected (Stripe checkout off-app). PWA covers ~80% of mobile use cases (capture, generate, share, view analytics) — iOS 18+ PWA support is now adequate. Native iOS thin client (Phase 1) for camera capture with framing guides, share-sheet to IG/TikTok, push notifications, App Store presence. Android Phase 2 (months 4–6). Avoid IAP for subscriptions — free download + sign-in to existing account.

**Build cost & timeline (2026 dollars)**: Web app + PWA core: $80–150K (3–4 mo). iOS thin client (Capacitor/React Native): $25–50K (1.5 mo). Android: $25–50K (1.5 mo). Annual maintenance: $40–60K all-platforms.

**Feature priority by surface**:

| Feature | Web | iOS | Android | Priority |
|---|---|---|---|---|
| Generate video from URL | ✅ | ✅ | ✅ | P0 |
| Bulk listing import via MLS | ✅ | — | — | P0 |
| Capture-to-video (camera) | △ | ✅ | ✅ | P1 |
| Brand/asset library | ✅ | ✅ | ✅ | P0 |
| Approval workflows | ✅ | view-only | view-only | P1 |
| Analytics dashboard | ✅ | view-only | view-only | P1 |
| Push notifications | — | ✅ | ✅ | P1 |
| White-label | ✅ | branded | branded | P2 |

### SECTION 5: Scaling Beyond Listing Videos

| Segment | US size (est.) | ARPU | Ease (1–5) | Competitive density | Score |
|---|---|---|---|---|---|
| Real estate agents (core) | 1.45M Realtors (May 2025) → 1.2M forecast YE 2026 + ~1.5M licensees | $79/mo | 5 | High | base |
| Mortgage brokers/loan officers | ~370K licensed (NMLS) | $49–149/mo | 4 | Low | High |
| Real estate photographers | ~12K firms (Aryeo data) | $99/mo + per-render | 5 | Medium | High (white-label) |
| Property managers | ~330K firms | $99–499/mo | 3 | Medium (AppFolio/Buildium) | Medium |
| Home stagers | ~7K | $49/mo | 4 | Low (Pedra) | Medium |
| Title/escrow | ~7K | $99–499/mo | 2 | Low | Low |
| Home inspectors | ~30K | $29–79/mo | 3 | Low | Low |
| **New construction/developers** | ~5K active builders | $499–4,999/mo | 4 | Low | High (luxury videos) |
| Commercial real estate | ~50K CRE brokers | $149–499/mo | 3 | Low (CREXi/LoopNet not focused on video) | Medium-high |
| Long-term rental landlords | 11M individual + 280K firms | $9–29/mo | 3 | High (Zumper/Apartments.com) | Low |
| **Short-term rental hosts (Airbnb/VRBO)** | ~2.5M US hosts | $19–49/mo | 5 | Low | High |
| Senior care / 55+ communities | 30K+ communities | $499–2,000/mo | 3 | Low | Medium-high |
| **Luxury real estate (US)** | ~30K luxury agents | $299–999/mo | 4 | Low | High |

**International**: UK (~25K agents, Rightmove/Zoopla), Canada (~155K Realtors, CREA Web API), Australia (~75K, Domain/REA Group), UAE Dubai luxury (~15K, Bayut).

**Adjacency rollout**: Phase 1 (0–6 mo) US residential agents core. Phase 2 (6–12 mo) photographer white-label + STR hosts. Phase 3 (12–18 mo) mortgage/loan officers (co-branded with agent partners — built-in viral loop), new-construction builders, Canada/UK. Phase 4 (18–24 mo) commercial CRE, luxury edition, senior care.

**What realtors currently pay that AI replaces**: videographer per listing $300–$1,200 → AI ≈ $5; photo editor $50–$150/listing → bundled; copywriter/MLS description $50/listing → bundled; social media manager $500–$3,000/mo → bundled; branding/logo $1,500 one-time → bundled; direct-mail design $100–$500/campaign → bundled.

### SECTION 6: Free Marketing Strategy (0-budget, target 100–200 paying agents in 60 days)

**AI Influencer Strategy** — 5–10 AI-persona Instagram + TikTok accounts: "Houses you can afford on $X salary in [Austin/Phoenix/Tampa/Charlotte/Nashville]," day-in-the-life of a [city] luxury agent, market alerts for first-time buyers in [city].

*2026 compliance constraints (must follow)*:
- **FTC Endorsement Guides** (revised June 2023) explicitly cover virtual endorsers same as humans; "clear and conspicuous" disclosure required.
- **FTC Consumer Reviews and Testimonials Rule** (effective Oct 21, 2024): bans AI-generated testimonials misrepresenting reviewer identity at up to $51,744/violation. The FTC's Affiverse-tracked first warning letters under this rule were issued in January 2026.
- **Meta**: AI-Info label is mandatory for photorealistic video / realistic audio digitally created/altered — auto-applied via C2PA detection. May 2026 added optional "AI Creator" profile label (recommend opting in for transparency benefit). Engagement penalty for AI-Info content: 15–30% per Sybrid analysis.
- **TikTok**: AIGC labeling required for fully or significantly AI-generated content; auto-detection via C2PA; per TikTok Newsroom, the platform has cumulatively labeled "over 1.3 billion AI-generated videos" through H1 2025. Penalty ladder for unlabeled content (per Napolify analysis): 73% reach suppression within 48h; 3+ violations → 95% chance of monetization ban; 5+ → likely account termination.
- **NY State Synthetic Performer Disclosure**: $1,000 first-offense / $5,000 subsequent civil penalty.
- **EU AI Act Article 50** (Aug 2, 2026): deepfake disclosure obligation; up to €15M or 3% global turnover.

*Practical setup*: Veo 3.1 + ElevenLabs for consistent face/voice. Disclose on every post + use platform's built-in AI label + opt-in to IG "AI Creator" profile label. Content mix: 40% "Houses you can afford on $X salary," 30% neighborhood guides, 15% MLS-data market updates, 15% disclosed paid agent spotlights. Bio CTA: "Real agents use ListingOS to make videos like this." City-specific landing pages featuring local agent partners.

*Tools (2026 safety)*: **Phantombuster / Selenium-based scrapers — DO NOT USE for IG actions** (per QuickDM 2026 review, browser-automation tools "have documented ban histories and are explicitly against Meta's Terms of Service"). Use **CreatorFlow / ManyChat / official Meta Graph API** — 200 DMs/hour allowed via Graph API as of Feb 2026; safe daily ceiling ~600 DMs/account/day after 30-day warm-up; new accounts start at 200/day. Posting via Buffer/Later/Hootsuite official APIs. **Comment-to-DM** via ManyChat: "Comment 'TOUR' to get the buyer's guide" — converts at 5–15% per InstantDM benchmarks; 65–85% DM open rate.

**Cold Outreach Automation** — Database: Apollo.io ($39/user/mo annual; 230M+ contacts), Clay.com (premium enrichment), Hunter.io (free 25/mo). For US Realtors: NAR Find a Realtor + state license databases → enrich via Apollo. Sender infra: dedicated sub-domain (agents.listingos.com), 4–8 inboxes, 30-day warm-up via Smartlead/Instantly. Volume: 30–50/inbox/day → 75/inbox/day post-warm-up.

*2026 benchmarks*: Per Reachoutly's read of Instantly's Cold Email Benchmark Report 2026 (covering Jan 1–Dec 18, 2025 across "billions of cold email interactions"), platform-wide average reply rate is 3.43%; top performers exceed 10% and 58% of all replies are generated from step one. Cleverly's 2026 SaaS-specific analysis flags software/SaaS as "often under 2%" — so the realistic benchmark for ListingOS is **1–2% reply rate at average execution and 8–15% positive replies / 1–3% meeting bookings at top-quartile execution**. Smartlead 14.3B-email funnel: 100 sends → ~40 opens → ~3 replies → ~2 interested → ~1 demo. One Smartlead SaaS case: 400 emails → 61 demos in 8 weeks (~15%). At 4 inboxes × 75/day × 30 days = 9,000 emails/mo. At 1.5% positive reply = 135 conversations. At 30% close = ~40 paying/month (conservative).

*5-touch sequence (14 days)*: Day 0 — "Quick q about [their listing on Maple St]" → noticed listing, would a 30-sec cinematic Reel have helped? Free first one if interested. Day 3 — actually generate it and send link (cost ~$2 per email; conversion-killer if they don't book = $200 CAC; if they do = customer). Day 7 — social proof. Day 11 — Founding-100 lifetime urgency. Day 14 — breakup ("Should I stop emailing?").

*Best converting offer*: **Done-for-you first video** beats free-trial CTA for cold outreach because it removes setup friction.

*LinkedIn*: HeyReach hard limit 200 LinkedIn actions/day per account; recommended 20–40 invites/day, 100 messages/week. 3-week warm-up: 20–30 actions/day → 120 messages/day. LinkedIn 2026 soft cap: 100–150 connection requests/week. Target: brokerage Marketing Directors / Operations leaders at eXp, Compass, KW, Real, Side, Anywhere brands. Goal: brokerage-wide pilots, not individual agents. HeyReach campaign benchmark: 42% reply rate, 7 demos from one campaign.

*Instagram DMs*: Manual or low-volume only — 20–50 DMs/day on new account, 50–100 on established (Inrō 2026 limits). Comment-to-DM via ManyChat for inbound = ~15% conversion.

**Organic / Viral Distribution**

*Reddit*: r/realtors (~80K, strict; must be active first), r/RealEstate (~3M, heavily moderated), r/RealEstateTechnology (~10K, vendor-friendly if educational), r/SaaS, r/EntrepreneurRideAlong. 80/20 — 80% high-value answers, 20% own content. Working content: "How I tested 8 AI video tools for my listings," "Cost breakdown: $1,200 videographer vs $79/mo AI," "MLS-compliance tips for AI-generated content." Caveat: anecdotal r/SaaS posts cite ~40% conversion from "genuine helpful replies vs zero from $500 ads" — treat as anecdote, not benchmark.

*Facebook Groups*: **Lab Coat Agents** (165,000+ members, founders Tristan Ahumada/Nick Baldwin) is the highest-leverage — partner with founders directly via shared deal/equity, mirroring their existing SpotOn Connect partnership template. Other targets: Real Estate Mastermind (312K), Real Estate Referral Network (300K), Realtor Networking & Social Media Tips (108K, Natalie Ridderbos), Lab Coat Referrals (57K).

*Newsletters / publications*: Inman (Inman Connect events), HousingWire (Real Trends, Coast2Coast), The Real Deal (luxury), RISMedia (broker-focused), BAM (Broke Agent Media), Mike DelPrete's Real Estate AI Newsletter (~50K), Notorious POD (Rob Hahn — analytics-focused; pitch data, not product).

*Product Hunt*: Top launches receive 3,000–7,000 upvotes (BigIdeasDB 2026). One $800-promoted launch produced 127 signups / 3 paying customers; in the same week a free indie launch produced 89 signups / 12 paying. One Show HN dev-tool case: 47 paying customers despite negative comments. Launch end of week 4 with founding-member pricing live.

*YouTube long-tail SEO*: target "how to make a real estate Reel," "AI video for listings," "Zillow listing video," "MLS-compliant video real estate." 30 videos in 60 days, 5–8 min each.

*First-1000-users patterns* (Lenny Rachitsky case studies, reapplied): Tinder/USC street teams → office visits in top 10 markets, demo + free first video. DoorDash/Stanford fliers → 5,000 yard-sign-tagged QR codes ("want a video like this for your home?") in agent partners' open-house signs. Superhuman manual qualification → founder DMs every signup for 30 days. Calm precursor 100K emails in 2 weeks → ListingOS launches "What does AI think your $X home is worth?" tool for TikTok virality.

**Partnership Channels**:

| Partner | Type | Pitch |
|---|---|---|
| Real estate photographers | Reseller | $50–$100 add-on per shoot (mirroring AutoReel); 30% rev-share + co-branded white-label. |
| MLS boards (Bright, CRMLS, Stellar, NWMLS) | Distribution | Free seat per member; MLS gets co-marketing + revenue share. |
| Tom Ferry | Coach + Speaker | Built-in coaching curriculum; $99/mo "Coach Edition" + Tom's brand on splash. |
| Brian Buffini, Mike Ferry, Ricky Carruth | Coach | Affiliate codes + speaker fees + co-branded version. |
| Jimmy Mackin / Listing Leads | Coach + Marketing platform | Highest-leverage given proven 100-day program track record (2,120 agents / $3.1B in listings). Co-branded module. |
| Coffee & Contracts (Haley Ingram) | Marketing platform | Bundle: $99/mo joint subscription, given platform "has successfully assisted over 16,000 agents." |
| Lab Coat Agents Marketing Center | Marketing platform | Add video as missing module. |
| eXp, Compass, KW, Real, Side, Anywhere | Brokerage | Brokerage-paid plan; included in agent fees. |
| Follow Up Boss, kvCORE, Sierra | CRM | Native integration; co-marketing in their app stores. |

**60-day week-by-week action plan**:

- **Week 1**: Web/PWA MVP live with Stripe, RESO Web API for top 5 MLSs, FUB integration. 4 cold-email inboxes warming. 3 AI persona accounts (Austin, Phoenix, Tampa). 10 paid beta from founder network. **Target: 10 paying.**
- **Week 2**: Email warmup continues. AI personas post 3×/day. r/RealEstateTechnology case-study post. 1:1 outreach to 50 photographers via Aryeo directory. **Target: 25 paying.**
- **Week 3**: Cold email goes live (300/day). LinkedIn outreach to 50 brokerage Marketing Directors/COOs. First Lab Coat Agents value-post. Tom Ferry / Listing Leads outreach. **Target: 50 paying.**
- **Week 4**: Product Hunt launch Tuesday. Scale cold email to 600/day. AI personas at 1–3K followers. First photographer reseller signed. Pitch Inman story. **Target: 80 paying.**
- **Week 5**: Inman/HousingWire feature lands → 5K visitors. AI persona viral video ≥100K views. Cold-email reply rate ramps as deliverability matures. **Target: 110 paying.**
- **Week 6**: First Tom Ferry / Brian Buffini / Mike Ferry coaching cohort gets co-branded demo. eXp / Compass marketing-team conversations. Add 4 more cities to AI personas. **Target: 140 paying.**
- **Week 7**: Broker agreement signed (one). Bulk import 25–50 agents from one mid-market brokerage. AI personas add YouTube Shorts. **Target: 175 paying.**
- **Week 8**: Case-study webinar with first 3 power users. Email all 9K cold-email recipients with social proof. Add one sub-vertical (STR hosts via partnership with AirHost or Hostfully). **Target: 200 paying.**

**Realism check**: 200 paying × avg $79/mo = $15,800 MRR. Hard CAC ≈ $0 but ~$30K of founder/contractor time. Plausible at the upper bound for a domain-credible founding team shipping daily; **realistic floor with average execution is 80–120 paying**.

### SECTION 7: Retention & Churn Prevention

**Benchmarks**: PropTech monthly churn typical 4.7% (Dollarpocket benchmark); enterprise <2%; SMB/solo agents 5–8%. **BombBomb** (closest analog, real estate video messaging, founded 2006) hit $35M revenue in 2024 across 40K customers in 43 countries. BombBomb VP of Finance Clint Jackson, in a Bigfoot Capital Medium guest post titled "3 Ways SaaS Companies Misunderstand Their Churn Numbers," disclosed that the company "is consistently churning 30% of subscriptions up for renewal" annually, with cyclical Q1/Q4 spikes (budget reviews, slow market) and Q2 strongest.

**Habit-loop features**: Monday Market-Update Reel (auto-generated weekly per agent's market; login required to share); Listing Auto-Trigger (when a new MLS listing matches the agent's ID, video auto-generated; "Your video for 123 Maple St is ready — share to IG?"); Daily prompt ("What did you do today? 30 seconds + we make a Story" — voice-memo intake); Weekly Agent Challenge ("Post 3 videos this week → win Tom Ferry Summit ticket / Yeti / $100 Amazon"); Streaks with visible loss on reset.

**Onboarding sequences**: Day 0 welcome + auto-triggered first video + 5-step setup checklist; Day 1 brand kit walkthrough; Day 3 first listing import + CRM connect; Day 7 performance review + tip; Day 14 brokerage invite at 30% off; Day 30 annual upgrade offer (20% off + 1 month free); Day 45 case-study from similar agent; Day 60 NPS + referral incentive.

**Gamification**: brokerage leaderboard (most videos, most reach, most leads attributed); achievement badges (First Listing, 10, 100, First Lead from Video, $1M in Listings Marketed); annual "Realtor of the Year" awards.

**Structural lock-in**: 12-month rolling performance dashboard; agent-tuned branded asset library; client testimonial library accumulated over months/years; custom voice clone trained on agent's voice; MLS auto-trigger workflow that replaces manual videographer relationships.

**Brokerage-level retention**: brokerage-wide bundling (ListingOS in agent's monthly fee — individual agent never sees the bill, can't churn individually); admin enforcement (marketing director enforces use; non-users lose access to brand-approved templates); recruiting moat (brokerage gets a recruiting story — "$500/mo of marketing tools free to every agent" — increases brokerage retention of ListingOS as a recruiting weapon).

### SECTION 8: Risk Factors & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AI costs increase | Low | Medium | Multi-vendor abstraction (fal.ai + OpenRouter + direct), renegotiate quarterly. |
| Veo / Sora vertically integrate real-estate features | Medium | High | Build the *workflow* moat (MLS, CRM, brokerage) — not just the model. |
| Reel-E / AutoReel raise ($10M+) and outspend | Medium | Medium | Founding-member lifetime + brokerage exclusivity; community moat. |
| Meta / TikTok deprioritize AI-labeled content (15–30% engagement drop) | High | Medium | Diversify across YouTube Shorts, IG, TikTok, Pinterest, LinkedIn, email. Lean into transparency. |
| FTC enforcement on AI testimonial/influencer (first warning letters issued Jan 2026) | Medium | High | Disclosure-by-default in product; legal review of every persona; opt-in for AI Creator label. |
| Fair Housing violation in AI descriptions/people-in-rooms | Medium | Very High (HUD complaint, lawsuit) | Pre-screen filter; ban discriminatory prompt outputs; transparent watermarks; no human likenesses without consent. |
| MLS data licensing pulled | Low–Medium | High | Multi-MLS via RESO Web API + Realtyna MLS Router. Agent paste-URL fallback. |
| Apple/Google reject the iOS app | Low | Medium | Web-first; iOS as thin client. |
| NAR settlement aftermath (1.45M May 2025 → 1.2M forecast YE 2026 per NAR Treasurer Craig Sanford / Inman 11/18/25) | High | Medium | Capture share faster; expand to mortgage / property mgmt / STR. |
| Real estate market freezes | Medium | High | $29 Lite tier for low-volume agents; lock annuals. |
| Cold email deliverability collapses (Gmail/Yahoo 2024 rules tighten further) | Medium | High | Quality over quantity; trigger-based outreach; ramp inbound channels. |
| AI persona accounts banned | Medium | Low (replaceable) | Run 5–10 personas; comply with Meta/TikTok labeling; never impersonate real humans. |
| EU AI Act fines (Aug 2026) | Low (US-focused) | Medium if EU expansion | Defer EU launch until Article 50 compliance audit. |
| Brokerage settles on a competitor first | Medium | High | Sign 2–3 mid-market brokerages in first 90 days as anchors. |

---

## Recommendations

**Phase 1 — Launch (Months 0–3, ~$150K capital)**
- Web app + PWA + iOS thin client.
- Photo→video on Seedance v1.5 Fast for bulk, Veo 3.1 Fast for AI+ hero (~$1.50–$2.50 blended cost/video).
- 4-format simultaneous render (16:9, 9:16, 1:1, 4:5 × branded/unbranded = 8 outputs).
- Brand kit with locked agent license # + EHO logo.
- RESO Web API for top 10 MLSs (CRMLS, Bright, Stellar, NWMLS, MRED, Heartland, REcolorado, NTREIS, SABOR, GLVAR).
- Follow Up Boss + kvCORE + Sierra two-way integrations.
- Fair Housing-screened listing description writer.
- 800-track music library with beat-sync.
- Single-property landing pages + QR.
- Stripe billing, 7-day trial with 1 free fully-branded video.
- **Pricing live: $29 / $79 / $149 / $349 / $999 / Custom + $2,499 white-label.**

**Phase 2 — Months 3–9**
- Virtual staging + photo enhancement.
- ElevenLabs AI voiceover (30+ languages).
- Social-media content pack auto-generation per listing.
- Approval workflows + brokerage admin.
- Browser extension (Zillow/Redfin/Realtor.com).
- Native iOS app with camera capture + Native Android.
- Market-update auto-reels.
- White-label launch.
- Mortgage/loan-officer adjacency.

**Phase 3 — Months 9–18**
- AI avatar / talking-head + custom voice clone.
- Testimonial collection flow (SMS → AI auto-edit).
- Direct-mail integration (Lob).
- Neighborhood showcase videos.
- HubSpot/Salesforce enterprise integration.
- Commercial/CRE edition.
- New construction/developer edition.
- Canada, UK markets.
- Brokerage ROI dashboard.

**Adjacent revenue opportunities ranked by ROI**: (1) real estate photographer white-label (highest leverage — same product, distributor channel); (2) short-term rental hosts (~2.5M US, low competition, $19–49/mo ARPU); (3) new construction/developers ($499–$4,999/mo ARPU, low competitive density); (4) luxury real estate (~30K agents, $299–$999/mo); (5) mortgage/loan officers (~370K, viral co-branding loop with agents); (6) Canada/UK international expansion.

**Benchmarks that would change these recommendations**:
- If wholesale AI costs *increase* 50%+ (e.g., model providers consolidate / regulators slow training), shift to subscription-only, drop Solo Lite tier, and prioritize white-label.
- If photographer reseller channel produces <10 customers in week 4, abandon and reallocate to brokerage outbound.
- If brokerage-wide bundling deal closes by end of week 4 with eXp/Compass/Real/Side regional, deprioritize cold email and double down on enterprise sales.
- If AI persona engagement penalty exceeds 40% (vs 15–30% baseline), pivot AI personas to faceless screen-only formats and shift budget to YouTube long-tail SEO.

---

## Caveats

- **AutoReel's, Reel-E's, and Pedra's user counts are self-reported via PR** (Barchart, marketersmedia for AutoReel; founder-stated for Reel-E; Pedra's own site for the 20,000+ agencies number). "Thousands" / "18,000+" / "20,000+" should be treated as marketing claims, not independently audited.
- **AI video model pricing changes monthly.** The cost stack assumed here (Seedance v1.5 Fast at $0.022/sec) requires a multi-vendor abstraction layer (fal.ai + OpenRouter + direct ByteDance/Atlas Cloud) to lock in margins. Veo 3.1 Fast's price cut on April 7, 2026 illustrates this volatility.
- **PropTech churn benchmark of 4.7%** comes from a third-party benchmark (Dollarpocket); BombBomb's "30% of subscriptions up for renewal" disclosure is from a 2018-era Bigfoot Capital Medium guest post by VP of Finance Clint Jackson and may be dated. Individual brokerage outcomes vary widely.
- **The "TikTok removed 2.3M videos in Q1 2026 under synthetic-media policies"** figure cited by AuditSocials is a third-party blog claim — TikTok's own H1 2025 Code Transparency Report stated "policy-violating AIGC removals fell 53% to less than 25,000," and TikTok Newsroom reports "over 1.3 billion AI-generated videos" cumulatively *labeled* (not removed) through H1 2025. The official platform data is more reliable than secondary aggregation.
- **AI persona compliance is a moving target** — Meta's May 2026 "AI Creator" profile label is currently optional, but Meta historically transitions optional labels to required within 12–18 months. The EU AI Act's August 2026 deepfake rules will tighten further. Build for transparency, not loopholes.
- **The cold-email reply benchmark "B2B SaaS 2–4%"** is the upper bound; Cleverly's 2026 SaaS-specific analysis of the same Instantly Cold Email Benchmark Report 2026 dataset notes software/SaaS replies are "often under 2%." Plan for 1–2% at average execution and treat 8–15% positive replies as top-quartile aspiration, not baseline.
- **"100–200 paying agents in 60 days with zero budget"** is plausible only if the founding team is domain-credible (existing real-estate or PropTech network) and shipping product daily; the realistic floor with average execution is **80–120 paying agents**. Plan capital and runway accordingly.
- **NAR membership is shrinking.** As of May 31, 2025, NAR membership stood at 1,453,690; per Inman News (Nov 18, 2025) NAR Treasurer Craig Sanford disclosed "NAR's 2026 budget is based on falling to 1.2 million members next year," paired with a $41M expense reduction. TAM shrinks ~20% in two years, but the agents who survive are full-time professionals who pay for marketing automation — making the relative TAM for ListingOS *larger* among paying-customer-likely agents.