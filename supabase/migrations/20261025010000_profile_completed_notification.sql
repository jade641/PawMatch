-- PawMatch: completing the profile is announced in Notifications instead of a toast.
--
-- When update_my_profile first sets a location, it adds a "system" notification.
-- data.silent tells the app not to pop up a toast for it when it arrives live.

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
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Name is required';
  end if;

  select profile_completed into v_was_completed from public.users where id = auth.uid();

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
  end if;

  return v_user;
end;
$$;
