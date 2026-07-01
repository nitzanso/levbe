-- Run this in the Supabase SQL Editor

-- ── Recurring Events ──────────────────────────────────────────────────────────
-- days_of_week uses JS day numbers: 0=Sunday, 1=Monday … 6=Saturday
CREATE TABLE IF NOT EXISTS public.recurring_events (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title        text NOT NULL,
  description  text,
  recurrence   text NOT NULL DEFAULT 'daily'
                 CHECK (recurrence IN ('daily', 'weekly', 'custom')),
  days_of_week int[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  time         text,                -- e.g. '20:00'
  color        text NOT NULL DEFAULT '#FF6B6B',
  active       boolean NOT NULL DEFAULT true,
  created_by   text NOT NULL,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.recurring_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "re_select" ON public.recurring_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "re_insert" ON public.recurring_events
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "re_update" ON public.recurring_events
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "re_delete" ON public.recurring_events
  FOR DELETE USING (auth.role() = 'authenticated');

-- Seed: daily evening video call
INSERT INTO public.recurring_events (title, description, recurrence, days_of_week, time, color, active, created_by)
SELECT
  'Evening video call 📞',
  'Our daily call — the highlight of the day',
  'daily',
  '{0,1,2,3,4,5,6}',
  '20:00',
  '#4ECDC4',
  true,
  email
FROM auth.users
LIMIT 1
ON CONFLICT DO NOTHING;

-- ── One-off Events ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.one_off_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text NOT NULL,
  date        date NOT NULL,
  time        text,
  color       text NOT NULL DEFAULT '#FF6B6B',
  notes       text,
  created_by  text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.one_off_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ooe_select" ON public.one_off_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "ooe_insert" ON public.one_off_events
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "ooe_update" ON public.one_off_events
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "ooe_delete" ON public.one_off_events
  FOR DELETE USING (auth.role() = 'authenticated');
