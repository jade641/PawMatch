-- PawMatch: administrators can hide a dog listing or suspend an account.
--
-- A hidden dog disappears for everyone except its owner, who sees why it was hidden.
-- A suspended account can still sign in and read why, but can't change anything: its
-- dogs and vet / breeder listing disappear and every write below is refused.
-- Both close active match requests, and both can be undone by an administrator.

alter table public.dogs
  add column hidden_at timestamptz,
  add column hidden_reason text,
  add column hidden_by uuid references public.users (id) on delete set null;

alter table public.users
  add column suspended_at timestamptz,
  add column suspended_reason text,
  add column suspended_by uuid references public.users (id) on delete set null;

create index dogs_hidden_idx on public.dogs (hidden_at) where hidden_at is not null;
create index users_suspended_idx on public.users (suspended_at) where suspended_at is not null;

-- ---------------------------------------------------------------------------
-- Visibility
-- ---------------------------------------------------------------------------
-- Lives outside the API-exposed public schema, like private.blocked_user_ids().
create or replace function private.suspended_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where suspended_at is not null;
$$;

revoke all on function private.suspended_user_ids() from public, anon;
grant execute on function private.suspended_user_ids() to authenticated;

drop policy "dogs: read all except blocked users" on public.dogs;
create policy "dogs: read visible listings" on public.dogs
  for select to authenticated
  using (
    owner_id = auth.uid()
    or (
      hidden_at is null
      and owner_id not in (select private.blocked_user_ids())
      and owner_id not in (select private.suspended_user_ids())
    )
  );

drop policy "verifiers: read approved or own" on public.verifiers;
create policy "verifiers: read approved or own" on public.verifiers
  for select to authenticated
  using (user_id = auth.uid() or (approved and user_id not in (select private.suspended_user_ids())));

-- ---------------------------------------------------------------------------
-- Enforcement
-- ---------------------------------------------------------------------------
create or replace function public.reject_if_suspended()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.users where id = auth.uid() and suspended_at is not null) then
    raise exception 'Your account is suspended';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger dogs_reject_suspended
  before insert or update or delete on public.dogs
  for each row execute function public.reject_if_suspended();
create trigger match_requests_reject_suspended
  before insert or update on public.match_requests
  for each row execute function public.reject_if_suspended();
create trigger messages_reject_suspended
  before insert on public.messages
  for each row execute function public.reject_if_suspended();
create trigger reviews_reject_suspended
  before insert on public.reviews
  for each row execute function public.reject_if_suspended();
create trigger verifier_submissions_reject_suspended
  before insert or update on public.verifier_submissions
  for each row execute function public.reject_if_suspended();
create trigger user_reports_reject_suspended
  before insert on public.user_reports
  for each row execute function public.reject_if_suspended();

-- The request triggers read dogs as the table owner, so RLS alone wouldn't stop these.
create or replace function public.match_requests_moderation_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
      from public.dogs d
      join public.users u on u.id = d.owner_id
     where d.id in (new.dog_id, new.requester_dog_id)
       and (d.hidden_at is not null or u.suspended_at is not null)
  ) then
    raise exception 'This dog is no longer available';
  end if;
  return new;
end;
$$;

create trigger match_requests_moderation_check
  before insert on public.match_requests
  for each row execute function public.match_requests_moderation_check();

create or replace function public.verifier_submissions_moderation_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.users where id = new.verifier_user_id and suspended_at is not null) then
    raise exception 'This verifier is not available';
  end if;
  return new;
end;
$$;

create trigger verifier_submissions_moderation_check
  before insert on public.verifier_submissions
  for each row execute function public.verifier_submissions_moderation_check();

-- ---------------------------------------------------------------------------
-- Administrator actions
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_dog_hidden(p_dog uuid, p_hidden boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.dogs;
  r public.match_requests;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Only PawMatch administrators can moderate listings';
  end if;

  select * into d from public.dogs where id = p_dog for update;
  if not found then
    raise exception 'Dog not found';
  end if;
  if d.owner_id = auth.uid() then
    raise exception 'You can''t moderate your own listing';
  end if;

  if not p_hidden then
    if d.hidden_at is null then
      raise exception 'This listing is not hidden';
    end if;
    update public.dogs set hidden_at = null, hidden_reason = null, hidden_by = null where id = d.id;
    perform public.notify(
      d.owner_id,
      'system',
      'Your listing is visible again',
      d.name || ' is back on PawMatch.',
      jsonb_build_object('kind', 'dog_restored', 'dog_id', d.id)
    );
    return;
  end if;

  if d.hidden_at is not null then
    raise exception 'This listing is already hidden';
  end if;
  if v_reason is null then
    raise exception 'Please add a reason for hiding this listing';
  end if;

  update public.dogs set hidden_at = now(), hidden_reason = v_reason, hidden_by = auth.uid() where id = d.id;

  for r in
    update public.match_requests
       set status = 'cancelled'
     where status in ('pending', 'accepted') and p_dog in (dog_id, requester_dog_id)
    returning *
  loop
    perform public.notify(
      case when r.recipient_user_id = d.owner_id then r.requester_user_id else r.recipient_user_id end,
      'request_update',
      'Breeding request cancelled',
      'This request was closed by the PawMatch team.',
      jsonb_build_object('match_request_id', r.id, 'status', 'cancelled')
    );
  end loop;

  perform public.notify(
    d.owner_id,
    'system',
    'Your listing was hidden',
    d.name || ' was hidden by the PawMatch team: ' || v_reason,
    jsonb_build_object('kind', 'dog_hidden', 'dog_id', d.id)
  );
end;
$$;

create or replace function public.admin_set_user_suspended(p_user uuid, p_suspended boolean, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u public.users;
  r public.match_requests;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Only PawMatch administrators can suspend accounts';
  end if;

  select * into u from public.users where id = p_user for update;
  if not found then
    raise exception 'User not found';
  end if;
  if u.id = auth.uid() then
    raise exception 'You can''t suspend your own account';
  end if;
  if u.role = 'admin' then
    raise exception 'Administrators can''t be suspended';
  end if;

  if not p_suspended then
    if u.suspended_at is null then
      raise exception 'This account is not suspended';
    end if;
    update public.users set suspended_at = null, suspended_reason = null, suspended_by = null where id = u.id;
    perform public.notify(
      u.id,
      'system',
      'Your account was reinstated',
      'You can use PawMatch again.',
      jsonb_build_object('kind', 'account_reinstated')
    );
    return;
  end if;

  if u.suspended_at is not null then
    raise exception 'This account is already suspended';
  end if;
  if v_reason is null then
    raise exception 'Please add a reason for suspending this account';
  end if;

  update public.users set suspended_at = now(), suspended_reason = v_reason, suspended_by = auth.uid() where id = u.id;

  for r in
    update public.match_requests
       set status = 'cancelled'
     where status in ('pending', 'accepted') and u.id in (requester_user_id, recipient_user_id)
    returning *
  loop
    perform public.notify(
      case when r.recipient_user_id = u.id then r.requester_user_id else r.recipient_user_id end,
      'request_update',
      'Breeding request cancelled',
      'This request was closed by the PawMatch team.',
      jsonb_build_object('match_request_id', r.id, 'status', 'cancelled')
    );
  end loop;

  perform public.notify(
    u.id,
    'system',
    'Your account was suspended',
    v_reason,
    jsonb_build_object('kind', 'account_suspended')
  );
end;
$$;

-- A reported user's account status and dogs, for the report screen.
create or replace function public.admin_user_moderation(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only PawMatch administrators can view this';
  end if;
  select jsonb_build_object(
           'role', u.role,
           'suspended_at', u.suspended_at,
           'suspended_reason', u.suspended_reason,
           'dogs', coalesce((
             select jsonb_agg(
                      jsonb_build_object('id', d.id, 'name', d.name, 'breed', d.breed, 'img', d.img,
                                         'hidden_at', d.hidden_at, 'hidden_reason', d.hidden_reason)
                      order by d.created_at)
               from public.dogs d
              where d.owner_id = u.id
           ), '[]'::jsonb)
         )
    into v_result
    from public.users u
   where u.id = p_user;
  if v_result is null then
    raise exception 'User not found';
  end if;
  return v_result;
end;
$$;

-- Everything currently hidden or suspended, newest first, so it can be undone.
create or replace function public.admin_list_restricted()
returns table (
  kind text,
  target_id uuid,
  title text,
  subtitle text,
  reason text,
  restricted_at timestamptz,
  restricted_by text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only PawMatch administrators can view this';
  end if;
  return query
    select x.kind, x.target_id, x.title, x.subtitle, x.reason, x.restricted_at, x.restricted_by
      from (
        select 'dog'::text as kind, d.id as target_id, d.name as title,
               d.breed || ' • ' || o.full_name as subtitle, d.hidden_reason as reason,
               d.hidden_at as restricted_at, a.full_name as restricted_by
          from public.dogs d
          join public.users o on o.id = d.owner_id
          left join public.users a on a.id = d.hidden_by
         where d.hidden_at is not null
        union all
        select 'user'::text, u.id, u.full_name, u.email, u.suspended_reason, u.suspended_at, a.full_name
          from public.users u
          left join public.users a on a.id = u.suspended_by
         where u.suspended_at is not null
      ) x
     order by x.restricted_at desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke all on function public.reject_if_suspended() from public, anon, authenticated;
revoke all on function public.match_requests_moderation_check() from public, anon, authenticated;
revoke all on function public.verifier_submissions_moderation_check() from public, anon, authenticated;
revoke all on function public.admin_set_dog_hidden(uuid, boolean, text) from public, anon;
revoke all on function public.admin_set_user_suspended(uuid, boolean, text) from public, anon;
revoke all on function public.admin_user_moderation(uuid) from public, anon;
revoke all on function public.admin_list_restricted() from public, anon;
grant execute on function public.admin_set_dog_hidden(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_user_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.admin_user_moderation(uuid) to authenticated;
grant execute on function public.admin_list_restricted() to authenticated;
