-- BrainWave v2 — lectures (transcripts, notes, quizzes, flashcards).
-- Run after 0002_learning.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.
-- Audio is never stored: the browser sends it for transcription in one-minute pieces.

create table if not exists public.lectures (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title        text not null default '' check (char_length(title) <= 200),
  source       text not null check (source in ('record', 'upload', 'text')),
  language     text not null default 'auto' check (language in ('auto', 'en', 'he')),
  status       text not null default 'transcribing' check (status in ('transcribing', 'ready', 'error')),
  duration_sec integer not null default 0 check (duration_sec >= 0),
  segments     jsonb not null default '[]'::jsonb,
  slides_text  text check (char_length(slides_text) <= 60000),
  notes        jsonb,
  quiz         jsonb,
  flashcards   jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists lectures_by_user on public.lectures (user_id, created_at desc);

alter table public.lectures enable row level security;

drop policy if exists "lectures: read own" on public.lectures;
create policy "lectures: read own" on public.lectures
  for select using (auth.uid() = user_id);

drop policy if exists "lectures: insert own" on public.lectures;
create policy "lectures: insert own" on public.lectures
  for insert with check (auth.uid() = user_id);

drop policy if exists "lectures: update own" on public.lectures;
create policy "lectures: update own" on public.lectures
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "lectures: delete own" on public.lectures;
create policy "lectures: delete own" on public.lectures
  for delete using (auth.uid() = user_id);
