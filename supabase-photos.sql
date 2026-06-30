-- Levbe — Photos feature schema
-- Run this in your Supabase SQL editor AFTER running supabase-schema.sql and supabase-tasks.sql

-- ─────────────────────────────────────────
-- 1. Photos table
-- ─────────────────────────────────────────
create table if not exists public.photos (
  id uuid default gen_random_uuid() primary key,
  author text not null,                -- email of the sender
  image_path text not null,            -- path in Supabase Storage bucket "photos"
  caption text,
  status text check (status in ('pending', 'revealed')) not null default 'pending',
  tag text check (tag in ('achievement', 'moment', 'everyday')),
  created_at timestamptz default now(),
  revealed_at timestamptz
);

-- ─────────────────────────────────────────
-- 2. Row Level Security
-- ─────────────────────────────────────────
alter table public.photos enable row level security;

create policy "authenticated users can do everything" on public.photos
  for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────
-- 3. Storage bucket
--    Creates a public bucket called "photos"
-- ─────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos',
  'photos',
  true,
  10485760,   -- 10 MB limit per file
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- Storage RLS: only authenticated users can upload or read
create policy "Authenticated users can upload photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'photos');

create policy "Authenticated users can view all photos"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'photos');

create policy "Authors can delete their own photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
