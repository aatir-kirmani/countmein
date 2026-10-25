-- Blockers can still read the profiles they blocked (so the Blocked list can show names);
-- the blocked user still cannot see the blocker.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  auth.uid() is null or id = auth.uid() or is_admin()
  or not is_blocked_between(id, auth.uid())
  or exists (select 1 from public.blocks b where b.blocker_id = auth.uid() and b.blocked_id = profiles.id)
);
