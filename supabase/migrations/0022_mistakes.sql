-- BrainWave — weak spots.
-- Run after 0021_lecture_marks.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.
-- Questions a student got wrong, kept until they get them right twice in a row.

create table if not exists public.mistakes (
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  key        text not null check (char_length(key) between 1 and 80),
  lecture_id uuid references public.lectures (id) on delete cascade,
  question   jsonb not null,
  wrong      integer not null default 1 check (wrong >= 0),
  streak     integer not null default 0 check (streak >= 0),
  last_wrong timestamptz not null default now(),
  resolved   boolean not null default false,
  primary key (user_id, key)
);

create index if not exists mistakes_open on public.mistakes (user_id) where not resolved;

alter table public.mistakes enable row level security;

drop policy if exists "mistakes: own" on public.mistakes;
create policy "mistakes: own" on public.mistakes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
