-- PawMatch: deleting a profile deletes the login too.
--
-- public.users is cascade-deleted when its auth.users row goes, but not the other way
-- round. Deleting a user from public.users (e.g. in the Table Editor) used to leave the
-- login behind: the email stayed "already registered" while sign-in found no profile.

create or replace function public.delete_login_for_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- When the delete started from auth.users this matches nothing: that row is already gone.
  delete from auth.users where id = old.auth_user_id;
  return old;
end;
$$;

revoke all on function public.delete_login_for_profile() from public, anon, authenticated;

create trigger users_delete_login
  after delete on public.users
  for each row execute function public.delete_login_for_profile();
