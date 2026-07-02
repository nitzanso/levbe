-- Run this in the Supabase SQL Editor
-- Safe to re-run — uses IF NOT EXISTS

-- ── reactions table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reactions (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  author      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text        NOT NULL,
  entity_id   text        NOT NULL,  -- stored as text so it works for any id type
  emoji       text        NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(author, entity_type, entity_id, emoji)
);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "reactions_select" ON public.reactions;
DROP POLICY IF EXISTS "reactions_insert" ON public.reactions;
DROP POLICY IF EXISTS "reactions_delete" ON public.reactions;

CREATE POLICY "reactions_select" ON public.reactions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "reactions_insert" ON public.reactions
  FOR INSERT WITH CHECK (auth.uid() = author);

CREATE POLICY "reactions_delete" ON public.reactions
  FOR DELETE USING (auth.uid() = author);

ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;

-- ── comments table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.comments (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  author      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type text        NOT NULL,
  entity_id   text        NOT NULL,
  text        text        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "comments_select" ON public.comments;
DROP POLICY IF EXISTS "comments_insert" ON public.comments;

CREATE POLICY "comments_select" ON public.comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = author);

ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
