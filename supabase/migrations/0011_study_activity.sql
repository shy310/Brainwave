-- BrainWave — Phase 4A: study streaks and weekly stats.
-- Run after 0010_card_reviews.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.

create table if not exists public.study_days (
  user_id  uuid not null references auth.users (id) on delete cascade default auth.uid(),
  day      date not null,
  minutes  integer not null default 0 check (minutes between 0 and 1440),
  cards    integer not null default 0 check (cards >= 0),
  quizzes  integer not null default 0 check (quizzes >= 0),
  lectures integer not null default 0 check (lectures >= 0),
  primary key (user_id, day)
);

alter table public.study_days enable row level security;

drop policy if exists "study days: read own" on public.study_days;
create policy "study days: read own" on public.study_days for select using (auth.uid() = user_id);

-- Add to today's numbers in one statement (two tabs can't overwrite each other).
-- Only small, non-negative steps are accepted, and only for the caller.
create or replace function public.bump_study_day(p_day date, p_minutes int, p_cards int, p_quizzes int, p_lectures int)
returns void language sql security definer set search_path = public as $$
  insert into public.study_days as s (user_id, day, minutes, cards, quizzes, lectures)
  values (auth.uid(), p_day, least(greatest(p_minutes, 0), 5), least(greatest(p_cards, 0), 50),
          least(greatest(p_quizzes, 0), 5), least(greatest(p_lectures, 0), 5))
  on conflict (user_id, day) do update set
    minutes = least(s.minutes + excluded.minutes, 1440),
    cards = s.cards + excluded.cards,
    quizzes = s.quizzes + excluded.quizzes,
    lectures = s.lectures + excluded.lectures;
$$;

revoke all on function public.bump_study_day(date, int, int, int, int) from public, anon;
grant execute on function public.bump_study_day(date, int, int, int, int) to authenticated;
