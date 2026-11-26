-- BrainWave — cheat sheets.
-- Run after 0026_lecture_sources.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.
-- A one-to-two page exam cheat sheet of a lecture, made on request.

alter table public.lectures add column if not exists cheat_sheet jsonb;
