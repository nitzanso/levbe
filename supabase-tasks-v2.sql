-- Run this in the Supabase SQL Editor.
-- Adds priority column + task_activity table for the Jira-equivalent task board.
-- Safe to re-run.

-- 1. Add priority column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority text DEFAULT 'medium';

-- Add or replace the CHECK constraint (drop first to be safe)
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_priority_check
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Backfill any NULL priority values
UPDATE public.tasks SET priority = 'medium' WHERE priority IS NULL;

-- 2. Create task_activity table
CREATE TABLE IF NOT EXISTS public.task_activity (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id     uuid        REFERENCES public.tasks(id) ON DELETE CASCADE,
  author      uuid        REFERENCES auth.users(id),
  action_type text        NOT NULL,
  old_value   text,
  new_value   text,
  created_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ta_select" ON public.task_activity;
DROP POLICY IF EXISTS "ta_insert" ON public.task_activity;

CREATE POLICY "ta_select" ON public.task_activity
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "ta_insert" ON public.task_activity
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
