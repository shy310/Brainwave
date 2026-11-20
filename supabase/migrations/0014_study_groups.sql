-- BrainWave — Phase 6: study groups.
-- Run after 0013_onboarding_defaults.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.
--
-- Students make a group, invite classmates with a link, and share lecture
-- notes, flashcards and quizzes with it. Sharing copies a snapshot into the
-- group: the original lecture (and its transcript) is never readable by others.

create table if not exists public.study_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique check (invite_code ~ '^[A-Za-z0-9]{10,32}$'),
  created_at  timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id     uuid not null references public.study_groups (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  display_name text not null default '' check (char_length(display_name) <= 60),
  joined_at    timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_shares (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.study_groups (id) on delete cascade,
  shared_by  uuid not null references auth.users (id) on delete cascade default auth.uid(),
  sharer_name text not null default '' check (char_length(sharer_name) <= 60),
  title      text not null check (char_length(title) between 1 and 200),
  notes      jsonb,
  flashcards jsonb,
  quiz       jsonb,
  created_at timestamptz not null default now(),
  check (notes is not null or flashcards is not null or quiz is not null),
  check (octet_length(coalesce(notes::text, '') || coalesce(flashcards::text, '') || coalesce(quiz::text, '')) < 200000)
);

create index if not exists group_members_by_user on public.group_members (user_id);
create index if not exists group_shares_by_group on public.group_shares (group_id, created_at desc);

-- Membership checks used by the policies (security definer avoids recursive RLS).
create or replace function public.is_group_member(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = p_group and user_id = auth.uid());
$$;
create or replace function public.is_group_owner(p_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.study_groups where id = p_group and owner_id = auth.uid());
$$;

alter table public.study_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_shares enable row level security;

drop policy if exists "groups: members read" on public.study_groups;
create policy "groups: members read" on public.study_groups for select using (public.is_group_member(id));
drop policy if exists "groups: owner updates" on public.study_groups;
create policy "groups: owner updates" on public.study_groups for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "groups: owner deletes" on public.study_groups;
create policy "groups: owner deletes" on public.study_groups for delete using (owner_id = auth.uid());
-- Groups are created only through create_study_group() (which also adds the owner as a member).

drop policy if exists "members: members read" on public.group_members;
create policy "members: members read" on public.group_members for select using (public.is_group_member(group_id));
drop policy if exists "members: leave or owner removes" on public.group_members;
create policy "members: leave or owner removes" on public.group_members for delete
  using ((user_id = auth.uid() and role <> 'owner') or (public.is_group_owner(group_id) and user_id <> auth.uid()));
-- Members join only through join_study_group().

drop policy if exists "shares: members read" on public.group_shares;
create policy "shares: members read" on public.group_shares for select using (public.is_group_member(group_id));
drop policy if exists "shares: members share" on public.group_shares;
create policy "shares: members share" on public.group_shares for insert with check (shared_by = auth.uid() and public.is_group_member(group_id));
drop policy if exists "shares: sharer or owner removes" on public.group_shares;
create policy "shares: sharer or owner removes" on public.group_shares for delete using (shared_by = auth.uid() or public.is_group_owner(group_id));

create or replace function public.create_study_group(p_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_code text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if (select count(*) from public.study_groups where owner_id = auth.uid()) >= 50 then raise exception 'too many groups'; end if;
  -- 24 hex characters (96 random bits): long enough that codes can't be guessed.
  v_code := left(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 24);
  insert into public.study_groups (name, owner_id, invite_code) values (left(trim(p_name), 80), auth.uid(), v_code) returning id into v_id;
  insert into public.group_members (group_id, user_id, role, display_name) values (v_id, auth.uid(), 'owner', left(coalesce(p_display_name, ''), 60));
  return v_id;
end $$;

-- What an invite link shows before joining: the group's name and size only.
create or replace function public.preview_study_group(p_code text)
returns table (name text, members bigint) language sql stable security definer set search_path = public as $$
  select g.name, (select count(*) from public.group_members m where m.group_id = g.id)
  from public.study_groups g where g.invite_code = p_code;
$$;

create or replace function public.join_study_group(p_code text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select id into v_id from public.study_groups where invite_code = p_code;
  if v_id is null then raise exception 'invite not found'; end if;
  if (select count(*) from public.group_members where group_id = v_id) >= 200 then raise exception 'group is full'; end if;
  insert into public.group_members (group_id, user_id, display_name) values (v_id, auth.uid(), left(coalesce(p_display_name, ''), 60))
  on conflict (group_id, user_id) do nothing;
  return v_id;
end $$;

-- The owner can make a new invite link (the old one stops working).
create or replace function public.reset_study_group_invite(p_group uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_group_owner(p_group) then raise exception 'only the owner can do this'; end if;
  -- 24 hex characters (96 random bits): long enough that codes can't be guessed.
  v_code := left(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 24);
  update public.study_groups set invite_code = v_code where id = p_group;
  return v_code;
end $$;

revoke all on function public.create_study_group(text, text), public.preview_study_group(text), public.join_study_group(text, text),
  public.reset_study_group_invite(uuid), public.is_group_member(uuid), public.is_group_owner(uuid) from public, anon;
grant execute on function public.create_study_group(text, text), public.preview_study_group(text), public.join_study_group(text, text),
  public.reset_study_group_invite(uuid), public.is_group_member(uuid), public.is_group_owner(uuid) to authenticated;
