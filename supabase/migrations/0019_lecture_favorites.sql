-- BrainWave — favourite lectures.
-- Run after 0018_arabic_russian.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.
-- A star on a lecture, set from the library's right-click (or long-press) menu.

alter table public.lectures add column if not exists favorite boolean not null default false;
