-- Fix "new row violates row-level security policy" on insert ... returning (PostgREST .select()).
-- The old select policies looked the row up by id through a function, which cannot see a row
-- inserted in the same statement. Check the row's own columns first.
drop policy if exists events_select on public.events;
create policy events_select on public.events for select using (
  visibility in ('public', 'unlisted') or organizer_id = auth.uid() or can_view_event(id)
);

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select using (
  owner_id = auth.uid() or can_view_project(id) or is_admin()
);
