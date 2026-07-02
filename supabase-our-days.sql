-- Run this in the Supabase SQL Editor

-- ── day_entries table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.day_entries (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date         date NOT NULL,
  author       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('highlight', 'photo', 'doodle', 'proud', 'mood')),
  text         text,
  image_url    text,
  drawing_data text,
  mood_emoji   text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS day_entries_date_idx ON public.day_entries (date DESC);

ALTER TABLE public.day_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.day_entries REPLICA IDENTITY FULL;

-- Both users can read all entries
CREATE POLICY "day_entries_select" ON public.day_entries
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only the author can insert their own entry
CREATE POLICY "day_entries_insert" ON public.day_entries
  FOR INSERT WITH CHECK (auth.uid() = author);

-- Only the author can update/delete
CREATE POLICY "day_entries_update" ON public.day_entries
  FOR UPDATE USING (auth.uid() = author);

CREATE POLICY "day_entries_delete" ON public.day_entries
  FOR DELETE USING (auth.uid() = author);

-- Enable realtime so the partner sees new entries instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.day_entries;

-- ── Migration: bring existing data into day_entries ───────────────────────────
-- Run AFTER the table is created.
-- author fields in old tables store email strings — look up auth UUID via users table.

-- Mood check-ins → 'mood' entries
INSERT INTO public.day_entries (date, author, type, mood_emoji, text, created_at)
SELECT
  c.date,
  u.id,
  'mood',
  CASE c.mood
    WHEN 1 THEN '😔'
    WHEN 2 THEN '😕'
    WHEN 3 THEN '😐'
    WHEN 4 THEN '🙂'
    ELSE '😊'
  END,
  c.note,
  COALESCE(c.date::timestamptz, now())
FROM public.checkins c
JOIN public.users u ON u.email = c.author
ON CONFLICT DO NOTHING;

-- Text notes → 'highlight' entries
INSERT INTO public.day_entries (date, author, type, text, created_at)
SELECT
  n.created_at::date,
  u.id,
  'highlight',
  n.content,
  n.created_at
FROM public.notes_and_doodles n
JOIN public.users u ON u.email = n.author
WHERE n.type = 'note'
ON CONFLICT DO NOTHING;

-- Drawings → 'doodle' entries
INSERT INTO public.day_entries (date, author, type, drawing_data, created_at)
SELECT
  n.created_at::date,
  u.id,
  'doodle',
  n.content,
  n.created_at
FROM public.notes_and_doodles n
JOIN public.users u ON u.email = n.author
WHERE n.type = 'drawing'
ON CONFLICT DO NOTHING;

-- Achievements → 'proud' entries
INSERT INTO public.day_entries (date, author, type, text, created_at)
SELECT
  a.created_at::date,
  u.id,
  'proud',
  a.text,
  a.created_at
FROM public.achievements a
JOIN public.users u ON u.email = a.author
ON CONFLICT DO NOTHING;

-- Revealed photos → 'photo' entries (image_url stores the storage path)
INSERT INTO public.day_entries (date, author, type, image_url, text, created_at)
SELECT
  COALESCE(p.revealed_at::date, p.created_at::date),
  u.id,
  'photo',
  p.image_path,
  p.caption,
  p.created_at
FROM public.photos p
JOIN public.users u ON u.email = p.author
WHERE p.status = 'revealed'
ON CONFLICT DO NOTHING;
