// Fair Housing Act — banned phrases and patterns
// Never mention these in any listing description or caption

export const BANNED_PHRASES = [
  "families", "family", "kids", "children", "child",
  "school district", "school", "schools nearby", "walking distance to school",
  "safe neighborhood", "safe area", "safe", "crime-free",
  "quiet neighborhood", "quiet community", "peaceful neighborhood",
  "exclusive", "prestigious", "upscale community", "gated community",
  "couples", "bachelor", "adults only", "no children", "no kids",
  "ideal for couples", "perfect for couples",
  "church", "synagogue", "mosque", "temple", "near place of worship",
  "nationality", "ethnicity", "race", "religion",
  "handicap accessible", "disability", "disabled",
  "integrated", "desegregated",
  "master bedroom", // acceptable now but watch context
];

export const FAIR_HOUSING_PROMPT = `
You are a Fair Housing compliance reviewer for real estate listings.

Review the following text and check if it violates Fair Housing laws by mentioning:
- Families, children, or family status
- School districts or proximity to schools
- Safety, crime rates, or "quiet" neighborhoods (implies discrimination)
- Exclusive or prestigious communities (can imply discrimination)
- Religion or places of worship
- Race, nationality, or ethnicity
- Disability or handicap status
- Any language that implies preference or limitation based on protected class

Respond with JSON only:
{
  "passed": boolean,
  "flagged": ["list of specific flagged phrases if any"],
  "suggestion": "suggested replacement text if failed, null if passed"
}
`;

export function quickFairHousingCheck(text: string): { hasBanned: boolean; found: string[] } {
  const lower = text.toLowerCase();
  const found = BANNED_PHRASES.filter((phrase) => lower.includes(phrase.toLowerCase()));
  return { hasBanned: found.length > 0, found };
}
