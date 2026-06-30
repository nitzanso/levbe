-- Levbe — Tasks feature schema additions
-- Run this in your Supabase SQL editor AFTER running supabase-schema.sql

-- ─────────────────────────────────────────
-- 1. Add email column to users table
--    (needed so the task assignee picker knows the partner's email)
-- ─────────────────────────────────────────
alter table public.users add column if not exists email text;

-- Update the trigger to also store email going forward
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, avatar_color, email)
  values (new.id, split_part(new.email, '@', 1), '#FF6B6B', new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

-- Backfill email for any existing users (runs as superuser so auth.users is accessible)
update public.users u
set email = au.email
from auth.users au
where u.id = au.id
  and u.email is null;

-- ─────────────────────────────────────────
-- 2. Tasks table
-- ─────────────────────────────────────────
create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  status text check (status in ('backlog', 'todo', 'in_progress', 'done')) not null default 'todo',
  assignee text,           -- email of the assigned person, nullable
  due_date date,
  tags text[] not null default '{}',
  depends_on uuid[] not null default '{}',   -- array of task ids this task is blocked by
  created_by text not null,                  -- email
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- 3. Task comments
-- ─────────────────────────────────────────
create table if not exists public.task_comments (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  author text not null,   -- email
  text text not null,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────
-- 4. Row Level Security
-- ─────────────────────────────────────────
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;

create policy "authenticated users can do everything" on public.tasks
  for all to authenticated using (true) with check (true);

create policy "authenticated users can do everything" on public.task_comments
  for all to authenticated using (true) with check (true);

-- ─────────────────────────────────────────
-- 5. Auto-update updated_at on task changes
-- ─────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();
