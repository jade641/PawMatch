import type { RealtimeChannel } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { File as ExpoFile } from "expo-file-system";
import { Platform } from "react-native";
import { supabase } from "../lib/supabase";
import type {
  AppNotification,
  AuditEntry,
  DocType,
  Dog,
  DogInput,
  MatchRequest,
  Message,
  OwnerProfile,
  RankedMatch,
  Review,
  Session,
  Sex,
  Size,
  Submission,
  VerifierApplication,
  VerifierProfile,
  VerifierRole,
} from "../types";
import { computeCompatibility, explainCompatibility, rankCandidates, type MatchPreferences } from "./compatibility";

const OWNER_FIELDS = "user_id, display_name, location, rating, review_count, completed_matches, verified_at";
const DOG_SELECT = `*, owner:owners(${OWNER_FIELDS})`;
const REQUEST_SELECT =
  `*, dog:dogs!match_requests_dog_id_fkey(${DOG_SELECT}), ` +
  `requester_dog:dogs!match_requests_requester_dog_id_fkey(${DOG_SELECT})`;

/* ── Error handling ─────────────────────────────────────────────────── */

function friendlyMessage(error: unknown): string {
  const message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "Something went wrong. Please try again.";
  if (/network request failed|failed to fetch|fetch failed/i.test(message)) {
    return "Can't reach PawMatch right now. Please check your internet connection.";
  }
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/^\s*(\{\}|504|upstream request timeout)\s*$/i.test(message) || /gateway time-?out/i.test(message)) {
    return "PawMatch's server took too long to respond. Please try again in a moment.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Please confirm your email address first. Enter the code we emailed you.";
  }
  if (/email rate limit exceeded|over_email_send_rate_limit|for security purposes, you can only request this/i.test(message)) {
    return "Too many emails were requested. Please wait a minute and try again.";
  }
  if (/user already registered/i.test(message)) return "An account with this email already exists.";
  if (/error getting user email from external provider/i.test(message)) {
    // Facebook accounts created with a phone number, or a declined email permission.
    return "We couldn't get an email address from that account. Please allow email access, or sign up with your email instead.";
  }
  if (/jwt expired|invalid jwt/i.test(message)) return "Your session expired. Please sign in again.";
  if (/token has expired or is invalid/i.test(message)) return "That code is invalid or has expired.";
  if (/duplicate key.*match_requests_one_active/i.test(message)) {
    return "There is already an active request between these two dogs.";
  }
  if (/duplicate key.*reviews/i.test(message)) return "You already reviewed this match.";
  return message;
}

export class ApiError extends Error {}

function fail(error: unknown): never {
  throw new ApiError(friendlyMessage(error));
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : friendlyMessage(error);
}

function normalizeDog(row: any): Dog {
  return {
    ...row,
    age: Number(row.age),
    rating: Number(row.rating ?? 0),
    tier: Number(row.tier ?? 0),
    score: Number(row.score ?? 0),
    temperament: row.temperament ?? [],
    verified_docs: row.verified_docs ?? [],
    photos: row.photos ?? [],
    owner: row.owner ? { ...row.owner, rating: Number(row.owner.rating ?? 0) } : null,
  };
}

function normalizeRequest(row: any): MatchRequest {
  return {
    ...row,
    dog: row.dog ? normalizeDog(row.dog) : null,
    requester_dog: row.requester_dog ? normalizeDog(row.requester_dog) : null,
  };
}

/* ── Authentication ─────────────────────────────────────────────────── */

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) fail(error);
}

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  location: string;
  role: "owner" | "verifier";
  verifierRole?: VerifierRole;
  clinic?: string;
  licenseNumber?: string;
}

/**
 * `needsConfirmation`: Supabase requires the user to confirm their email first.
 * `alreadyRegistered`: the email belongs to an existing account; nothing was created.
 */
export async function signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean; alreadyRegistered: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        full_name: input.fullName.trim(),
        phone: input.phone.trim(),
        location: input.location,
        role: input.role,
        verifier_role: input.verifierRole,
        clinic: input.clinic?.trim(),
        license_number: input.licenseNumber?.trim(),
      },
    },
  });
  if (error) {
    if (error.code === "user_already_exists" || /already (been )?registered/i.test(error.message ?? "")) {
      return { needsConfirmation: false, alreadyRegistered: true };
    }
    // Supabase times out (504) when it cannot send the confirmation email.
    if (error.status === 504 || /timeout|timed out|error sending confirmation/i.test(error.message ?? "")) {
      fail(
        "We couldn't send your confirmation email, so the account wasn't created. Please try again later. " +
          "(Admins: check the SMTP settings in Supabase → Authentication → Emails.)",
      );
    }
    fail(error);
  }
  // With email confirmation on, an existing address returns a user with no identities.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { needsConfirmation: false, alreadyRegistered: true };
  }
  return { needsConfirmation: !data.session, alreadyRegistered: false };
}

/** Adds a (pending) vet / breeder profile to the signed-in account, e.g. an existing dog owner. */
export async function addVerifierProfile(verifierRole: VerifierRole, clinic: string, licenseNumber: string) {
  const { error } = await supabase.rpc("add_verifier_profile", {
    p_verifier_role: verifierRole,
    p_clinic: clinic.trim(),
    p_license_number: licenseNumber.trim(),
  });
  if (error) fail(error);
}

/** Confirms a new account with the code from the "Confirm signup" email; signs the user in. */
export async function verifySignupCode(email: string, code: string) {
  const address = email.trim().toLowerCase();
  const token = code.trim();
  const { error } = await supabase.auth.verifyOtp({ email: address, token, type: "email" });
  if (!error) return;
  // Older Auth versions only accept the legacy "signup" type for confirmation codes.
  const { error: legacyError } = await supabase.auth.verifyOtp({ email: address, token, type: "signup" });
  if (legacyError) fail(error);
}

export async function resendSignupCode(email: string) {
  const { error } = await supabase.auth.resend({ type: "signup", email: email.trim().toLowerCase() });
  if (error) fail(error);
}

export function isEmailNotConfirmed(error: unknown) {
  return /confirm your email address first|email not confirmed/i.test(errorMessage(error));
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) fail(error);
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  if (error) fail(error);
}

export async function resetPasswordWithCode(email: string, code: string, newPassword: string) {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: "recovery",
  });
  if (error) fail(error);
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) fail(updateError);
}

export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) fail(error);
}

export const socialLoginEnabled = process.env.EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN === "true";

async function isProviderEnabled(provider: "google" | "facebook"): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "" },
    });
    const settings = (await res.json()) as { external?: Record<string, boolean> };
    return settings.external?.[provider] !== false;
  } catch {
    return true; // Can't tell (e.g. offline): let the OAuth flow report its own error.
  }
}

/** Google / Facebook sign-in through Supabase OAuth (requires providers to be enabled). */
export async function signInWithProvider(provider: "google" | "facebook"): Promise<boolean> {
  // A disabled provider only fails inside the browser (a raw JSON error page),
  // so check first and explain it in the app instead.
  if (!(await isProviderEnabled(provider))) {
    fail(
      `${provider === "google" ? "Google" : "Facebook"} sign-in isn't available yet. Please use your email and password. ` +
        "(Admins: enable the provider in Supabase → Authentication → Sign In / Providers.)",
    );
  }

  if (Platform.OS === "web") {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) fail(error);
    return true;
  }

  // pawmatch://auth-callback in builds, exp://<ip>:8081/--/auth-callback in Expo Go.
  // It must match Supabase → Authentication → URL Configuration → Redirect URLs, or
  // Supabase sends the browser to the Site URL and the app never gets the session.
  const redirectTo = Linking.createURL("auth-callback");
  if (__DEV__) console.log("[auth] OAuth redirect URL:", redirectTo);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) fail(error);

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return false;

  const url = new URL(result.url);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  // Supabase may report OAuth errors in the query string or the fragment.
  const oauthError = url.searchParams.get("error") ?? hash.get("error");
  // Cancelling on the provider's page (or declining its permissions) isn't a failure.
  if (oauthError === "access_denied") return false;
  const errorDescription = url.searchParams.get("error_description") ?? hash.get("error_description");
  if (errorDescription) fail(errorDescription);

  const code = url.searchParams.get("code");
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) fail(exchangeError);
    return true;
  }

  const access_token = hash.get("access_token");
  const refresh_token = hash.get("refresh_token");
  if (access_token && refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sessionError) fail(sessionError);
    return true;
  }
  return false;
}

/* ── Profiles ───────────────────────────────────────────────────────── */

export async function fetchSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return null;

  const [user, owner, verifier] = await Promise.all([
    supabase.from("users").select("*").eq("id", uid).maybeSingle(),
    supabase.from("owners").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("verifiers").select("*").eq("user_id", uid).maybeSingle(),
  ]);
  if (user.error) fail(user.error);
  if (!user.data) {
    // getSession() only reads the session stored on the device. If the account was
    // deleted server-side (e.g. a database reset), drop that stale session and treat
    // the user as signed out instead of failing boot on every launch.
    const { error: authError } = await supabase.auth.getUser();
    if (authError) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      return null;
    }
    fail("Your PawMatch profile could not be found. Please contact support.");
  }

  return {
    user: user.data,
    owner: owner.data ? { ...owner.data, rating: Number(owner.data.rating) } : null,
    verifier: verifier.data ? { ...verifier.data, rating: Number(verifier.data.rating) } : null,
  };
}

export async function updateMyProfile(fullName: string, phone: string, location: string) {
  const { error } = await supabase.rpc("update_my_profile", {
    p_full_name: fullName,
    p_phone: phone,
    p_location: location,
  });
  if (error) fail(error);
}

export async function getOwner(userId: string): Promise<OwnerProfile | null> {
  const { data, error } = await supabase.from("owners").select("*").eq("user_id", userId).maybeSingle();
  if (error) fail(error);
  return data ? { ...data, rating: Number(data.rating) } : null;
}

export async function updateVerifierProfile(
  userId: string,
  patch: Partial<Pick<VerifierProfile, "available" | "clinic" | "license_number">>,
) {
  const { error } = await supabase.from("verifiers").update(patch).eq("user_id", userId);
  if (error) fail(error);
}

/* ── Dogs ───────────────────────────────────────────────────────────── */

export async function listMyDogs(userId: string): Promise<Dog[]> {
  const { data, error } = await supabase
    .from("dogs")
    .select(DOG_SELECT)
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });
  if (error) fail(error);
  return (data ?? []).map(normalizeDog);
}

export async function getDog(id: string): Promise<Dog | null> {
  const { data, error } = await supabase.from("dogs").select(DOG_SELECT).eq("id", id).maybeSingle();
  if (error) fail(error);
  return data ? normalizeDog(data) : null;
}

export async function createDog(input: DogInput): Promise<Dog> {
  const { data, error } = await supabase.from("dogs").insert(input).select(DOG_SELECT).single();
  if (error) fail(error);
  return normalizeDog(data);
}

export async function updateDog(id: string, input: Partial<DogInput>): Promise<Dog> {
  const { data, error } = await supabase.from("dogs").update(input).eq("id", id).select(DOG_SELECT).single();
  if (error) fail(error);
  return normalizeDog(data);
}

export async function deleteDog(id: string) {
  const { error } = await supabase.from("dogs").delete().eq("id", id);
  if (error) fail(error);
}

export interface BrowseFilters {
  excludeOwnerId: string;
  search?: string;
  sex?: Sex;
  size?: Size;
  verifiedOnly?: boolean;
  location?: string;
  limit?: number;
}

/** Search and filter dog profiles (FR4). */
export async function browseDogs(filters: BrowseFilters): Promise<Dog[]> {
  const select = filters.location ? `*, owner:owners!inner(${OWNER_FIELDS})` : DOG_SELECT;
  let query = supabase.from("dogs").select(select).neq("owner_id", filters.excludeOwnerId);

  const search = (filters.search ?? "").replace(/[%,()*\\]/g, " ").trim();
  if (search) query = query.or(`name.ilike.%${search}%,breed.ilike.%${search}%,color.ilike.%${search}%`);
  if (filters.sex) query = query.eq("sex", filters.sex);
  if (filters.size) query = query.eq("size", filters.size);
  if (filters.verifiedOnly) query = query.eq("verified", true);
  if (filters.location) query = query.ilike("owner.location", `%${filters.location}%`);

  const { data, error } = await query
    .order("tier", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 60);
  if (error) fail(error);
  return (data ?? []).map(normalizeDog);
}

export async function countVerifiedDogs(excludeOwnerId: string, location?: string): Promise<number> {
  let query = supabase
    .from("dogs")
    .select(location ? "id, owner:owners!inner(location)" : "id", { count: "exact", head: true })
    .neq("owner_id", excludeOwnerId)
    .eq("verified", true);
  if (location) query = query.ilike("owner.location", `%${location}%`);
  const { count, error } = await query;
  if (error) fail(error);
  return count ?? 0;
}

/* ── File uploads (Supabase Storage) ────────────────────────────────── */

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

async function readLocalFile(uri: string): Promise<Blob | Uint8Array> {
  if (Platform.OS === "web") return (await fetch(uri)).blob();
  return new ExpoFile(uri).bytes();
}

async function uploadFile(bucket: "dog-photos" | "documents", ownerId: string, prefix: string, uri: string, mimeType: string) {
  const contentType = mimeType === "image/jpg" ? "image/jpeg" : mimeType;
  const ext = EXTENSIONS[contentType];
  if (!ext) fail("Unsupported file type. Please use JPG, PNG or PDF.");

  const body = await readLocalFile(uri);
  const size = body instanceof Uint8Array ? body.byteLength : body.size;
  if (size > MAX_UPLOAD_BYTES) fail("File is larger than 10 MB. Please choose a smaller file.");

  const path = `${ownerId}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType, upsert: false });
  if (error) fail(error);
  return path;
}

export async function uploadDogPhoto(ownerId: string, uri: string, mimeType: string): Promise<string> {
  const path = await uploadFile("dog-photos", ownerId, "dog", uri, mimeType);
  return supabase.storage.from("dog-photos").getPublicUrl(path).data.publicUrl;
}

export async function uploadDocument(ownerId: string, type: DocType, uri: string, mimeType: string): Promise<string> {
  return uploadFile("documents", ownerId, type, uri, mimeType);
}

export async function getDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 10);
  if (error) fail(error);
  return data.signedUrl;
}

/* ── Compatibility matching ─────────────────────────────────────────── */

async function candidatePool(target: Dog): Promise<Dog[]> {
  const { data, error } = await supabase
    .from("dogs")
    .select(DOG_SELECT)
    .neq("owner_id", target.owner_id)
    .neq("sex", target.sex)
    .limit(1000);
  if (error) fail(error);
  return (data ?? []).map(normalizeDog);
}

/**
 * Ranked breeding partner recommendations for one of the user's dogs.
 * Runs on the `compatibility` Edge Function; if it is not deployed or not
 * reachable, the identical algorithm runs on the device.
 */
export async function recommendMatches(
  target: Dog,
  preferences: MatchPreferences = {},
  limit = 3,
): Promise<{ results: RankedMatch[]; source: "edge" | "device" }> {
  try {
    const { data, error } = await supabase.functions.invoke("compatibility", {
      body: { action: "recommend", dogId: target.id, preferences, limit },
    });
    if (error || !data?.results) throw error ?? new Error("Empty response");
    return {
      source: "edge",
      results: data.results.map((r: any) => ({ ...r, dog: normalizeDog(r.dog) })),
    };
  } catch {
    const pool = await candidatePool(target);
    const ranked = rankCandidates(target, pool, { limit, preferences });
    return {
      source: "device",
      results: ranked.map((r) => ({ dog: r.candidate, compatibility: r.compatibility, reasons: r.reasons })),
    };
  }
}

/** Scores arbitrary dogs against the user's active dog (browse list). */
export function scoreDogs(target: Dog | null, dogs: Dog[]): RankedMatch[] {
  return dogs.map((dog) => {
    const compatibility = computeCompatibility(
      target ?? { breed: dog.breed, age: dog.age, sex: dog.sex === "male" ? "female" : "male", temperament: [] },
      dog,
    );
    return { dog, compatibility, reasons: explainCompatibility(compatibility, dog.breed) };
  });
}

/** Fire-and-forget: alert owners whose dogs are highly compatible with a new dog. */
export function notifyCompatibleMatches(dogId: string) {
  supabase.functions.invoke("compatibility", { body: { action: "notify", dogId } }).catch(() => undefined);
}

/* ── Match requests & messaging ─────────────────────────────────────── */

export async function listMyRequests(): Promise<MatchRequest[]> {
  const { data, error } = await supabase
    .from("match_requests")
    .select(REQUEST_SELECT)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) fail(error);
  return (data ?? []).map(normalizeRequest);
}

export async function getRequest(id: number): Promise<MatchRequest | null> {
  const { data, error } = await supabase.from("match_requests").select(REQUEST_SELECT).eq("id", id).maybeSingle();
  if (error) fail(error);
  return data ? normalizeRequest(data) : null;
}

/** Any open request between two dogs, in either direction. */
export async function findOpenRequest(dogA: string, dogB: string): Promise<MatchRequest | null> {
  const { data, error } = await supabase
    .from("match_requests")
    .select(REQUEST_SELECT)
    .or(`and(dog_id.eq.${dogA},requester_dog_id.eq.${dogB}),and(dog_id.eq.${dogB},requester_dog_id.eq.${dogA})`)
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) fail(error);
  return data && data[0] ? normalizeRequest(data[0]) : null;
}

export async function createRequest(input: {
  dogId: string;
  myDogId: string;
  message: string;
  score: number | null;
}): Promise<MatchRequest> {
  const { data, error } = await supabase
    .from("match_requests")
    .insert({
      dog_id: input.dogId,
      requester_dog_id: input.myDogId,
      message: input.message.trim(),
      compatibility_score: input.score,
    })
    .select(REQUEST_SELECT)
    .single();
  if (error) fail(error);
  return normalizeRequest(data);
}

export async function respondToRequest(id: number, action: "accept" | "decline" | "cancel" | "complete") {
  const { error } = await supabase.rpc("respond_match_request", { p_request_id: id, p_action: action });
  if (error) fail(error);
}

export async function listMessages(requestId: number): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("match_request_id", requestId)
    .order("created_at", { ascending: true });
  if (error) fail(error);
  return data ?? [];
}

export async function sendMessage(requestId: number, body: string): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ match_request_id: requestId, body: body.trim() })
    .select("*")
    .single();
  if (error) fail(error);
  return data;
}

function subscribe(channelName: string, table: string, event: "INSERT" | "UPDATE" | "*", filter: string, onChange: (row: any) => void) {
  const channel: RealtimeChannel = supabase
    .channel(`${channelName}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes" as any, { event, schema: "public", table, filter }, (payload: any) => onChange(payload.new))
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToMessages(requestId: number, onInsert: (m: Message) => void) {
  return subscribe("messages", "messages", "INSERT", `match_request_id=eq.${requestId}`, onInsert);
}

export function subscribeToRequest(requestId: number, onUpdate: (r: Partial<MatchRequest>) => void) {
  return subscribe("request", "match_requests", "UPDATE", `id=eq.${requestId}`, onUpdate);
}

/* ── Verification workflow ──────────────────────────────────────────── */

export async function listVerifiers(): Promise<VerifierProfile[]> {
  const { data, error } = await supabase
    .from("verifiers")
    .select("*")
    .eq("approved", true)
    .order("available", { ascending: false })
    .order("rating", { ascending: false });
  if (error) fail(error);
  return (data ?? []).map((v) => ({ ...v, rating: Number(v.rating) }));
}

export async function submitDocuments(
  dogId: string,
  verifierUserId: string,
  documents: { type: DocType; path: string }[],
): Promise<Submission[]> {
  const { data, error } = await supabase
    .from("verifier_submissions")
    .insert(
      documents.map((d) => ({
        dog_id: dogId,
        verifier_user_id: verifierUserId,
        submission_type: d.type,
        document_url: d.path,
      })),
    )
    .select("*");
  if (error) fail(error);
  return data ?? [];
}

export async function listDogSubmissions(dogId: string): Promise<Submission[]> {
  const { data, error } = await supabase
    .from("verifier_submissions")
    .select("*")
    .eq("dog_id", dogId)
    .order("created_at", { ascending: false });
  if (error) fail(error);
  return data ?? [];
}

export async function listSubmissions(ids: string[]): Promise<Submission[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("verifier_submissions").select("*").in("id", ids);
  if (error) fail(error);
  return data ?? [];
}

export async function listVerifierQueue(verifierUserId: string): Promise<Submission[]> {
  const { data, error } = await supabase
    .from("verifier_submissions")
    .select(`*, dog:dogs(${DOG_SELECT})`)
    .eq("verifier_user_id", verifierUserId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) fail(error);
  return (data ?? []).map((s: any) => ({ ...s, dog: s.dog ? normalizeDog(s.dog) : null }));
}

export async function getSubmission(id: string): Promise<Submission | null> {
  const { data, error } = await supabase
    .from("verifier_submissions")
    .select(`*, dog:dogs(${DOG_SELECT})`)
    .eq("id", id)
    .maybeSingle();
  if (error) fail(error);
  return data ? { ...data, dog: data.dog ? normalizeDog(data.dog) : null } : null;
}

export async function reviewSubmission(id: string, decision: "approve" | "reject", notes: string) {
  const { error } = await supabase.rpc("review_submission", {
    p_submission_id: id,
    p_decision: decision,
    p_notes: notes,
  });
  if (error) fail(error);
}

export function subscribeToSubmissions(filter: string, onUpdate: (s: Submission) => void) {
  return subscribe("submissions", "verifier_submissions", "*", filter, onUpdate);
}

export async function getAuditTrail(dogId: string): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("dog_id", dogId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) fail(error);
  return data ?? [];
}

/* ── Admin: verifier applications ───────────────────────────────────── */

export async function listVerifierApplications(): Promise<VerifierApplication[]> {
  const { data, error } = await supabase.rpc("admin_list_verifiers");
  if (error) fail(error);
  return ((data ?? []) as VerifierApplication[]).map((a) => ({ ...a, documents_reviewed: Number(a.documents_reviewed) }));
}

export async function reviewVerifier(id: string, decision: "approve" | "reject", notes: string) {
  const { error } = await supabase.rpc("admin_review_verifier", {
    p_verifier_id: id,
    p_decision: decision,
    p_notes: notes,
  });
  if (error) fail(error);
}

/* ── Reviews & reputation ───────────────────────────────────────────── */

export async function listReviewsFor(userId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*, reviewer:owners!reviews_reviewer_id_fkey(display_name), dog:dogs(name)")
    .eq("reviewee_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) fail(error);
  return data ?? [];
}

export async function listMyWrittenReviews(userId: string): Promise<Review[]> {
  const { data, error } = await supabase.from("reviews").select("*").eq("reviewer_id", userId);
  if (error) fail(error);
  return data ?? [];
}

export async function createReview(requestId: number, rating: number, comment: string) {
  const { error } = await supabase
    .from("reviews")
    .insert({ match_request_id: requestId, rating, comment: comment.trim() });
  if (error) fail(error);
}

/* ── Notifications ──────────────────────────────────────────────────── */

export async function listNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) fail(error);
  return data ?? [];
}

export async function markNotificationsRead(ids?: number[]) {
  let query = supabase.from("notifications").update({ read: true }).eq("read", false);
  if (ids) query = query.in("id", ids);
  const { error } = await query;
  if (error) fail(error);
}

export function subscribeToNotifications(userId: string, onInsert: (n: AppNotification) => void) {
  return subscribe("notifications", "notifications", "INSERT", `user_id=eq.${userId}`, onInsert);
}
