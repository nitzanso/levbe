-- Levbe notifications migration
-- Run this in Supabase SQL Editor after the main supabase-schema.sql

-- ─────────────────────────────────────────
-- 1. Add email + last_seen_at to users table
-- ─────────────────────────────────────────

alter table public.users add column if not exists email text;
alter table public.users add column if not exists last_seen_at timestamptz;

-- Backfill email from auth.users for existing rows
update public.users u
set email = a.email
from auth.users a
where u.id = a.id;

-- Update the new-user trigger to also save email
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, email, avatar_color)
  values (new.id, split_part(new.email, '@', 1), new.email, '#FF6B6B')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────
-- 2. notification_log table
-- ─────────────────────────────────────────

create table if not exists public.notification_log (
  id uuid default gen_random_uuid() primary key,
  recipient_email text not null,
  sender_email text,
  type text check (type in ('activity', 'daily_nudge', 'ping')) not null,
  sent_at timestamptz default now(),
  related_entity text  -- e.g. 'photo:uuid', 'note:uuid', 'achievement:uuid'
);

alter table public.notification_log enable row level security;
create policy "authenticated users can do everything" on public.notification_log
  for all to authenticated using (true) with check (true);
