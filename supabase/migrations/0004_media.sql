-- BrainWave v2 — saved video lessons and podcasts.
-- Run after 0003_lectures.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.

create table if not exists public.media (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  kind       text not null check (kind in ('video', 'podcast')),
  title      text not null check (char_length(title) <= 200),
  origin     jsonb not null default '{}'::jsonb,
  locale     text not null default 'en' check (locale in ('en', 'he')),
  script     jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists media_by_user on public.media (user_id, kind, created_at desc);

alter table public.media enable row level security;

drop policy if exists "media: read own" on public.media;
create policy "media: read own" on public.media for select using (auth.uid() = user_id);

drop policy if exists "media: insert own" on public.media;
create policy "media: insert own" on public.media for insert with check (auth.uid() = user_id);

drop policy if exists "media: update own" on public.media;
create policy "media: update own" on public.media for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "media: delete own" on public.media;
create policy "media: delete own" on public.media for delete using (auth.uid() = user_id);
