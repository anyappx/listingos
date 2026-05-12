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

function mockContentPack(input: ContentPackInput): ContentPack {
  const addr = input.address || "this property";
  const city = input.city || "the area";
  const price = input.price ? `$${input.price.toLocaleString()}` : "contact for pricing";
  const beds = input.beds || "";
  const baths = input.baths || "";
  return {
    hooks: [
      `Just listed: ${addr} in ${city} for ${price}!`,
      `Dream home alert! ${beds}bd/${baths}ba in ${city} — this won't last long`,
      `POV: You just found your dream home 🏡`,
    ],
    features: [
      `${beds} bedrooms, ${baths} bathrooms`,
      `Located in ${city}`,
      `Listed at ${price}`,
      "Modern finishes throughout",
      "Move-in ready",
    ],
    shotList: [
      { sceneNumber: 1, duration: "4s", camera: "dolly", speak: `Welcome to ${addr}, nestled in the heart of ${city}.` },
      { sceneNumber: 2, duration: "4s", camera: "horizontal", speak: "Spacious living areas designed for modern comfort." },
      { sceneNumber: 3, duration: "4s", camera: "zoom", speak: "A chef's kitchen with premium finishes throughout." },
      { sceneNumber: 4, duration: "3s", camera: "orbital", speak: `${beds} bedrooms and ${baths} bathrooms await.` },
      { sceneNumber: 5, duration: "4s", camera: "dolly", speak: `Listed at ${price}. Schedule your private tour today.` },
    ],
    captionStyles: {
      bold: `JUST LISTED: ${addr} · ${price} · ${beds}bd/${baths}ba · DM for details`,
      storytelling: `Imagine waking up every morning in ${city}... This is ${addr} — and it could be yours.`,
      dataDriven: `${beds}bd/${baths}ba · ${input.sqft ? `${input.sqft.toLocaleString()} sqft ·` : ""} ${price} · ${city}`,
      casual: `ok so this house just listed and i'm obsessed 🏡 ${addr} in ${city}`,
      luxury: `An exceptional residence in ${city}. ${addr}. ${price}. Inquire within.`,
    },
    platformPosts: {
      instagram: `✨ Just listed: ${addr} · ${price} 🏡 #JustListed #RealEstate #${city.replace(/\s/g, "")}Homes`,
      tiktok: `POV: You just found your dream home 🏡 ${addr} · ${price} #RealEstateTok #HouseHunting`,
      linkedin: `New listing: ${addr}, ${city}. ${beds}bd/${baths}ba priced at ${price}. An excellent opportunity for buyers in the area.`,
      facebook: `New Listing! ${addr} in ${city} — ${beds}bd/${baths}ba listed at ${price}. Contact us to schedule a tour!`,
      twitter: `Just listed: ${addr} in ${city} for ${price} 🏠 ${beds}bd/${baths}ba. DM for details!`,
      youtubeShort: `Tour this beautiful ${beds}-bedroom home at ${addr} in ${city} listed at ${price}!`,
      emailSnippet: `I wanted to share a beautiful new listing: ${addr} in ${city}. This ${beds}bd/${baths}ba home is priced at ${price} and is ready for its next owners. Let me know if you'd like to schedule a private showing!`,
    },
    engagementQuestions: [
      `What's your favorite room in a new home? Comment below! 👇`,
      `Would you rather have a larger kitchen or a larger master suite?`,
      `Tag someone who needs to see this home in ${city}!`,
    ],
    generatedAt: new Date().toISOString(),
  };
}

export async function generateContentPack(input: ContentPackInput): Promise<ContentPack | null> {
  if (!hasRealApiKey()) {
    return mockContentPack(input);
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
