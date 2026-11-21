-- BrainWave — group challenges: a weekly game leaderboard and a daily question.
-- Run after 0023_note_highlights.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.

-- Best game score of each member, per week (weeks start on Monday, UTC).
create table if not exists public.group_scores (
  group_id     uuid not null references public.study_groups (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  week         date not null,
  game         text not null check (game in ('glide', 'rush')),
  best         integer not null check (best between 0 and 10000000),
  display_name text not null default '' check (char_length(display_name) <= 60),
  updated_at   timestamptz not null default now(),
  primary key (group_id, user_id, week, game)
);

-- Who answered the group's question of the day, and whether they got it right.
create table if not exists public.group_daily (
  group_id     uuid not null references public.study_groups (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  day          date not null,
  correct      boolean not null,
  display_name text not null default '' check (char_length(display_name) <= 60),
  answered_at  timestamptz not null default now(),
  primary key (group_id, user_id, day)
);

alter table public.group_scores enable row level security;
alter table public.group_daily enable row level security;

-- Members see their group's board; writing goes through the functions below only.
drop policy if exists "group scores: members read" on public.group_scores;
create policy "group scores: members read" on public.group_scores for select using (public.is_group_member(group_id));
drop policy if exists "group daily: members read" on public.group_daily;
create policy "group daily: members read" on public.group_daily for select using (public.is_group_member(group_id));

-- A finished game: keep the best score of this week in every group the student is in.
create or replace function public.submit_game_score(p_game text, p_score integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_week date := date_trunc('week', (now() at time zone 'utc'))::date;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_game not in ('glide', 'rush') or p_score is null or p_score < 0 or p_score > 10000000 then raise exception 'bad score'; end if;
  insert into public.group_scores (group_id, user_id, week, game, best, display_name)
    select m.group_id, m.user_id, v_week, p_game, p_score, m.display_name
    from public.group_members m where m.user_id = auth.uid()
  on conflict (group_id, user_id, week, game) do update
    set best = greatest(group_scores.best, excluded.best), display_name = excluded.display_name, updated_at = now();
end $$;

-- Answer today's question once (a second answer the same day doesn't count).
create or replace function public.answer_group_daily(p_group uuid, p_correct boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_member(p_group) then raise exception 'not a member'; end if;
  insert into public.group_daily (group_id, user_id, day, correct, display_name)
    select p_group, auth.uid(), (now() at time zone 'utc')::date, p_correct, m.display_name
    from public.group_members m where m.group_id = p_group and m.user_id = auth.uid()
  on conflict (group_id, user_id, day) do nothing;
end $$;

revoke all on function public.submit_game_score(text, integer), public.answer_group_daily(uuid, boolean) from public, anon;
grant execute on function public.submit_game_score(text, integer), public.answer_group_daily(uuid, boolean) to authenticated;
