-- Add id to checkins if it doesn't exist yet
ALTER TABLE public.checkins ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- reactions table
CREATE TABLE IF NOT EXISTS public.reactions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  author       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type  text NOT NULL CHECK (entity_type IN ('photo', 'note', 'achievement', 'checkin')),
  entity_id    uuid NOT NULL,
  emoji        text NOT NULL,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(author, entity_type, entity_id, emoji)
);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reactions_select" ON public.reactions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "reactions_insert" ON public.reactions
  FOR INSERT WITH CHECK (auth.uid() = author);

CREATE POLICY "reactions_delete" ON public.reactions
  FOR DELETE USING (auth.uid() = author);

-- comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  author       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type  text NOT NULL CHECK (entity_type IN ('photo', 'note', 'achievement', 'checkin')),
  entity_id    uuid NOT NULL,
  text         text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select" ON public.comments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = author);
