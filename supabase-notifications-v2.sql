-- Run this in the Supabase SQL Editor

-- ── Notifications table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN (
                'photo','drawing','note','achievement',
                'comment','reaction','ping','daily_nudge',
                'task_comment','dream_added'
              )),
  entity_type text,    -- 'photo' | 'note' | 'achievement' | 'task' | 'dream'
  entity_id   text,    -- id of the related row (as text for flexibility)
  message     text NOT NULL,
  read        boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Only the recipient can read their own notifications
CREATE POLICY "n_select" ON public.notifications
  FOR SELECT USING (auth.uid() = recipient);

-- Any authenticated user can insert (the sender inserts for the partner)
CREATE POLICY "n_insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Only the recipient can mark as read
CREATE POLICY "n_update" ON public.notifications
  FOR UPDATE USING (auth.uid() = recipient);

CREATE POLICY "n_delete" ON public.notifications
  FOR DELETE USING (auth.uid() = recipient);

-- Enable realtime for live bell updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
