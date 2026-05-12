import { z } from "zod";

export const ScrapeInputSchema = z.object({
  url: z
    .string()
    .url("Must be a valid URL")
    .refine(
      (url) => {
        const allowed = ["zillow.com", "redfin.com", "realtor.com"];
        return allowed.some((domain) => url.includes(domain));
      },
      { message: "URL must be from Zillow, Redfin, or Realtor.com" }
    ),
});

export const GenerateInputSchema = z.object({
  listingId: z.string().uuid("Invalid listing ID"),
  style: z.enum(["modern", "luxury", "energetic", "minimal", "cinematic", "coastal", "desert", "urban"]),
  durationSeconds: z.union([
    z.literal(15),
    z.literal(30),
    z.literal(45),
    z.literal(60),
    z.literal(90),
    z.literal(120),
  ]),
  formats: z.enum(["both", "16x9", "9x16"]),
  musicTrackId: z.string().uuid("Invalid music track ID"),
  includeNeighborhoodBroll: z.boolean(),
});

export const BrandInputSchema = z.object({
  logoUrl: z.string().url().optional().nullable(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
    .optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")
    .optional(),
  font: z.string().optional(),
  agentName: z.string().max(100).optional().nullable(),
  licenseNumber: z.string().max(50).optional().nullable(),
  brokerage: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  headshotUrl: z.string().url().optional().nullable(),
});

export const BrandVoiceInputSchema = z.object({
  voiceExamples: z.string().min(20, "Please provide at least 20 characters of caption examples"),
});

export const LeadInputSchema = z.object({
  listingId: z.string().uuid("Invalid listing ID"),
  name: z.string().min(1).max(200).optional(),
  email: z.string().email("Invalid email address").optional(),
  phone: z
    .string()
    .regex(/^[\d\s\-\+\(\)\.]+$/, "Invalid phone number")
    .max(20)
    .optional(),
  message: z.string().max(1000).optional(),
});

export const UpdateListingSchema = z.object({
  descriptionMls: z.string().max(500).optional(),
  descriptionSocial: z.string().max(150).optional(),
  descriptionLuxury: z.string().max(300).optional(),
  captionInstagram: z.string().max(200).optional(),
  captionTiktok: z.string().max(100).optional(),
  captionFacebook: z.string().max(180).optional(),
  address: z.string().max(300).optional(),
  price: z.number().int().positive().optional(),
});

export const UploadInputSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  purpose: z.enum(["logo", "headshot", "listing_photo"]),
});

// Scraped listing data validation (from scraper output)
export const ScrapedListingSchema = z.object({
  address: z.string().min(1).max(500),
  city: z.string().min(1).max(200),
  state: z.string().max(50).optional(),
  zip: z.string().max(10).optional(),
  price: z.number().int().positive().optional(),
  beds: z.number().min(0).max(100).optional(),
  baths: z.number().min(0).max(100).optional(),
  sqft: z.number().int().positive().optional(),
  description: z.string().max(5000).optional(),
  photoUrls: z.array(z.string().url()).min(1).max(40),
});

export type ScrapeInput = z.infer<typeof ScrapeInputSchema>;
export type GenerateInput = z.infer<typeof GenerateInputSchema>;
export type BrandInput = z.infer<typeof BrandInputSchema>;
export type BrandVoiceInput = z.infer<typeof BrandVoiceInputSchema>;
export type LeadInput = z.infer<typeof LeadInputSchema>;
export type UpdateListingInput = z.infer<typeof UpdateListingSchema>;
export type UploadInput = z.infer<typeof UploadInputSchema>;
export type ScrapedListing = z.infer<typeof ScrapedListingSchema>;
