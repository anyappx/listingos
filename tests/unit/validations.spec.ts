/**
 * Unit tests for Zod validation schemas in lib/validations.ts
 *
 * These run without a browser — pure logic tests.
 * Covers all schemas: ScrapeInput, GenerateInput, BrandInput, LeadInput,
 * UpdateListing, UploadInput, ScrapedListing.
 *
 * Happy paths + boundary + negative paths for each.
 */
import { test, expect } from "@playwright/test";
import {
  ScrapeInputSchema,
  GenerateInputSchema,
  BrandInputSchema,
  LeadInputSchema,
  UpdateListingSchema,
  UploadInputSchema,
  ScrapedListingSchema,
} from "../../lib/validations";

// ─── ScrapeInputSchema ─────────────────────────────────────────────────────

test.describe("ScrapeInputSchema", () => {
  test("accepts valid Zillow URL", () => {
    const r = ScrapeInputSchema.safeParse({
      url: "https://www.zillow.com/homedetails/123-Main-St-Raleigh-NC-27601/12345_zpid/",
    });
    expect(r.success).toBe(true);
  });

  test("accepts valid Redfin URL", () => {
    const r = ScrapeInputSchema.safeParse({
      url: "https://www.redfin.com/NC/Raleigh/123-Main-St-27601/home/12345",
    });
    expect(r.success).toBe(true);
  });

  test("accepts valid Realtor.com URL", () => {
    const r = ScrapeInputSchema.safeParse({
      url: "https://www.realtor.com/realestateandhomes-detail/123-Main-St_Raleigh_NC_27601_M12345-67890",
    });
    expect(r.success).toBe(true);
  });

  test("rejects non-listing domain (google.com)", () => {
    const r = ScrapeInputSchema.safeParse({
      url: "https://google.com/search?q=house",
    });
    expect(r.success).toBe(false);
  });

  test("rejects empty string", () => {
    const r = ScrapeInputSchema.safeParse({ url: "" });
    expect(r.success).toBe(false);
  });

  test("rejects non-url string", () => {
    const r = ScrapeInputSchema.safeParse({ url: "zillow.com/something" });
    expect(r.success).toBe(false);
  });

  test("rejects missing url field", () => {
    const r = ScrapeInputSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  test("rejects url as number", () => {
    const r = ScrapeInputSchema.safeParse({ url: 12345 });
    expect(r.success).toBe(false);
  });

  test("rejects url as null", () => {
    const r = ScrapeInputSchema.safeParse({ url: null });
    expect(r.success).toBe(false);
  });

  test("rejects http://facebook.com (not a listing domain)", () => {
    const r = ScrapeInputSchema.safeParse({ url: "https://facebook.com/marketplace/item/12345" });
    expect(r.success).toBe(false);
  });
});

// ─── GenerateInputSchema ───────────────────────────────────────────────────

const VALID_GENERATE = {
  listingId: "550e8400-e29b-41d4-a716-446655440000",
  style: "modern" as const,
  durationSeconds: 30 as const,
  formats: "16x9" as const,
  musicTrackId: "550e8400-e29b-41d4-a716-446655440001",
  includeNeighborhoodBroll: false,
};

test.describe("GenerateInputSchema — styles", () => {
  const VALID_STYLES = ["modern", "luxury", "energetic", "minimal", "cinematic", "coastal", "desert", "urban"];

  for (const style of VALID_STYLES) {
    test(`accepts style=${style}`, () => {
      const r = GenerateInputSchema.safeParse({ ...VALID_GENERATE, style });
      expect(r.success).toBe(true);
    });
  }

  test("rejects unknown style 'galaxy'", () => {
    const r = GenerateInputSchema.safeParse({ ...VALID_GENERATE, style: "galaxy" });
    expect(r.success).toBe(false);
  });

  test("rejects empty style ''", () => {
    const r = GenerateInputSchema.safeParse({ ...VALID_GENERATE, style: "" });
    expect(r.success).toBe(false);
  });

  test("rejects style=null", () => {
    const r = GenerateInputSchema.safeParse({ ...VALID_GENERATE, style: null });
    expect(r.success).toBe(false);
  });

  test("rejects missing style", () => {
    const { style: _, ...rest } = VALID_GENERATE;
    const r = GenerateInputSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });
});

test.describe("GenerateInputSchema — durations", () => {
  const VALID_DURATIONS = [15, 30, 45, 60, 90, 120];
  const INVALID_DURATIONS = [0, 10, 20, 75, 180, 300, -1, -30];

  for (const d of VALID_DURATIONS) {
    test(`accepts durationSeconds=${d}`, () => {
      const r = GenerateInputSchema.safeParse({ ...VALID_GENERATE, durationSeconds: d });
      expect(r.success).toBe(true);
    });
  }

  for (const d of INVALID_DURATIONS) {
    test(`rejects durationSeconds=${d}`, () => {
      const r = GenerateInputSchema.safeParse({ ...VALID_GENERATE, durationSeconds: d });
      expect(r.success).toBe(false);
    });
  }

  test("rejects durationSeconds as string '30'", () => {
    const r = GenerateInputSchema.safeParse({ ...VALID_GENERATE, durationSeconds: "30" });
    expect(r.success).toBe(false);
  });

  test("rejects missing durationSeconds", () => {
    const { durationSeconds: _, ...rest } = VALID_GENERATE;
    const r = GenerateInputSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });
});

test.describe("GenerateInputSchema — formats", () => {
  test("accepts formats='16x9'", () => {
    const r = GenerateInputSchema.safeParse({ ...VALID_GENERATE, formats: "16x9" });
    expect(r.success).toBe(true);
  });

  test("accepts formats='9x16'", () => {
    const r = GenerateInputSchema.safeParse({ ...VALID_GENERATE, formats: "9x16" });
    expect(r.success).toBe(true);
  });

  test("accepts formats='both'", () => {
    const r = GenerateInputSchema.safeParse({ ...VALID_GENERATE, formats: "both" });
    expect(r.success).toBe(true);
  });

  test("rejects formats='square'", () => {
    const r = GenerateInputSchema.safeParse({ ...VALID_GENERATE, formats: "square" });
    expect(r.success).toBe(false);
  });

  test("rejects missing formats", () => {
    const { formats: _, ...rest } = VALID_GENERATE;
    const r = GenerateInputSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });
});

test.describe("GenerateInputSchema — listingId / musicTrackId", () => {
  test("rejects non-uuid listingId", () => {
    const r = GenerateInputSchema.safeParse({ ...VALID_GENERATE, listingId: "not-a-uuid" });
    expect(r.success).toBe(false);
  });

  test("rejects missing listingId", () => {
    const { listingId: _, ...rest } = VALID_GENERATE;
    const r = GenerateInputSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });

  test("rejects non-uuid musicTrackId", () => {
    const r = GenerateInputSchema.safeParse({ ...VALID_GENERATE, musicTrackId: "track-1" });
    expect(r.success).toBe(false);
  });

  test("rejects includeNeighborhoodBroll as string", () => {
    const r = GenerateInputSchema.safeParse({ ...VALID_GENERATE, includeNeighborhoodBroll: "yes" });
    expect(r.success).toBe(false);
  });

  test("accepts includeNeighborhoodBroll=true", () => {
    const r = GenerateInputSchema.safeParse({ ...VALID_GENERATE, includeNeighborhoodBroll: true });
    expect(r.success).toBe(true);
  });
});

// ─── BrandInputSchema ─────────────────────────────────────────────────────

test.describe("BrandInputSchema", () => {
  test("accepts all fields valid", () => {
    const r = BrandInputSchema.safeParse({
      primaryColor: "#FF5733",
      accentColor: "#1A2B3C",
      agentName: "Jane Smith",
      phone: "+1-555-123-4567",
      brokerage: "Best Homes Realty",
      licenseNumber: "NC-12345",
    });
    expect(r.success).toBe(true);
  });

  test("accepts empty object (all optional)", () => {
    const r = BrandInputSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  test("accepts null for nullable fields", () => {
    const r = BrandInputSchema.safeParse({
      logoUrl: null,
      agentName: null,
      phone: null,
      headshotUrl: null,
    });
    expect(r.success).toBe(true);
  });

  test("rejects invalid hex color (3-char)", () => {
    const r = BrandInputSchema.safeParse({ primaryColor: "#FFF" });
    expect(r.success).toBe(false);
  });

  test("rejects invalid hex color (no hash)", () => {
    const r = BrandInputSchema.safeParse({ primaryColor: "FF5733" });
    expect(r.success).toBe(false);
  });

  test("rejects color named 'red'", () => {
    const r = BrandInputSchema.safeParse({ primaryColor: "red" });
    expect(r.success).toBe(false);
  });

  test("rejects agentName over 100 chars", () => {
    const r = BrandInputSchema.safeParse({ agentName: "A".repeat(101) });
    expect(r.success).toBe(false);
  });

  test("accepts agentName exactly 100 chars", () => {
    const r = BrandInputSchema.safeParse({ agentName: "A".repeat(100) });
    expect(r.success).toBe(true);
  });

  test("rejects phone over 20 chars", () => {
    const r = BrandInputSchema.safeParse({ phone: "1234567890123456789012" });
    expect(r.success).toBe(false);
  });

  test("rejects logoUrl that's not a URL", () => {
    const r = BrandInputSchema.safeParse({ logoUrl: "not-a-url" });
    expect(r.success).toBe(false);
  });

  test("rejects brokerage over 100 chars", () => {
    const r = BrandInputSchema.safeParse({ brokerage: "B".repeat(101) });
    expect(r.success).toBe(false);
  });
});

// ─── LeadInputSchema ──────────────────────────────────────────────────────

test.describe("LeadInputSchema", () => {
  test("accepts full valid lead", () => {
    const r = LeadInputSchema.safeParse({
      listingId: "550e8400-e29b-41d4-a716-446655440000",
      name: "John Doe",
      email: "john@example.com",
      phone: "+1 555-123-4567",
      message: "Interested in a viewing",
    });
    expect(r.success).toBe(true);
  });

  test("accepts minimal lead (listingId only)", () => {
    const r = LeadInputSchema.safeParse({
      listingId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(r.success).toBe(true);
  });

  test("rejects missing listingId", () => {
    const r = LeadInputSchema.safeParse({ email: "test@example.com" });
    expect(r.success).toBe(false);
  });

  test("rejects non-uuid listingId", () => {
    const r = LeadInputSchema.safeParse({ listingId: "bad-id", email: "test@example.com" });
    expect(r.success).toBe(false);
  });

  test("rejects invalid email", () => {
    const r = LeadInputSchema.safeParse({
      listingId: "550e8400-e29b-41d4-a716-446655440000",
      email: "not-an-email",
    });
    expect(r.success).toBe(false);
  });

  test("rejects phone with letters", () => {
    const r = LeadInputSchema.safeParse({
      listingId: "550e8400-e29b-41d4-a716-446655440000",
      phone: "CALL ME NOW",
    });
    expect(r.success).toBe(false);
  });

  test("rejects message over 1000 chars", () => {
    const r = LeadInputSchema.safeParse({
      listingId: "550e8400-e29b-41d4-a716-446655440000",
      message: "x".repeat(1001),
    });
    expect(r.success).toBe(false);
  });

  test("accepts message exactly 1000 chars", () => {
    const r = LeadInputSchema.safeParse({
      listingId: "550e8400-e29b-41d4-a716-446655440000",
      message: "x".repeat(1000),
    });
    expect(r.success).toBe(true);
  });
});

// ─── UpdateListingSchema ──────────────────────────────────────────────────

test.describe("UpdateListingSchema", () => {
  test("accepts empty object (all optional)", () => {
    const r = UpdateListingSchema.safeParse({});
    expect(r.success).toBe(true);
  });

  test("accepts valid address update", () => {
    const r = UpdateListingSchema.safeParse({ address: "123 Main St, Raleigh, NC 27601" });
    expect(r.success).toBe(true);
  });

  test("accepts valid price update", () => {
    const r = UpdateListingSchema.safeParse({ price: 450000 });
    expect(r.success).toBe(true);
  });

  test("rejects negative price", () => {
    const r = UpdateListingSchema.safeParse({ price: -1000 });
    expect(r.success).toBe(false);
  });

  test("rejects price=0", () => {
    const r = UpdateListingSchema.safeParse({ price: 0 });
    expect(r.success).toBe(false);
  });

  test("rejects address over 300 chars", () => {
    const r = UpdateListingSchema.safeParse({ address: "A".repeat(301) });
    expect(r.success).toBe(false);
  });

  test("rejects descriptionMls over 500 chars", () => {
    const r = UpdateListingSchema.safeParse({ descriptionMls: "x".repeat(501) });
    expect(r.success).toBe(false);
  });

  test("rejects captionInstagram over 200 chars", () => {
    const r = UpdateListingSchema.safeParse({ captionInstagram: "x".repeat(201) });
    expect(r.success).toBe(false);
  });

  test("rejects captionTiktok over 100 chars", () => {
    const r = UpdateListingSchema.safeParse({ captionTiktok: "x".repeat(101) });
    expect(r.success).toBe(false);
  });
});

// ─── UploadInputSchema ────────────────────────────────────────────────────

test.describe("UploadInputSchema", () => {
  test("accepts valid listing photo upload", () => {
    const r = UploadInputSchema.safeParse({
      filename: "photo.jpg",
      contentType: "image/jpeg",
      purpose: "listing_photo",
    });
    expect(r.success).toBe(true);
  });

  test("accepts image/png", () => {
    const r = UploadInputSchema.safeParse({
      filename: "photo.png",
      contentType: "image/png",
      purpose: "listing_photo",
    });
    expect(r.success).toBe(true);
  });

  test("accepts image/webp", () => {
    const r = UploadInputSchema.safeParse({
      filename: "photo.webp",
      contentType: "image/webp",
      purpose: "listing_photo",
    });
    expect(r.success).toBe(true);
  });

  test("accepts purpose='logo'", () => {
    const r = UploadInputSchema.safeParse({
      filename: "logo.png",
      contentType: "image/png",
      purpose: "logo",
    });
    expect(r.success).toBe(true);
  });

  test("accepts purpose='headshot'", () => {
    const r = UploadInputSchema.safeParse({
      filename: "headshot.jpg",
      contentType: "image/jpeg",
      purpose: "headshot",
    });
    expect(r.success).toBe(true);
  });

  test("rejects application/pdf contentType", () => {
    const r = UploadInputSchema.safeParse({
      filename: "doc.pdf",
      contentType: "application/pdf",
      purpose: "listing_photo",
    });
    expect(r.success).toBe(false);
  });

  test("rejects unknown purpose", () => {
    const r = UploadInputSchema.safeParse({
      filename: "photo.jpg",
      contentType: "image/jpeg",
      purpose: "profile_picture",
    });
    expect(r.success).toBe(false);
  });

  test("rejects empty filename", () => {
    const r = UploadInputSchema.safeParse({
      filename: "",
      contentType: "image/jpeg",
      purpose: "listing_photo",
    });
    expect(r.success).toBe(false);
  });

  test("rejects filename over 255 chars", () => {
    const r = UploadInputSchema.safeParse({
      filename: "a".repeat(256),
      contentType: "image/jpeg",
      purpose: "listing_photo",
    });
    expect(r.success).toBe(false);
  });

  test("accepts filename exactly 255 chars", () => {
    const r = UploadInputSchema.safeParse({
      filename: "a".repeat(255),
      contentType: "image/jpeg",
      purpose: "listing_photo",
    });
    expect(r.success).toBe(true);
  });
});

// ─── ScrapedListingSchema ─────────────────────────────────────────────────

test.describe("ScrapedListingSchema", () => {
  const VALID_SCRAPED = {
    address: "123 Main St",
    city: "Raleigh",
    state: "NC",
    zip: "27601",
    price: 450000,
    beds: 3,
    baths: 2,
    sqft: 1800,
    description: "Beautiful home",
    photoUrls: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
  };

  test("accepts valid scraped listing", () => {
    const r = ScrapedListingSchema.safeParse(VALID_SCRAPED);
    expect(r.success).toBe(true);
  });

  test("accepts minimal (address, city, one photo)", () => {
    const r = ScrapedListingSchema.safeParse({
      address: "123 Main St",
      city: "Raleigh",
      photoUrls: ["https://example.com/photo.jpg"],
    });
    expect(r.success).toBe(true);
  });

  test("rejects missing address", () => {
    const { address: _, ...rest } = VALID_SCRAPED;
    const r = ScrapedListingSchema.safeParse(rest);
    expect(r.success).toBe(false);
  });

  test("rejects empty city", () => {
    const r = ScrapedListingSchema.safeParse({ ...VALID_SCRAPED, city: "" });
    expect(r.success).toBe(false);
  });

  test("rejects empty photoUrls array", () => {
    const r = ScrapedListingSchema.safeParse({ ...VALID_SCRAPED, photoUrls: [] });
    expect(r.success).toBe(false);
  });

  test("rejects photoUrls with invalid URL", () => {
    const r = ScrapedListingSchema.safeParse({
      ...VALID_SCRAPED,
      photoUrls: ["not-a-url"],
    });
    expect(r.success).toBe(false);
  });

  test("rejects more than 40 photos", () => {
    const r = ScrapedListingSchema.safeParse({
      ...VALID_SCRAPED,
      photoUrls: Array.from({ length: 41 }, (_, i) => `https://example.com/photo${i}.jpg`),
    });
    expect(r.success).toBe(false);
  });

  test("accepts exactly 40 photos", () => {
    const r = ScrapedListingSchema.safeParse({
      ...VALID_SCRAPED,
      photoUrls: Array.from({ length: 40 }, (_, i) => `https://example.com/photo${i}.jpg`),
    });
    expect(r.success).toBe(true);
  });

  test("rejects negative price", () => {
    const r = ScrapedListingSchema.safeParse({ ...VALID_SCRAPED, price: -1000 });
    expect(r.success).toBe(false);
  });

  test("rejects beds > 100", () => {
    const r = ScrapedListingSchema.safeParse({ ...VALID_SCRAPED, beds: 101 });
    expect(r.success).toBe(false);
  });

  test("accepts beds=0 (studio)", () => {
    const r = ScrapedListingSchema.safeParse({ ...VALID_SCRAPED, beds: 0 });
    expect(r.success).toBe(true);
  });
});
