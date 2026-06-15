-- Enable pgcrypto for token generation
create extension if not exists pgcrypto;

-- Templates
create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_image_url text not null,
  default_stickers jsonb default '[]'
);

-- Gifts
create table if not exists gifts (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references templates(id),
  status text not null default 'draft'
    check (status in ('draft', 'collecting', 'sent', 'opened')),
  recipient_name text,
  creator_name text,
  note text,
  recipient_token text unique not null default encode(gen_random_bytes(16), 'hex'),
  contributor_token text unique not null default encode(gen_random_bytes(16), 'hex'),
  dashboard_token text unique not null default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz default now(),
  auto_finalize_at timestamptz default now() + interval '14 days'
);

-- Frames
create table if not exists frames (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid references gifts(id) on delete cascade not null,
  order_index integer not null,
  snapshot_url text,
  contributor_id text not null,
  created_at timestamptz default now()
);

-- Contributions (layer data)
create table if not exists contributions (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid references gifts(id) on delete cascade not null,
  frame_id uuid references frames(id) on delete cascade not null,
  contributor_id text not null,
  layers_json jsonb not null default '[]'
);

-- Sticker pool
create table if not exists sticker_pool (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references templates(id),
  image_url text not null,
  category text not null,
  weight integer default 1
);

-- Rendered GIFs cache
create table if not exists rendered_gifs (
  gift_id uuid primary key references gifts(id) on delete cascade,
  gif_url text not null,
  rendered_at timestamptz default now(),
  frame_count integer
);

-- Indexes
create index if not exists idx_gifts_contributor_token on gifts(contributor_token);
create index if not exists idx_gifts_recipient_token on gifts(recipient_token);
create index if not exists idx_gifts_dashboard_token on gifts(dashboard_token);
create index if not exists idx_frames_gift_id on frames(gift_id);
create index if not exists idx_contributions_frame_id on contributions(frame_id);

-- =====================
-- Row Level Security
-- =====================

alter table gifts enable row level security;
alter table frames enable row level security;
alter table contributions enable row level security;
alter table sticker_pool enable row level security;
alter table templates enable row level security;
alter table rendered_gifs enable row level security;

-- Templates: public read
create policy "templates_public_read" on templates for select using (true);

-- Sticker pool: public read
create policy "sticker_pool_public_read" on sticker_pool for select using (true);

-- Gifts: read by service role only (API routes use service key)
-- Frames: read/insert by service role only
-- All writes go through API routes (service key bypasses RLS)

-- =====================
-- Storage buckets
-- =====================
-- Run these via Supabase dashboard or CLI:
--
-- insert into storage.buckets (id, name, public) values ('frames', 'frames', true);
-- insert into storage.buckets (id, name, public) values ('stickers', 'stickers', true);
