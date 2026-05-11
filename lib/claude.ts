import Anthropic from "@anthropic-ai/sdk";
import { buildDescriptionPrompt, type ListingDescriptionInput } from "@/prompts/listing-description";
import { buildCaptionPrompt, type CaptionInput } from "@/prompts/captions";
import { FAIR_HOUSING_PROMPT, quickFairHousingCheck } from "@/prompts/fair-housing";
import { buildContentPackPrompt, parseContentPack, type ContentPackInput } from "@/prompts/content-pack";
import type { ListingDescriptions, ListingCaptions, FairHousingResult, ContentPack } from "@/lib/types";

const MODEL = "claude-haiku-4-5";

function hasRealApiKey(): boolean {
  const key = process.env.ANTHROPIC_API_KEY;
  return !!key && !key.startsWith("placeholder");
}

function getClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Placeholder content used when no API key is configured (dev/testing)
function mockDescriptions(input: ListingDescriptionInput): ListingDescriptions {
  const addr = input.address || "this property";
  return {
    mls: `Welcome to ${addr}. This exceptional home offers ${input.beds || "spacious"} bedrooms and ${input.baths || "modern"} bathrooms${input.sqft ? `, spanning ${input.sqft.toLocaleString()} square feet` : ""}. Located in ${input.city || "a desirable area"}, this property combines comfort with timeless design. Don't miss your opportunity to own this remarkable home.`,
    social: `Stunning ${input.beds || ""}bd/${input.baths || ""}ba in ${input.city || "prime location"}. ${input.price ? `Listed at $${input.price.toLocaleString()}` : "Contact for pricing"}.`,
    luxury: `An exceptional residence in ${input.city || "a premier location"}, this ${input.beds || "spacious"}-bedroom home offers an elevated lifestyle. ${input.sqft ? `${input.sqft.toLocaleString()} sq ft` : "Generous proportions"} of refined living space await.`,
  };
}

function mockCaptions(input: CaptionInput): ListingCaptions {
  const addr = input.address || "this home";
  return {
    instagram: `✨ Just listed: ${addr}${input.city ? ` in ${input.city}` : ""}${input.price ? ` · $${input.price.toLocaleString()}` : ""}. Swipe to see more! 🏡 #JustListed #RealEstate`,
    tiktok: `New listing just dropped! ${addr}${input.price ? ` at $${input.price.toLocaleString()}` : ""}. DM for details!`,
    facebook: `🏡 NEW LISTING: ${addr}${input.city ? `, ${input.city}` : ""}${input.price ? ` — $${input.price.toLocaleString()}` : ""}. Contact me today to schedule a showing!`,
  };
}

export async function generateDescriptions(
  input: ListingDescriptionInput
): Promise<ListingDescriptions> {
  if (!hasRealApiKey()) {
    return mockDescriptions(input);
  }

  const client = getClient();
  const prompt = buildDescriptionPrompt(input);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]+\}/);
  if (!jsonMatch) throw new Error("Claude returned invalid JSON for descriptions");

  const parsed = JSON.parse(jsonMatch[0]) as {
    mls?: string;
    social?: string;
    luxury?: string;
  };

  const descriptions: ListingDescriptions = {
    mls: (parsed.mls || "").substring(0, 500),
    social: (parsed.social || "").substring(0, 150),
    luxury: (parsed.luxury || "").substring(0, 300),
  };

  await Promise.all(
    Object.entries(descriptions).map(async ([key, val]) => {
      const check = await fairHousingCheck(val);
      if (!check.passed && check.suggestion) {
        descriptions[key as keyof ListingDescriptions] = check.suggestion;
      }
    })
  );

  return descriptions;
}

export async function generateCaptions(input: CaptionInput): Promise<ListingCaptions> {
  if (!hasRealApiKey()) {
    return mockCaptions(input);
  }

  const client = getClient();
  const prompt = buildCaptionPrompt(input);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]+\}/);
  if (!jsonMatch) throw new Error("Claude returned invalid JSON for captions");

  const parsed = JSON.parse(jsonMatch[0]) as {
    instagram?: string;
    tiktok?: string;
    facebook?: string;
  };

  const captions: ListingCaptions = {
    instagram: (parsed.instagram || "").substring(0, 200),
    tiktok: (parsed.tiktok || "").substring(0, 100),
    facebook: (parsed.facebook || "").substring(0, 180),
  };

  await Promise.all(
    Object.entries(captions).map(async ([key, val]) => {
      const check = await fairHousingCheck(val);
      if (!check.passed && check.suggestion) {
        captions[key as keyof ListingCaptions] = check.suggestion;
      }
    })
  );

  return captions;
}

export async function fairHousingCheck(text: string): Promise<FairHousingResult> {
  const quick = quickFairHousingCheck(text);
  if (!quick.hasBanned) {
    return { passed: true, flagged: [], suggestion: null };
  }

  if (!hasRealApiKey()) {
    // Without API key, trust the quick check result
    return { passed: false, flagged: quick.found, suggestion: null };
  }

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [
      { role: "user", content: `${FAIR_HOUSING_PROMPT}\n\nText to review:\n"${text}"` },
    ],
  });

  const responseText = response.content[0].type === "text" ? response.content[0].text : "";
  const jsonMatch = responseText.match(/\{[\s\S]+\}/);
  if (!jsonMatch) {
    return { passed: false, flagged: quick.found, suggestion: null };
  }

  return JSON.parse(jsonMatch[0]) as FairHousingResult;
}

export async function generateAllContent(
  listing: ListingDescriptionInput & CaptionInput
): Promise<{ descriptions: ListingDescriptions; captions: ListingCaptions }> {
  const [descriptions, captions] = await Promise.all([
    generateDescriptions(listing),
    generateCaptions(listing),
  ]);
  return { descriptions, captions };
}

export async function generateContentPack(input: ContentPackInput): Promise<ContentPack | null> {
  if (!hasRealApiKey()) {
    return null;
  }

  const client = getClient();
  const prompt = buildContentPackPrompt(input);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";
  return parseContentPack(text);
}
