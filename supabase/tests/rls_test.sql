-- RLS / privacy tests. Run against a fresh DB with the migration applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql
-- Runs in a transaction and rolls back; raises an exception on the first failed assertion.
begin;

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true);
  perform set_config('role', case when u is null then 'anon' else 'authenticated' end, true);
end $$;
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAIL: %', msg; end if; raise notice 'ok: %', msg; end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'founder@x.com',   '{"full_name":"Fay Founder"}'),
  ('00000000-0000-0000-0000-00000000000b', 'builder@x.com',   '{"full_name":"Bo Builder"}'),
  ('00000000-0000-0000-0000-00000000000c', 'stranger@x.com',  '{"full_name":"Cy Stranger"}'),
  ('00000000-0000-0000-0000-00000000000d', 'organizer@x.com', '{"full_name":"Oz Organizer"}');

-- Organizer creates an unlisted event happening now.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
insert into events (id, organizer_id, name, starts_at, ends_at, visibility, cover_url)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000d', 'Meetup', now() - interval '1 hour', now() + interval '2 hours', 'unlisted', 'https://example.com/cover.jpg');
do $$ begin
  insert into events (organizer_id, name, starts_at, ends_at) values ('00000000-0000-0000-0000-00000000000d', 'No cover', now(), now() + interval '1 hour');
  raise exception 'FAIL: event without cover allowed';
exception when check_violation then raise notice 'ok: event requires a cover image';
end $$;
select pg_temp.assert((select length(code) = 6 from events where id = '10000000-0000-0000-0000-000000000001'), 'event code generated');

-- Founder checks in and posts a project with a slot.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into event_checkins (event_id, user_id, location_note) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'table 4');
insert into projects (id, owner_id, name, pitch, openness) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'BuildFast', 'Ship faster', 'specific');
insert into project_slots (id, project_id, specialty) values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Design/UI/UX');
insert into event_projects (event_id, project_id) values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001');

-- Stranger (not checked in) cannot see the board of a non-public event.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) = 0 from event_projects where event_id = '10000000-0000-0000-0000-000000000001'), 'non-checked-in user cannot see unlisted board');
select pg_temp.assert((select count(*) = 0 from event_checkins where event_id = '10000000-0000-0000-0000-000000000001'), 'non-checked-in user cannot see attendees');

-- Builder checks in and can see the board.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into event_checkins (event_id, user_id) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) = 1 from event_projects where event_id = '10000000-0000-0000-0000-000000000001'), 'checked-in user sees board');

-- Nobody sees others' contact details before a connection.
select pg_temp.assert((select count(*) = 0 from user_contacts where user_id = '00000000-0000-0000-0000-00000000000a'), 'builder cannot read founder contacts before acceptance');
select pg_temp.assert((select count(*) = 0 from get_contact('00000000-0000-0000-0000-00000000000a')), 'get_contact empty before acceptance');
select pg_temp.assert((select count(*) = 1 from user_contacts where user_id = '00000000-0000-0000-0000-00000000000b'), 'user reads own contacts');

-- Builder requests to join; duplicate pending request is rejected.
select create_join_request('20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'I design things', null);
do $$ begin
  perform create_join_request('20000000-0000-0000-0000-000000000001', null, '10000000-0000-0000-0000-000000000001', 'again', null);
  raise exception 'FAIL: duplicate request allowed';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: duplicate request rejected (%)', sqlerrm;
end $$;

-- Builder cannot accept their own request.
do $$ begin
  perform respond_join_request((select id from join_requests limit 1), 'accept');
  raise exception 'FAIL: requester accepted own request';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: requester cannot accept own request';
end $$;

-- Stranger cannot see the request.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) = 0 from join_requests), 'stranger cannot see requests');

-- Founder sees the request, still no contact access, then accepts.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) = 1 from join_requests), 'owner sees request');
select pg_temp.assert((select count(*) = 0 from user_contacts where user_id = '00000000-0000-0000-0000-00000000000b'), 'founder cannot read builder contacts before acceptance');
select respond_join_request((select id from join_requests limit 1), 'accept', null, true);
select pg_temp.assert((select status = 'filled' from project_slots where id = '30000000-0000-0000-0000-000000000001'), 'slot marked filled');
select pg_temp.assert((select contact_email = 'builder@x.com' from get_contact('00000000-0000-0000-0000-00000000000b')), 'founder sees builder contact after acceptance');
select pg_temp.assert((select count(*) = 1 from matches), 'match recorded');

-- Builder sees founder contact and project space; stranger sees neither.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) = 1 from user_contacts where user_id = '00000000-0000-0000-0000-00000000000a'), 'builder sees founder contact after acceptance');
insert into messages (project_id, sender_id, body) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'hi team');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) = 0 from user_contacts where user_id in ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b')), 'stranger never sees contacts');
select pg_temp.assert((select count(*) = 0 from messages), 'stranger cannot read project space messages');
do $$ begin
  insert into messages (project_id, sender_id, body) values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', 'spam');
  raise exception 'FAIL: non-member posted message';
exception when others then
  if sqlerrm like 'FAIL%' then raise; end if; raise notice 'ok: non-member cannot post message';
end $$;

-- Anonymous users never see contacts.
select pg_temp.as_user(null);
select pg_temp.assert((select count(*) = 0 from user_contacts), 'anon sees no contacts');

-- Users cannot make themselves admin.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
update profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.assert((select not is_admin from profiles where id = '00000000-0000-0000-0000-00000000000c'), 'cannot self-promote to admin');

-- Blocked users cannot request or see the blocker's projects.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) = 0 from projects where owner_id = '00000000-0000-0000-0000-00000000000a'), 'blocked user cannot see blocker projects');
select pg_temp.assert((select count(*) = 0 from profiles where id = '00000000-0000-0000-0000-00000000000a'), 'blocked user cannot see blocker profile');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) = 1 from profiles where id = '00000000-0000-0000-0000-00000000000c'), 'blocker can still see who they blocked');

-- Rate limit: 10 requests per event.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into projects (owner_id, name, pitch, openness) select '00000000-0000-0000-0000-00000000000a', 'P' || g, 'pitch', 'anyone' from generate_series(1, 11) g;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ declare p record; n int := 0; begin
  for p in select id from projects where name like 'P%' order by name loop
    begin
      perform create_join_request(p.id, null, '10000000-0000-0000-0000-000000000001', null, null);
      n := n + 1;
    exception when others then
      if sqlerrm not like '%limit of 10%' then raise; end if;
    end;
  end loop;
  -- builder already sent 1 request to BuildFast, so 9 more succeed.
  if n <> 9 then raise exception 'FAIL: rate limit allowed % extra requests', n; end if;
  raise notice 'ok: rate limit enforced at 10 per event';
end $$;

rollback;
