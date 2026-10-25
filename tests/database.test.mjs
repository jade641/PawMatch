// Database scenario tests: applies the Supabase migration to an in-process
// Postgres (PGlite) with stand-ins for Supabase's auth/storage schemas, then
// exercises the business rules and row-level security as different users.
// Run: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase", "migrations");
const db = new PGlite();

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

await db.exec(SUPABASE_STUB);
for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
  await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
  console.log("applied", file);
}

async function as(uid, sql, params = []) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    await tx.exec("set local role authenticated");
    return (await tx.query(sql, params)).rows;
  });
}
async function asFails(uid, sql, params, pattern) {
  try {
    await as(uid, sql, params);
  } catch (e) {
    if (pattern && !pattern.test(e.message)) throw new Error(`Expected ${pattern}, got: ${e.message}`);
    return e.message;
  }
  throw new Error(`Expected failure: ${sql}`);
}
const su = async (sql, params = []) => (await db.query(sql, params)).rows;

let passed = 0;
async function step(name, fn) {
  await fn();
  passed++;
  console.log("  ok -", name);
}

async function signUp(email, meta) {
  const [{ id }] = await su("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [email, meta]);
  return id;
}

const A = await signUp("juan@test.ph", { full_name: "Juan dela Cruz", location: "Talomo, Davao City", phone: "09171234567" });
const B = await signUp("maria@test.ph", { full_name: "Maria Santos", location: "Talomo, Davao City" });
const C = await signUp("outsider@test.ph", { full_name: "Out Sider" });
const V = await signUp("vet@test.ph", { full_name: "Dr. Patricia Reyes", role: "verifier", clinic: "Davao Animal Clinic", license_number: "PRC-123" });
const W = await signUp("fakevet@test.ph", { full_name: "Not Approved", role: "verifier" });

await step("provisioning creates users/owners/verifiers", async () => {
  const users = await su("select id, role, full_name, location, phone from public.users order by email");
  assert.equal(users.length, 5);
  const owners = await su("select user_id from public.owners");
  assert.equal(owners.length, 3);
  const vers = await su("select user_id, approved, clinic from public.verifiers");
  assert.equal(vers.length, 2);
  assert.ok(vers.every((v) => v.approved === false));
});

await step("users: can only read own row", async () => {
  const rows = await as(A, "select id from public.users");
  assert.deepEqual(rows.map((r) => r.id), [A]);
});

let maxId, bellaId, rexId;
await step("dogs: owner inserts own dog", async () => {
  [{ id: maxId }] = await as(A, `insert into public.dogs (name, breed, age, sex, size, color, temperament)
    values ('Max','Labrador Retriever',2,'male','large','Yellow','{Friendly}') returning id, owner_id`);
  [{ id: bellaId }] = await as(B, `insert into public.dogs (name, breed, age, sex, size, color, temperament)
    values ('Bella','Labrador Retriever',1,'female','large','Black','{Friendly,Calm}') returning id`);
  // Luna only needs to exist (a second female candidate); her id isn't used later.
  await as(B, `insert into public.dogs (name, breed, age, sex, size, temperament)
    values ('Luna','Shih Tzu',3,'female','small','{Playful}') returning id`);
  [{ id: rexId }] = await as(B, `insert into public.dogs (name, breed, age, sex, size, temperament)
    values ('Rex','Beagle',3,'male','medium','{Calm}') returning id`);
  const [d] = await su("select owner_id, tier, verified from public.dogs where id=$1", [maxId]);
  assert.equal(d.owner_id, A);
  assert.equal(d.tier, 0);
});

await step("dogs: cannot self-assign verification tier", async () => {
  await asFails(A, `insert into public.dogs (name, breed, age, sex, size, tier) values ('X','Y',1,'male','small',3)`, [], /permission denied/);
  await asFails(A, `update public.dogs set tier = 3 where id = $1`, [maxId], /permission denied/);
  await asFails(A, `update public.dogs set verified = true where id = $1`, [maxId], /permission denied/);
});

await step("dogs: cannot insert for or edit someone else", async () => {
  await asFails(A, `insert into public.dogs (owner_id, name, breed, age, sex, size) values ($1,'X','Y',1,'male','small')`, [B], /row-level security/);
  const rows = await as(A, `update public.dogs set name = 'Hacked' where id = $1 returning id`, [bellaId]);
  assert.equal(rows.length, 0);
  const del = await as(A, `delete from public.dogs where id = $1 returning id`, [bellaId]);
  assert.equal(del.length, 0);
});

await step("verifiers cannot create dog profiles", async () => {
  await asFails(V, `insert into public.dogs (name, breed, age, sex, size) values ('X','Y',1,'male','small')`, [], /row-level security|foreign key/);
});

let reqId;
await step("match request: validation", async () => {
  await asFails(A, `insert into public.match_requests (dog_id, requester_dog_id) values ($1, $2)`, [maxId, maxId], /own dog/);
  await asFails(A, `insert into public.match_requests (dog_id, requester_dog_id) values ($1, $2)`, [rexId, maxId], /opposite sex/);
  await asFails(A, `insert into public.match_requests (dog_id, requester_dog_id) values ($1, $2)`, [bellaId, rexId], /belong to you/);
  await asFails(A, `insert into public.match_requests (dog_id, requester_dog_id, status) values ($1, $2, 'accepted')`, [bellaId, maxId], /permission denied/);
});

await step("match request: created with recipient, opening message and alert", async () => {
  [{ id: reqId }] = await as(A, `insert into public.match_requests (dog_id, requester_dog_id, message, compatibility_score)
    values ($1, $2, 'Hi Maria! Max would love to meet Bella.', 100) returning id`, [bellaId, maxId]);
  const [r] = await su("select * from public.match_requests where id=$1", [reqId]);
  assert.equal(r.recipient_user_id, B);
  assert.equal(r.requester_name, "Juan dela Cruz");
  assert.equal(r.requester_email, "juan@test.ph");
  assert.equal(r.status, "pending");
  const msgs = await as(B, "select body, sender_id from public.messages where match_request_id=$1", [reqId]);
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].sender_id, A);
  const notes = await as(B, "select type, title, data from public.notifications");
  assert.equal(notes.length, 1, "opening message should not double-notify");
  assert.equal(notes[0].type, "match_request");
  assert.equal(Number(notes[0].data.match_request_id), Number(reqId));
});

await step("match request: duplicate active request rejected", async () => {
  await asFails(A, `insert into public.match_requests (dog_id, requester_dog_id) values ($1, $2)`, [bellaId, maxId], /duplicate key/);
});

await step("match request: outsiders can't see it", async () => {
  assert.equal((await as(C, "select id from public.match_requests")).length, 0);
  assert.equal((await as(C, "select id from public.messages")).length, 0);
  await asFails(C, "insert into public.messages (match_request_id, body) values ($1, 'spam')", [reqId], /row-level security/);
});

await step("match request: only recipient can accept; direct update blocked", async () => {
  await asFails(A, "select public.respond_match_request($1, 'accept')", [reqId], /Only the owner/);
  await asFails(B, "update public.match_requests set status='accepted' where id=$1", [reqId], /permission denied/);
  const [r] = await as(B, "select (public.respond_match_request($1, 'accept')).status", [reqId]);
  assert.equal(r.status, "accepted");
  const notes = await as(A, "select type, data from public.notifications where type='request_update'");
  assert.equal(notes.length, 1);
});

await step("messages: party message notifies the other party", async () => {
  await as(B, "insert into public.messages (match_request_id, body) values ($1, 'Sure! Saturday?')", [reqId]);
  const notes = await as(A, "select type, body from public.notifications where type='message'");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].body, "Sure! Saturday?");
  await asFails(A, "insert into public.messages (match_request_id, sender_id, body) values ($1, $2, 'spoof')", [reqId, B], /row-level security/);
});

await step("reviews: reviewee resolved by server, aggregates updated", async () => {
  await asFails(C, "insert into public.reviews (match_request_id, rating) values ($1, 5)", [reqId], /Only owners involved/);
  await as(A, "insert into public.reviews (match_request_id, rating, comment) values ($1, 5, 'Great owner')", [reqId]);
  const [o] = await su("select rating, review_count from public.owners where user_id=$1", [B]);
  assert.equal(Number(o.rating), 5);
  assert.equal(o.review_count, 1);
  const [d] = await su("select rating, reviews from public.dogs where id=$1", [bellaId]);
  assert.equal(d.reviews, 1);
  await asFails(A, "insert into public.reviews (match_request_id, rating) values ($1, 4)", [reqId], /duplicate key/);
  await as(B, "insert into public.reviews (match_request_id, rating) values ($1, 4)", [reqId]);
  const [oa] = await su("select rating, review_count from public.owners where user_id=$1", [A]);
  assert.equal(Number(oa.rating), 4);
});

await step("match request: complete increments completed matches", async () => {
  await as(A, "select public.respond_match_request($1, 'complete')", [reqId]);
  const rows = await su("select completed_matches from public.owners where user_id in ($1,$2)", [A, B]);
  assert.ok(rows.every((r) => r.completed_matches === 1));
  await asFails(A, "select public.respond_match_request($1, 'cancel')", [reqId], /no longer be cancelled/);
});

const docPath = `${A}/vaccination-1.jpg`;
await step("storage: documents only uploadable into own folder", async () => {
  await as(A, "insert into storage.objects (bucket_id, name) values ('documents', $1)", [docPath]);
  await as(A, "insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${A}/health-1.pdf`]);
  await as(A, "insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${A}/pedigree-1.pdf`]);
  await asFails(A, "insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${B}/x.jpg`], /row-level security/);
});

let subId;
await step("verification: only approved verifiers, no foreign document paths", async () => {
  await asFails(A, `insert into public.verifier_submissions (dog_id, verifier_user_id, submission_type, document_url)
    values ($1, $2, 'vaccination', $3)`, [maxId, W, docPath], /not an approved/);
  await su("update public.verifiers set approved = true where user_id = $1", [V]);
  await asFails(A, `insert into public.verifier_submissions (dog_id, verifier_user_id, submission_type, document_url)
    values ($1, $2, 'vaccination', $3)`, [maxId, V, `${B}/x.jpg`], /own documents folder/);
  await asFails(A, `insert into public.verifier_submissions (dog_id, verifier_user_id, submission_type, document_url)
    values ($1, $2, 'vaccination', $3)`, [bellaId, V, docPath], /row-level security|own documents folder/);
});

await step("verification: owner submits, verifier alerted, audit logged", async () => {
  [{ id: subId }] = await as(A, `insert into public.verifier_submissions (dog_id, verifier_user_id, submission_type, document_url)
    values ($1, $2, 'vaccination', $3) returning id`, [maxId, V, docPath]);
  const [s] = await su("select * from public.verifier_submissions where id=$1", [subId]);
  assert.equal(s.owner_id, A);
  assert.equal(s.verifier_name, "Dr. Patricia Reyes");
  assert.equal(s.status, "owner_submitted");
  // V signed up without a location, so it also has a "Complete your profile" reminder.
  const notes = await as(V, "select type from public.notifications where type <> 'system'");
  assert.deepEqual(notes.map((n) => n.type), ["verification_request"]);
  const audit = await as(C, "select action from public.audit_logs where dog_id=$1", [maxId]);
  assert.deepEqual(audit.map((a) => a.action), ["submitted"]);
});

await step("storage: assigned verifier can read the document, others can't", async () => {
  assert.equal((await as(V, "select name from storage.objects where name=$1", [docPath])).length, 1);
  assert.equal((await as(B, "select name from storage.objects where name=$1", [docPath])).length, 0);
  assert.equal((await as(V, "select name from storage.objects where name=$1", [`${A}/health-1.pdf`])).length, 0);
});

await step("verification: only assigned verifier can review; remarks required to reject", async () => {
  await asFails(A, "select public.review_submission($1, 'approve')", [subId], /Only the assigned verifier/);
  await asFails(V, "select public.review_submission($1, 'reject', '  ')", [subId], /remarks/);
  await asFails(V, "update public.verifier_submissions set status='vet_verified' where id=$1", [subId], /permission denied/);
});

await step("verification: approval awards Tier 1 badge and notifies owner", async () => {
  await as(V, "select public.review_submission($1, 'approve')", [subId]);
  const [d] = await su("select tier, verified, verified_docs, score from public.dogs where id=$1", [maxId]);
  assert.equal(d.tier, 1);
  assert.equal(d.verified, true);
  assert.deepEqual(d.verified_docs, ["vaccination"]);
  assert.equal(d.score, 25);
  const [o] = await su("select verified_at from public.owners where user_id=$1", [A]);
  assert.ok(o.verified_at);
  const notes = await as(A, "select type, title from public.notifications where type='verification_result'");
  assert.equal(notes.length, 1);
  const audit = await su("select action from public.audit_logs where dog_id=$1 order by id", [maxId]);
  assert.deepEqual(audit.map((a) => a.action), ["submitted", "approved", "tier_changed"]);
  await asFails(V, "select public.review_submission($1, 'approve')", [subId], /already been reviewed/);
});

await step("verification: rejection records remarks; more documents raise tier", async () => {
  const [{ id: h }] = await as(A, `insert into public.verifier_submissions (dog_id, verifier_user_id, submission_type, document_url)
    values ($1, $2, 'health_clearance', $3) returning id`, [maxId, V, `${A}/health-1.pdf`]);
  await as(V, "select public.review_submission($1, 'reject', 'Blurry photo, please re-upload')", [h]);
  let [d] = await su("select tier from public.dogs where id=$1", [maxId]);
  assert.equal(d.tier, 1);
  const [s] = await as(A, "select status, notes from public.verifier_submissions where id=$1", [h]);
  assert.equal(s.status, "verification_failed");
  assert.equal(s.notes, "Blurry photo, please re-upload");

  const [{ id: h2 }] = await as(A, `insert into public.verifier_submissions (dog_id, verifier_user_id, submission_type, document_url)
    values ($1, $2, 'health_clearance', $3) returning id`, [maxId, V, `${A}/health-1.pdf`]);
  const [{ id: p }] = await as(A, `insert into public.verifier_submissions (dog_id, verifier_user_id, submission_type, document_url)
    values ($1, $2, 'pedigree', $3) returning id`, [maxId, V, `${A}/pedigree-1.pdf`]);
  await as(V, "select public.review_submission($1, 'approve')", [h2]);
  [d] = await su("select tier from public.dogs where id=$1", [maxId]);
  assert.equal(d.tier, 2);
  await as(V, "select public.review_submission($1, 'approve')", [p]);
  [d] = await su("select tier, score, verified_docs from public.dogs where id=$1", [maxId]);
  assert.equal(d.tier, 3);
  assert.equal(d.score, 75);
  assert.deepEqual(d.verified_docs, ["health_clearance", "pedigree", "vaccination"]);
});

await step("verifiers: unapproved hidden, can't self-approve", async () => {
  const list = await as(A, "select user_id from public.verifiers");
  assert.deepEqual(list.map((v) => v.user_id), [V]);
  await asFails(W, "update public.verifiers set approved = true where user_id = $1", [W], /permission denied/);
  const rows = await as(W, "update public.verifiers set available = false, clinic = 'New Clinic' where user_id = $1 returning clinic", [W]);
  assert.equal(rows[0].clinic, "New Clinic");
});

const ADM = await signUp("admin@test.ph", { full_name: "PawMatch Admin" });
await su("update public.users set role = 'admin' where id = $1", [ADM]);
const appId = async (uid) => (await su("select id from public.verifiers where user_id = $1", [uid]))[0].id;

await step("admin: only admins can list or review applications; no self-promotion", async () => {
  await asFails(A, "select * from public.admin_list_verifiers()", [], /Only PawMatch administrators/);
  await asFails(V, "select public.admin_review_verifier($1, 'approve')", [await appId(W)], /Only PawMatch administrators/);
  await asFails(A, "update public.users set role = 'admin' where id = $1", [A], /permission denied/);
  assert.equal((await as(ADM, "select public.is_admin() as ok"))[0].ok, true);
  assert.equal((await as(A, "select public.is_admin() as ok"))[0].ok, false);
});

let Y, yApp;
await step("admin: new application alerts admins and lists contact details", async () => {
  Y = await signUp("newvet@test.ph", { full_name: "Dr. Ana Lim", role: "verifier", verifier_role: "Certified Breeder", clinic: "Lim Kennels", license_number: "PCCI-77", phone: "0918" });
  yApp = await appId(Y);
  const notes = await as(ADM, "select type, title, data from public.notifications where type = 'verifier_application'");
  assert.equal(notes.length, 1);
  assert.equal(notes[0].title, "New certified breeder application");
  assert.equal(notes[0].data.verifier_id, yApp);
  const [row] = (await as(ADM, "select * from public.admin_list_verifiers()")).filter((r) => r.id === yApp);
  assert.equal(row.email, "newvet@test.ph");
  assert.equal(row.phone, "0918");
  assert.equal(row.approved, false);
  assert.equal(row.reviewed_at, null);
});

await step("admin: reject needs remarks, notifies applicant; verifier can't edit review fields", async () => {
  await asFails(ADM, "select public.admin_review_verifier($1, 'reject', ' ')", [yApp], /remarks/);
  await as(ADM, "select public.admin_review_verifier($1, 'reject', 'License number not found in PCCI registry')", [yApp]);
  const [own] = await as(Y, "select approved, reviewed_at, review_notes from public.verifiers where user_id = $1", [Y]);
  assert.equal(own.approved, false);
  assert.ok(own.reviewed_at);
  assert.equal(own.review_notes, "License number not found in PCCI registry");
  const [n] = await as(Y, "select title, body from public.notifications where type = 'verifier_review'");
  assert.equal(n.title, "Your application was not approved");
  await asFails(ADM, "select public.admin_review_verifier($1, 'reject', 'again')", [yApp], /already been rejected/);
  await asFails(Y, "update public.verifiers set review_notes = null, reviewed_at = null where user_id = $1", [Y], /permission denied/);
});

await step("admin: correcting the license re-submits the application", async () => {
  await as(Y, "update public.verifiers set license_number = 'PCCI-0077' where user_id = $1", [Y]);
  const [own] = await su("select approved, reviewed_at, review_notes from public.verifiers where id = $1", [yApp]);
  assert.equal(own.reviewed_at, null);
  assert.equal(own.review_notes, null);
  const titles = (await as(ADM, "select title from public.notifications where type = 'verifier_application' order by id")).map((r) => r.title);
  assert.deepEqual(titles, ["New certified breeder application", "Updated certified breeder application"]);
  await as(Y, "update public.verifiers set available = false where user_id = $1", [Y]);
  assert.equal((await as(ADM, "select id from public.notifications where type = 'verifier_application'")).length, 2);
});

await step("admin: approval lists the verifier for owners and notifies them", async () => {
  await as(ADM, "select public.admin_review_verifier($1, 'approve')", [yApp]);
  assert.ok((await as(A, "select user_id from public.verifiers")).some((v) => v.user_id === Y));
  const titles = (await as(Y, "select title from public.notifications where type = 'verifier_review' order by id")).map((r) => r.title);
  assert.deepEqual(titles, ["Your application was not approved", "Your account is approved"]);
  const [row] = (await as(ADM, "select * from public.admin_list_verifiers()")).filter((r) => r.id === yApp);
  assert.equal(row.reviewer_name, "PawMatch Admin");
  await asFails(ADM, "select public.admin_review_verifier($1, 'approve')", [yApp], /already approved/);
});

await step("admin: changing an approved license or revoking returns the account to unapproved", async () => {
  await as(Y, "update public.verifiers set license_number = 'OTHER-1' where user_id = $1", [Y]);
  assert.equal((await su("select approved from public.verifiers where id = $1", [yApp]))[0].approved, false);
  await as(ADM, "select public.admin_review_verifier($1, 'approve')", [yApp]);
  await as(ADM, "select public.admin_review_verifier($1, 'reject', 'Complaint from owners')", [yApp]);
  assert.equal((await su("select approved from public.verifiers where id = $1", [yApp]))[0].approved, false);
  const [n] = await as(Y, "select title from public.notifications where type = 'verifier_review' order by id desc limit 1");
  assert.equal(n.title, "Your verifier approval was revoked");
});

await step("admin: cannot review own application", async () => {
  await su("update public.users set role = 'admin' where id = $1", [W]);
  await asFails(W, "select public.admin_review_verifier($1, 'approve')", [await appId(W)], /your own application/);
  await su("update public.users set role = 'verifier' where id = $1", [W]);
});

await step("owner adds a vet profile to the same account: pending, admins alerted, once only", async () => {
  const before = (await as(ADM, "select id from public.notifications where type = 'verifier_application'")).length;
  await asFails(B, "select public.add_verifier_profile('Licensed Veterinarian', 'Santos Vet', ' ')", [], /license/);
  const [v] = await as(B, "select * from public.add_verifier_profile('Licensed Veterinarian', 'Santos Vet', 'PRC-555')");
  assert.equal(v.user_id, B);
  assert.equal(v.name, "Maria Santos");
  assert.equal(v.approved, false);
  assert.equal((await su("select id from public.owners where user_id = $1", [B])).length, 1, "owner profile kept");
  assert.equal((await as(ADM, "select id from public.notifications where type = 'verifier_application'")).length, before + 1);
  await asFails(B, "select public.add_verifier_profile('Licensed Veterinarian', 'Santos Vet', 'PRC-555')", [], /already has a vet/);
  await asFails(V, "select public.add_verifier_profile('Licensed Veterinarian', 'X Clinic', 'PRC-1')", [], /already has a vet/);
});

await step("dual-role account can't verify its own dog", async () => {
  await as(ADM, "select public.admin_review_verifier($1, 'approve')", [await appId(B)]);
  await as(B, "insert into storage.objects (bucket_id, name) values ('documents', $1)", [`${B}/vaccination-9.jpg`]);
  await asFails(B, `insert into public.verifier_submissions (dog_id, verifier_user_id, submission_type, document_url)
    values ($1, $2, 'vaccination', $3)`, [bellaId, B, `${B}/vaccination-9.jpg`], /own dog/);
});

await step("profile: update_my_profile syncs owners", async () => {
  await as(A, "select public.update_my_profile('Juan D. Cruz', '0917', 'Buhangin, Davao City')");
  const [o] = await su("select display_name, location from public.owners where user_id=$1", [A]);
  assert.equal(o.display_name, "Juan D. Cruz");
  assert.equal(o.location, "Buhangin, Davao City");
  await asFails(A, "update public.owners set rating = 5 where user_id=$1", [A], /permission denied/);
});

await step("profile: sign-ups without a location (Google) start incomplete until saved", async () => {
  const completed = async (uid) => (await su("select profile_completed from public.users where id=$1", [uid]))[0].profile_completed;
  assert.equal(await completed(A), true);
  assert.equal(await completed(C), false);
  await asFails(C, "update public.users set profile_completed = true where id=$1", [C], /permission denied/);
  const reminder = async () => (await su("select read from public.notifications where user_id=$1 and data->>'kind' = 'complete_profile'", [C]));
  assert.deepEqual(await reminder(), [{ read: false }]);
  assert.equal((await su("select id from public.notifications where user_id=$1 and data->>'kind' = 'complete_profile'", [A])).length, 0);
  await as(C, "select public.update_my_profile('Out Sider', '', '')");
  assert.equal(await completed(C), false);
  await as(C, "select public.update_my_profile('Out Sider', '', 'Toril, Davao City')");
  assert.equal(await completed(C), true);
  assert.deepEqual(await reminder(), [{ read: true }]);
  const notes = await su("select title, data from public.notifications where user_id=$1 and data->>'kind' = 'profile_completed'", [C]);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].data.silent, true);
  await as(C, "select public.update_my_profile('Out Sider', '0917', 'Toril, Davao City')");
  assert.equal((await su("select id from public.notifications where user_id=$1 and data->>'kind' = 'profile_completed'", [C])).length, 1);
  assert.equal((await su("select location from public.owners where user_id=$1", [C]))[0].location, "Toril, Davao City");
  const moved = async () => (await su("select id from public.notifications where user_id=$1 and data->>'kind' = 'location_updated'", [C])).length;
  assert.equal(await moved(), 0);
  await as(C, "select public.update_my_profile('Out Sider', '0917', 'Buhangin, Davao City')");
  assert.equal(await moved(), 1);
});

await step("profile: set_my_avatar syncs owners/verifiers and checks the upload", async () => {
  const pic = `${A}/avatar-1.jpg`;
  await asFails(A, "select public.set_my_avatar($1)", [pic], /Upload the picture/);
  await asFails(A, "insert into storage.objects (bucket_id, name) values ('avatars', $1)", [`${B}/avatar-1.jpg`], /row-level security/);
  await as(A, "insert into storage.objects (bucket_id, name) values ('avatars', $1)", [pic]);
  await as(A, "select public.set_my_avatar($1)", [pic]);
  assert.equal((await su("select avatar_url from public.users where id=$1", [A]))[0].avatar_url, pic);
  assert.equal((await su("select avatar_url from public.owners where user_id=$1", [A]))[0].avatar_url, pic);
  await asFails(B, "select public.set_my_avatar($1)", [pic], /Upload the picture/);

  await as(V, "insert into storage.objects (bucket_id, name) values ('avatars', $1)", [`${V}/avatar-1.png`]);
  await as(V, "select public.set_my_avatar($1)", [`${V}/avatar-1.png`]);
  assert.equal((await su("select avatar from public.verifiers where user_id=$1", [V]))[0].avatar, `${V}/avatar-1.png`);

  // The old picture is deleted by its owner; nobody else can list or delete it.
  assert.equal((await as(B, "delete from storage.objects where bucket_id='avatars' and name=$1 returning name", [pic])).length, 0);
  assert.equal((await as(B, "select name from storage.objects where bucket_id='avatars' and name=$1", [pic])).length, 0);
  assert.equal((await as(A, "delete from storage.objects where bucket_id='avatars' and name=$1 returning name", [pic])).length, 1);
});

await step("notifications: user can only mark own as read", async () => {
  const rows = await as(A, "update public.notifications set read = true returning id");
  assert.ok(rows.length > 0);
  await asFails(A, "update public.notifications set title = 'x'", [], /permission denied/);
  await asFails(A, "insert into public.notifications (user_id, type, title) values ($1, 'system', 'fake')", [B], /permission denied/);
  await asFails(A, "select public.notify($1, 'system', 'x', 'y')", [B], /permission denied/);
  assert.equal((await as(A, "select id from public.notifications where user_id <> $1", [A])).length, 0);
});

await step("internal helpers are not callable by clients", async () => {
  await asFails(A, "select public.recompute_dog_verification($1)", [maxId], /permission denied/);
  await asFails(A, "select public.recompute_reputation($1, null)", [A], /permission denied/);
});

await step("deleting a dog cascades its requests and submissions", async () => {
  await as(A, "delete from public.dogs where id=$1", [maxId]);
  assert.equal((await su("select id from public.match_requests where requester_dog_id is null and id=$1", [reqId])).length, 1);
  assert.equal((await su("select id from public.verifier_submissions where dog_id=$1", [maxId])).length, 0);
});

console.log(`\nAll ${passed} SQL scenario checks passed.`);
