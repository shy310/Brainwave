-- BrainWave — Phase 2D: lectures made from a PDF or from photos.
-- Run after 0007_folders.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.
-- Photos and PDFs are read in the browser or by the AI and are not stored; only the text is saved.

alter table public.lectures drop constraint if exists lectures_source_check;
alter table public.lectures
  add constraint lectures_source_check check (source in ('record', 'upload', 'text', 'pdf', 'image'));
