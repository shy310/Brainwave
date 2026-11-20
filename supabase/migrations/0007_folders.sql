-- BrainWave — Phase 2B: folders for lectures.
-- Run after 0006_summary_mode.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.

create table if not exists public.lecture_folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name       text not null check (char_length(name) between 1 and 80),
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists lecture_folders_by_user on public.lecture_folders (user_id, position);

alter table public.lecture_folders enable row level security;

drop policy if exists "folders: own" on public.lecture_folders;
create policy "folders: own" on public.lecture_folders
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- A lecture is in at most one folder. Deleting a folder keeps its lectures.
alter table public.lectures
  add column if not exists folder_id uuid references public.lecture_folders (id) on delete set null;

create index if not exists lectures_by_folder on public.lectures (user_id, folder_id);

-- A lecture can only be put in one of its owner's own folders.
create or replace function public.lecture_folder_is_own()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.folder_id is not null and not exists (
    select 1 from public.lecture_folders f where f.id = new.folder_id and f.user_id = new.user_id
  ) then
    raise exception 'folder not found';
  end if;
  return new;
end $$;

drop trigger if exists lectures_folder_is_own on public.lectures;
create trigger lectures_folder_is_own
  before insert or update of folder_id on public.lectures
  for each row execute function public.lecture_folder_is_own();
