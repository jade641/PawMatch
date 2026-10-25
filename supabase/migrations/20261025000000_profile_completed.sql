-- PawMatch: track whether an account has chosen its location.
--
-- The email sign-up form always sends a district, but Google sign-in skips that
-- form, so those accounts start on the "Davao City" default. users.profile_completed
-- stays false until the user saves their profile (update_my_profile). The app uses
-- it to show a "Complete your profile" card on Home and to ask for the location
-- before adding a dog or sending a match request.

alter table public.users add column if not exists profile_completed boolean not null default false;

-- Existing accounts: complete if they signed up with a location or have since set a district.
update public.users u
   set profile_completed = true
  from auth.users a
 where a.id = u.auth_user_id
   and (coalesce(trim(a.raw_user_meta_data ->> 'location'), '') <> '' or u.location <> 'Davao City');

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

  return new;
end;
$$;

-- Saving the profile with a location marks it complete.
create or replace function public.update_my_profile(p_full_name text, p_phone text, p_location text)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users;
  v_location text := nullif(trim(coalesce(p_location, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Name is required';
  end if;

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

  return v_user;
end;
$$;
