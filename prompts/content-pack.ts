import type { ContentPack } from "@/lib/types";

export interface ContentPackInput {
  address: string;
  city: string;
  state?: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  features?: string;
  style: string;
  agentName?: string;
  voiceProfile?: string;
}

export function buildContentPackPrompt(input: ContentPackInput): string {
  const priceStr = input.price ? `$${input.price.toLocaleString()}` : "Contact for pricing";
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
Never mention: families, children, religion, nationality, disability, gender, age, safe area, quiet neighborhood, exclusive, walking distance to schools, ideal for couples.${voiceInstructions}

LISTING:
Address: ${input.address}
City: ${input.city}${input.state ? `, ${input.state}` : ""}
Price: ${priceStr}
Specs: ${specsStr || "Not specified"}
Style: ${input.style}
${input.features ? `Notable features: ${input.features}` : ""}

Return ONLY valid JSON matching this exact structure:
{
  "hooks": [
    "10 scroll-stopping hooks for Reels/TikTok. Short. Punchy. Start with action verbs or POV. Under 15 words each. Mix emotional, data-driven, and curiosity hooks."
  ],
  "features": [
    "8-12 specific sellable features. Be precise: not 'nice kitchen' but 'quartz waterfall island with pendant lighting'. Infer from specs and price point."
  ],
  "shotList": [
    {
      "sceneNumber": 1,
      "duration": "0-3s",
      "camera": "specific direction: walk toward, pan across, push in, pull back, reveal",
      "speak": "exact words to say. Or '[silence — let the space breathe]' for reveals"
    }
  ],
  "captionStyles": {
    "bold": "attention-grabbing, direct, urgency. Under 150 chars.",
    "storytelling": "paint a picture. Under 200 chars.",
    "dataDriven": "price per sqft, market comparison. Under 150 chars.",
    "casual": "conversational, light. Under 150 chars.",
    "luxury": "refined, aspirational. Under 200 chars."
  },
  "platformPosts": {
    "instagram": "caption + 5 relevant hashtags + CTA. Under 300 chars total.",
    "tiktok": "spoken-word script, 15-second delivery. No hashtags.",
    "linkedin": "professional, market-insight angle, no emojis. 2-3 sentences.",
    "facebook": "conversational, end with question. 2-3 sentences.",
    "twitter": "under 280 chars. Bold take or key stat. No hashtags.",
    "youtubeShort": "hook + tour highlights + CTA. 30-second script.",
    "emailSnippet": "subject line + 3-sentence body + CTA link placeholder."
  },
  "engagementQuestions": [
    "5 questions that drive comments/saves. Mix polls, debates, opinions. Each under 80 chars."
  ]
}

REQUIREMENTS:
- shotList must have exactly 6 scenes totaling 30 seconds
- hooks must have exactly 10 items
- features must have 8-12 items
- engagementQuestions must have exactly 5 items
- ALL text must be Fair Housing compliant
- Be SPECIFIC to this listing's price point and location
- Do NOT use generic phrases like "beautiful home" or "must see"`;
}

export function parseContentPack(raw: string): ContentPack | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    if (!Array.isArray(parsed.hooks)) return null;
    if (!Array.isArray(parsed.features)) return null;
    if (!Array.isArray(parsed.shotList)) return null;
    if (!parsed.captionStyles || typeof parsed.captionStyles !== "object") return null;
    if (!parsed.platformPosts || typeof parsed.platformPosts !== "object") return null;
    if (!Array.isArray(parsed.engagementQuestions)) return null;

    return {
      ...(parsed as Omit<ContentPack, "generatedAt">),
      generatedAt: new Date().toISOString(),
    } as ContentPack;
  } catch {
    return null;
  }
}
