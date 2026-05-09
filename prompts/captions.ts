import type { VideoStyle } from "@/lib/types";

export interface CaptionInput {
  address: string;
  city: string;
  price: number | null;
  style: VideoStyle;
}

export function buildCaptionPrompt(input: CaptionInput): string {
  const { address, city, price, style } = input;
  const priceFormatted = price ? `$${price.toLocaleString()}` : "Contact for pricing";
  const styleDescriptions: Record<VideoStyle, string> = {
    modern: "contemporary and polished",
    luxury: "elevated and aspirational",
    energetic: "exciting and dynamic",
    minimal: "clean and understated",
  };

  return `You are a real estate social media expert. Generate platform-specific captions for a listing video.

Property: ${address}, ${city}
Price: ${priceFormatted}
Video Style: ${styleDescriptions[style]}

Return ONLY valid JSON, no markdown:

{
  "instagram": "Engaging caption + 5 relevant hashtags. Max 200 characters total. Use emojis. End with the price or call to action.",
  "tiktok": "Punchy opener that hooks in the first 3 words. Max 100 characters. No hashtags. Make it feel native to TikTok.",
  "facebook": "Conversational caption for Facebook. Max 180 characters. End with a question to drive engagement."
}

CRITICAL: No Fair Housing violations. No mention of families, schools, safety, quiet, exclusive, or any protected class.`;
}
