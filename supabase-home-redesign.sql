-- Run this in the Supabase SQL Editor

-- ── Dreams Bucket List ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dreams (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  author     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text       text NOT NULL,
  done       boolean NOT NULL DEFAULT false,
  done_at    timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.dreams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dreams_select" ON public.dreams FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "dreams_insert" ON public.dreams FOR INSERT WITH CHECK (auth.uid() = author);
CREATE POLICY "dreams_update" ON public.dreams FOR UPDATE USING (auth.uid() = author);
CREATE POLICY "dreams_delete" ON public.dreams FOR DELETE USING (auth.uid() = author);

-- ── Daily Ideas ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_ideas (
  id         serial PRIMARY KEY,
  text       text NOT NULL
);
ALTER TABLE public.daily_ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_ideas_select" ON public.daily_ideas FOR SELECT USING (auth.role() = 'authenticated');

-- Seed 35 daily ideas
INSERT INTO public.daily_ideas (text) VALUES
  ('Send each other a voice memo instead of a text today'),
  ('Screenshot a meme that made you think of them and send it'),
  ('Plan a future restaurant you both want to try — research the menu together'),
  ('Watch the same episode of a show at the same time and react over text'),
  ('Make a collaborative Spotify playlist — each add 5 songs'),
  ('Write down one thing about them that surprised you when you first met'),
  ('Send a photo of what you can see from where you''re sitting right now'),
  ('Plan a dream trip — pick a destination and find 3 things to do there'),
  ('Send them a song lyric that describes how you feel today'),
  ('Do a 10-minute video call just to have a drink together'),
  ('Write them a list: 5 small reasons you love them today'),
  ('Pick a question from a "36 questions to fall in love" list and answer it for them'),
  ('Send a throwback photo — something from before you met'),
  ('Plan your next visit: one must-do activity, one restaurant, one cozy night in'),
  ('Tell them about a moment from your day where you thought of them'),
  ('Find a short podcast episode you both might like and share the link'),
  ('Send a photo of something in your city that you want to show them in person one day'),
  ('Write down a memory from your last visit that made you smile'),
  ('Look up a new recipe and cook the same dish separately — compare results'),
  ('Send them your honest answer to: what''s one thing worrying you this week?'),
  ('Pick a book you''d love to read together and suggest a start date'),
  ('Plan a virtual movie night — same film, separate couches'),
  ('Find a funny YouTube video and watch it "together" over text'),
  ('Tell them something they do that you notice and appreciate but rarely say out loud'),
  ('Share your current desktop or phone wallpaper — and the story behind it'),
  ('Play an online game together — even just 10 minutes of Wordle or chess'),
  ('Send a list of 3 things you want to do together on your next visit'),
  ('Find a photo that represents your dream home — share and discuss'),
  ('Tell them about a skill you want to learn this year'),
  ('Send a voice note describing your current vibe in 30 seconds'),
  ('Look up a new café or park near them and tell them to visit it for you'),
  ('Answer this together: what''s your happiest recent memory as a couple?'),
  ('Make a shared note called "Things I Want To Tell You In Person"'),
  ('Send a selfie — no filter, whatever you look like right now'),
  ('Write them a proper letter. No bullet points. Just feelings.')
ON CONFLICT DO NOTHING;

-- ── Weekly Highlights ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weekly_highlights (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  author     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text       text NOT NULL,
  week_start date NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.weekly_highlights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wh_select" ON public.weekly_highlights FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "wh_insert" ON public.weekly_highlights FOR INSERT WITH CHECK (auth.uid() = author);
CREATE POLICY "wh_delete" ON public.weekly_highlights FOR DELETE USING (auth.uid() = author);

-- ── User Background Photos ───────────────────────────────────────────────────
-- Add background_url column to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS background_url text;
