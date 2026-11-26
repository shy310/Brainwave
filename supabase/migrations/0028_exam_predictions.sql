-- BrainWave — exam predictions.
-- Run after 0027_cheat_sheets.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.
-- The AI's prediction of an exam's likely topics, with a mock exam.

alter table public.exams add column if not exists prediction jsonb;
