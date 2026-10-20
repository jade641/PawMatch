-- PawMatch: profile pictures for owners and verifiers.
--
-- Pictures live in the public "avatars" bucket under "<auth uid>/<file>". The
-- storage path (not a full URL) is stored in users.avatar_url and mirrored to
-- owners.avatar_url and verifiers.avatar; the app turns it into a public URL.
-- The app deletes the previous picture from storage after a replacement is
-- saved, so each account keeps only its current picture.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

-- Listing and removing through the Storage API need select as well as delete.
create policy "avatars: owner reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Sets (or clears, with null) the caller's picture on users / owners / verifiers.
create or replace function public.set_my_avatar(p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_path is not null and (
    (storage.foldername(p_path))[1] is distinct from auth.uid()::text
    or not exists (select 1 from storage.objects where bucket_id = 'avatars' and name = p_path)
  ) then
    raise exception 'Upload the picture before saving it';
  end if;

  update public.users set avatar_url = p_path where id = auth.uid();
  update public.owners set avatar_url = p_path where user_id = auth.uid();
  update public.verifiers set avatar = p_path where user_id = auth.uid();
end;
$$;

grant execute on function public.set_my_avatar(text) to authenticated;
