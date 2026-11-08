-- PawMatch: report and block other users.
--
-- Blocking works both ways: neither user sees the other's dogs (browse, recommendations
-- and match alerts all read dogs through RLS), and neither can send the other a match
-- request or a message. Blocking also closes any active request between them.
-- Reports go to the PawMatch administrators, who resolve or dismiss them in the app.

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'match_request', 'request_update', 'message', 'verification_request',
  'verification_result', 'review', 'match_alert', 'system',
  'verifier_application', 'verifier_review', 'user_report'
));

-- ---------------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------------
create table public.user_blocks (
  blocker_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  blocked_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

-- Users only see the blocks they made, so this helper reads both directions for the
-- RLS policies. It lives outside the API-exposed public schema: policies can use it,
-- but nobody can call it to find out who blocked them.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.blocked_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select blocked_id from public.user_blocks where blocker_id = auth.uid()
  union
  select blocker_id from public.user_blocks where blocked_id = auth.uid();
$$;

revoke all on function private.blocked_user_ids() from public, anon;
grant execute on function private.blocked_user_ids() to authenticated;

create or replace function public.users_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
     where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

-- Blocking closes active requests between the two users, which also closes their chat.
create or replace function public.user_blocks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.match_requests
     set status = 'cancelled'
   where status in ('pending', 'accepted')
     and ((requester_user_id = new.blocker_id and recipient_user_id = new.blocked_id)
       or (requester_user_id = new.blocked_id and recipient_user_id = new.blocker_id));
  return new;
end;
$$;

create trigger user_blocks_after_insert
  after insert on public.user_blocks
  for each row execute function public.user_blocks_after_insert();

-- Runs after match_requests_before_insert (triggers fire in name order), which sets the recipient.
create or replace function public.match_requests_block_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.users_blocked(new.requester_user_id, new.recipient_user_id) then
    raise exception 'You can''t send a request to this owner';
  end if;
  return new;
end;
$$;

create trigger match_requests_block_check
  before insert on public.match_requests
  for each row execute function public.match_requests_block_check();

create or replace function public.messages_block_check()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.match_requests;
begin
  select * into r from public.match_requests where id = new.match_request_id;
  if found and public.users_blocked(r.requester_user_id, r.recipient_user_id) then
    raise exception 'You can''t message this owner';
  end if;
  return new;
end;
$$;

create trigger messages_block_check
  before insert on public.messages
  for each row execute function public.messages_block_check();

-- Blocked users' dogs disappear from each other's browse, profiles and recommendations.
drop policy "dogs: read all" on public.dogs;
create policy "dogs: read all except blocked users" on public.dogs
  for select to authenticated
  using (owner_id = auth.uid() or owner_id not in (select private.blocked_user_ids()));

-- People the signed-in user has blocked, with their names, for Settings → Blocked users.
create or replace function public.list_my_blocks()
returns table (blocked_id uuid, full_name text, avatar_url text, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select b.blocked_id, u.full_name, u.avatar_url, b.created_at
    from public.user_blocks b
    join public.users u on u.id = b.blocked_id
   where b.blocker_id = auth.uid()
   order by b.created_at desc;
$$;

alter table public.user_blocks enable row level security;
create policy "user_blocks: read own" on public.user_blocks
  for select to authenticated using (blocker_id = auth.uid());
create policy "user_blocks: block" on public.user_blocks
  for insert to authenticated with check (blocker_id = auth.uid());
create policy "user_blocks: unblock" on public.user_blocks
  for delete to authenticated using (blocker_id = auth.uid());

revoke insert, update, delete on public.user_blocks from anon, authenticated;
grant insert (blocked_id) on public.user_blocks to authenticated;
grant delete on public.user_blocks to authenticated;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create table public.user_reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null default auth.uid() references public.users (id) on delete cascade,
  reported_id uuid not null references public.users (id) on delete cascade,
  reason text not null check (reason in (
    'scam', 'harassment', 'fake_profile', 'fake_documents', 'animal_welfare', 'spam', 'other'
  )),
  details text not null default '' check (char_length(details) <= 1000),
  match_request_id bigint references public.match_requests (id) on delete set null,
  dog_id uuid references public.dogs (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  admin_notes text,
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);
create index user_reports_status_idx on public.user_reports (status, created_at desc);
create index user_reports_reported_idx on public.user_reports (reported_id);
-- One open report per person: a second one waits until the first is reviewed.
create unique index user_reports_one_open_idx on public.user_reports (reporter_id, reported_id) where status = 'open';

create or replace function public.report_reason_label(p_reason text)
returns text
language sql
immutable
as $$
  select case p_reason
    when 'scam' then 'Scam or fraud'
    when 'harassment' then 'Harassment or abusive messages'
    when 'fake_profile' then 'Fake profile or dog'
    when 'fake_documents' then 'Fake health documents'
    when 'animal_welfare' then 'Animal welfare concern'
    when 'spam' then 'Spam'
    else 'Something else'
  end;
$$;

create or replace function public.user_reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.match_requests;
begin
  if new.match_request_id is not null then
    select * into r from public.match_requests where id = new.match_request_id;
    if not found
       or new.reporter_id not in (r.requester_user_id, r.recipient_user_id)
       or new.reported_id not in (r.requester_user_id, r.recipient_user_id) then
      raise exception 'You can only report a conversation you are part of';
    end if;
  end if;
  if new.dog_id is not null and not exists (
    select 1 from public.dogs where id = new.dog_id and owner_id = new.reported_id
  ) then
    raise exception 'That dog does not belong to the reported owner';
  end if;
  new.details := trim(new.details);
  return new;
end;
$$;

create trigger user_reports_before_insert
  before insert on public.user_reports
  for each row execute function public.user_reports_before_insert();

create or replace function public.user_reports_notify_admins()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reported text;
begin
  select full_name into v_reported from public.users where id = new.reported_id;
  perform public.notify(
    u.id,
    'user_report',
    'New report: ' || public.report_reason_label(new.reason),
    coalesce(nullif(v_reported, ''), 'A user') || ' was reported and is waiting for review.',
    jsonb_build_object('kind', 'new_report', 'report_id', new.id)
  )
  from public.users u
  where u.role = 'admin' and u.id not in (new.reporter_id, new.reported_id);
  return new;
end;
$$;

create trigger user_reports_notify_admins
  after insert on public.user_reports
  for each row execute function public.user_reports_notify_admins();

-- Reports with both users' details, for the admin screens.
create or replace function public.admin_list_reports()
returns table (
  id bigint,
  reason text,
  details text,
  status text,
  admin_notes text,
  created_at timestamptz,
  reviewed_at timestamptz,
  reviewer_name text,
  reporter_id uuid,
  reporter_name text,
  reporter_email text,
  reported_id uuid,
  reported_name text,
  reported_email text,
  reported_phone text,
  reported_report_count bigint,
  match_request_id bigint,
  dog_id uuid,
  dog_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only PawMatch administrators can view reports';
  end if;
  return query
    select r.id, r.reason, r.details, r.status, r.admin_notes, r.created_at, r.reviewed_at, rv.full_name,
           r.reporter_id, rp.full_name, rp.email,
           r.reported_id, rd.full_name, rd.email, rd.phone,
           (select count(*) from public.user_reports x where x.reported_id = r.reported_id),
           r.match_request_id, r.dog_id, d.name
      from public.user_reports r
      join public.users rp on rp.id = r.reporter_id
      join public.users rd on rd.id = r.reported_id
      left join public.users rv on rv.id = r.reviewed_by
      left join public.dogs d on d.id = r.dog_id
     order by (r.status = 'open') desc, r.created_at desc;
end;
$$;

-- p_status: 'resolved' (action taken) or 'dismissed' (no violation). The reporter is told it was reviewed.
create or replace function public.admin_review_report(p_report_id bigint, p_status text, p_notes text default null)
returns public.user_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.user_reports;
  v_reported text;
begin
  if not public.is_admin() then
    raise exception 'Only PawMatch administrators can review reports';
  end if;
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'Status must be resolved or dismissed';
  end if;

  select * into r from public.user_reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found';
  end if;
  if r.status <> 'open' then
    raise exception 'This report has already been reviewed';
  end if;
  if auth.uid() in (r.reporter_id, r.reported_id) then
    raise exception 'You can''t review a report you are involved in';
  end if;

  update public.user_reports
     set status = p_status,
         admin_notes = nullif(trim(coalesce(p_notes, '')), ''),
         reviewed_by = auth.uid(),
         reviewed_at = now()
   where id = r.id
  returning * into r;

  select full_name into v_reported from public.users where id = r.reported_id;
  perform public.notify(
    r.reporter_id,
    'user_report',
    'Your report was reviewed',
    'Thank you. The PawMatch team reviewed your report about ' || coalesce(nullif(v_reported, ''), 'this user') || '.',
    jsonb_build_object('kind', 'report_reviewed', 'report_id', r.id, 'status', r.status)
  );

  return r;
end;
$$;

alter table public.user_reports enable row level security;
create policy "user_reports: reporter reads own" on public.user_reports
  for select to authenticated using (reporter_id = auth.uid());
create policy "user_reports: report others" on public.user_reports
  for insert to authenticated with check (reporter_id = auth.uid());

revoke insert, update, delete on public.user_reports from anon, authenticated;
grant insert (reported_id, reason, details, match_request_id, dog_id) on public.user_reports to authenticated;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke all on function public.users_blocked(uuid, uuid) from public, anon, authenticated;
revoke all on function public.user_blocks_after_insert() from public, anon, authenticated;
revoke all on function public.match_requests_block_check() from public, anon, authenticated;
revoke all on function public.messages_block_check() from public, anon, authenticated;
revoke all on function public.user_reports_before_insert() from public, anon, authenticated;
revoke all on function public.user_reports_notify_admins() from public, anon, authenticated;
revoke all on function public.list_my_blocks() from public, anon;
revoke all on function public.admin_list_reports() from public, anon;
revoke all on function public.admin_review_report(bigint, text, text) from public, anon;
grant execute on function public.list_my_blocks() to authenticated;
grant execute on function public.admin_list_reports() to authenticated;
grant execute on function public.admin_review_report(bigint, text, text) to authenticated;
