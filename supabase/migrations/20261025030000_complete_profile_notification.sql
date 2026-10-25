-- PawMatch: "Complete your profile" is a notification instead of a card on Home.
--
-- Accounts created without a location (Google sign-in) get a "system"
-- notification that opens Edit Profile. Saving a location marks it read.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role text := case when meta ->> 'role' = 'verifier' then 'verifier' else 'owner' end;
  v_name text := coalesce(
    nullif(trim(meta ->> 'full_name'), ''),
    nullif(trim(meta ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'PawMatch user'
  );
  v_chosen_location text := nullif(trim(meta ->> 'location'), '');
  v_location text := coalesce(v_chosen_location, 'Davao City');
begin
  insert into public.users (id, auth_user_id, full_name, email, phone, location, role, profile_completed)
  values (
    new.id, new.id, v_name, coalesce(new.email, ''), nullif(trim(meta ->> 'phone'), ''), v_location, v_role,
    v_chosen_location is not null
  );

  if v_role = 'verifier' then
    insert into public.verifiers (user_id, name, role, clinic, license_number)
    values (
      new.id,
      v_name,
      case when meta ->> 'verifier_role' = 'Certified Breeder' then 'Certified Breeder' else 'Licensed Veterinarian' end,
      coalesce(trim(meta ->> 'clinic'), ''),
      coalesce(trim(meta ->> 'license_number'), '')
    );
  else
    insert into public.owners (user_id, display_name, location)
    values (new.id, v_name, v_location);
  end if;

  if v_chosen_location is null then
    perform public.notify(
      new.id, 'system', 'Complete your profile',
      'Add your district so PawMatch can show you dogs nearby.',
      jsonb_build_object('kind', 'complete_profile', 'silent', true)
    );
  end if;

  return new;
end;
$$;

-- Accounts that are still incomplete get the reminder too (once).
insert into public.notifications (user_id, type, title, body, data)
select u.id, 'system', 'Complete your profile',
       'Add your district so PawMatch can show you dogs nearby.',
       jsonb_build_object('kind', 'complete_profile', 'silent', true)
  from public.users u
 where not u.profile_completed
   and not exists (
     select 1 from public.notifications n where n.user_id = u.id and n.data ->> 'kind' = 'complete_profile'
   );

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
    -- The "Complete your profile" reminder is done.
    update public.notifications
       set read = true
     where user_id = v_user.id and data ->> 'kind' = 'complete_profile';
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
