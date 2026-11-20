-- BrainWave — Phase 2E: share a lecture's notes with a link.
-- Run after 0008_note_sources.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.
--
-- A lecture is shared by giving it a long random token. Anyone with the link
-- can read the notes (title, summary, sections, terms, reminders) and the
-- flashcards — never the transcript, slides or anything else. Clearing the
-- token stops the link working.

alter table public.lectures
  add column if not exists share_token text unique
  check (share_token is null or (char_length(share_token) between 20 and 64 and share_token ~ '^[A-Za-z0-9_-]+$'));

create or replace function public.shared_lecture(p_token text)
returns table (title text, source text, notes jsonb, flashcards jsonb, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select l.title, l.source, l.notes, l.flashcards, l.created_at
  from public.lectures l
  where p_token is not null and char_length(p_token) >= 20 and l.share_token = p_token and l.notes is not null
  limit 1;
$$;

revoke all on function public.shared_lecture(text) from public;
grant execute on function public.shared_lecture(text) to anon, authenticated;
