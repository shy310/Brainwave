-- BrainWave v2 — learning progress.
-- Run after 0001_foundation.sql (Supabase → SQL Editor → paste → Run).

create table if not exists public.topic_progress (
  user_id       uuid not null references auth.users (id) on delete cascade,
  topic_id      text not null check (char_length(topic_id) <= 60),
  lesson_done   boolean not null default false,
  quiz_attempts integer not null default 0 check (quiz_attempts >= 0),
  best_score    integer not null default 0 check (best_score between 0 and 100),
  last_score    integer check (last_score between 0 and 100),
  practiced     integer not null default 0 check (practiced >= 0),
  updated_at    timestamptz not null default now(),
  primary key (user_id, topic_id)
);

create index if not exists topic_progress_recent on public.topic_progress (user_id, updated_at desc);

alter table public.topic_progress enable row level security;

drop policy if exists "progress: read own" on public.topic_progress;
create policy "progress: read own" on public.topic_progress
  for select using (auth.uid() = user_id);

drop policy if exists "progress: insert own" on public.topic_progress;
create policy "progress: insert own" on public.topic_progress
  for insert with check (auth.uid() = user_id);

drop policy if exists "progress: update own" on public.topic_progress;
create policy "progress: update own" on public.topic_progress
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "progress: delete own" on public.topic_progress;
create policy "progress: delete own" on public.topic_progress
  for delete using (auth.uid() = user_id);
