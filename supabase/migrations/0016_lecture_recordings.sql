-- BrainWave — keep a lecture's recording.
-- Run after 0015_grader_history.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.
-- When recording stops, the student chooses to keep the audio or delete it.
-- Kept audio is a private file in Storage, in a folder named after the
-- student, so nobody else can read it. Each student keeps at most 30.

alter table public.lectures
  add column if not exists audio_path  text   check (audio_path is null or char_length(audio_path) <= 300),
  add column if not exists audio_type  text   check (audio_type is null or char_length(audio_type) <= 100),
  add column if not exists audio_bytes bigint check (audio_bytes is null or audio_bytes between 0 and 52428800);

-- Private bucket; 50 MB a file is about three hours of speech at 32 kbit/s.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lecture-audio', 'lecture-audio', false, 52428800, array['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/x-m4a'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- May the signed-in student save this file? Yes if it replaces one of theirs,
-- or they keep fewer than 30 recordings. (A function, because a policy on
-- storage.objects can't read storage.objects itself.)
create or replace function public.may_keep_recording(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from storage.objects where bucket_id = 'lecture-audio' and name = p_name)
      or (select count(*) from storage.objects
          where bucket_id = 'lecture-audio' and (storage.foldername(name))[1] = auth.uid()::text) < 30
$$;
revoke all on function public.may_keep_recording(text) from public, anon;
grant execute on function public.may_keep_recording(text) to authenticated;

drop policy if exists "lecture audio: read own" on storage.objects;
create policy "lecture audio: read own" on storage.objects for select to authenticated
  using (bucket_id = 'lecture-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "lecture audio: add own" on storage.objects;
create policy "lecture audio: add own" on storage.objects for insert to authenticated
  with check (bucket_id = 'lecture-audio' and (storage.foldername(name))[1] = (select auth.uid())::text
              and public.may_keep_recording(name));

drop policy if exists "lecture audio: replace own" on storage.objects;
create policy "lecture audio: replace own" on storage.objects for update to authenticated
  using (bucket_id = 'lecture-audio' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'lecture-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "lecture audio: delete own" on storage.objects;
create policy "lecture audio: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'lecture-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
