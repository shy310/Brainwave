-- BrainWave — deadlines (assignments, quizzes, projects), e.g. from a syllabus.
-- Run after 0028_exam_predictions.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.

create table if not exists public.deadlines (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title      text not null check (char_length(title) between 1 and 160),
  due_date   date not null,
  kind       text not null default 'assignment' check (kind in ('assignment', 'quiz', 'project', 'other')),
  course     text check (course is null or char_length(course) <= 120),
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists deadlines_by_user on public.deadlines (user_id, due_date);

alter table public.deadlines enable row level security;

drop policy if exists "deadlines: own" on public.deadlines;
create policy "deadlines: own" on public.deadlines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
