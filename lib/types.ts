// TypeScript interfaces matching DB_SCHEMA.sql exactly

export type Plan = "trial" | "solo" | "agent";
export type SubscriptionStatus = "trialing" | "active" | "canceled" | "past_due";
export type VideoStatus = "queued" | "processing" | "complete" | "failed";
export type VideoStyle = "modern" | "luxury" | "energetic" | "minimal";
export type VideoFormat = "both" | "16x9" | "9x16";
export type MusicGenre = "modern" | "luxury" | "upbeat" | "calm" | "bold";

export interface ListingPhoto {
  url: string;
  order: number;
  is_cover: boolean;
}

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  plan: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: SubscriptionStatus;
  trial_ends_at: string;
  listings_used_this_month: number;
  listings_reset_at: string;
  created_at: string;
  updated_at: string;
}

export interface BrandKit {
  id: string;
  user_id: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  font: string;
  agent_name: string | null;
  license_number: string | null;
  brokerage: string | null;
  phone: string | null;
  headshot_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface MusicTrack {
  id: string;
  name: string;
  genre: MusicGenre;
  file_path: string;
  duration_seconds: number;
  bpm: number | null;
  display_order: number;
}

export interface Listing {
  id: string;
  user_id: string;
  slug: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  raw_description: string | null;
  source_url: string | null;
  photos: ListingPhoto[];
  description_mls: string | null;
  description_social: string | null;
  description_luxury: string | null;
  caption_instagram: string | null;
  caption_tiktok: string | null;
  caption_facebook: string | null;
  fair_housing_passed: boolean | null;
  fair_housing_flags: Record<string, unknown> | null;
  view_count: number;
  lead_count: number;
  created_at: string;
  updated_at: string;
}

export interface VideoJob {
  id: string;
  listing_id: string;
  user_id: string;
  status: VideoStatus;
  style: VideoStyle;
  duration_seconds: number;
  music_track_id: string | null;
  include_neighborhood_broll: boolean;
  progress_step: string | null;
  progress_percent: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: string;
  job_id: string;
  listing_id: string;
  user_id: string;
  url_16x9: string | null;
  url_9x16: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  is_watermarked: boolean;
  download_count: number;
  created_at: string;
}

export interface Lead {
  id: string;
  listing_id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  source: string;
  created_at: string;
}

// API response types

export interface ScrapeResponse {
  listingId: string;
  slug: string;
  address: string;
  city: string;
  price: number;
  beds: number;
  baths: number;
  sqft: number;
  description: string;
  photos: ListingPhoto[];
}

export interface GenerateResponse {
  jobId: string;
  estimatedSeconds: number;
}

export interface JobStatusQueued {
  status: "queued";
  progressStep: string;
  progressPercent: number;
}

export interface JobStatusProcessing {
  status: "processing";
  progressStep: string;
  progressPercent: number;
}

export interface JobStatusComplete {
  status: "complete";
  progressPercent: 100;
  video: {
    url16x9: string;
    url9x16: string;
    thumbnailUrl: string;
    durationSeconds: number;
  };
  listing: {
    descriptionMls: string;
    descriptionSocial: string;
    descriptionLuxury: string;
    captionInstagram: string;
    captionTiktok: string;
    captionFacebook: string;
    shareUrl: string;
    qrCodeUrl: string;
  };
}

export interface JobStatusFailed {
  status: "failed";
  error: string;
}

export type JobStatusResponse =
  | JobStatusQueued
  | JobStatusProcessing
  | JobStatusComplete
  | JobStatusFailed;

// Video generation job payload (BullMQ)
export interface VideoJobPayload {
  jobId: string;
  listingId: string;
  userId: string;
  style: VideoStyle;
  durationSeconds: number;
  formats: VideoFormat;
  musicTrackId: string;
  includeNeighborhoodBroll: boolean;
}

// Claude AI outputs
export interface ListingDescriptions {
  mls: string;
  social: string;
  luxury: string;
}

export interface ListingCaptions {
  instagram: string;
  tiktok: string;
  facebook: string;
}

export interface FairHousingResult {
  passed: boolean;
  flagged: string[];
  suggestion: string | null;
}

// Dashboard stats
export interface DashboardStats {
  videosThisMonth: number;
  totalViews: number;
  totalLeads: number;
  listingsUsed: number;
  listingsLimit: number;
}
