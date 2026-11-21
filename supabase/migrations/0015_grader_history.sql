-- BrainWave — "Grade my answer" history on every device.
-- Run after 0014_study_groups.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.
-- One row per question (task); its attempts (answer + grade) are kept together.

create table if not exists public.grader_tasks (
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  task_id    text not null check (char_length(task_id) <= 32),
  question   text not null check (char_length(question) <= 8000),
  rubric     text not null default '' check (char_length(rubric) <= 4000),
  attempts   jsonb not null default '[]'::jsonb check (jsonb_typeof(attempts) = 'array' and octet_length(attempts::text) < 200000),
  updated_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

create index if not exists grader_tasks_recent on public.grader_tasks (user_id, updated_at desc);

alter table public.grader_tasks enable row level security;

drop policy if exists "grader tasks: own" on public.grader_tasks;
create policy "grader tasks: own" on public.grader_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
