-- BrainWave v2 — daily narration (text-to-speech) allowance per student.
-- Run after 0004_media.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.
-- Until this is run, narration works without a per-student limit.

create table if not exists public.tts_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default current_date,
  chars   integer not null default 0,
  primary key (user_id, day)
);
alter table public.tts_usage enable row level security; -- no policies: only the server touches it

create or replace function public.consume_tts(p_user uuid, p_chars integer, p_daily_chars integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_chars integer;
begin
  insert into public.tts_usage (user_id, day, chars) values (p_user, current_date, p_chars)
  on conflict (user_id, day) do update set chars = tts_usage.chars + p_chars
  returning chars into v_chars;
  if v_chars > p_daily_chars then
    update public.tts_usage set chars = chars - p_chars where user_id = p_user and day = current_date;
    return false;
  end if;
  delete from public.tts_usage where day < current_date - 30;
  return true;
end $$;

revoke all on function public.consume_tts(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_tts(uuid, integer, integer) to service_role;
