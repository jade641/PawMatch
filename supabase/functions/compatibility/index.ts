// Deno runtime types are supplied by the Supabase Edge Functions environment.

// Supabase Edge Function: compatibility
//
// POST { action: "recommend", dogId, preferences?, limit? }
//   -> ranked breeding partner recommendations for one of the caller's dogs.
// POST { action: "notify", dogId }
//   -> sends "compatible match" alerts to owners of dogs that score >= 80
//      against the caller's newly added dog.
//
// Deploy: npx supabase functions deploy compatibility
// deno.json maps the bare import to npm: for Deno; editors resolve it from node_modules.
import { createClient } from "@supabase/supabase-js";
import { type CandidateFields, type MatchPreferences, rankCandidates } from "../_shared/compatibility.ts";

type DogRow = CandidateFields & { owner_id: string; [column: string]: unknown };

declare const Deno: {
  env: {
    get(name: string): string | undefined;
  };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALERT_THRESHOLD = 80;

const DOG_COLUMNS =
  "id, owner_id, name, breed, age, sex, size, color, temperament, description, score, verified, tier, verified_docs, img, photos, rating, reviews, created_at, photo_verified_at, owner:owners(user_id, display_name, location, rating, review_count, completed_matches, verified_at)";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Not signed in" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });

  const { data: auth } = await userClient.auth.getUser();
  const user = auth?.user;
  if (!user) return json({ error: "Not signed in" }, 401);

  let body: { action?: string; dogId?: string; preferences?: MatchPreferences; limit?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = body.action ?? "recommend";
  if (!body.dogId) return json({ error: "dogId is required" }, 400);

  const { data: targetData, error: targetError } = await userClient
    .from("dogs")
    .select(DOG_COLUMNS)
    .eq("id", body.dogId)
    .maybeSingle();
  if (targetError) return json({ error: targetError.message }, 500);
  const target = targetData as DogRow | null;
  if (!target || target.owner_id !== user.id) return json({ error: "Dog not found" }, 404);

  const { data: poolData, error: poolError } = await userClient
    .from("dogs")
    .select(DOG_COLUMNS)
    .neq("owner_id", user.id)
    .neq("sex", target.sex)
    .limit(1000);
  if (poolError) return json({ error: poolError.message }, 500);

  const candidates: DogRow[] = ((poolData ?? []) as DogRow[]).map((d) => ({ ...d, age: Number(d.age) }));
  const targetProfile: DogRow = { ...target, age: Number(target.age) };

  if (action === "recommend") {
    const limit = Math.min(Math.max(Number(body.limit) || 3, 1), 50);
    const ranked = rankCandidates(targetProfile, candidates, { limit, preferences: body.preferences });
    return json({
      algorithm: "weighted-sum-model",
      results: ranked.map((r) => ({ dog: r.candidate, compatibility: r.compatibility, reasons: r.reasons })),
    });
  }

  if (action === "notify") {
    const ranked = rankCandidates(targetProfile, candidates, { limit: candidates.length });
    const best = new Map<string, (typeof ranked)[number]>();
    for (const r of ranked) {
      if (r.compatibility.total < ALERT_THRESHOLD) continue;
      if (!best.has(r.candidate.owner_id)) best.set(r.candidate.owner_id, r);
    }
    if (best.size === 0) return json({ notified: 0 });

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);
    const rows = [...best.values()].map((r) => ({
      user_id: r.candidate.owner_id,
      type: "match_alert",
      title: `New compatible match for ${r.candidate.name}`,
      body: `${target.name} (${target.breed}, ${Number(target.age)} yrs) is ${r.compatibility.total}% compatible with ${r.candidate.name}.`,
      data: { dog_id: target.id, for_dog_id: r.candidate.id, score: r.compatibility.total },
    }));
    const { error } = await admin.from("notifications").insert(rows);
    if (error) return json({ error: error.message }, 500);
    return json({ notified: rows.length });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
