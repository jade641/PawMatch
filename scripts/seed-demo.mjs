// Seeds demo accounts and dog profiles for beta testing, approves verifiers and manages admins.
//
// Requires the project's service-role key, which must never be shipped in the app.
// Put it in .env.seed (git-ignored):
//   SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...
//   DEMO_PASSWORD=choose-a-demo-password
//
// Usage:
//   npm run seed:demo                              create demo owners, vet and dogs
//   npm run verifier:approve -- vet@example.com    approve a registered vet/breeder
//   npm run verifier:list                          list verifier accounts awaiting approval
//   npm run admin:grant -- you@example.com         let an account review verifiers in the app
//   npm run admin:revoke -- you@example.com        remove admin rights
import { Buffer } from "node:buffer";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see .env.example).");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUserByEmail(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function approveVerifier(email) {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`No account found for ${email}`);
  const { data, error } = await admin
    .from("verifiers")
    .update({ approved: true, reviewed_at: new Date().toISOString(), review_notes: null })
    .eq("user_id", user.id)
    .select("name, role, clinic, license_number");
  if (error) throw error;
  if (!data?.length) throw new Error(`${email} is not registered as a veterinarian or breeder`);
  console.log(`Approved ${data[0].name} (${data[0].role}, ${data[0].clinic || "no clinic"}, license ${data[0].license_number || "—"})`);
}

async function setAdmin(email, isAdmin) {
  const user = await findUserByEmail(email);
  if (!user) throw new Error(`No account found for ${email}`);
  const { data: owner, error: oError } = await admin.from("owners").select("id").eq("user_id", user.id).maybeSingle();
  if (oError) throw oError;
  const role = isAdmin ? "admin" : owner ? "owner" : "verifier";
  const { error } = await admin.from("users").update({ role }).eq("id", user.id);
  if (error) throw error;
  console.log(isAdmin ? `${email} is now an admin. Sign out and back in to see the Admin tab.` : `${email} is no longer an admin.`);
}

async function listPendingVerifiers() {
  const { data, error } = await admin
    .from("verifiers")
    .select("name, role, clinic, license_number, created_at, user:users(email, phone)")
    .eq("approved", false)
    .is("reviewed_at", null)
    .order("created_at");
  if (error) throw error;
  if (!data.length) return console.log("No verifiers awaiting approval.");
  for (const v of data) {
    console.log(`- ${v.name} <${v.user?.email}> ${v.role}, ${v.clinic}, license ${v.license_number || "—"}, phone ${v.user?.phone ?? "—"}`);
  }
}

const IMG = (id) => `https://images.unsplash.com/${id}?w=600&fit=crop`;

const DEMO = [
  {
    email: "demo.owner@pawmatch.app",
    meta: { full_name: "Juan dela Cruz", location: "Talomo, Davao City", phone: "09171234567" },
    dogs: [
      { name: "Max", breed: "Siberian Husky", age: 4, sex: "male", size: "large", color: "Gray", temperament: ["Loyal", "Protective", "Intelligent"], img: IMG("photo-1568572933382-74d440642117"), verify: ["vaccination", "health_clearance"] },
      { name: "Bruno", breed: "Labrador Retriever", age: 3, sex: "male", size: "large", color: "Brown / Chocolate", temperament: ["Friendly", "Playful"], img: IMG("photo-1587300003388-59208cc962cb"), verify: ["vaccination"] },
    ],
  },
  {
    email: "demo.owner2@pawmatch.app",
    meta: { full_name: "Maria Santos", location: "Buhangin, Davao City", phone: "09181234567" },
    dogs: [
      { name: "Bella", breed: "Shih Tzu", age: 3, sex: "female", size: "small", color: "Brown / Chocolate", temperament: ["Friendly", "Energetic", "Loyal"], img: IMG("photo-1629740067905-bd3f515aa739"), verify: ["vaccination", "health_clearance", "pedigree"] },
      { name: "Luna", breed: "Golden Retriever", age: 2, sex: "female", size: "large", color: "Golden", temperament: ["Friendly", "Gentle"], img: IMG("photo-1633722715463-d30f4f325e24"), verify: ["vaccination"] },
    ],
  },
  {
    email: "demo.owner3@pawmatch.app",
    meta: { full_name: "Carlos Reyes", location: "Toril, Davao City", phone: "09191234567" },
    dogs: [
      { name: "Kiko", breed: "Shih Tzu", age: 2, sex: "male", size: "small", color: "White", temperament: ["Playful", "Affectionate"], img: IMG("photo-1721781010133-8eb0e9b23daf"), verify: [] },
      { name: "Yuki", breed: "Siberian Husky", age: 3, sex: "female", size: "large", color: "White", temperament: ["Energetic", "Friendly"], img: IMG("photo-1693615774176-a5560f55ac49"), verify: ["vaccination"] },
      { name: "Rocky", breed: "Beagle", age: 3, sex: "male", size: "medium", color: "Tricolor", temperament: ["Calm", "Friendly", "Gentle"], img: IMG("photo-1583511655857-d19b40a7a54e"), verify: [] },
    ],
  },
];

const DEMO_VET = {
  email: "demo.vet@pawmatch.app",
  meta: {
    full_name: "Dr. Patricia Reyes",
    role: "verifier",
    verifier_role: "Licensed Veterinarian",
    clinic: "Davao Animal Clinic",
    license_number: "PRC-DEMO-0001",
    location: "Poblacion, Davao City",
    phone: "09201234567",
  },
};

// 1x1 PNG used as a placeholder document for pre-verified demo records.
const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function ensureUser(email, password, meta) {
  const existing = await findUserByEmail(email);
  if (existing) {
    console.log(`  exists  ${email}`);
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta });
  if (error) throw error;
  console.log(`  created ${email}`);
  return data.user.id;
}

async function seed() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 8) {
    console.error("Set DEMO_PASSWORD (at least 8 characters) for the demo accounts.");
    process.exit(1);
  }

  console.log("Accounts:");
  const vetId = await ensureUser(DEMO_VET.email, password, DEMO_VET.meta);
  await admin.from("verifiers").update({ approved: true }).eq("user_id", vetId);

  for (const owner of DEMO) {
    const ownerId = await ensureUser(owner.email, password, owner.meta);
    const { count } = await admin.from("dogs").select("id", { count: "exact", head: true }).eq("owner_id", ownerId);
    if (count) {
      console.log(`  ${owner.meta.full_name} already has dogs; skipping`);
      continue;
    }

    for (const { verify, ...dog } of owner.dogs) {
      const { data: created, error } = await admin
        .from("dogs")
        .insert({ ...dog, owner_id: ownerId, description: `${dog.name} is a ${dog.temperament.join(", ").toLowerCase()} ${dog.breed} from ${owner.meta.location}.` })
        .select("id")
        .single();
      if (error) throw error;

      for (const type of verify) {
        const path = `${ownerId}/demo-${type}-${created.id}.png`;
        const up = await admin.storage.from("documents").upload(path, PLACEHOLDER_PNG, { contentType: "image/png", upsert: true });
        if (up.error) throw up.error;
        const { data: sub, error: subError } = await admin
          .from("verifier_submissions")
          .insert({ dog_id: created.id, verifier_user_id: vetId, submission_type: type, document_url: path })
          .select("id")
          .single();
        if (subError) throw subError;
        await admin
          .from("verifier_submissions")
          .update({ status: "vet_verified", reviewed_at: new Date().toISOString(), notes: "Demo record" })
          .eq("id", sub.id);
        await admin.from("audit_logs").insert({
          dog_id: created.id,
          submission_id: sub.id,
          actor_id: vetId,
          actor_name: DEMO_VET.meta.full_name,
          action: "approved",
          details: type,
        });
      }
      if (verify.length) {
        const { error: rpcError } = await admin.rpc("recompute_dog_verification", { p_dog: created.id });
        if (rpcError) throw rpcError;
      }
      console.log(`  dog     ${dog.name} (${dog.breed}, ${dog.sex}) — ${verify.length} verified document(s)`);
    }

    await admin.from("notifications").insert({
      user_id: ownerId,
      type: "system",
      title: "Welcome to the PawMatch beta",
      body: "This is a demo account. Report anything odd through Help & About → Report a problem.",
    });
  }

  console.log(`\nDone. Demo logins (password: the DEMO_PASSWORD you set):`);
  console.log(`  owner: ${DEMO.map((d) => d.email).join(", ")}`);
  console.log(`  vet:   ${DEMO_VET.email}`);
}

const [command, arg] = process.argv.slice(2);
try {
  if (command === "approve-verifier") {
    if (!arg) throw new Error("Usage: npm run verifier:approve -- someone@example.com");
    await approveVerifier(arg);
  } else if (command === "grant-admin" || command === "revoke-admin") {
    if (!arg) throw new Error(`Usage: npm run admin:${command.split("-")[0]} -- someone@example.com`);
    await setAdmin(arg, command === "grant-admin");
  } else if (command === "list-verifiers") {
    await listPendingVerifiers();
  } else {
    await seed();
  }
} catch (e) {
  console.error("Error:", e.message ?? e);
  // process.exit() here crashes Node on Windows while fetch sockets are closing.
  process.exitCode = 1;
}
