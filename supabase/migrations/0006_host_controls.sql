-- Host controls in line with standard event platforms: registration (RSVP) with approval,
-- waitlist and questions; co-hosts; host check-in; guest messages; cancel/duplicate; time zones; insights.

-- ============================================================
-- Event settings
-- ============================================================
alter table public.events add column if not exists timezone text not null default 'UTC';
alter table public.events add column if not exists require_approval boolean not null default false;
alter table public.events add column if not exists waitlist_enabled boolean not null default false;
alter table public.events add column if not exists registration_open boolean not null default true;
alter table public.events add column if not exists registration_questions jsonb not null default '[]'::jsonb;
alter table public.events add column if not exists show_guest_list boolean not null default true;
alter table public.events add column if not exists page_views integer not null default 0;
alter table public.events add column if not exists cancelled_at timestamptz;
alter table public.events add column if not exists cancel_reason text;
alter table public.events add column if not exists reminder_sent boolean not null default false;
alter table public.events add constraint events_questions_array check (jsonb_typeof(registration_questions) = 'array' and jsonb_array_length(registration_questions) <= 10);
alter table public.events add constraint events_cancel_reason_len check (cancel_reason is null or char_length(cancel_reason) <= 500);

create or replace function public.event_effective_status(e public.events) returns text
language sql stable as $$
  select case
    when e.cancelled_at is not null then 'cancelled'
    when e.status = 'ended' or now() >= e.ends_at then 'ended'
    when now() >= e.starts_at or e.status = 'live' then 'live'
    else 'upcoming' end
$$;

-- ============================================================
-- Co-hosts
-- ============================================================
create table if not exists public.event_hosts (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'cohost' check (role in ('cohost', 'manager')),
  show_on_page boolean not null default true,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists event_hosts_user_idx on public.event_hosts (user_id);

-- Owner only (the creator). Co-hosts can manage almost everything, but not delete the event or change the team.
create or replace function public.is_event_owner(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events where id = eid and organizer_id = auth.uid())
$$;

-- Owner or co-host/manager. Every policy built on this now includes co-hosts.
create or replace function public.is_event_organizer(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events where id = eid and organizer_id = auth.uid())
      or exists (select 1 from event_hosts where event_id = eid and user_id = auth.uid())
$$;

create or replace function public.can_view_board(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e where e.id = eid and (
      is_event_organizer(eid) or is_admin() or (
        (e.visibility = 'public' or is_checked_in(eid))
        and now() < e.ends_at + interval '7 days'
      )
    )
  )
$$;


drop policy if exists events_update on public.events;
create policy events_update on public.events for update using (is_event_organizer(id) or is_admin());

alter table public.event_hosts enable row level security;
create policy hosts_select on public.event_hosts for select using (can_view_event(event_id));
create policy hosts_insert on public.event_hosts for insert with check (is_event_owner(event_id) and user_id <> auth.uid());
create policy hosts_update on public.event_hosts for update using (is_event_owner(event_id));
create policy hosts_delete on public.event_hosts for delete using (is_event_owner(event_id) or user_id = auth.uid());

-- ============================================================
-- Registrations (RSVP)
-- ============================================================
create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('going', 'pending', 'waitlist', 'declined', 'cancelled')),
  answers jsonb not null default '{}'::jsonb,
  decided_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index if not exists event_registrations_event_idx on public.event_registrations (event_id, status);

-- Registered guests can see the event they registered for (e.g. invite-only after approval).
create or replace function public.can_view_event(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e where e.id = eid and (
      e.visibility in ('public','unlisted') or is_event_organizer(eid)
      or is_checked_in(eid) or is_invited(eid) or is_admin()
      or exists (select 1 from event_registrations r where r.event_id = eid and r.user_id = auth.uid())
    )
  )
$$;

alter table public.event_registrations enable row level security;
-- Private: only the guest and the hosts. Public counts come from event_public_stats().
create policy registrations_select on public.event_registrations for select
  using (user_id = auth.uid() or is_event_organizer(event_id) or is_admin());
-- All writes go through the RPCs below.

create or replace function public.going_count(eid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from event_registrations where event_id = eid and status = 'going'
$$;

create or replace function public.register_for_event(p_event uuid, p_answers jsonb default '{}'::jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  e events;
  r event_registrations;
  q jsonb;
  st text;
begin
  if me is null or not is_active_user() then raise exception 'Sign in to register'; end if;
  select * into e from events where id = p_event;
  if e.id is null or not can_view_event(p_event) then raise exception 'Event not found'; end if;
  if event_effective_status(e) = 'cancelled' then raise exception 'This event was cancelled'; end if;
  if event_effective_status(e) = 'ended' then raise exception 'This event has ended'; end if;

  select * into r from event_registrations where event_id = p_event and user_id = me;
  if r.status in ('going', 'pending', 'waitlist') then return r.status; end if;
  if r.status = 'declined' then raise exception 'The host declined your registration for this event'; end if;

  if not e.registration_open and not is_event_organizer(p_event) then raise exception 'Registration is closed'; end if;
  if e.visibility = 'invite_only' and not is_invited(p_event) and not is_event_organizer(p_event) then
    raise exception 'This event is invite-only';
  end if;

  -- Required questions must be answered.
  for q in select * from jsonb_array_elements(e.registration_questions) loop
    if coalesce((q->>'required')::boolean, false)
       and coalesce(btrim(p_answers->>(q->>'id')), '') = '' then
      raise exception 'Please answer: %', q->>'label';
    end if;
  end loop;

  if is_event_organizer(p_event) then st := 'going';
  elsif e.require_approval then st := 'pending';
  elsif e.capacity is not null and going_count(p_event) >= e.capacity then
    if e.waitlist_enabled then st := 'waitlist'; else raise exception 'This event is full'; end if;
  else st := 'going';
  end if;

  insert into event_registrations (event_id, user_id, status, answers)
  values (p_event, me, st, coalesce(p_answers, '{}'::jsonb))
  on conflict (event_id, user_id) do update set status = excluded.status, answers = excluded.answers, updated_at = now(), decided_by = null;
  return st;
end $$;

-- Fill freed spots from the waitlist (oldest first) when no approval is needed.
create or replace function public.promote_waitlist(p_event uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare e events; n int := 0; free int;
begin
  select * into e from events where id = p_event;
  if e.require_approval or not e.waitlist_enabled then return 0; end if;
  free := case when e.capacity is null then 1000000 else e.capacity - going_count(p_event) end;
  if free <= 0 then return 0; end if;
  with nxt as (
    select id from event_registrations where event_id = p_event and status = 'waitlist' order by created_at limit free
  )
  update event_registrations r set status = 'going', updated_at = now() from nxt where r.id = nxt.id;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.cancel_registration(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update event_registrations set status = 'cancelled', updated_at = now()
  where event_id = p_event and user_id = auth.uid() and status in ('going', 'pending', 'waitlist');
  perform promote_waitlist(p_event);
end $$;

-- Host decisions on a single guest: going (approve), declined, waitlist, pending.
create or replace function public.host_set_registration(p_event uuid, p_user uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_event_organizer(p_event) then raise exception 'Only hosts can do that'; end if;
  if p_status not in ('going', 'declined', 'waitlist', 'pending') then raise exception 'Unknown status'; end if;
  insert into event_registrations (event_id, user_id, status, decided_by)
  values (p_event, p_user, p_status, auth.uid())
  on conflict (event_id, user_id) do update set status = excluded.status, decided_by = auth.uid(), updated_at = now();
  if p_status = 'declined' then
    delete from event_checkins where event_id = p_event and user_id = p_user;
    perform promote_waitlist(p_event);
  end if;
end $$;

-- Approve everyone who is pending or on the waitlist.
create or replace function public.host_approve_all(p_event uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not is_event_organizer(p_event) then raise exception 'Only hosts can do that'; end if;
  update event_registrations set status = 'going', decided_by = auth.uid(), updated_at = now()
  where event_id = p_event and status in ('pending', 'waitlist');
  get diagnostics n = row_count;
  return n;
end $$;

-- Host checks a guest in at the door (scanner or manual). Bypasses guest-side rules.
create or replace function public.host_check_in(p_event uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_event_organizer(p_event) then raise exception 'Only hosts can check guests in'; end if;
  if not exists (select 1 from profiles where id = p_user) then raise exception 'Guest not found'; end if;
  perform set_config('countmein.host_checkin', 'on', true);
  insert into event_registrations (event_id, user_id, status, decided_by)
  values (p_event, p_user, 'going', auth.uid())
  on conflict (event_id, user_id) do update set status = 'going', decided_by = auth.uid(), updated_at = now();
  insert into event_checkins (event_id, user_id) values (p_event, p_user) on conflict (event_id, user_id) do nothing;
  perform set_config('countmein.host_checkin', 'off', true);
end $$;

create or replace function public.host_undo_check_in(p_event uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_event_organizer(p_event) then raise exception 'Only hosts can do that'; end if;
  delete from event_checkins where event_id = p_event and user_id = p_user;
end $$;

-- Check-in rules now respect registration, approval, waitlist and capacity (counted on going registrations).
create or replace function public.enforce_checkin() returns trigger
language plpgsql security definer set search_path = public as $$
declare e events; r event_registrations;
begin
  if current_setting('countmein.host_checkin', true) = 'on' then return new; end if;
  select * into e from events where id = new.event_id;
  if event_effective_status(e) = 'cancelled' then raise exception 'This event was cancelled'; end if;
  if event_effective_status(e) = 'ended' then raise exception 'This event has ended'; end if;
  if e.organizer_id = new.user_id or exists (select 1 from event_hosts where event_id = e.id and user_id = new.user_id) then
    return new;
  end if;

  select * into r from event_registrations where event_id = e.id and user_id = new.user_id;
  if r.status = 'going' then return new; end if;
  if r.status = 'pending' then raise exception 'Your registration is waiting for host approval'; end if;
  if r.status = 'waitlist' then raise exception 'You are on the waitlist. The host will let you know if a spot opens'; end if;
  if r.status = 'declined' then raise exception 'The host declined your registration for this event'; end if;

  -- Walk-in (no registration yet).
  if e.require_approval then raise exception 'This event requires host approval. Register first'; end if;
  if not e.registration_open then raise exception 'Registration is closed'; end if;
  if e.visibility = 'invite_only' and not exists (
    select 1 from event_invites i join auth.users u on lower(u.email) = lower(i.email)
    where i.event_id = e.id and u.id = new.user_id
  ) then
    raise exception 'This event is invite-only';
  end if;
  if exists (select 1 from jsonb_array_elements(e.registration_questions) q where coalesce((q->>'required')::boolean, false)) then
    raise exception 'Register first: the host has a few questions for you';
  end if;
  if e.capacity is not null and going_count(e.id) >= e.capacity then raise exception 'This event is at capacity'; end if;
  if e.ticket_price_cents > 0 and not exists (
    select 1 from event_tickets where event_id = e.id and user_id = new.user_id and status = 'paid'
  ) then
    raise exception 'A ticket is required to check in';
  end if;
  return new;
end $$;

-- Every check-in has a matching going registration (walk-ins get one automatically).
create or replace function public.checkin_registers() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into event_registrations (event_id, user_id, status)
  values (new.event_id, new.user_id, 'going')
  on conflict (event_id, user_id) do update set status = 'going', updated_at = now()
  where event_registrations.status <> 'going';
  return new;
end $$;
drop trigger if exists checkin_registers on public.event_checkins;
create trigger checkin_registers after insert on public.event_checkins
  for each row execute function public.checkin_registers();

-- Public numbers for the event page (no identities).
create or replace function public.event_public_stats(p_event uuid)
returns table (going bigint, checked_in bigint, waitlist bigint, spots_left integer)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from event_registrations where event_id = p_event and status = 'going'),
    (select count(*) from event_checkins where event_id = p_event),
    (select count(*) from event_registrations where event_id = p_event and status = 'waitlist'),
    (select case when e.capacity is null then null else greatest(0, e.capacity - going_count(p_event)) end from events e where e.id = p_event)
  where can_view_event(p_event)
$$;

-- ============================================================
-- Guest messages (blasts)
-- ============================================================
create table if not exists public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  subject text not null check (char_length(subject) between 1 and 140),
  body text not null check (char_length(body) between 1 and 4000),
  audience text not null default 'all' check (audience in ('all', 'going', 'checked_in', 'pending', 'waitlist')),
  emailed_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists event_messages_event_idx on public.event_messages (event_id, created_at desc);

-- The viewer's relationship to an event, for message audiences.
create or replace function public.guest_status(eid uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from event_checkins where event_id = eid and user_id = auth.uid()) then 'checked_in'
    else (select status from event_registrations where event_id = eid and user_id = auth.uid())
  end
$$;

alter table public.event_messages enable row level security;
create policy event_messages_select on public.event_messages for select using (
  is_event_organizer(event_id) or is_admin() or (
    guest_status(event_id) in ('checked_in', 'going', 'pending', 'waitlist') and (
      audience = 'all'
      or audience = guest_status(event_id)
      or (audience = 'going' and guest_status(event_id) = 'checked_in')
    )
  )
);
create policy event_messages_insert on public.event_messages for insert
  with check (is_event_organizer(event_id) and author_id = auth.uid());
create policy event_messages_delete on public.event_messages for delete using (is_event_organizer(event_id));

-- ============================================================
-- Lifecycle: cancel, duplicate
-- ============================================================
create or replace function public.cancel_event(p_event uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_event_organizer(p_event) then raise exception 'Only hosts can cancel this event'; end if;
  update events set cancelled_at = now(), cancel_reason = nullif(btrim(p_reason), '') where id = p_event and cancelled_at is null;
end $$;

create or replace function public.uncancel_event(p_event uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_event_organizer(p_event) then raise exception 'Only hosts can do that'; end if;
  update events set cancelled_at = null, cancel_reason = null where id = p_event;
end $$;

-- Copy an event's details and settings (not guests) to new dates. Returns the new event id.
create or replace function public.duplicate_event(p_event uuid, p_starts timestamptz, p_ends timestamptz) returns uuid
language plpgsql security definer set search_path = public as $$
declare src events; new_id uuid;
begin
  if not is_event_organizer(p_event) then raise exception 'Only hosts can duplicate this event'; end if;
  if p_ends <= p_starts then raise exception 'End must be after start'; end if;
  select * into src from events where id = p_event;
  insert into events (
    organizer_id, series_id, name, description, starts_at, ends_at, venue, city, maps_url, location_details,
    cover_url, gallery_urls, video_url, visibility, capacity, ticket_price_cents, currency, timezone,
    require_approval, waitlist_enabled, registration_open, registration_questions, show_guest_list
  ) values (
    auth.uid(), src.series_id, src.name, src.description, p_starts, p_ends, src.venue, src.city, src.maps_url, src.location_details,
    src.cover_url, src.gallery_urls, src.video_url, src.visibility, src.capacity, src.ticket_price_cents, src.currency, src.timezone,
    src.require_approval, src.waitlist_enabled, true, src.registration_questions, src.show_guest_list
  ) returning id into new_id;
  insert into event_sponsors (event_id, name, logo_url, url, tier)
    select new_id, name, logo_url, url, tier from event_sponsors where event_id = p_event;
  return new_id;
end $$;

-- ============================================================
-- Insights
-- ============================================================
create or replace function public.track_event_view(p_event uuid) returns void
language sql security definer set search_path = public as $$
  update events set page_views = page_views + 1 where id = p_event and can_view_event(p_event)
$$;

create or replace function public.event_insights(p_event uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when not (is_event_organizer(p_event) or is_admin()) then null else jsonb_build_object(
    'page_views', (select page_views from events where id = p_event),
    'going', (select count(*) from event_registrations where event_id = p_event and status = 'going'),
    'pending', (select count(*) from event_registrations where event_id = p_event and status = 'pending'),
    'waitlist', (select count(*) from event_registrations where event_id = p_event and status = 'waitlist'),
    'declined', (select count(*) from event_registrations where event_id = p_event and status = 'declined'),
    'cancelled', (select count(*) from event_registrations where event_id = p_event and status = 'cancelled'),
    'checked_in', (select count(*) from event_checkins where event_id = p_event),
    'projects', (select count(*) from event_projects where event_id = p_event),
    'requests', (select count(*) from join_requests where event_id = p_event),
    'matches', (select count(*) from matches where event_id = p_event),
    'registrations_by_day', coalesce((
      select jsonb_agg(jsonb_build_object('day', d, 'count', c) order by d)
      from (select date_trunc('day', created_at)::date d, count(*) c from event_registrations where event_id = p_event group by 1) x
    ), '[]'::jsonb),
    'checkins_by_hour', coalesce((
      select jsonb_agg(jsonb_build_object('hour', h, 'count', c) order by h)
      from (select date_trunc('hour', checked_in_at) h, count(*) c from event_checkins where event_id = p_event group by 1) y
    ), '[]'::jsonb)
  ) end
$$;

-- Organizer stats now include co-hosts (is_event_organizer) automatically.

-- ============================================================
-- Grants and realtime
-- ============================================================
grant execute on function public.register_for_event(uuid, jsonb) to authenticated;
grant execute on function public.cancel_registration(uuid) to authenticated;
grant execute on function public.host_set_registration(uuid, uuid, text) to authenticated;
grant execute on function public.host_approve_all(uuid) to authenticated;
grant execute on function public.host_check_in(uuid, uuid) to authenticated;
grant execute on function public.host_undo_check_in(uuid, uuid) to authenticated;
grant execute on function public.event_public_stats(uuid) to anon, authenticated;
grant execute on function public.track_event_view(uuid) to anon, authenticated;
grant execute on function public.event_insights(uuid) to authenticated;
grant execute on function public.cancel_event(uuid, text) to authenticated;
grant execute on function public.uncancel_event(uuid) to authenticated;
grant execute on function public.duplicate_event(uuid, timestamptz, timestamptz) to authenticated;
revoke execute on function public.promote_waitlist(uuid) from public, anon, authenticated;

alter publication supabase_realtime add table public.event_registrations, public.event_messages, public.event_hosts;
