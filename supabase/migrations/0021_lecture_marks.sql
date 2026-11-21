-- BrainWave — important moments.
-- Run after 0020_exams.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.
-- Times (in seconds) the student marked as important while recording.

alter table public.lectures add column if not exists marks real[] not null default '{}';
