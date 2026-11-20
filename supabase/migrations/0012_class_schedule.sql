-- BrainWave — Phase 4C: weekly class schedule for recording reminders.
-- Run after 0011_study_activity.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.

create table if not exists public.class_slots (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name           text not null check (char_length(name) between 1 and 80),
  weekday        smallint not null check (weekday between 0 and 6),
  starts         text not null check (starts ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ends           text not null check (ends ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  folder_id      uuid references public.lecture_folders (id) on delete set null,
  remind_minutes smallint not null default 10 check (remind_minutes between 0 and 120),
  created_at     timestamptz not null default now()
);

create index if not exists class_slots_by_user on public.class_slots (user_id, weekday, starts);

alter table public.class_slots enable row level security;

drop policy if exists "class slots: own" on public.class_slots;
create policy "class slots: own" on public.class_slots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
