-- Levbe database schema
-- Run this entire file in your Supabase SQL editor (supabase.com → your project → SQL Editor → New query)

-- ─────────────────────────────────────────
-- 1. Users (one row per person, linked to auth.users)
-- ─────────────────────────────────────────
create table if not exists public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  avatar_color text default '#FF6B6B'
);

-- ─────────────────────────────────────────
-- 2. Daily quotes
-- ─────────────────────────────────────────
create table if not exists public.daily_quotes (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  author text,
  category text check (category in ('love', 'distance', 'hope', 'ours')) not null default 'love'
);

-- ─────────────────────────────────────────
-- 3. Idea bank
-- ─────────────────────────────────────────
create table if not exists public.idea_bank (
  id uuid default gen_random_uuid() primary key,
  idea_text text not null,
  category text check (category in ('activity', 'question', 'ritual')) not null default 'activity',
  added_by text not null,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- 4. Weekly moments
-- ─────────────────────────────────────────
create table if not exists public.weekly_moments (
  id uuid default gen_random_uuid() primary key,
  week_start_date date not null,
  idea_text text not null,
  proposed_by text not null,
  source text check (source in ('idea_bank', 'freeform')) not null default 'freeform',
  idea_bank_id uuid references public.idea_bank(id),
  date_time timestamptz,
  confirmed boolean default false,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- 5. Visits
-- ─────────────────────────────────────────
create table if not exists public.visits (
  id uuid default gen_random_uuid() primary key,
  status text check (status in ('proposed', 'confirmed')) not null default 'proposed',
  traveler text not null,
  start_date date not null,
  end_date date,
  notes text,
  proposed_by text not null,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- 6. Milestones
-- ─────────────────────────────────────────
create table if not exists public.milestones (
  id uuid default gen_random_uuid() primary key,
  track text check (track in ('wellbeing', 'career_israel', 'germany_prep', 'relationship', 'contingency')) not null,
  title text not null,
  definition_of_done text not null,
  target_date date,
  status text check (status in ('not_started', 'in_progress', 'done')) not null default 'not_started',
  visibility text check (visibility in ('default', 'tucked_away')) not null default 'default',
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- ─────────────────────────────────────────
-- 7. Achievements ("Proud of us")
-- ─────────────────────────────────────────
create table if not exists public.achievements (
  id uuid default gen_random_uuid() primary key,
  author text not null,
  text text not null,
  created_at timestamptz default now(),
  partner_reacted boolean default false
);

-- ─────────────────────────────────────────
-- 8. Check-ins
-- ─────────────────────────────────────────
create table if not exists public.checkins (
  id uuid default gen_random_uuid() primary key,
  author text not null,
  date date not null,
  mood integer check (mood between 1 and 5) not null,
  note text,
  unique(author, date)
);

-- ─────────────────────────────────────────
-- 9. Discussions ("Talk it out")
-- ─────────────────────────────────────────
create table if not exists public.discussions (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  created_by text not null,
  status text check (status in ('open', 'resolved')) not null default 'open',
  entries jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  resolved_at timestamptz
);

-- ─────────────────────────────────────────
-- 10. Notes & doodles
-- ─────────────────────────────────────────
create table if not exists public.notes_and_doodles (
  id uuid default gen_random_uuid() primary key,
  author text not null,
  type text check (type in ('drawing', 'note')) not null,
  content text not null,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- Row Level Security (RLS) — both users can read/write everything
-- ─────────────────────────────────────────
alter table public.users enable row level security;
alter table public.daily_quotes enable row level security;
alter table public.idea_bank enable row level security;
alter table public.weekly_moments enable row level security;
alter table public.visits enable row level security;
alter table public.milestones enable row level security;
alter table public.achievements enable row level security;
alter table public.checkins enable row level security;
alter table public.discussions enable row level security;
alter table public.notes_and_doodles enable row level security;

-- Allow any authenticated user (the two of you) to do everything
create policy "authenticated users can do everything" on public.users for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on public.daily_quotes for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on public.idea_bank for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on public.weekly_moments for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on public.visits for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on public.milestones for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on public.achievements for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on public.checkins for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on public.discussions for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on public.notes_and_doodles for all to authenticated using (true) with check (true);

-- Auto-create user profile when someone signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, avatar_color)
  values (new.id, split_part(new.email, '@', 1), '#FF6B6B')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────
-- Seed data — starter quotes
-- ─────────────────────────────────────────
insert into public.daily_quotes (text, author, category) values
('Distance is just a test to see how far love can travel.', null, 'distance'),
('The pain of parting is nothing to the joy of meeting again.', 'Charles Dickens', 'distance'),
('I exist in two places, here and where you are.', 'Margaret Atwood', 'love'),
('No matter where I am, you are always in my heart.', null, 'love'),
('Absence sharpens love, presence strengthens it.', 'Thomas Fuller', 'distance'),
('The simple lack of her is more to me than others'' presence.', 'Edward Thomas', 'love'),
('Love is not about how many days, months, or years you have been together. It is about how much you love each other every single day.', null, 'love'),
('You are the finest, loveliest, tenderest, and most beautiful person I have ever known.', 'F. Scott Fitzgerald', 'love'),
('Wherever you are, you will always be in my heart.', 'Mahatma Gandhi', 'love'),
('I carry your heart with me. I carry it in my heart.', 'e.e. cummings', 'love'),
('The art of love is largely the art of persistence.', 'Albert Ellis', 'love'),
('Your absence has not taught me how to be alone. It has merely shown me that when together we cast a single shadow on the wall.', 'Doug Fetherling', 'distance'),
('I think about you constantly, whether it''s with my mind or my heart.', 'Albany Bach Reid', 'love'),
('Even the moon is envious of how beautiful you are.', null, 'love'),
('If you have to go somewhere I can''t follow, I''ll watch for you in the moonlight.', null, 'distance'),
('Every moment of light and dark is a miracle.', 'Walt Whitman', 'hope'),
('The hours I spend with you I look upon as sort of a perfumed garden.', 'Robert Graves', 'love'),
('Home is wherever you are.', null, 'love'),
('The best thing to hold onto in life is each other.', 'Audrey Hepburn', 'love'),
('We loved with a love that was more than love.', 'Edgar Allan Poe', 'love'),
('You''ve got a heart like the sun — it warms everyone around you.', null, 'ours'),
('Every time I think of you, I know it will be okay.', null, 'hope'),
('Missing someone gets easier every day because even though it''s one day further from the last time you saw each other, it''s one day closer to the next time you will.', null, 'distance'),
('Love is not finding someone to live with; it''s finding someone you can''t imagine living without.', 'Rafael Ortiz', 'love'),
('Some things transcend distance.', null, 'distance'),
('You are my today and all of my tomorrows.', 'Leo Christopher', 'love'),
('In case you ever foolishly forget: I am never not thinking of you.', 'Virginia Woolf', 'love'),
('I saw that you were perfect, and so I loved you. Then I saw that you were not perfect and I loved you even more.', 'Angelita Lim', 'love'),
('The most important thing in the world is family and love.', 'John Wooden', 'love'),
('Love is composed of a single soul inhabiting two bodies.', 'Aristotle', 'love')
on conflict do nothing;

-- ─────────────────────────────────────────
-- Seed data — starter idea bank
-- ─────────────────────────────────────────
insert into public.idea_bank (idea_text, category, added_by) values
('Cook the same recipe at the same time on a video call, eat together', 'activity', 'system'),
('Watch a film in sync — timed start, voice notes reaction after', 'activity', 'system'),
('Each send 3 photos of your day with zero context, other has to guess the story', 'activity', 'system'),
('Take turns picking a song that describes your week, share without explanation first', 'ritual', 'system'),
('Both draw the same prompt (e.g. "draw your mood today") in Notes & doodles, compare', 'activity', 'system'),
('Plan a remote "date night" outfit — get dressed up for a call like a real date', 'ritual', 'system'),
('Read the same book, voice-note your thoughts as you go', 'activity', 'system'),
('Mail an actual physical letter', 'ritual', 'system'),
('Voice note: narrate the next 2 minutes of your actual day, no editing', 'ritual', 'system'),
('Send a photo of whatever is directly in front of you right now', 'ritual', 'system'),
('What''s something about this distance that''s been harder than you expected?', 'question', 'system'),
('What''s a small thing I did recently that made you feel loved?', 'question', 'system'),
('What does a normal Tuesday look like for us once we live together?', 'question', 'system'),
('What''s one thing about your city / your life there you want me to understand better?', 'question', 'system'),
('What''s something you''re proud of yourself for this week that you haven''t said out loud?', 'question', 'system'),
('If you could teleport to be with me for one hour right now, what would we do?', 'question', 'system'),
('What''s a habit or small ritual you''d like us to share once we live together?', 'question', 'system'),
('Tell me about the last time you laughed really hard — what happened?', 'question', 'system')
on conflict do nothing;
