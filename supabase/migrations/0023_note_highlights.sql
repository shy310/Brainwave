-- BrainWave — highlights and comments in lecture notes.
-- Run after 0022_mistakes.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.

alter table public.lectures add column if not exists highlights jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.lectures add constraint lectures_highlights_array check (jsonb_typeof(highlights) = 'array');
exception when duplicate_object then null; end $$;
