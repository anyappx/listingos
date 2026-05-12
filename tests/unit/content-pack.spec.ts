/**
 * Unit tests for content pack logic:
 *  - parseContentPack (prompts/content-pack.ts)
 *  - ContentPack structure validation
 *  - Edge cases: missing fields, malformed JSON, partial data
 *
 * These run without a browser — pure logic tests.
 */
import { test, expect } from "@playwright/test";
import { parseContentPack, buildContentPackPrompt } from "../../prompts/content-pack";
import type { ContentPack, ShotScene } from "../../lib/types";

// ─── parseContentPack ─────────────────────────────────────────────────────

test.describe("parseContentPack", () => {
  const VALID_PACK = {
    hooks: [
      "Just listed: 123 Main St for $450k!",
      "Dream home alert — this won't last!",
      "POV: You just found your dream home",
      "New listing just dropped",
      "3bd/2ba just hit the market",
      "Would you pay $450k for this?",
      "Here's what $450k buys you today",
      "Swipe to see every room",
      "Open house vibes: this weekend only",
      "Calling all buyers — you need to see this",
    ],
    features: [
      "Quartz waterfall kitchen island",
      "Primary suite with spa bath",
      "3-car garage",
      "Open-concept living",
      "Home office with built-ins",
      "Covered rear patio",
      "Hardwood floors throughout",
      "Walking distance to restaurants",
    ],
    shotList: [
      { sceneNumber: 1, duration: "0-4s", camera: "dolly in from curb", speak: "Welcome to 123 Main St." },
      { sceneNumber: 2, duration: "4-8s", camera: "pan across living room", speak: "Open-concept living meets modern design." },
      { sceneNumber: 3, duration: "8-12s", camera: "push in to kitchen", speak: "Quartz waterfall island — built for entertaining." },
      { sceneNumber: 4, duration: "12-16s", camera: "reveal primary suite", speak: "Retreat to your spa-inspired primary suite." },
      { sceneNumber: 5, duration: "16-20s", camera: "pull back to patio", speak: "And this covered patio — perfect for evenings." },
      { sceneNumber: 6, duration: "20-30s", camera: "drone pull-back exterior", speak: "Listed at $450,000. Schedule your private tour today." },
    ],
    captionStyles: {
      bold: "JUST LISTED: 3BD/2BA in Raleigh · $450k · DM to tour",
      storytelling: "Imagine mornings in Raleigh with this kitchen. It's possible.",
      dataDriven: "3bd/2ba · 1,800sqft · $250/sqft · Raleigh, NC",
      casual: "ok so this house just hit the market and it's absolutely perfect 🏡",
      luxury: "An exceptional Raleigh residence. 123 Main St. $450,000.",
    },
    platformPosts: {
      instagram: "✨ Just listed: 3bd/2ba in Raleigh for $450k! DM to schedule a tour 🏡 #JustListed #RaleighRealEstate #NCHomes",
      tiktok: "POV: This is your new home. Walk through it with me. 3bd/2ba in Raleigh, just listed for $450k.",
      linkedin: "New listing in Raleigh: 3-bedroom home at 123 Main St priced at $450,000. A compelling opportunity in a strong market.",
      facebook: "Just listed in Raleigh! 3 bedrooms, 2 baths, beautiful finishes. Listed at $450,000. What do you think — great value?",
      twitter: "Just listed: 3bd/2ba in Raleigh for $450k. DM for details.",
      youtubeShort: "Tour this stunning Raleigh home with me! 3bd/2ba, $450k. This home won't last — check out every room in 30 seconds.",
      emailSnippet: "Subject: New Listing: 3bd/2ba in Raleigh — $450k\n\nI wanted to share this stunning new listing at 123 Main St in Raleigh. This 3-bedroom, 2-bathroom home features modern finishes and is priced at $450,000.\n\nReply to schedule your private tour: [BOOKING_LINK]",
    },
    engagementQuestions: [
      "Kitchen or primary suite — which matters more to you?",
      "Would you renovate or move in as-is?",
      "What's your must-have for a new home?",
      "Tag someone who needs to see this listing!",
      "Poll: would you pay $450k for 3bd/2ba in Raleigh?",
    ],
  };

  test("parses valid complete JSON string", () => {
    const raw = JSON.stringify(VALID_PACK);
    const result = parseContentPack(raw);
    expect(result).not.toBeNull();
    expect(result!.hooks).toHaveLength(10);
    expect(result!.features).toHaveLength(8);
    expect(result!.shotList).toHaveLength(6);
    expect(result!.engagementQuestions).toHaveLength(5);
  });

  test("adds generatedAt timestamp when parsing", () => {
    const raw = JSON.stringify(VALID_PACK);
    const result = parseContentPack(raw);
    expect(result).not.toBeNull();
    expect(typeof result!.generatedAt).toBe("string");
    expect(new Date(result!.generatedAt).getFullYear()).toBeGreaterThanOrEqual(2026);
  });

  test("parses JSON wrapped in text/explanation", () => {
    const raw = `Here is the content pack:\n\n${JSON.stringify(VALID_PACK)}\n\nHope this helps!`;
    const result = parseContentPack(raw);
    expect(result).not.toBeNull();
  });

  test("returns null for empty string", () => {
    expect(parseContentPack("")).toBeNull();
  });

  test("returns null for plain text (no JSON)", () => {
    expect(parseContentPack("Sorry I cannot generate content")).toBeNull();
  });

  test("returns null for malformed JSON", () => {
    expect(parseContentPack("{hooks: [bad json")).toBeNull();
  });

  test("returns null when hooks array is missing", () => {
    const pack = { ...VALID_PACK };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (pack as any).hooks;
    expect(parseContentPack(JSON.stringify(pack))).toBeNull();
  });

  test("returns null when shotList is missing", () => {
    const pack = { ...VALID_PACK };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (pack as any).shotList;
    expect(parseContentPack(JSON.stringify(pack))).toBeNull();
  });

  test("returns null when captionStyles is not an object", () => {
    expect(parseContentPack(JSON.stringify({ ...VALID_PACK, captionStyles: "bold caption" }))).toBeNull();
  });

  test("returns null when platformPosts is a string", () => {
    expect(parseContentPack(JSON.stringify({ ...VALID_PACK, platformPosts: "instagram: great post!" }))).toBeNull();
  });

  test("returns null when features is not an array", () => {
    expect(parseContentPack(JSON.stringify({ ...VALID_PACK, features: "great kitchen" }))).toBeNull();
  });

  test("returns null when engagementQuestions is missing", () => {
    const pack = { ...VALID_PACK };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (pack as any).engagementQuestions;
    expect(parseContentPack(JSON.stringify(pack))).toBeNull();
  });

  test("preserves all captionStyle keys", () => {
    const result = parseContentPack(JSON.stringify(VALID_PACK));
    expect(result).not.toBeNull();
    expect(result!.captionStyles.bold).toBeTruthy();
    expect(result!.captionStyles.storytelling).toBeTruthy();
    expect(result!.captionStyles.dataDriven).toBeTruthy();
    expect(result!.captionStyles.casual).toBeTruthy();
    expect(result!.captionStyles.luxury).toBeTruthy();
  });

  test("preserves all platformPost keys", () => {
    const result = parseContentPack(JSON.stringify(VALID_PACK));
    expect(result).not.toBeNull();
    const posts = result!.platformPosts;
    expect(posts.instagram).toBeTruthy();
    expect(posts.tiktok).toBeTruthy();
    expect(posts.linkedin).toBeTruthy();
    expect(posts.facebook).toBeTruthy();
    expect(posts.twitter).toBeTruthy();
    expect(posts.youtubeShort).toBeTruthy();
    expect(posts.emailSnippet).toBeTruthy();
  });

  test("shotList items have required ShotScene fields", () => {
    const result = parseContentPack(JSON.stringify(VALID_PACK));
    expect(result).not.toBeNull();
    for (const scene of result!.shotList as ShotScene[]) {
      expect(typeof scene.sceneNumber).toBe("number");
      expect(typeof scene.duration).toBe("string");
      expect(typeof scene.camera).toBe("string");
      expect(typeof scene.speak).toBe("string");
    }
  });

  test("hooks are all strings", () => {
    const result = parseContentPack(JSON.stringify(VALID_PACK));
    expect(result).not.toBeNull();
    for (const hook of result!.hooks) {
      expect(typeof hook).toBe("string");
    }
  });

  test("null input → returns null", () => {
    // Type cast for robustness test
    expect(parseContentPack(null as unknown as string)).toBeNull();
  });

  test("number input → returns null", () => {
    expect(parseContentPack(42 as unknown as string)).toBeNull();
  });
});

// ─── ContentPack structural invariants ─────────────────────────────────────

test.describe("ContentPack structural invariants", () => {
  test("mock content pack has all required top-level keys", () => {
    // Validates against the ContentPack interface shape
    const mockPack: ContentPack = {
      hooks: ["Hook 1"],
      features: ["Feature 1"],
      shotList: [{ sceneNumber: 1, duration: "4s", camera: "dolly", speak: "Welcome." }],
      captionStyles: {
        bold: "BOLD CAPTION",
        storytelling: "Story caption",
        dataDriven: "Data caption",
        casual: "Casual caption",
        luxury: "Luxury caption",
      },
      platformPosts: {
        instagram: "IG post",
        tiktok: "TikTok post",
        linkedin: "LinkedIn post",
        facebook: "Facebook post",
        twitter: "Twitter post",
        youtubeShort: "YouTube script",
        emailSnippet: "Email body",
      },
      engagementQuestions: ["Question?"],
      generatedAt: new Date().toISOString(),
    };

    expect(Array.isArray(mockPack.hooks)).toBe(true);
    expect(Array.isArray(mockPack.features)).toBe(true);
    expect(Array.isArray(mockPack.shotList)).toBe(true);
    expect(Array.isArray(mockPack.engagementQuestions)).toBe(true);
    expect(typeof mockPack.captionStyles).toBe("object");
    expect(typeof mockPack.platformPosts).toBe("object");
    expect(typeof mockPack.generatedAt).toBe("string");
  });

  test("captionStyles has exactly 5 required keys", () => {
    const required = ["bold", "storytelling", "dataDriven", "casual", "luxury"];
    const sample: ContentPack["captionStyles"] = {
      bold: "b",
      storytelling: "s",
      dataDriven: "d",
      casual: "c",
      luxury: "l",
    };
    for (const key of required) {
      expect(key in sample).toBe(true);
    }
    expect(Object.keys(sample)).toHaveLength(5);
  });

  test("platformPosts has exactly 7 required keys", () => {
    const required = ["instagram", "tiktok", "linkedin", "facebook", "twitter", "youtubeShort", "emailSnippet"];
    const sample: ContentPack["platformPosts"] = {
      instagram: "ig",
      tiktok: "tt",
      linkedin: "li",
      facebook: "fb",
      twitter: "tw",
      youtubeShort: "yt",
      emailSnippet: "em",
    };
    for (const key of required) {
      expect(key in sample).toBe(true);
    }
    expect(Object.keys(sample)).toHaveLength(7);
  });

  test("ShotScene has exactly 4 required fields", () => {
    const scene: ShotScene = {
      sceneNumber: 1,
      duration: "4s",
      camera: "dolly",
      speak: "Welcome.",
    };
    expect(scene.sceneNumber).toBeDefined();
    expect(scene.duration).toBeDefined();
    expect(scene.camera).toBeDefined();
    expect(scene.speak).toBeDefined();
  });
});

// ─── buildContentPackPrompt ───────────────────────────────────────────────

test.describe("buildContentPackPrompt", () => {
  test("includes address in prompt", () => {
    const prompt = buildContentPackPrompt({
      address: "123 Oak Street",
      city: "Austin",
      style: "modern",
      price: null,
      beds: null,
      baths: null,
      sqft: null,
    });
    expect(prompt).toContain("123 Oak Street");
    expect(prompt).toContain("Austin");
  });

  test("includes price in prompt when provided", () => {
    const prompt = buildContentPackPrompt({
      address: "456 Elm St",
      city: "Dallas",
      style: "luxury",
      price: 750000,
      beds: 4,
      baths: 3,
      sqft: 3200,
    });
    expect(prompt).toContain("750,000");
    expect(prompt).toContain("4 beds");
    expect(prompt).toContain("3 baths");
    expect(prompt).toContain("3,200 sqft");
  });

  test("shows contact-for-pricing when price is null", () => {
    const prompt = buildContentPackPrompt({
      address: "789 Pine Rd",
      city: "Nashville",
      style: "minimal",
      price: null,
      beds: 2,
      baths: 1,
      sqft: null,
    });
    expect(prompt).toContain("Contact for pricing");
  });

  test("includes fair housing warning", () => {
    const prompt = buildContentPackPrompt({
      address: "100 Maple Ave",
      city: "Seattle",
      style: "coastal",
      price: 600000,
      beds: 3,
      baths: 2,
      sqft: 1500,
    });
    expect(prompt.toLowerCase()).toContain("fair housing");
  });

  test("includes voice profile when provided", () => {
    const prompt = buildContentPackPrompt({
      address: "200 Cedar Blvd",
      city: "Denver",
      style: "energetic",
      price: 400000,
      beds: 3,
      baths: 2,
      sqft: 1600,
      voiceProfile: "Casual and friendly. Uses lots of emojis.",
    });
    expect(prompt).toContain("Casual and friendly");
  });

  test("includes features when provided", () => {
    const prompt = buildContentPackPrompt({
      address: "300 Birch Lane",
      city: "Portland",
      style: "modern",
      price: 520000,
      beds: 3,
      baths: 2,
      sqft: 1900,
      features: "Rooftop deck, wine cellar, heated floors",
    });
    expect(prompt).toContain("Rooftop deck");
  });

  test("prompt instructs JSON output with correct structure", () => {
    const prompt = buildContentPackPrompt({
      address: "400 Willow Way",
      city: "Chicago",
      style: "urban",
      price: 380000,
      beds: 2,
      baths: 2,
      sqft: 1200,
    });
    expect(prompt).toContain("hooks");
    expect(prompt).toContain("features");
    expect(prompt).toContain("shotList");
    expect(prompt).toContain("captionStyles");
    expect(prompt).toContain("platformPosts");
    expect(prompt).toContain("engagementQuestions");
  });
});
