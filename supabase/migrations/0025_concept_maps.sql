-- BrainWave — concept maps.
-- Run after 0024_group_challenges.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.
-- A drawn map of a lecture's ideas (nodes and links), made on request.

alter table public.lectures add column if not exists concept_map jsonb;
