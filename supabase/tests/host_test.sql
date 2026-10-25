-- Host controls tests: registration, approval, waitlist, questions, co-hosts, messages, cancel, duplicate, insights.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/host_test.sql
-- Runs in a transaction and rolls back.
begin;

create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true);
  perform set_config('role', case when u is null then 'anon' else 'authenticated' end, true);
end $$;
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond, false) then raise exception 'FAIL: %', msg; end if; raise notice 'ok: %', msg; end $$;
-- Run a statement that must fail with a message containing `expect`.
create or replace function pg_temp.must_fail(stmt text, expect text, msg text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % (statement succeeded)', msg;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if position(lower(expect) in lower(sqlerrm)) = 0 then raise exception 'FAIL: % (got "%")', msg, sqlerrm; end if;
  raise notice 'ok: %', msg;
end $$;

-- o = owner, c = co-host, a/b = guests, s = stranger
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a0', 'owner@x.com'),
  ('00000000-0000-0000-0000-0000000000c0', 'cohost@x.com'),
  ('00000000-0000-0000-0000-0000000000a1', 'a@x.com'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@x.com'),
  ('00000000-0000-0000-0000-0000000000f1', 'stranger@x.com');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a0');
insert into events (id, organizer_id, name, starts_at, ends_at, cover_url, require_approval, timezone,
                    registration_questions)
values ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a0', 'Approval event',
        now() + interval '1 day', now() + interval '1 day 3 hours', 'x', true, 'Asia/Dubai',
        '[{"id":"q1","label":"What are you building?","required":true}]');
insert into event_hosts (event_id, user_id, role) values ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c0', 'cohost');

-- ---------- approval + questions ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.must_fail($$insert into event_checkins (event_id, user_id) values ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1')$$, 'approval', 'walk-in blocked when approval is required');
select pg_temp.must_fail($$select register_for_event('e0000000-0000-0000-0000-000000000001', '{}')$$, 'please answer', 'required question enforced');
select pg_temp.assert(register_for_event('e0000000-0000-0000-0000-000000000001', '{"q1":"A CRM"}') = 'pending', 'registration is pending when approval is required');
select pg_temp.must_fail($$insert into event_checkins (event_id, user_id) values ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1')$$, 'waiting for host approval', 'pending guest cannot check in');
select pg_temp.assert((select count(*) = 1 from event_registrations where user_id = '00000000-0000-0000-0000-0000000000a1'), 'guest sees own registration');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.assert((select count(*) = 0 from event_registrations), 'stranger cannot see registrations');
select pg_temp.must_fail($$select host_set_registration('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'going')$$, 'only hosts', 'stranger cannot approve');

-- ---------- co-host powers ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c0');
select pg_temp.assert((select count(*) = 1 from event_registrations), 'co-host sees registrations');
select pg_temp.assert((select answers->>'q1' = 'A CRM' from event_registrations), 'co-host sees registration answers');
select host_set_registration('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', 'going');
update events set name = 'Renamed by co-host' where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.assert((select name = 'Renamed by co-host' from events where id = 'e0000000-0000-0000-0000-000000000001'), 'co-host can edit event');
delete from events where id = 'e0000000-0000-0000-0000-000000000001';
select pg_temp.assert((select count(*) = 1 from events where id = 'e0000000-0000-0000-0000-000000000001'), 'co-host cannot delete event');
select pg_temp.must_fail($$insert into event_hosts (event_id, user_id) values ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1')$$, 'row-level security', 'co-host cannot add hosts');
select pg_temp.assert((select event_insights('e0000000-0000-0000-0000-000000000001')->>'going')::int = 1, 'co-host sees insights');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into event_checkins (event_id, user_id) values ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1');
select pg_temp.assert(true, 'approved guest can check in');

-- ---------- host check-in at the door ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c0');
select host_check_in('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1');
select pg_temp.assert((select count(*) = 1 from event_checkins where user_id = '00000000-0000-0000-0000-0000000000b1'), 'host can check in an unregistered guest');
select pg_temp.assert((select status = 'going' from event_registrations where user_id = '00000000-0000-0000-0000-0000000000b1'), 'host check-in creates a going registration');
select host_undo_check_in('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1');
select pg_temp.assert((select count(*) = 0 from event_checkins where user_id = '00000000-0000-0000-0000-0000000000b1'), 'host can undo a check-in');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.assert(event_insights('e0000000-0000-0000-0000-000000000001') is null, 'stranger gets no insights');

-- ---------- guest messages ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a0');
insert into event_messages (event_id, author_id, subject, body, audience) values
  ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a0', 'Doors at 7', 'See you', 'going'),
  ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a0', 'Waitlist note', 'Hang tight', 'waitlist');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.assert((select count(*) = 1 from event_messages), 'checked-in guest sees going messages only');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.assert((select count(*) = 0 from event_messages), 'stranger sees no messages');
select pg_temp.must_fail($$insert into event_messages (event_id, author_id, subject, body) values ('e0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', 's', 'b')$$, 'row-level security', 'stranger cannot message guests');

-- ---------- capacity + waitlist ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a0');
insert into events (id, organizer_id, name, starts_at, ends_at, cover_url, capacity, waitlist_enabled)
values ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a0', 'Tiny room', now() + interval '1 day', now() + interval '1 day 2 hours', 'x', 1, true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.assert(register_for_event('e0000000-0000-0000-0000-000000000002') = 'going', 'first guest gets the spot');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select pg_temp.assert(register_for_event('e0000000-0000-0000-0000-000000000002') = 'waitlist', 'second guest is waitlisted');
select pg_temp.must_fail($$insert into event_checkins (event_id, user_id) values ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1')$$, 'waitlist', 'waitlisted guest cannot check in');
select pg_temp.assert((select spots_left = 0 and waitlist = 1 from event_public_stats('e0000000-0000-0000-0000-000000000002')), 'public stats show full room and waitlist');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select cancel_registration('e0000000-0000-0000-0000-000000000002');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a0');
select pg_temp.assert((select status = 'going' from event_registrations where event_id = 'e0000000-0000-0000-0000-000000000002' and user_id = '00000000-0000-0000-0000-0000000000b1'), 'waitlist promoted when a spot frees up');

update events set waitlist_enabled = false where id = 'e0000000-0000-0000-0000-000000000002';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.must_fail($$select register_for_event('e0000000-0000-0000-0000-000000000002')$$, 'full', 'full event without waitlist rejects registration');
select pg_temp.must_fail($$insert into event_checkins (event_id, user_id) values ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f1')$$, 'capacity', 'walk-in blocked at capacity');

-- ---------- registration closed ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a0');
update events set registration_open = false, capacity = null where id = 'e0000000-0000-0000-0000-000000000002';
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.must_fail($$select register_for_event('e0000000-0000-0000-0000-000000000002')$$, 'closed', 'closed registration rejects new guests');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into event_checkins (event_id, user_id) values ('e0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000b1');
select pg_temp.assert(true, 'registered guest can still check in after registration closes');

-- ---------- duplicate ----------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a0');
insert into event_sponsors (event_id, name) values ('e0000000-0000-0000-0000-000000000001', 'Acme');
create temp table dup as select duplicate_event('e0000000-0000-0000-0000-000000000001', now() + interval '8 days', now() + interval '8 days 3 hours') as id;
select pg_temp.assert((select e.require_approval and e.timezone = 'Asia/Dubai' and jsonb_array_length(e.registration_questions) = 1 and e.code <> o.code
  from events e, events o, dup where e.id = dup.id and o.id = 'e0000000-0000-0000-0000-000000000001'), 'duplicate copies settings with a new code');
select pg_temp.assert((select count(*) = 0 from event_registrations r, dup where r.event_id = dup.id), 'duplicate has no guests');
select pg_temp.assert((select count(*) = 1 from event_sponsors s, dup where s.event_id = dup.id), 'duplicate copies sponsors');

-- ---------- cancel ----------
select cancel_event('e0000000-0000-0000-0000-000000000002', 'Venue flooded');
select pg_temp.assert((select event_effective_status(e) = 'cancelled' from events e where id = 'e0000000-0000-0000-0000-000000000002'), 'event shows as cancelled');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.must_fail($$select register_for_event('e0000000-0000-0000-0000-000000000002')$$, 'cancelled', 'cannot register for a cancelled event');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c0');
select pg_temp.must_fail($$select cancel_event('e0000000-0000-0000-0000-000000000002')$$, 'only hosts', 'co-host of another event cannot cancel this one');

-- ---------- page views ----------
select pg_temp.as_user(null);
select track_event_view('e0000000-0000-0000-0000-000000000002');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a0');
select pg_temp.assert((select page_views = 1 from events where id = 'e0000000-0000-0000-0000-000000000002'), 'page views are counted');

select 'ALL_PASSED' as result;
rollback;
