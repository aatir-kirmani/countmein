-- Countmein schema: tables, RLS, triggers, RPCs, realtime, storage.
create extension if not exists pgcrypto;

-- ============================================================
-- Tables
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  username text unique not null,
  avatar_url text,
  bio text check (char_length(bio) <= 160),
  skills text[] not null default '{}',
  links jsonb not null default '{}'::jsonb,
  hours_per_week int check (hours_per_week between 0 and 80),
  looking_for text[] not null default '{}',
  onboarded boolean not null default false,
  is_admin boolean not null default false,
  is_organizer boolean not null default true,
  banned boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Contact details live in their own table so they can never leak through profile reads.
create table public.user_contacts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  contact_email text,
  contact_phone text
);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table public.event_series (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text unique not null,
  description text,
  city text,
  cover_url text,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  series_id uuid references public.event_series(id) on delete set null,
  name text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue text,
  city text,
  cover_url text,
  code text unique not null,
  visibility text not null default 'public' check (visibility in ('public','unlisted','invite_only')),
  capacity int check (capacity > 0),
  status text not null default 'upcoming' check (status in ('upcoming','live','ended')),
  ticket_price_cents int not null default 0 check (ticket_price_cents >= 0),
  currency text not null default 'usd',
  recap_sent boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.events (organizer_id);

create table public.event_invites (
  event_id uuid not null references public.events(id) on delete cascade,
  email text not null,
  primary key (event_id, email)
);

create table public.event_tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_session_id text unique,
  status text not null default 'pending' check (status in ('pending','paid','refunded')),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table public.event_sponsors (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  logo_url text,
  url text,
  tier text not null default 'supporter',
  created_at timestamptz not null default now()
);

create table public.event_checkins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  location_note text check (char_length(location_note) <= 80),
  unique (event_id, user_id)
);
create index on public.event_checkins (user_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  pitch text not null check (char_length(pitch) between 1 and 100),
  description text,
  stage text not null default 'idea' check (stage in ('idea','building','launched','revenue')),
  link text,
  logo_url text,
  tech_stack text[] not null default '{}',
  openness text not null default 'closed' check (openness in ('closed','specific','anyone')),
  general_note text,
  created_at timestamptz not null default now()
);
create index on public.projects (owner_id);

create table public.project_slots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  specialty text not null,
  description text,
  commitment text,
  compensation text not null default 'tbd' check (compensation in ('equity','paid','rev_share','unpaid','tbd')),
  status text not null default 'open' check (status in ('open','filled','closed')),
  created_at timestamptz not null default now()
);
create index on public.project_slots (project_id);

create table public.event_projects (
  event_id uuid not null references public.events(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (event_id, project_id)
);
create index on public.event_projects (project_id);

-- requester_id is always the candidate (non-owner). direction says who initiated.
create table public.join_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  slot_id uuid references public.project_slots(id) on delete set null,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  message text check (char_length(message) <= 280),
  status text not null default 'pending' check (status in ('pending','interested','accepted','declined','withdrawn','expired')),
  direction text not null default 'request' check (direction in ('request','invite')),
  decline_reason text,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create unique index join_requests_one_open on public.join_requests (project_id, requester_id)
  where status in ('pending','interested');
create index on public.join_requests (requester_id);
create index on public.join_requests (event_id);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'Collaborator',
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index on public.project_members (user_id);

-- Public feed of matches for the projector celebration.
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now()
);
create index on public.matches (event_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index on public.messages (project_id, created_at);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  assignee_id uuid references public.profiles(id) on delete set null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.tasks (project_id);

create table public.project_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  url text,
  note text,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('project','profile','message','event')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 1 and 1000),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Helper functions (security definer to avoid RLS recursion)
-- ============================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and not banned)
$$;

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

create or replace function public.event_effective_status(e public.events) returns text
language sql stable as $$
  select case
    when e.status = 'ended' or now() >= e.ends_at then 'ended'
    when now() >= e.starts_at or e.status = 'live' then 'live'
    else 'upcoming' end
$$;

create or replace function public.is_event_organizer(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from events where id = eid and organizer_id = auth.uid())
$$;

create or replace function public.is_checked_in(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from event_checkins where event_id = eid and user_id = auth.uid())
$$;

create or replace function public.is_invited(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from event_invites i join auth.users u on lower(u.email) = lower(i.email)
    where i.event_id = eid and u.id = auth.uid()
  )
$$;

-- Event metadata: public/unlisted readable by anyone with the link.
create or replace function public.can_view_event(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e where e.id = eid and (
      e.visibility in ('public','unlisted') or e.organizer_id = auth.uid()
      or is_checked_in(eid) or is_invited(eid) or is_admin()
    )
  )
$$;

-- Board + People tab: public events are open; others require check-in. Ended boards stay 7 days.
create or replace function public.can_view_board(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from events e where e.id = eid and (
      e.organizer_id = auth.uid() or is_admin() or (
        (e.visibility = 'public' or is_checked_in(eid))
        and now() < e.ends_at + interval '7 days'
      )
    )
  )
$$;

create or replace function public.is_project_owner(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from projects where id = pid and owner_id = auth.uid())
$$;

create or replace function public.is_project_member(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from project_members where project_id = pid and user_id = auth.uid())
$$;

-- Connected = share membership of at least one project (owner is a member).
create or replace function public.is_connected(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from project_members a join project_members b on a.project_id = b.project_id
    where a.user_id = auth.uid() and b.user_id = other and a.user_id <> b.user_id
  )
$$;

-- Can the viewer see this project's details at all (not blocked by owner)?
create or replace function public.can_view_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from projects p where p.id = pid
      and (auth.uid() is null or not is_blocked_between(p.owner_id, auth.uid()))
  )
$$;

-- ============================================================
-- Triggers
-- ============================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  uname text;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'user_name', split_part(new.email, '@', 1), 'user'), '[^a-zA-Z0-9_]', '', 'g'));
  if base = '' then base := 'user'; end if;
  uname := left(base, 20);
  while exists (select 1 from profiles where username = uname) loop
    uname := left(base, 15) || floor(random() * 100000)::text;
  end loop;
  insert into profiles (id, name, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    uname,
    new.raw_user_meta_data->>'avatar_url'
  );
  insert into user_contacts (user_id, contact_email) values (new.id, new.email);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent users from granting themselves admin/ban status.
create or replace function public.protect_profile_flags() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() and auth.uid() is not null then
    new.is_admin := old.is_admin;
    new.banned := old.banned;
  end if;
  return new;
end $$;
create trigger protect_profile_flags before update on public.profiles
  for each row execute function public.protect_profile_flags();

-- Owner is always a member of their project.
create or replace function public.add_owner_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into project_members (project_id, user_id, role) values (new.id, new.owner_id, 'Founder')
  on conflict do nothing;
  return new;
end $$;
create trigger add_owner_member after insert on public.projects
  for each row execute function public.add_owner_member();

-- Capacity + ticket + invite enforcement on check-in.
create or replace function public.enforce_checkin() returns trigger
language plpgsql security definer set search_path = public as $$
declare e events;
begin
  select * into e from events where id = new.event_id;
  if event_effective_status(e) = 'ended' then raise exception 'This event has ended'; end if;
  if e.visibility = 'invite_only' and e.organizer_id <> new.user_id and not is_invited(e.id) then
    raise exception 'This event is invite-only';
  end if;
  if e.capacity is not null and (select count(*) from event_checkins where event_id = e.id) >= e.capacity then
    raise exception 'This event is at capacity';
  end if;
  if e.ticket_price_cents > 0 and e.organizer_id <> new.user_id and not exists (
    select 1 from event_tickets where event_id = e.id and user_id = new.user_id and status = 'paid'
  ) then
    raise exception 'A ticket is required to check in';
  end if;
  return new;
end $$;
create trigger enforce_checkin before insert on public.event_checkins
  for each row execute function public.enforce_checkin();

-- ============================================================
-- RPCs
-- ============================================================
create or replace function public.gen_event_code() returns text
language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    exit when not exists (select 1 from events where code = c);
  end loop;
  return c;
end $$;

create or replace function public.set_event_code() returns trigger
language plpgsql as $$
begin
  if new.code is null or new.code = '' then new.code := gen_event_code(); end if;
  new.code := upper(new.code);
  return new;
end $$;
create trigger set_event_code before insert on public.events
  for each row execute function public.set_event_code();

-- Look up an event by code (works for invite-only so the page can explain access).
create or replace function public.event_by_code(p_code text)
returns table (id uuid, name text, visibility text, can_view boolean)
language sql stable security definer set search_path = public as $$
  select e.id, e.name, e.visibility, can_view_event(e.id) from events e where e.code = upper(p_code)
$$;

-- Send a request (candidate -> project) or invite (owner -> candidate).
create or replace function public.create_join_request(
  p_project uuid, p_slot uuid, p_event uuid, p_message text, p_candidate uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  proj projects;
  ev events;
  cand uuid;
  dir text;
  rid uuid;
begin
  if me is null or not is_active_user() then raise exception 'Not signed in'; end if;
  select * into proj from projects where id = p_project;
  if proj.id is null then raise exception 'Project not found'; end if;

  if p_candidate is null then
    cand := me; dir := 'request';
    if proj.owner_id = me then raise exception 'You own this project'; end if;
    if proj.openness = 'closed' then raise exception 'This project is not open to collaborators'; end if;
  else
    if proj.owner_id <> me then raise exception 'Only the founder can invite'; end if;
    cand := p_candidate; dir := 'invite';
    if cand = me then raise exception 'You cannot invite yourself'; end if;
  end if;

  if is_blocked_between(proj.owner_id, cand) then raise exception 'Unable to send'; end if;
  if exists (select 1 from project_members where project_id = p_project and user_id = cand) then
    raise exception 'Already a member';
  end if;

  if p_slot is not null and not exists (
    select 1 from project_slots where id = p_slot and project_id = p_project and status = 'open'
  ) then raise exception 'That slot is no longer open'; end if;

  if p_event is not null then
    select * into ev from events where id = p_event;
    if event_effective_status(ev) = 'ended' then raise exception 'This event has ended'; end if;
    if not exists (select 1 from event_checkins where event_id = p_event and user_id = me) then
      raise exception 'Check in to this event first';
    end if;
    if dir = 'request' and (
      select count(*) from join_requests where requester_id = me and event_id = p_event and direction = 'request'
    ) >= 10 then
      raise exception 'You have reached the limit of 10 requests for this event';
    end if;
  end if;

  insert into join_requests (project_id, slot_id, requester_id, event_id, message, direction)
  values (p_project, p_slot, cand, p_event, left(p_message, 280), dir)
  returning id into rid;
  return rid;
exception when unique_violation then
  raise exception 'There is already an open request for this project';
end $$;

-- Respond: accept | decline | interested | withdraw. Authorization depends on direction.
create or replace function public.respond_join_request(
  p_id uuid, p_action text, p_reason text default null, p_fill_slot boolean default false
) returns void
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  r join_requests;
  proj projects;
  is_owner boolean;
  is_cand boolean;
  role_name text;
begin
  select * into r from join_requests where id = p_id for update;
  if r.id is null then raise exception 'Request not found'; end if;
  select * into proj from projects where id = r.project_id;
  is_owner := proj.owner_id = me;
  is_cand := r.requester_id = me;
  if r.status not in ('pending','interested') then raise exception 'This request is already %', r.status; end if;

  if p_action = 'withdraw' then
    if not ((r.direction = 'request' and is_cand) or (r.direction = 'invite' and is_owner)) then
      raise exception 'Not allowed';
    end if;
    update join_requests set status = 'withdrawn', responded_at = now() where id = p_id;
    return;
  end if;

  -- The receiving party responds.
  if not ((r.direction = 'request' and is_owner) or (r.direction = 'invite' and is_cand)) then
    raise exception 'Not allowed';
  end if;

  if p_action = 'decline' then
    update join_requests set status = 'declined', decline_reason = p_reason, responded_at = now() where id = p_id;
  elsif p_action = 'interested' then
    if r.direction <> 'request' then raise exception 'Not allowed'; end if;
    update join_requests set status = 'interested', responded_at = now() where id = p_id;
  elsif p_action = 'accept' then
    select coalesce((select specialty from project_slots where id = r.slot_id), 'Collaborator') into role_name;
    update join_requests set status = 'accepted', responded_at = now() where id = p_id;
    insert into project_members (project_id, user_id, role) values (r.project_id, r.requester_id, role_name)
      on conflict (project_id, user_id) do update set role = excluded.role;
    if r.event_id is not null then
      insert into matches (event_id, project_id, user_id, role) values (r.event_id, r.project_id, r.requester_id, role_name);
    end if;
    if p_fill_slot and r.slot_id is not null then
      update project_slots set status = 'filled' where id = r.slot_id;
    end if;
  else
    raise exception 'Unknown action';
  end if;
end $$;

-- Contact details of a connected user (or yourself). Returns nothing otherwise.
create or replace function public.get_contact(p_user uuid)
returns table (contact_email text, contact_phone text)
language sql stable security definer set search_path = public as $$
  select c.contact_email, c.contact_phone from user_contacts c
  where c.user_id = p_user and (p_user = auth.uid() or is_connected(p_user))
$$;

-- Owner's location note for a candidate marked "let's talk first".
create or replace function public.get_meetup_note(p_request uuid)
returns text
language sql stable security definer set search_path = public as $$
  select ec.location_note from join_requests r
  join projects p on p.id = r.project_id
  join event_checkins ec on ec.event_id = r.event_id and ec.user_id = p.owner_id
  where r.id = p_request and r.status in ('interested','accepted') and r.requester_id = auth.uid()
$$;

create or replace function public.expire_requests() returns int
language sql security definer set search_path = public as $$
  with x as (
    update join_requests r set status = 'expired', responded_at = now()
    from events e
    where r.event_id = e.id and r.status in ('pending','interested') and now() > e.ends_at + interval '48 hours'
    returning 1
  ) select count(*)::int from x
$$;

-- Organizer stats.
create or replace function public.event_stats(p_event uuid)
returns table (attendees bigint, projects bigint, requests bigint, matches bigint, open_slots bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from event_checkins where event_id = p_event),
    (select count(*) from event_projects where event_id = p_event),
    (select count(*) from join_requests where event_id = p_event),
    (select count(*) from matches where event_id = p_event),
    (select count(*) from project_slots s join event_projects ep on ep.project_id = s.project_id
       where ep.event_id = p_event and s.status = 'open')
  where is_event_organizer(p_event) or is_admin()
$$;

create or replace function public.touch_last_seen() returns void
language sql security definer set search_path = public as $$
  update profiles set last_seen_at = now() where id = auth.uid()
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.user_contacts enable row level security;
alter table public.blocks enable row level security;
alter table public.event_series enable row level security;
alter table public.events enable row level security;
alter table public.event_invites enable row level security;
alter table public.event_tickets enable row level security;
alter table public.event_sponsors enable row level security;
alter table public.event_checkins enable row level security;
alter table public.projects enable row level security;
alter table public.project_slots enable row level security;
alter table public.event_projects enable row level security;
alter table public.join_requests enable row level security;
alter table public.project_members enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.tasks enable row level security;
alter table public.project_links enable row level security;
alter table public.reports enable row level security;

-- profiles: public info readable except across blocks; self-update only.
create policy profiles_select on public.profiles for select
  using (auth.uid() is null or id = auth.uid() or is_admin() or not is_blocked_between(id, auth.uid()));
create policy profiles_update on public.profiles for update
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

-- user_contacts: only self, connected collaborators, or admin.
create policy contacts_select on public.user_contacts for select
  using (user_id = auth.uid() or is_connected(user_id) or is_admin());
create policy contacts_update on public.user_contacts for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy blocks_select on public.blocks for select using (blocker_id = auth.uid());
create policy blocks_insert on public.blocks for insert with check (blocker_id = auth.uid());
create policy blocks_delete on public.blocks for delete using (blocker_id = auth.uid());

create policy series_select on public.event_series for select using (true);
create policy series_write on public.event_series for all
  using (organizer_id = auth.uid() or is_admin()) with check (organizer_id = auth.uid() and is_active_user());

create policy events_select on public.events for select using (can_view_event(id));
create policy events_insert on public.events for insert with check (organizer_id = auth.uid() and is_active_user());
create policy events_update on public.events for update using (organizer_id = auth.uid() or is_admin());
create policy events_delete on public.events for delete using (organizer_id = auth.uid() or is_admin());

create policy invites_all on public.event_invites for all
  using (is_event_organizer(event_id)) with check (is_event_organizer(event_id));

create policy tickets_select on public.event_tickets for select
  using (user_id = auth.uid() or is_event_organizer(event_id) or is_admin());
-- tickets are written by the server (service role) after Stripe confirms payment.

create policy sponsors_select on public.event_sponsors for select using (can_view_event(event_id));
create policy sponsors_write on public.event_sponsors for all
  using (is_event_organizer(event_id)) with check (is_event_organizer(event_id));

create policy checkins_select on public.event_checkins for select
  using (user_id = auth.uid() or can_view_board(event_id));
create policy checkins_insert on public.event_checkins for insert
  with check (user_id = auth.uid() and is_active_user() and can_view_event(event_id));
create policy checkins_update on public.event_checkins for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy checkins_delete on public.event_checkins for delete
  using (user_id = auth.uid() or is_event_organizer(event_id));

create policy projects_select on public.projects for select using (can_view_project(id) or is_admin());
create policy projects_insert on public.projects for insert with check (owner_id = auth.uid() and is_active_user());
create policy projects_update on public.projects for update using (owner_id = auth.uid() or is_admin());
create policy projects_delete on public.projects for delete using (owner_id = auth.uid() or is_admin());

create policy slots_select on public.project_slots for select using (can_view_project(project_id));
create policy slots_write on public.project_slots for all
  using (is_project_owner(project_id)) with check (is_project_owner(project_id));

create policy event_projects_select on public.event_projects for select using (can_view_board(event_id));
create policy event_projects_insert on public.event_projects for insert
  with check (is_project_owner(project_id) and is_checked_in(event_id));
create policy event_projects_delete on public.event_projects for delete
  using (is_project_owner(project_id) or is_event_organizer(event_id) or is_admin());

-- join_requests: candidate and project owner only. Writes go through RPCs.
create policy requests_select on public.join_requests for select
  using (requester_id = auth.uid() or is_project_owner(project_id));

create policy members_select on public.project_members for select
  using (true);
create policy members_delete on public.project_members for delete
  using ((is_project_owner(project_id) and user_id <> auth.uid()) or (user_id = auth.uid() and not is_project_owner(project_id)));
create policy members_update on public.project_members for update
  using (is_project_owner(project_id));

create policy matches_select on public.matches for select using (can_view_board(event_id));

create policy messages_select on public.messages for select using (is_project_member(project_id) or is_admin());
create policy messages_insert on public.messages for insert
  with check (sender_id = auth.uid() and is_project_member(project_id) and is_active_user());
create policy messages_delete on public.messages for delete
  using (sender_id = auth.uid() or is_project_owner(project_id) or is_admin());

create policy tasks_all on public.tasks for all
  using (is_project_member(project_id)) with check (is_project_member(project_id));

create policy links_select on public.project_links for select using (is_project_member(project_id));
create policy links_insert on public.project_links for insert
  with check (author_id = auth.uid() and is_project_member(project_id));
create policy links_delete on public.project_links for delete
  using (author_id = auth.uid() or is_project_owner(project_id));

create policy reports_insert on public.reports for insert with check (reporter_id = auth.uid());
create policy reports_select on public.reports for select using (reporter_id = auth.uid() or is_admin());
create policy reports_update on public.reports for update using (is_admin());

-- Lock RPCs to signed-in users.
revoke execute on function public.expire_requests() from public, anon, authenticated;
grant execute on function public.create_join_request(uuid, uuid, uuid, text, uuid) to authenticated;
grant execute on function public.respond_join_request(uuid, text, text, boolean) to authenticated;
grant execute on function public.get_contact(uuid) to authenticated;

-- ============================================================
-- Realtime
-- ============================================================
alter publication supabase_realtime add table
  public.event_checkins, public.event_projects, public.projects, public.project_slots,
  public.join_requests, public.matches, public.messages, public.tasks, public.project_members;

-- ============================================================
-- Storage: public "media" bucket; users write under their own uid folder.
-- ============================================================
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict do nothing;
create policy media_read on storage.objects for select using (bucket_id = 'media');
create policy media_write on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
