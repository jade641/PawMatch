-- PawMatch: verification photos are deleted once they have been reviewed.
--
-- Supabase only lets files be deleted through the Storage API, so the admin's app does
-- it after a review and then clears photo_path here. A failed delete is retried the next
-- time an admin opens the Photos tab. The decision, code and reviewer stay on record.

-- Lives outside the API-exposed public schema, like private.blocked_user_ids().
-- Reads the table as its owner because admins can't select other owners' rows directly.
create or replace function private.is_reviewed_verification_photo(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
           select 1 from public.dog_photo_verifications
            where photo_path = p_name and status in ('approved', 'rejected')
         )
     and not exists (
           select 1 from public.dog_photo_verifications
            where photo_path = p_name and status = 'pending'
         );
$$;

revoke all on function private.is_reviewed_verification_photo(text) from public, anon;
grant execute on function private.is_reviewed_verification_photo(text) to authenticated;

create policy "dog-verifications: admin deletes reviewed" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dog-verifications' and public.is_admin() and private.is_reviewed_verification_photo(name));

create or replace function public.admin_clear_reviewed_photo(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.dog_photo_verifications;
begin
  if not public.is_admin() then
    raise exception 'Only PawMatch administrators can do this';
  end if;

  select * into v from public.dog_photo_verifications where id = p_id for update;
  if not found then
    raise exception 'Verification not found';
  end if;
  if v.status not in ('approved', 'rejected') then
    raise exception 'This photo has not been reviewed yet';
  end if;
  if exists (select 1 from storage.objects where bucket_id = 'dog-verifications' and name = v.photo_path) then
    raise exception 'This photo is still stored';
  end if;

  update public.dog_photo_verifications set photo_path = null where id = v.id;
end;
$$;

revoke all on function public.admin_clear_reviewed_photo(uuid) from public, anon;
grant execute on function public.admin_clear_reviewed_photo(uuid) to authenticated;
