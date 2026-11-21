-- Access checks for the migrations, run by supabase/tests/run.sh as a superuser
-- that switches between three students (A, B, C) and a signed-out visitor.
\set ON_ERROR_STOP 1
set client_min_messages = warning;

create function pg_temp.ok(cond boolean, what text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'CHECK FAILED: %', what; end if; end $$;
-- Run a statement that must be refused.
create function pg_temp.refused(stmt text, what text) returns void language plpgsql as $$
begin
  begin execute stmt; exception when others then return; end;
  raise exception 'CHECK FAILED (was allowed): %', what;
end $$;
create function pg_temp.as_user(id uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(id::text, ''), false); end $$;

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test'),
  ('cccccccc-0000-0000-0000-000000000003', 'c@test');
select pg_temp.ok((select count(*) from public.profiles) = 3, 'a profile is created for each new user');

-- ── Lectures and folders ──────────────────────────────────────────────────
set role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.lecture_folders (id, name) values ('f0000000-0000-0000-0000-00000000000a', 'A folder');
insert into public.lectures (id, title, source, segments, notes, folder_id) values
  ('10000000-0000-0000-0000-00000000000a', 'A lecture', 'record', '[{"start":0,"text":"secret transcript"}]',
   '{"title":"t","summary":"s","sections":[],"keyTerms":[],"reminders":[]}', 'f0000000-0000-0000-0000-00000000000a');
insert into public.lectures (title, source) values ('A pdf', 'pdf'), ('A photos', 'image');
select pg_temp.refused($$insert into public.lectures (title, source) values ('x', 'video')$$, 'unknown lecture sources');
select pg_temp.refused($$insert into public.lectures (title, source, user_id) values ('x', 'text', 'bbbbbbbb-0000-0000-0000-000000000002')$$, 'creating a lecture for someone else');

select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from public.lectures) = 0, 'B cannot see A''s lectures');
update public.lectures set title = 'hacked';
delete from public.lectures;
insert into public.lectures (id, title, source) values ('20000000-0000-0000-0000-00000000000b', 'B lecture', 'text');
select pg_temp.refused($$update public.lectures set folder_id = 'f0000000-0000-0000-0000-00000000000a' where id = '20000000-0000-0000-0000-00000000000b'$$,
  'B putting a lecture in A''s folder');
select pg_temp.ok((select count(*) from public.lecture_folders) = 0, 'B cannot see A''s folders');
update public.lectures set favorite = true where id = '20000000-0000-0000-0000-00000000000b';
select pg_temp.ok((select favorite from public.lectures where id = '20000000-0000-0000-0000-00000000000b'), 'a student can star their own lecture');
update public.lectures set favorite = true where id = '10000000-0000-0000-0000-00000000000a';


-- ── Share links ───────────────────────────────────────────────────────────
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.ok((select title from public.lectures where id = '10000000-0000-0000-0000-00000000000a') = 'A lecture', 'B''s update did not touch A''s lecture');
select pg_temp.ok(not (select favorite from public.lectures where id = '10000000-0000-0000-0000-00000000000a'), 'B cannot star A''s lecture');
update public.lectures set share_token = 'Abc_def-ghijklmnopqrstu' where id = '10000000-0000-0000-0000-00000000000a';
select pg_temp.refused($$update public.lectures set share_token = 'short' where id = '10000000-0000-0000-0000-00000000000a'$$, 'short share tokens');
set role anon;
select pg_temp.as_user(null);
select pg_temp.ok((select count(*) from public.shared_lecture('Abc_def-ghijklmnopqrstu')) = 1, 'anyone with the link reads the notes');
select pg_temp.ok((select title from public.shared_lecture('Abc_def-ghijklmnopqrstu')) = 'A lecture', 'the shared title');
select pg_temp.ok((select count(*) from public.shared_lecture('Abc_def-ghijklmnopqrstu-wrong')) = 0, 'a wrong token reads nothing');
select pg_temp.ok((select count(*) from public.shared_lecture('Abc')) = 0, 'a short token reads nothing');
select pg_temp.ok((select count(*) from public.lectures) = 0, 'signed-out visitors cannot read lectures');
select pg_temp.ok(not exists (select 1 from information_schema.routines r join information_schema.parameters p using (specific_name)
  where r.routine_name = 'shared_lecture' and p.parameter_mode = 'OUT' and p.parameter_name in ('segments', 'slides_text', 'user_id')), 'share links never return the transcript, slides or owner');
select pg_temp.refused($$select public.bump_study_day(current_date, 1, 0, 0, 0)$$, 'signed-out visitors recording study time');

-- ── Reviews, study days, schedule ─────────────────────────────────────────
set role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.card_reviews (card_key, lecture_id, due_at, last_at, first_at) values ('10000000:x', '10000000-0000-0000-0000-00000000000a', now(), now(), now());
select public.bump_study_day(current_date, 999, 2, 1, 0);
select public.bump_study_day(current_date, 1, 1, 0, 1);
select pg_temp.ok((select minutes from public.study_days) = 6, 'study minutes add up, and each step is capped');
select pg_temp.ok((select cards from public.study_days) = 3, 'cards add up');
select pg_temp.refused($$insert into public.study_days (user_id, day) values ('aaaaaaaa-0000-0000-0000-000000000001', current_date - 1)$$, 'writing study days directly');
insert into public.class_slots (name, weekday, starts, ends) values ('Calculus', 5, '10:00', '11:30');
select pg_temp.refused($$insert into public.class_slots (name, weekday, starts, ends) values ('x', 7, '10:00', '11:00')$$, 'weekday out of range');
select pg_temp.refused($$insert into public.class_slots (name, weekday, starts, ends) values ('x', 1, '25:00', '11:00')$$, 'invalid time');
update public.profiles set summary_mode = 'exam', study_goal = 'exams', lecture_language = 'he';
select pg_temp.refused($$update public.profiles set study_goal = 'party'$$, 'unknown study goal');
insert into public.grader_tasks (task_id, question, attempts) values ('abc', 'Why is the sky blue?', '[{"at": 1, "answer": "Rayleigh"}]');
select pg_temp.refused($$insert into public.grader_tasks (task_id, question, attempts) values ('x', 'q', '{"not": "a list"}')$$, 'grader attempts must be a list');

select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from public.card_reviews) = 0, 'B cannot see A''s card reviews');
select pg_temp.ok((select count(*) from public.study_days) = 0, 'B cannot see A''s study days');
select pg_temp.ok((select count(*) from public.class_slots) = 0, 'B cannot see A''s schedule');
select pg_temp.ok((select count(*) from public.grader_tasks) = 0, 'B cannot see A''s graded answers');
select pg_temp.refused($$insert into public.grader_tasks (task_id, question, user_id) values ('y', 'q', 'aaaaaaaa-0000-0000-0000-000000000001')$$, 'writing A''s graded answers');
select pg_temp.refused($$insert into public.card_reviews (card_key, lecture_id, due_at, last_at, first_at, user_id) values ('x', '10000000-0000-0000-0000-00000000000a', now(), now(), now(), 'aaaaaaaa-0000-0000-0000-000000000001')$$, 'writing A''s reviews');

-- ── Study groups ──────────────────────────────────────────────────────────
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
create temp table ids as select public.create_study_group('Calculus group', 'Ann') as gid;
grant select on ids to authenticated;
select pg_temp.ok((select count(*) from public.study_groups) = 1, 'the owner sees their group');
select pg_temp.ok((select role from public.group_members) = 'owner', 'the owner is a member');
select pg_temp.ok((select invite_code ~ '^[a-f0-9]{24}$' from public.study_groups), 'invite codes are 24 random hex characters');
create temp table code as select invite_code from public.study_groups;
grant select on code to authenticated;
select pg_temp.refused($$insert into public.study_groups (name, owner_id, invite_code) values ('x', 'aaaaaaaa-0000-0000-0000-000000000001', 'abcdefghij12')$$, 'creating groups without the function');

select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from public.study_groups) = 0, 'non-members cannot see a group');
select pg_temp.ok((select name from public.preview_study_group((select invite_code from code))) = 'Calculus group', 'an invite shows the group name');
select pg_temp.ok((select count(*) from public.preview_study_group('000000000000000000000000')) = 0, 'a wrong invite shows nothing');
select pg_temp.refused($$insert into public.group_members (group_id, user_id) select gid, 'bbbbbbbb-0000-0000-0000-000000000002' from ids$$, 'joining without an invite');
select public.join_study_group((select invite_code from code), 'Ben');
select public.join_study_group((select invite_code from code), 'Ben');
select pg_temp.ok((select count(*) from public.group_members) = 2, 'a member sees the members (joining twice is harmless)');
insert into public.group_shares (group_id, sharer_name, title, notes) select gid, 'Ben', 'B notes', '{"summary":"s"}' from ids;
select pg_temp.refused($$insert into public.group_shares (group_id, title, notes, shared_by) select gid, 'fake', '{}', 'aaaaaaaa-0000-0000-0000-000000000001' from ids$$, 'sharing in someone else''s name');
select pg_temp.refused($$insert into public.group_shares (group_id, title) select gid, 'empty' from ids$$, 'an empty share');
delete from public.study_groups;
delete from public.group_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.study_groups set name = 'hacked';
select pg_temp.refused($$select public.reset_study_group_invite((select gid from ids))$$, 'a member resetting the invite');

select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.ok((select count(*) from public.group_shares) = 0, 'outsiders cannot read shares');
select pg_temp.ok((select count(*) from public.group_members) = 0, 'outsiders cannot see members');
select pg_temp.refused($$insert into public.group_shares (group_id, title, notes) select gid, 'spam', '{}' from ids$$, 'outsiders sharing into a group');

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.ok((select name from public.study_groups) = 'Calculus group', 'members could not rename or delete the group');
select pg_temp.ok((select count(*) from public.group_members) = 2, 'members could not remove the owner');
select pg_temp.ok((select count(*) from public.group_shares) = 1, 'the owner sees what members share');
delete from public.group_shares;
select pg_temp.ok((select count(*) from public.group_shares) = 0, 'the owner can remove any share');
delete from public.group_members where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.ok((select count(*) from public.group_members where role = 'owner') = 1, 'the owner cannot leave their own group');
select public.reset_study_group_invite((select gid from ids));
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.refused($$select public.join_study_group((select invite_code from code), 'Cy')$$, 'an old invite link after a reset');

select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
delete from public.group_members where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select pg_temp.ok((select count(*) from public.study_groups) = 0, 'after leaving, the group is gone from view');

-- ── Kept lecture recordings (Storage) ──────────────────────────────────────
reset role;
set role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into storage.objects (bucket_id, name) values ('lecture-audio', 'aaaaaaaa-0000-0000-0000-000000000001/l1.webm');
select pg_temp.ok((select count(*) from storage.objects) = 1, 'a student keeps a recording in their own folder');
update storage.objects set metadata = '{"size": 1}' where name = 'aaaaaaaa-0000-0000-0000-000000000001/l1.webm';
select pg_temp.refused($$insert into storage.objects (bucket_id, name) values ('lecture-audio', 'bbbbbbbb-0000-0000-0000-000000000002/x.webm')$$, 'saving into someone else''s folder');
select pg_temp.refused($$insert into storage.objects (bucket_id, name) values ('lecture-audio', 'x.webm')$$, 'saving outside any folder');
select pg_temp.refused($$update storage.objects set name = 'bbbbbbbb-0000-0000-0000-000000000002/moved.webm'$$, 'moving a recording into someone else''s folder');
insert into storage.objects (bucket_id, name)
  select 'lecture-audio', 'aaaaaaaa-0000-0000-0000-000000000001/n' || i || '.webm' from generate_series(2, 29) i;
select pg_temp.ok(public.may_keep_recording('aaaaaaaa-0000-0000-0000-000000000001/n30.webm'), '29 kept: one more is allowed');
insert into storage.objects (bucket_id, name) values ('lecture-audio', 'aaaaaaaa-0000-0000-0000-000000000001/n30.webm');
select pg_temp.refused($$insert into storage.objects (bucket_id, name) values ('lecture-audio', 'aaaaaaaa-0000-0000-0000-000000000001/n31.webm')$$, 'a 31st kept recording');
select pg_temp.ok(public.may_keep_recording('aaaaaaaa-0000-0000-0000-000000000001/n30.webm'), 'at the limit, an existing recording can still be replaced');
delete from storage.objects where name = 'aaaaaaaa-0000-0000-0000-000000000001/n30.webm';
insert into storage.objects (bucket_id, name) values ('lecture-audio', 'aaaaaaaa-0000-0000-0000-000000000001/n31.webm');
select pg_temp.ok((select count(*) from storage.objects) = 30, 'deleting one makes room for another');

select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.ok((select count(*) from storage.objects) = 0, 'other students cannot see someone''s recordings');
delete from storage.objects;
update storage.objects set name = 'bbbbbbbb-0000-0000-0000-000000000002/stolen.webm';
select pg_temp.as_user(null);
reset role;
set role anon;
select pg_temp.ok((select count(*) from storage.objects) = 0, 'signed-out visitors cannot see recordings');
select pg_temp.refused($$insert into storage.objects (bucket_id, name) values ('lecture-audio', 'aaaaaaaa-0000-0000-0000-000000000001/anon.webm')$$, 'signed-out uploads');
reset role;
select pg_temp.ok((select count(*) from storage.objects where name like 'aaaaaaaa-0000-0000-0000-000000000001/%') = 30, 'another student could not delete or move them');
select pg_temp.ok((select not public from storage.buckets where id = 'lecture-audio'), 'the recordings bucket is private');
delete from storage.objects;

-- ── Web push reminders ─────────────────────────────────────────────────────
reset role;
set role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.save_push_subscription('https://push.example/a1', 'key-a', 'auth-a');
select pg_temp.ok((select count(*) from public.push_subscriptions) = 1, 'a student saves their device');
select pg_temp.refused($$insert into public.push_subscriptions (endpoint, user_id, p256dh, auth) values ('https://push.example/x', 'bbbbbbbb-0000-0000-0000-000000000002', 'k', 'a')$$, 'adding a device directly, or for someone else');
select pg_temp.refused($$select public.save_push_subscription('http://insecure.example/a', 'k', 'a')$$, 'a push address that isn''t https');
insert into public.reminder_settings (timezone, study_enabled, study_time) values ('Asia/Jerusalem', true, '19:00');
select pg_temp.refused($$update public.reminder_settings set timezone = 'Mars/Olympus'$$, 'an unknown time zone');
select pg_temp.ok((select count(*) from public.push_config) = 0, 'students cannot read the push keys');
select pg_temp.ok((select count(*) from public.push_sent) = 0, 'students cannot read what was sent');
select pg_temp.refused($$select * from public.claim_due_reminders()$$, 'students claiming reminders');
select pg_temp.refused($$select public.schedule_push_ticks('https://evil.example/api/push/tick')$$, 'students changing the minute job');
insert into public.class_slots (name, weekday, starts, ends, remind_minutes) values ('Calculus', 1, '10:00', '11:30', 15);

select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select public.save_push_subscription('https://push.example/a1', 'key-b', 'auth-b');
select pg_temp.ok((select count(*) from public.push_subscriptions) = 1 and (select p256dh from public.push_subscriptions) = 'key-b', 'a shared device moves to the student now signed in');
select pg_temp.ok((select count(*) from public.reminder_settings) = 0, 'others'' reminder settings are hidden');
delete from public.push_subscriptions;
select public.save_push_subscription('https://push.example/b1', 'key-b', 'auth-b');

select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.ok((select count(*) from public.push_subscriptions) = 0, 'the first student no longer gets pushes on that device');
select public.save_push_subscription('https://push.example/a2', 'key-a', 'auth-a');

reset role;
select pg_temp.ok((select length(cron_secret) >= 60 from public.push_config), 'a long secret is made for the minute job');
-- Monday 23 Nov 2026, 19:04 in Jerusalem (UTC+2): the study reminder is due once.
select pg_temp.ok((select count(*) from public.claim_due_reminders('2026-11-23 17:04:00+00') where kind = 'study') = 1, 'the study reminder is due at its time');
select pg_temp.ok((select count(*) from public.claim_due_reminders('2026-11-23 17:05:00+00') where kind = 'study') = 0, 'and is sent only once');
select pg_temp.ok((select count(*) from public.claim_due_reminders('2026-11-23 16:50:00+00') where kind = 'study') = 0, 'not before its time');
-- Monday class at 10:00 with a 15-minute reminder: due at 09:45 Jerusalem = 07:45 UTC.
select pg_temp.ok((select class_name from public.claim_due_reminders('2026-11-23 07:46:00+00') where kind = 'class') = 'Calculus', 'the class reminder is due before class');
select pg_temp.ok((select count(*) from public.claim_due_reminders('2026-11-30 07:30:00+00')) = 0, 'not 15 minutes too early the next week');
select pg_temp.ok((select subscriptions -> 0 ->> 'endpoint' from public.claim_due_reminders('2026-11-30 07:47:00+00') where kind = 'class') = 'https://push.example/a2', 'it goes to the student''s own devices');
-- Studied already today: no study reminder.
insert into public.study_days (user_id, day, minutes) values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-11-24', 12);
select pg_temp.ok((select count(*) from public.claim_due_reminders('2026-11-24 17:02:00+00') where kind = 'study') = 0, 'no study reminder after studying that day');
-- Late at night in Jerusalem the date is already tomorrow.
update public.reminder_settings set study_time = '00:30';
select pg_temp.ok((select count(*) from public.claim_due_reminders('2026-11-25 22:35:00+00') where kind = 'study') = 1, 'the local date counts, not UTC');
delete from public.push_sent;

-- ── Arabic and Russian ────────────────────────────────────────────────────
reset role;
set role authenticated;
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
update public.profiles set locale = 'ar', lecture_language = 'ru' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select pg_temp.ok((select locale || lecture_language from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'arru', 'a student can choose Arabic or Russian');
select pg_temp.refused($$update public.profiles set locale = 'fr' where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$, 'an unsupported app language');
insert into public.lectures (title, source, language) values ('Лекция', 'text', 'ru');
select pg_temp.refused($$insert into public.lectures (title, source, language) values ('x', 'text', 'xx')$$, 'an unsupported lecture language');
delete from public.lectures where title = 'Лекция';
reset role;

-- ── Deleting an account removes everything ────────────────────────────────
reset role;
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select pg_temp.ok((select count(*) from public.lectures where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'deleted account: lectures gone');
select pg_temp.ok((select count(*) from public.lecture_folders) = 0, 'deleted account: folders gone');
select pg_temp.ok((select count(*) from public.card_reviews) = 0, 'deleted account: reviews gone');
select pg_temp.ok((select count(*) from public.study_days) = 0, 'deleted account: study days gone');
select pg_temp.ok((select count(*) from public.class_slots) = 0, 'deleted account: schedule gone');
select pg_temp.ok((select count(*) from public.grader_tasks) = 0, 'deleted account: graded answers gone');
select pg_temp.ok((select count(*) from public.push_subscriptions where user_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'deleted account: push devices gone');
select pg_temp.ok((select count(*) from public.reminder_settings) = 0, 'deleted account: reminder settings gone');
select pg_temp.ok((select count(*) from public.study_groups) = 0, 'deleted account: owned groups gone');
select pg_temp.ok((select count(*) from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 0, 'deleted account: profile gone');
select pg_temp.ok((select count(*) from public.lectures) = 1, 'other students keep their lectures');
