-- BrainWave — reminders on the website, even when it's closed (Web Push).
-- Run after 0016_lecture_recordings.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.
--
-- The browser gives each device a push address (subscription). Every minute
-- the database asks the server to send the reminders that are due: the daily
-- study reminder (only if the student hasn't studied yet that day) and
-- "record your class" reminders from the timetable. Times are the student's
-- own, in their time zone. The keys for signing pushes and the secret for the
-- minute job are made here and on the server, and are never shown to anyone.

-- ── Where to send ─────────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  endpoint   text primary key check (char_length(endpoint) <= 1000 and endpoint like 'https://%'),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  p256dh     text not null check (char_length(p256dh) <= 200),
  auth       text not null check (char_length(auth) <= 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_by_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

drop policy if exists "push subscriptions: read own" on public.push_subscriptions;
create policy "push subscriptions: read own" on public.push_subscriptions for select using (auth.uid() = user_id);
drop policy if exists "push subscriptions: delete own" on public.push_subscriptions;
create policy "push subscriptions: delete own" on public.push_subscriptions for delete using (auth.uid() = user_id);

-- Save this device for the signed-in student. A device used by someone else
-- before (shared computer, account switch) now belongs to this student only.
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if (select count(*) from public.push_subscriptions where user_id = auth.uid() and endpoint <> p_endpoint) >= 10 then
    -- Keep the newest devices only.
    delete from public.push_subscriptions where endpoint in (
      select endpoint from public.push_subscriptions where user_id = auth.uid() order by created_at limit 1);
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values (p_endpoint, auth.uid(), p_p256dh, p_auth);
end $$;
revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- ── When ──────────────────────────────────────────────────────────────────
create or replace function public.is_time_zone(p text) returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = p)
$$;

create table if not exists public.reminder_settings (
  user_id       uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  timezone      text not null default 'UTC' check (char_length(timezone) <= 64 and public.is_time_zone(timezone)),
  study_enabled boolean not null default false,
  study_time    text not null default '19:00' check (study_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  updated_at    timestamptz not null default now()
);
alter table public.reminder_settings enable row level security;
drop policy if exists "reminder settings: own" on public.reminder_settings;
create policy "reminder settings: own" on public.reminder_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── What was sent (so a reminder goes once, even if the job runs twice) ──
create table if not exists public.push_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  key     text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.push_sent enable row level security;
revoke all on public.push_sent from anon, authenticated;

-- ── Keys and the minute job's secret: only the server (service role) reads them ──
create table if not exists public.push_config (
  id            boolean primary key default true check (id),
  vapid_public  text,
  vapid_private text,
  cron_secret   text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;
insert into public.push_config (id) values (true) on conflict (id) do nothing;

-- ── Due reminders ─────────────────────────────────────────────────────────
-- Reminders whose time was in the last 10 minutes (so a late run still sends
-- them) and that weren't sent yet. Claiming and returning happen together, so
-- two runs at once can't send the same reminder twice.
create or replace function public.claim_due_reminders(p_now timestamptz default now())
returns table (user_id uuid, kind text, locale text, class_id uuid, class_name text, subscriptions jsonb)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  delete from public.push_sent where sent_at < p_now - interval '3 days';
  return query
  with subscribed as (
    select s.*, (p_now at time zone s.timezone) as local_now
    from public.reminder_settings s
    where exists (select 1 from public.push_subscriptions ps where ps.user_id = s.user_id)
  ),
  study as (
    select s.user_id, 'study'::text as kind, null::uuid as class_id, null::text as class_name,
           'study:' || (s.local_now)::date::text as key
    from subscribed s
    where s.study_enabled
      and s.local_now - ((s.local_now)::date + s.study_time::time) between interval '0' and interval '10 minutes'
      and not exists (
        select 1 from public.study_days d
        where d.user_id = s.user_id and d.day = (s.local_now)::date
          and (d.minutes > 0 or d.cards > 0 or d.quizzes > 0 or d.lectures > 0))
  ),
  classes as (
    select c.user_id, 'class'::text, c.id, c.name, 'class:' || c.id::text || ':' || day::text
    from subscribed s
    join public.class_slots c on c.user_id = s.user_id and c.remind_minutes > 0
    cross join lateral (select (s.local_now)::date + n as day from generate_series(0, 1) n) days
    where extract(dow from day) = c.weekday
      and s.local_now - (day + c.starts::time - make_interval(mins => c.remind_minutes)) between interval '0' and interval '10 minutes'
  ),
  due as (select * from study union all select * from classes),
  claimed as (
    insert into public.push_sent (user_id, key)
    select due.user_id, due.key from due
    on conflict do nothing
    returning push_sent.user_id, push_sent.key
  )
  select d.user_id, d.kind, coalesce(p.locale, 'en'), d.class_id, d.class_name,
         (select coalesce(jsonb_agg(jsonb_build_object('endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth)), '[]'::jsonb)
          from public.push_subscriptions ps where ps.user_id = d.user_id)
  from due d
  join claimed c on c.user_id = d.user_id and c.key = d.key
  left join public.profiles p on p.id = d.user_id;
end $$;
revoke all on function public.claim_due_reminders(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_due_reminders(timestamptz) to service_role;

-- ── The minute job ────────────────────────────────────────────────────────
-- Supabase has pg_cron (timers) and pg_net (web requests). After deploying, run
--   select public.schedule_push_ticks('https://<your-site>/api/push/tick');
-- once; it (re)creates a job that calls the server every minute with the secret.
do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then create extension if not exists pg_cron; end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then create extension if not exists pg_net; end if;
end $$;

create or replace function public.schedule_push_ticks(p_url text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_url !~ '^https://[^ ]+/api/push/tick$' then raise exception 'expected https://<site>/api/push/tick'; end if;
  perform cron.unschedule(jobid) from cron.job where jobname = 'brainwave-push';
  perform cron.schedule('brainwave-push', '* * * * *', format(
    $job$select net.http_post(url := %L, body := '{}'::jsonb,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select cron_secret from public.push_config)),
      timeout_milliseconds := 20000)$job$, p_url));
end $$;
revoke all on function public.schedule_push_ticks(text) from public, anon, authenticated;
