-- PawMatch: "Photo Verified" badge.
--
-- To show the dog on a listing is really theirs, an owner gets a random code, writes it
-- on paper and photographs it beside the dog with the in-app camera. An administrator
-- compares that private photo with the listing and awards the badge. The badge is for
-- one specific listing photo, so changing the dog's main photo removes it.

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'match_request', 'request_update', 'message', 'verification_request',
  'verification_result', 'review', 'match_alert', 'system',
  'verifier_application', 'verifier_review', 'user_report', 'photo_verification'
));

alter table public.dogs add column photo_verified_at timestamptz;

create table public.dog_photo_verifications (
  id uuid primary key default gen_random_uuid(),
  dog_id uuid not null references public.dogs (id) on delete cascade,
  owner_id uuid not null references public.users (id) on delete cascade,
  code text not null,
  code_issued_at timestamptz not null default now(),
  photo_path text,
  status text not null default 'awaiting_photo'
    check (status in ('awaiting_photo', 'pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);
create index dog_photo_verifications_dog_idx on public.dog_photo_verifications (dog_id, created_at desc);
create index dog_photo_verifications_status_idx on public.dog_photo_verifications (status, submitted_at desc);
create unique index dog_photo_verifications_one_open_idx
  on public.dog_photo_verifications (dog_id)
  where status in ('awaiting_photo', 'pending');

create trigger dog_photo_verifications_reject_suspended
  before insert or update on public.dog_photo_verifications
  for each row execute function public.reject_if_suspended();

-- The badge vouches for one photo.
create or replace function public.dogs_reset_photo_verification()
returns trigger
language plpgsql
as $$
begin
  if new.img is distinct from old.img then
    new.photo_verified_at := null;
  end if;
  return new;
end;
$$;

create trigger dogs_reset_photo_verification
  before update of img on public.dogs
  for each row execute function public.dogs_reset_photo_verification();

alter table public.dog_photo_verifications enable row level security;
create policy "dog_photo_verifications: owner reads" on public.dog_photo_verifications
  for select to authenticated using (owner_id = auth.uid());

revoke insert, update, delete on public.dog_photo_verifications from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private; only the owner and administrators can open these photos.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dog-verifications', 'dog-verifications', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy "dog-verifications: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dog-verifications' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "dog-verifications: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dog-verifications' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "dog-verifications: owner or admin reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'dog-verifications' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- ---------------------------------------------------------------------------
-- Owner steps
-- ---------------------------------------------------------------------------
-- Returns the open code, or issues one. A code lasts 24 hours so it can't be prepared far ahead.
create or replace function public.start_photo_verification(p_dog uuid)
returns public.dog_photo_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.dogs;
  v public.dog_photo_verifications;
  v_code text := 'PM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
begin
  select * into d from public.dogs where id = p_dog;
  if not found or d.owner_id is distinct from auth.uid() then
    raise exception 'Dog not found';
  end if;
  if d.hidden_at is not null then
    raise exception 'Hidden listings can''t be verified';
  end if;
  if d.img is null then
    raise exception 'Add a profile photo of your dog first';
  end if;
  if d.photo_verified_at is not null then
    raise exception 'This dog is already Photo Verified';
  end if;

  select * into v from public.dog_photo_verifications
   where dog_id = p_dog and status in ('awaiting_photo', 'pending')
   for update;
  if found then
    if v.status = 'pending' then
      raise exception 'This dog''s photo is already waiting for review';
    end if;
    if v.code_issued_at > now() - interval '24 hours' then
      return v;
    end if;
    update public.dog_photo_verifications
       set code = v_code, code_issued_at = now()
     where id = v.id
    returning * into v;
    return v;
  end if;

  insert into public.dog_photo_verifications (dog_id, owner_id, code)
  values (p_dog, d.owner_id, v_code)
  returning * into v;
  return v;
end;
$$;

create or replace function public.submit_photo_verification(p_id uuid, p_path text)
returns public.dog_photo_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.dog_photo_verifications;
  v_dog text;
  v_owner text;
begin
  select * into v from public.dog_photo_verifications where id = p_id for update;
  if not found or v.owner_id is distinct from auth.uid() then
    raise exception 'Verification not found';
  end if;
  if v.status <> 'awaiting_photo' then
    raise exception 'This verification was already submitted';
  end if;
  if v.code_issued_at <= now() - interval '24 hours' then
    raise exception 'This code has expired. Please get a new code.';
  end if;
  if (storage.foldername(p_path))[1] is distinct from auth.uid()::text
     or not exists (select 1 from storage.objects where bucket_id = 'dog-verifications' and name = p_path) then
    raise exception 'Upload the photo before submitting it';
  end if;

  update public.dog_photo_verifications
     set photo_path = p_path, status = 'pending', submitted_at = now()
   where id = v.id
  returning * into v;

  select name into v_dog from public.dogs where id = v.dog_id;
  select full_name into v_owner from public.users where id = v.owner_id;
  perform public.notify(
    u.id,
    'photo_verification',
    'New photo to verify',
    coalesce(v_dog, 'A dog') || ' • ' || coalesce(v_owner, 'an owner'),
    jsonb_build_object('kind', 'new_photo', 'verification_id', v.id)
  )
  from public.users u
  where u.role = 'admin' and u.id <> v.owner_id;

  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Administrator steps
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_photo_verifications()
returns table (
  id uuid,
  status text,
  code text,
  photo_path text,
  review_notes text,
  reviewer_name text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  dog_id uuid,
  dog_name text,
  dog_breed text,
  dog_img text,
  owner_id uuid,
  owner_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only PawMatch administrators can view photo verifications';
  end if;
  return query
    select v.id, v.status, v.code, v.photo_path, v.review_notes, r.full_name, v.submitted_at, v.reviewed_at,
           d.id, d.name, d.breed, d.img, u.id, u.full_name
      from public.dog_photo_verifications v
      join public.dogs d on d.id = v.dog_id
      join public.users u on u.id = v.owner_id
      left join public.users r on r.id = v.reviewed_by
     where v.status <> 'awaiting_photo'
     order by (v.status = 'pending') desc, v.submitted_at desc;
end;
$$;

-- p_decision: 'approve', or 'reject' (remarks required; the owner sees them and can try again).
create or replace function public.admin_review_photo_verification(p_id uuid, p_decision text, p_notes text default null)
returns public.dog_photo_verifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.dog_photo_verifications;
  v_notes text := nullif(trim(coalesce(p_notes, '')), '');
  v_dog text;
begin
  if not public.is_admin() then
    raise exception 'Only PawMatch administrators can review photo verifications';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject';
  end if;

  select * into v from public.dog_photo_verifications where id = p_id for update;
  if not found then
    raise exception 'Verification not found';
  end if;
  if v.status <> 'pending' then
    raise exception 'This photo has already been reviewed';
  end if;
  if v.owner_id = auth.uid() then
    raise exception 'You can''t verify your own dog';
  end if;
  if p_decision = 'reject' and v_notes is null then
    raise exception 'Please add remarks explaining why the photo was not approved';
  end if;

  update public.dog_photo_verifications
     set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
         review_notes = v_notes,
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = v.id
  returning * into v;

  if p_decision = 'approve' then
    update public.dogs set photo_verified_at = now() where id = v.dog_id;
  end if;

  select name into v_dog from public.dogs where id = v.dog_id;
  perform public.notify(
    v.owner_id,
    'photo_verification',
    case when p_decision = 'approve' then 'Photo Verified badge awarded' else 'Photo verification not approved' end,
    case when p_decision = 'approve' then coalesce(v_dog, 'Your dog') || ' is now Photo Verified.' else v_notes end,
    jsonb_build_object('kind', 'photo_reviewed', 'dog_id', v.dog_id, 'status', v.status)
  );

  return v;
end;
$$;

revoke all on function public.dogs_reset_photo_verification() from public, anon, authenticated;
revoke all on function public.start_photo_verification(uuid) from public, anon;
revoke all on function public.submit_photo_verification(uuid, text) from public, anon;
revoke all on function public.admin_list_photo_verifications() from public, anon;
revoke all on function public.admin_review_photo_verification(uuid, text, text) from public, anon;
grant execute on function public.start_photo_verification(uuid) to authenticated;
grant execute on function public.submit_photo_verification(uuid, text) to authenticated;
grant execute on function public.admin_list_photo_verifications() to authenticated;
grant execute on function public.admin_review_photo_verification(uuid, text, text) to authenticated;
