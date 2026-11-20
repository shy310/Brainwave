-- BrainWave — Phase 7A: onboarding choices that set the app's defaults.
-- Run after 0012_class_schedule.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.

alter table public.profiles
  add column if not exists study_goal text
  check (study_goal is null or study_goal in ('understand', 'exams', 'quick'));

alter table public.profiles
  add column if not exists lecture_language text
  check (lecture_language is null or lecture_language in ('auto', 'en', 'he'));
