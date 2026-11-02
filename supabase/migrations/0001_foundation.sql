-- BrainWave v2 — foundation schema.
-- Run in Supabase: SQL Editor → paste → Run (or `supabase db push`).

-- ── Profiles ──────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null default '',
  grade         text not null default '9'
                check (grade in ('k','1','2','3','4','5','6','7','8','9','10','11','12','college')),
  locale        text not null default 'en' check (locale in ('en','he')),
  tutor_style   text,
  onboarded     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: read own"   on public.profiles for select using (id = auth.uid());
create policy "profiles: update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles: insert own" on public.profiles for insert with check (id = auth.uid());

-- Create a profile row automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── AI usage quotas (server-only; no client policies) ─────────────────────────
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default current_date,
  units   integer not null default 0,
  primary key (user_id, day)
);

create table if not exists public.ai_rate (
  user_id uuid not null references auth.users (id) on delete cascade,
  minute  timestamptz not null,
  count   integer not null default 0,
  primary key (user_id, minute)
);

alter table public.ai_usage enable row level security;
alter table public.ai_rate  enable row level security;

-- Atomically charge `p_cost` units; returns false when the student is over the
-- daily budget or the per-minute rate. Callable only with the service-role key.
create or replace function public.consume_quota(
  p_user uuid, p_op text, p_cost integer, p_daily_limit integer, p_rpm integer
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_units integer;
  v_count integer;
  v_minute timestamptz := date_trunc('minute', now());
begin
  insert into public.ai_rate (user_id, minute, count) values (p_user, v_minute, 1)
  on conflict (user_id, minute) do update set count = ai_rate.count + 1
  returning count into v_count;
  if v_count > p_rpm then return false; end if;

  insert into public.ai_usage (user_id, day, units) values (p_user, current_date, p_cost)
  on conflict (user_id, day) do update set units = ai_usage.units + p_cost
  returning units into v_units;
  if v_units > p_daily_limit then
    update public.ai_usage set units = units - p_cost where user_id = p_user and day = current_date;
    return false;
  end if;

  -- Keep the rate table small.
  delete from public.ai_rate where minute < now() - interval '10 minutes';
  return true;
end $$;

revoke all on function public.consume_quota(uuid, text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_quota(uuid, text, integer, integer, integer) to service_role;
