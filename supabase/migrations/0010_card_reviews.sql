-- BrainWave — Phase 3A: spaced repetition for flashcards.
-- Run after 0009_sharing.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.

create table if not exists public.card_reviews (
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  card_key   text not null check (char_length(card_key) <= 120),
  lecture_id uuid not null references public.lectures (id) on delete cascade,
  box        smallint not null default 0 check (box between 0 and 7),
  due_at     timestamptz not null,
  reviews    integer not null default 0,
  lapses     integer not null default 0,
  last_at    timestamptz not null,
  first_at   timestamptz not null,
  primary key (user_id, card_key)
);

create index if not exists card_reviews_due on public.card_reviews (user_id, due_at);

alter table public.card_reviews enable row level security;

drop policy if exists "card reviews: own" on public.card_reviews;
create policy "card reviews: own" on public.card_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
