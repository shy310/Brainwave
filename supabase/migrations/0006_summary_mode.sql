-- BrainWave — Phase 2A: how a student likes lecture notes written.
-- Run after 0005_tts.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.

alter table public.profiles
  add column if not exists summary_mode text
  check (summary_mode is null or summary_mode in ('short', 'detailed', 'exam'));
