-- LOS-003: All new columns for ListingOS features
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new

-- 1. Add content_pack to listings
alter table public.listings
  add column if not exists content_pack jsonb;

-- 2. Add referral columns to users
alter table public.users
  add column if not exists referral_code text unique,
  add column if not exists referred_by text;

-- 3. Add voice_profile to brand_kits
alter table public.brand_kits
  add column if not exists voice_profile text;

-- 4. Add multi-format + GIF + thumbnail selector to videos
alter table public.videos
  add column if not exists url_1x1 text,
  add column if not exists url_4x5 text,
  add column if not exists gif_url text,
  add column if not exists selector_thumbnails jsonb;

-- 4. Auto-generate referral codes for existing users (8-char alphanumeric)
update public.users
  set referral_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  where referral_code is null;

-- 5. Make referral_code non-null going forward via trigger
create or replace function public.handle_new_user_referral()
returns trigger language plpgsql security definer as $$
begin
  if new.referral_code is null then
    new.referral_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  end if;
  return new;
end;
$$;

drop trigger if exists on_user_created_set_referral on public.users;
create trigger on_user_created_set_referral
  before insert on public.users
  for each row execute procedure public.handle_new_user_referral();

-- 6. Index for referral lookups
create index if not exists idx_users_referral_code on public.users(referral_code);
create index if not exists idx_users_referred_by on public.users(referred_by);
