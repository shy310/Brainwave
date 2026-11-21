-- BrainWave — exam mode.
-- Run after 0019_lecture_favorites.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.
-- An exam: its date and which lectures it covers (a folder, or picked lectures),
-- plus the best practice-exam score so far.

create table if not exists public.exams (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title       text not null check (char_length(title) between 1 and 120),
  exam_date   date not null,
  folder_id   uuid references public.lecture_folders (id) on delete set null,
  lecture_ids uuid[] not null default '{}',
  best_score  smallint check (best_score between 0 and 100),
  attempts    integer not null default 0 check (attempts >= 0),
  created_at  timestamptz not null default now()
);

create index if not exists exams_by_user on public.exams (user_id, exam_date);

alter table public.exams enable row level security;

drop policy if exists "exams: own" on public.exams;
create policy "exams: own" on public.exams
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
