-- BrainWave — lectures from a YouTube link or a document (Word, PowerPoint, text).
-- Run after 0025_concept_maps.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.

alter table public.lectures drop constraint if exists lectures_source_check;
alter table public.lectures
  add constraint lectures_source_check check (source in ('record', 'upload', 'text', 'pdf', 'image', 'youtube', 'document'));

-- Where it came from (the YouTube video), to open it again at a moment.
alter table public.lectures add column if not exists source_url text check (source_url is null or (char_length(source_url) <= 300 and source_url ~ '^https://'));
