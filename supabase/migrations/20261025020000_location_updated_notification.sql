-- PawMatch: every location change is announced in Notifications, not a toast.
--
-- update_my_profile adds a "system" notification when the location changes:
-- "Profile completed" the first time a location is set, "Location updated" after
-- that. data.silent tells the app not to pop up a toast for it.

create or replace function public.update_my_profile(p_full_name text, p_phone text, p_location text)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
  v_location text := nullif(trim(coalesce(p_location, '')), '');
  v_was_completed boolean;
  v_old_location text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Name is required';
  end if;

  select profile_completed, location into v_was_completed, v_old_location from public.users where id = auth.uid();

  update public.users
     set full_name = trim(p_full_name),
         phone = nullif(trim(coalesce(p_phone, '')), ''),
         location = coalesce(v_location, location),
         profile_completed = profile_completed or v_location is not null
   where id = auth.uid()
  returning * into v_user;

  update public.owners
     set display_name = v_user.full_name, location = v_user.location
   where user_id = v_user.id;
  update public.verifiers
     set name = v_user.full_name
   where user_id = v_user.id;

  if v_user.profile_completed and not v_was_completed then
    perform public.notify(
      v_user.id, 'system', 'Profile completed',
      'Your location is set to ' || v_user.location || '. PawMatch will now show you dogs nearby.',
      jsonb_build_object('kind', 'profile_completed', 'silent', true)
    );
  elsif v_user.location is distinct from v_old_location then
    perform public.notify(
      v_user.id, 'system', 'Location updated',
      'Your location is now ' || v_user.location || '. PawMatch will show you dogs nearby.',
      jsonb_build_object('kind', 'location_updated', 'silent', true)
    );
  end if;

  return v_user;
end;
$$;
