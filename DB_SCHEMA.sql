-- ListingOS Database Schema
-- Run in Supabase SQL editor in order

-- ============================================
-- EXTENSIONS
-- ============================================
create extension if not exists "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Users (extends Supabase auth.users)
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  plan text not null default 'trial', -- trial | solo | agent
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  subscription_status text default 'trialing', -- trialing | active | canceled | past_due
  trial_ends_at timestamptz default (now() + interval '7 days'),
  listings_used_this_month int not null default 0,
  listings_reset_at timestamptz default date_trunc('month', now()) + interval '1 month',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Brand Kits
create table public.brand_kits (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  logo_url text,
  primary_color text default '#1A2E4A',
  accent_color text default '#F5A623',
  font text default 'Inter',
  agent_name text,
  license_number text,
  brokerage text,
  phone text,
  headshot_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on public.brand_kits(user_id);

-- Music Tracks (global, not per-user)
create table public.music_tracks (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  genre text not null, -- modern | luxury | upbeat | calm | bold
  file_path text not null, -- /public/music/track-name.mp3
  duration_seconds int not null,
  bpm int,
  display_order int not null default 0
);

-- Listings
create table public.listings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  slug text unique not null, -- for /l/[slug] public page
  address text,
  city text,
  state text,
  zip text,
  price int,
  beds numeric(4,1),
  baths numeric(4,1),
  sqft int,
  raw_description text,
  source_url text, -- original Zillow/Redfin URL
  photos jsonb default '[]', -- array of { url, order, is_cover }
  description_mls text,
  description_social text,
  description_luxury text,
  caption_instagram text,
  caption_tiktok text,
  caption_facebook text,
  fair_housing_passed boolean,
  fair_housing_flags jsonb,
  view_count int default 0,
  lead_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on public.listings(user_id);
create index on public.listings(slug);
create index on public.listings(created_at desc);

-- Video Jobs (async job tracking)
create table public.video_jobs (
  id uuid default uuid_generate_v4() primary key,
  listing_id uuid references public.listings(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  status text not null default 'queued', -- queued | processing | complete | failed
  style text not null default 'modern',
  duration_seconds int not null default 30,
  music_track_id uuid references public.music_tracks(id),
  include_neighborhood_broll boolean default true,
  progress_step text, -- "Rendering clips..." etc for UI
  progress_percent int default 0,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on public.video_jobs(listing_id);
create index on public.video_jobs(user_id);
create index on public.video_jobs(status);

-- Videos (completed outputs)
create table public.videos (
  id uuid default uuid_generate_v4() primary key,
  job_id uuid references public.video_jobs(id) on delete cascade not null,
  listing_id uuid references public.listings(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  url_16x9 text, -- R2 signed URL base path
  url_9x16 text,
  thumbnail_url text,
  duration_seconds int,
  file_size_bytes int,
  is_watermarked boolean default false,
  download_count int default 0,
  created_at timestamptz default now()
);
create index on public.videos(listing_id);
create index on public.videos(user_id);

-- Leads (from public listing pages)
create table public.leads (
  id uuid default uuid_generate_v4() primary key,
  listing_id uuid references public.listings(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  name text,
  email text,
  phone text,
  message text,
  source text default 'listing_page',
  created_at timestamptz default now()
);
create index on public.leads(listing_id);
create index on public.leads(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table public.users enable row level security;
alter table public.brand_kits enable row level security;
alter table public.listings enable row level security;
alter table public.video_jobs enable row level security;
alter table public.videos enable row level security;
alter table public.leads enable row level security;
-- music_tracks: no RLS (public read)

-- Users policies
create policy "users: own row only"
  on public.users for all
  using (auth.uid() = id);

-- Brand kit policies
create policy "brand_kits: own rows only"
  on public.brand_kits for all
  using (auth.uid() = user_id);

-- Listings policies
create policy "listings: own rows only"
  on public.listings for all
  using (auth.uid() = user_id);

create policy "listings: public can read by slug"
  on public.listings for select
  using (true); -- public listing pages need this

-- Video jobs policies
create policy "video_jobs: own rows only"
  on public.video_jobs for all
  using (auth.uid() = user_id);

-- Videos policies
create policy "videos: own rows only"
  on public.videos for all
  using (auth.uid() = user_id);

-- Leads policies
create policy "leads: agent can read own listing leads"
  on public.leads for select
  using (auth.uid() = user_id);

create policy "leads: anyone can insert"
  on public.leads for insert
  with check (true);

-- Music tracks (public read)
create policy "music_tracks: public read"
  on public.music_tracks for select
  using (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at before update on public.users
  for each row execute function update_updated_at();
create trigger brand_kits_updated_at before update on public.brand_kits
  for each row execute function update_updated_at();
create trigger listings_updated_at before update on public.listings
  for each row execute function update_updated_at();
create trigger video_jobs_updated_at before update on public.video_jobs
  for each row execute function update_updated_at();

-- Create user row on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Atomic credit check + deduct
create or replace function check_and_deduct_credit(p_user_id uuid)
returns boolean as $$
declare
  v_plan text;
  v_used int;
  v_limit int;
begin
  select plan, listings_used_this_month
  into v_plan, v_used
  from public.users
  where id = p_user_id
  for update; -- lock row

  -- Set limit by plan
  v_limit := case v_plan
    when 'trial' then 1
    when 'solo'  then 3
    when 'agent' then 10
    else 0
  end;

  if v_used >= v_limit then
    return false; -- no credits
  end if;

  update public.users
  set listings_used_this_month = listings_used_this_month + 1
  where id = p_user_id;

  return true;
end;
$$ language plpgsql security definer;

-- ============================================
-- SEED DATA — Music Tracks
-- ============================================

insert into public.music_tracks (name, genre, file_path, duration_seconds, bpm, display_order) values
  ('Modern Drift',     'modern',  '/music/modern-drift.mp3',     180, 98,  1),
  ('Clean Lines',      'modern',  '/music/clean-lines.mp3',      180, 104, 2),
  ('Golden Hour',      'luxury',  '/music/golden-hour.mp3',      180, 72,  3),
  ('Estate',           'luxury',  '/music/estate.mp3',           180, 68,  4),
  ('Coastal Light',    'luxury',  '/music/coastal-light.mp3',    180, 76,  5),
  ('Upbeat Close',     'upbeat',  '/music/upbeat-close.mp3',     180, 118, 6),
  ('New Keys',         'upbeat',  '/music/new-keys.mp3',         180, 122, 7),
  ('Fresh Start',      'upbeat',  '/music/fresh-start.mp3',      180, 115, 8),
  ('Quiet Streets',    'calm',    '/music/quiet-streets.mp3',    180, 64,  9),
  ('Sunday Morning',   'calm',    '/music/sunday-morning.mp3',   180, 60,  10),
  ('Still Water',      'calm',    '/music/still-water.mp3',      180, 58,  11),
  ('Minimal House',    'modern',  '/music/minimal-house.mp3',    180, 108, 12),
  ('Open Plan',        'modern',  '/music/open-plan.mp3',        180, 96,  13),
  ('Penthouse',        'luxury',  '/music/penthouse.mp3',        180, 70,  14),
  ('Grand Entry',      'bold',    '/music/grand-entry.mp3',      180, 130, 15),
  ('New Build',        'bold',    '/music/new-build.mp3',        180, 128, 16),
  ('Market Ready',     'upbeat',  '/music/market-ready.mp3',     180, 120, 17),
  ('Foundation',       'bold',    '/music/foundation.mp3',       180, 125, 18),
  ('Neighborhood',     'calm',    '/music/neighborhood.mp3',     180, 66,  19),
  ('Final Walk',       'calm',    '/music/final-walk.mp3',       180, 62,  20);
