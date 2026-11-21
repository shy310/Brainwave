-- BrainWave — Arabic and Russian.
-- Run after 0017_web_push.sql (Supabase → SQL Editor → paste → Run). Safe to re-run.
-- The app language, a lecture's spoken language and a video's or podcast's
-- language can now also be Arabic (ar) or Russian (ru).

create or replace function pg_temp.replace_check(p_table regclass, p_column text, p_name text, p_check text)
returns void language plpgsql as $$
declare c record;
begin
  -- Drop the old "in (...)" check on this column, whatever it was called.
  for c in
    select conname from pg_constraint
    where conrelid = p_table and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%' || p_column || '%'
      and pg_get_constraintdef(oid) ilike '%ANY%'
  loop
    execute format('alter table %s drop constraint %I', p_table, c.conname);
  end loop;
  execute format('alter table %s add constraint %I check (%s)', p_table, p_name, p_check);
end $$;

select pg_temp.replace_check('public.profiles', 'locale', 'profiles_locale_check',
  $$locale in ('en', 'he', 'ar', 'ru')$$);
select pg_temp.replace_check('public.profiles', 'lecture_language', 'profiles_lecture_language_check',
  $$lecture_language is null or lecture_language in ('auto', 'en', 'he', 'ar', 'ru')$$);
select pg_temp.replace_check('public.lectures', 'language', 'lectures_language_check',
  $$language in ('auto', 'en', 'he', 'ar', 'ru')$$);
select pg_temp.replace_check('public.media', 'locale', 'media_locale_check',
  $$locale in ('en', 'he', 'ar', 'ru')$$);
