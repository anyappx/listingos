export interface ListingDescriptionInput {
  address: string;
  city: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  rawDescription?: string;
}

export function buildDescriptionPrompt(input: ListingDescriptionInput): string {
  const { address, city, price, beds, baths, sqft, rawDescription } = input;
  const priceFormatted = price ? `$${price.toLocaleString()}` : "price not provided";
  const specs = [
    beds ? `${beds} bed` : null,
    baths ? `${baths} bath` : null,
    sqft ? `${sqft.toLocaleString()} sqft` : null,
  ].filter(Boolean).join(", ");

  return `You are a professional real estate copywriter. Generate listing descriptions for this property.

Property Details:
- Address: ${address}
- City: ${city}
- Price: ${priceFormatted}
- Specs: ${specs || "not provided"}
- Raw description from listing: ${rawDescription || "none provided"}

Generate 3 listing description variants. Return ONLY valid JSON, no markdown, no explanation:

{
  "mls": "Professional MLS description. Max 500 characters. Factual, highlights key features, no emotional language, no Fair Housing violations.",
  "social": "Social media description. Max 150 characters. Engaging, include 1 emoji that fits the property, conversational tone.",
  "luxury": "Luxury/aspirational description. Max 300 characters. Sensory language, aspirational tone, describe the lifestyle and experience."
}

CRITICAL Fair Housing rules - NEVER include:
- References to families, children, or schools
- Safety, crime, or quiet neighborhood mentions
- Exclusive, prestigious, or gated community language
- Any religion, race, ethnicity, nationality
- Any protected class language whatsoever`;
}
