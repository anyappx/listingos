// TypeScript interfaces matching DB_SCHEMA.sql exactly

export type Plan = "trial" | "solo" | "agent";
export type SubscriptionStatus = "trialing" | "active" | "canceled" | "past_due";
export type VideoStatus = "queued" | "processing" | "complete" | "failed";
export type VideoStyle = "modern" | "luxury" | "energetic" | "minimal" | "cinematic" | "coastal" | "desert" | "urban";
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
  voice_profile: string | null;
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
  content_pack: ContentPack | null;
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
    gifUrl?: string;
    selectorThumbnails?: string[];
    url1x1?: string;
    url4x5?: string;
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

// Content Pack
export interface ShotScene {
  sceneNumber: number;
  duration: string;
  camera: string;
  speak: string;
}

export interface ContentPack {
  hooks: string[];
  features: string[];
  shotList: ShotScene[];
  captionStyles: {
    bold: string;
    storytelling: string;
    dataDriven: string;
    casual: string;
    luxury: string;
  };
  platformPosts: {
    instagram: string;
    tiktok: string;
    linkedin: string;
    facebook: string;
    twitter: string;
    youtubeShort: string;
    emailSnippet: string;
  };
  engagementQuestions: string[];
  generatedAt: string;
}

// Per-photo configuration for video generation
export interface PhotoConfig {
  id: string;
  url: string;
  order: number;
  isCover: boolean;
  camera: string;
  intensity: number;
  clipDuration: number;
  enhance: boolean;
  skySrc?: string;
  dayToDusk: boolean;
  brighten: number;
}

// Video theme definition
export interface VideoTheme {
  name: string;
  previewImage: string;
  colorGrade: string;
  transitionType: string;
  transitionDuration: number;
  overlayFont: string;
  overlayColor: string;
  motionDefault: string;
  grainAmount: number;
  vignetteStrength: number;
}

// Full video generation configuration
export interface VideoConfig {
  listingId: string;
  theme: string;
  headline: string;
  customHeadline?: string;
  durationSeconds: number;
  formats: string[];
  includeBranded: boolean;
  includeClean: boolean;
  musicTrackId: string;
  musicVolume: number;
  photos: PhotoConfig[];
}

export const VIDEO_THEMES: VideoTheme[] = [
  { name: "Modern", previewImage: "/themes/modern.jpg", colorGrade: "eq=saturation=1.1:contrast=1.05", transitionType: "fade", transitionDuration: 0.5, overlayFont: "Inter", overlayColor: "#FFFFFF", motionDefault: "dolly", grainAmount: 2, vignetteStrength: 0.3 },
  { name: "Luxury", previewImage: "/themes/luxury.jpg", colorGrade: "eq=saturation=0.9:contrast=1.08:brightness=0.02", transitionType: "fade", transitionDuration: 0.8, overlayFont: "Playfair Display", overlayColor: "#D4AF37", motionDefault: "zoom", grainAmount: 4, vignetteStrength: 0.5 },
  { name: "Energetic", previewImage: "/themes/energetic.jpg", colorGrade: "eq=saturation=1.25:contrast=1.1", transitionType: "slideleft", transitionDuration: 0.3, overlayFont: "Montserrat", overlayColor: "#FF6B35", motionDefault: "horizontal", grainAmount: 1, vignetteStrength: 0.2 },
  { name: "Minimal", previewImage: "/themes/minimal.jpg", colorGrade: "eq=saturation=0.85:contrast=1.02", transitionType: "fade", transitionDuration: 0.6, overlayFont: "DM Sans", overlayColor: "#1A1A1A", motionDefault: "drift", grainAmount: 0, vignetteStrength: 0.1 },
  { name: "Cinematic", previewImage: "/themes/cinematic.jpg", colorGrade: "eq=saturation=1.05:contrast=1.12:brightness=-0.02", transitionType: "fade", transitionDuration: 1.0, overlayFont: "Bebas Neue", overlayColor: "#FFFFFF", motionDefault: "orbital", grainAmount: 6, vignetteStrength: 0.6 },
  { name: "Coastal", previewImage: "/themes/coastal.jpg", colorGrade: "eq=saturation=1.2:contrast=1.0:brightness=0.03", transitionType: "fade", transitionDuration: 0.5, overlayFont: "Raleway", overlayColor: "#0EA5E9", motionDefault: "circle", grainAmount: 2, vignetteStrength: 0.25 },
  { name: "Desert", previewImage: "/themes/desert.jpg", colorGrade: "eq=saturation=0.95:contrast=1.06:brightness=0.01,colorchannelmixer=rr=1.05:gg=0.98:bb=0.92", transitionType: "fade", transitionDuration: 0.7, overlayFont: "Josefin Sans", overlayColor: "#C8A96E", motionDefault: "dolly", grainAmount: 5, vignetteStrength: 0.4 },
  { name: "Urban", previewImage: "/themes/urban.jpg", colorGrade: "eq=saturation=0.8:contrast=1.15:brightness=-0.01", transitionType: "slideleft", transitionDuration: 0.4, overlayFont: "Space Grotesk", overlayColor: "#E2E8F0", motionDefault: "horizontal", grainAmount: 8, vignetteStrength: 0.45 },
];
