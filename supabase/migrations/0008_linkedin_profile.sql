-- Prefill new profiles from LinkedIn (OIDC: name, given_name, family_name, picture) as well as GitHub/Google.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  base text;
  uname text;
  display text;
begin
  display := coalesce(
    nullif(meta->>'full_name', ''), nullif(meta->>'name', ''),
    nullif(btrim(coalesce(meta->>'given_name', '') || ' ' || coalesce(meta->>'family_name', '')), ''),
    ''
  );
  base := lower(regexp_replace(coalesce(nullif(meta->>'user_name', ''), nullif(meta->>'preferred_username', ''), split_part(new.email, '@', 1), 'user'), '[^a-zA-Z0-9_]', '', 'g'));
  if base = '' then base := 'user'; end if;
  uname := left(base, 20);
  while exists (select 1 from profiles where username = uname) loop
    uname := left(base, 15) || floor(random() * 100000)::text;
  end loop;
  insert into profiles (id, name, username, avatar_url)
  values (new.id, display, uname, coalesce(nullif(meta->>'avatar_url', ''), nullif(meta->>'picture', '')));
  insert into user_contacts (user_id, contact_email) values (new.id, new.email);
  return new;
end $$;
