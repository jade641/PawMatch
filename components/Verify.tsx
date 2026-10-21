import {
  Award,
  Camera,
  CheckCircle,
  Clock,
  FileCheck,
  FileText,
  FolderOpen,
  History,
  ImageIcon,
  PawPrint,
  RotateCcw,
  Search,
  Shield,
  Star,
  Upload,
  X,
  XCircle,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import {
  docLabel,
  DOC_TYPES,
  FONT,
  FONT_BOLD,
  FONT_MEDIUM,
  formatDate,
  latestByType,
  shadow,
  SUBMISSION_STATUS,
  T,
  TIER_DESCRIPTIONS,
  timeAgo,
} from "../constants/theme";
import { useApp, useSession } from "../contexts/AppContext";
import { useAsync } from "../hooks/useAsync";
import * as api from "../services/api";
import { pickDocument, pickImage, type PickedFile, takePhoto } from "../services/media";
import type { DocType, Submission } from "../types";
import { MyDogSelector } from "./DogWidgets";
import { Avatar, Btn, Card, DogImage, EmptyState, ErrorView, Header, HeaderAction, Loading, ScoreBar, showMessage, Tag, TextLink, VeriBadge } from "./ui";

interface StagedDoc {
  type: DocType;
  path: string;
  name: string;
}

function ProgressBar({ step }: { step: 1 | 2 | 3 }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingVertical: 12, backgroundColor: T.white, borderBottomWidth: 1, borderBottomColor: T.border }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <Text style={{ fontSize: 12, color: T.primary, fontFamily: FONT_BOLD }}>Step {step} of 3</Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: i <= step ? T.primary : T.bg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 12, color: i <= step ? "#fff" : T.medium, fontFamily: FONT_BOLD }}>{i}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: T.bg, overflow: "hidden" }}>
        <View style={{ width: `${(step / 3) * 100}%`, height: "100%", backgroundColor: T.primary }} />
      </View>
    </View>
  );
}

/* ── Step 1: upload documents (Figure 16) ───────────────────────── */
export function VerifyUpload() {
  const { navigate, replace, goBack, canGoBack, params, myDogs, dogsLoaded, activeDog, setActiveDogId } = useApp();
  const session = useSession();
  const dog = myDogs.find((d) => d.id === (params.dogId ?? activeDog?.id)) ?? myDogs[0];
  const submissions = useAsync(() => (dog ? api.listDogSubmissions(dog.id) : Promise.resolve([])), [dog?.id]);
  const [picked, setSelected] = useState<DocType | null>(params.type ?? null);
  const [staged, setStaged] = useState<StagedDoc[]>([]);
  const [uploading, setUploading] = useState(false);

  const byType = useMemo(() => latestByType(submissions.data ?? []), [submissions.data]);
  const statusOf = (type: DocType) => byType.get(type)?.status;

  // Until the owner picks one, start on the first document that still needs submitting.
  const firstOpen = DOC_TYPES.find((d) => {
    const list = (submissions.data ?? []).filter((s) => s.submission_type === d.type);
    return !list.some((s) => s.status === "vet_verified" || s.status === "owner_submitted");
  })?.type;
  const selected: DocType = picked ?? firstOpen ?? "vaccination";

  // Re-open the screen for the chosen dog so its documents and staged uploads start fresh.
  // (Selecting via the active dog alone did nothing when the screen was opened with a dogId.)
  const chooseDog = (id: string) => {
    setActiveDogId(id);
    if (id !== dog?.id) replace("verify-upload", { dogId: id });
  };

  if (!dogsLoaded) return <Loading />;
  if (!dog) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <Header title="Verify Your Dog" icon={Shield} />
        <EmptyState icon={PawPrint} title="Add a dog first" message="Verification documents belong to a dog profile." actionLabel="Add Dog Profile" onAction={() => navigate("add-dog")} />
      </View>
    );
  }

  const upload = async (picker: () => Promise<PickedFile | null>) => {
    const file = await picker();
    if (!file) return;
    setUploading(true);
    try {
      const path = await api.uploadDocument(session.user.id, selected, file.uri, file.mimeType);
      setStaged((list) => [...list.filter((d) => d.type !== selected), { type: selected, path, name: file.name }]);
      const next = DOC_TYPES.find((d) => d.type !== selected && !statusOf(d.type) && !staged.some((s) => s.type === d.type));
      if (next) setSelected(next.type);
    } catch (e) {
      showMessage("Upload failed", api.errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const verifiedCount = dog.verified_docs.length;
  const previewScore = Math.min(100, (verifiedCount + staged.length) * 25);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header title="Verify Your Dog" icon={Shield} onBack={canGoBack ? goBack : undefined} />
      <ProgressBar step={1} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }}>
        <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT, lineHeight: 20 }}>
          Upload documents to earn your verification badge. More documents = higher tier.
        </Text>

        {myDogs.length > 1 && <MyDogSelector dogs={myDogs} activeId={dog.id} onSelect={chooseDog} label="Dog to verify" />}

        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Award size={16} color={T.dark} strokeWidth={1.6} />
              <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>Trust Score Preview</Text>
            </View>
            <VeriBadge tier={dog.tier} />
          </View>
          <ScoreBar score={previewScore} showLabel />
          <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>{TIER_DESCRIPTIONS[dog.tier]}</Text>
        </Card>

        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>Choose Document Type</Text>
          {DOC_TYPES.map((d) => {
            const status = statusOf(d.type);
            const isStaged = staged.some((s) => s.type === d.type);
            const active = selected === d.type;
            return (
              <TouchableOpacity
                key={d.type}
                onPress={() => setSelected(d.type)}
                disabled={status === "vet_verified"}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: active ? T.primaryLight : T.white,
                  borderWidth: 1.5,
                  borderColor: active ? T.primary : T.border,
                  opacity: status === "vet_verified" ? 0.7 : 1,
                }}
              >
                <FileCheck size={22} color={T.primary} strokeWidth={1.5} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_MEDIUM }}>{d.label}</Text>
                  {d.required && !status && <Text style={{ fontSize: 12, color: T.primaryDark, fontFamily: FONT_BOLD }}>Required for Tier 1</Text>}
                  {status && <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>{SUBMISSION_STATUS[status].label}</Text>}
                </View>
                {status === "vet_verified" || isStaged ? (
                  <CheckCircle size={20} color={status === "vet_verified" ? T.success : T.primary} />
                ) : (
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: active ? T.primary : T.border, alignItems: "center", justifyContent: "center" }}>
                    {active && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: T.primary }} />}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View
          style={{
            borderRadius: 16,
            padding: 22,
            alignItems: "center",
            gap: 10,
            borderWidth: 2,
            borderColor: T.primary + "60",
            borderStyle: "dashed",
            backgroundColor: T.primaryLight,
          }}
        >
          {uploading ? (
            <>
              <ActivityIndicator color={T.primary} size="large" />
              <Text style={{ color: T.primaryDark, fontFamily: FONT_BOLD }}>Uploading {docLabel(selected)}…</Text>
            </>
          ) : (
            <>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: T.white, alignItems: "center", justifyContent: "center" }}>
                <Upload size={26} color={T.primary} strokeWidth={1.5} />
              </View>
              <Text style={{ fontSize: 14, color: T.primaryDark, fontFamily: FONT_BOLD, textAlign: "center" }}>
                Upload your {docLabel(selected)}
              </Text>
              <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>JPG, PNG, PDF — Max 10MB</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 4 }}>
                <Btn title="Take Photo" icon={Camera} size="small" onPress={() => upload(takePhoto)} />
                <Btn title="Gallery" icon={ImageIcon} size="small" variant="outline" onPress={() => upload(() => pickImage(false))} />
                <Btn title="File / PDF" icon={FolderOpen} size="small" variant="outline" onPress={() => upload(pickDocument)} />
              </View>
            </>
          )}
        </View>

        {staged.length > 0 && (
          <Card style={{ gap: 8 }}>
            <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>Ready to send ({staged.length})</Text>
            {staged.map((s) => (
              <View key={s.type} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <FileText size={16} color={T.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT_MEDIUM }}>{docLabel(s.type)}</Text>
                  <Text style={{ fontSize: 11, color: T.medium, fontFamily: FONT }} numberOfLines={1}>{s.name}</Text>
                </View>
                <TouchableOpacity onPress={() => setStaged((list) => list.filter((x) => x.type !== s.type))} accessibilityRole="button" accessibilityLabel="Remove document" hitSlop={8}>
                  <X size={16} color={T.medium} />
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}

        <Btn
          title="Next → Choose Verifier"
          size="large"
          disabled={staged.length === 0 || uploading}
          onPress={() => navigate("verify-choose", { dogId: dog.id, docs: staged })}
        />
        <TextLink label="View submitted documents" onPress={() => navigate("verify-status", { dogId: dog.id })} style={{ alignSelf: "center" }} />
      </ScrollView>
    </View>
  );
}

/* ── Step 2: choose verifier (Figure 17) ────────────────────────── */
export function VerifyChoose() {
  const { goBack, replace, params, showToast } = useApp();
  const session = useSession();
  const docs: StagedDoc[] = params.docs ?? [];
  const verifiers = useAsync(() => api.listVerifiers(), []);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);

  // An owner who is also a vet can't verify their own dogs.
  const filtered = (verifiers.data ?? []).filter(
    (v) => v.user_id !== session.user.id && `${v.name} ${v.clinic} ${v.role}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const send = async () => {
    if (!selected || docs.length === 0) return;
    setSending(true);
    try {
      const created = await api.submitDocuments(params.dogId, selected, docs.map((d) => ({ type: d.type, path: d.path })));
      showToast("Sent for review", "The verifier has been notified.", "success");
      // Leave the upload step too: its staged files are now submitted, and going back to it
      // would let the same documents be sent (and the verifier notified) a second time.
      goBack();
      replace("verify-status", { dogId: params.dogId, submissionIds: created.map((s) => s.id) });
    } catch (e) {
      showMessage("Couldn't submit", api.errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header
        title="Choose Your Verifier"
        icon={Shield}
        onBack={goBack}
        right={
          <HeaderAction icon={RotateCcw} label="Reset" onPress={() => { setSelected(null); setSearch(""); }} />
        }
      />
      <ProgressBar step={2} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT }}>
          Select a licensed veterinarian or certified breeder to review your {docs.length} document{docs.length === 1 ? "" : "s"}.
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, height: 46, borderRadius: 12, borderWidth: 1, borderColor: T.border, backgroundColor: T.white }}>
          <Search size={18} color={T.medium} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search for a veterinarian or clinic"
            placeholderTextColor={T.light}
            accessibilityLabel="Search verifiers"
            style={{ flex: 1, fontSize: 14, color: T.dark, fontFamily: FONT }}
          />
        </View>

        {verifiers.loading ? (
          <Loading />
        ) : verifiers.error ? (
          <ErrorView message={verifiers.error} onRetry={() => verifiers.reload()} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Search} title="No verifiers found" message="No approved verifiers match your search yet." />
        ) : (
          filtered.map((v) => {
            const isSelected = selected === v.user_id;
            return (
              <TouchableOpacity
                key={v.id}
                onPress={() => setSelected(v.user_id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${v.name}, ${v.role}${v.clinic ? `, ${v.clinic}` : ""}, ${v.available ? "available" : "busy"}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: T.white,
                  borderWidth: 2,
                  borderColor: isSelected ? T.primary : T.border,
                  ...shadow,
                }}
              >
                <Avatar name={v.name} size={52} uri={api.avatarUrl(v.avatar)} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>{v.name}</Text>
                  <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>{v.role}</Text>
                  {v.clinic ? <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>{v.clinic}</Text> : null}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 }}>
                    {v.rating > 0 && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Star size={12} color={T.star} fill={T.star} />
                        <Text style={{ fontSize: 12, fontFamily: FONT }}>{v.rating.toFixed(1)}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: v.available ? T.success : T.secondaryDark }} />
                      <Text style={{ fontSize: 12, fontFamily: FONT }}>{v.available ? "Available" : "Busy"}</Text>
                    </View>
                  </View>
                </View>
                {isSelected ? <Tag label="Selected" tone="brand" /> : <Tag label="Select" />}
              </TouchableOpacity>
            );
          })
        )}

        <Btn title="Send for Review →" size="large" disabled={!selected || docs.length === 0} loading={sending} onPress={send} />
      </ScrollView>
    </View>
  );
}

/* ── Step 3: verification status (Figure 18) ────────────────────── */
function SubmissionRow({ s }: { s: Submission }) {
  const status = SUBMISSION_STATUS[s.status];
  return (
    <Card style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD, flexShrink: 1 }}>{docLabel(s.submission_type)}</Text>
        <Tag label={status.label} tone={status.tone} />
      </View>
      <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT }}>Submitted {formatDate(s.created_at)}</Text>
      <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT }}>Reviewer: {s.verifier_name}</Text>
      {s.reviewed_at && <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT }}>Reviewed {formatDate(s.reviewed_at)}</Text>}
      {s.notes ? (
        <View style={{ backgroundColor: s.status === "verification_failed" ? T.errorLight : T.bg, borderRadius: 10, padding: 10 }}>
          <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT }}>Remarks: {s.notes}</Text>
        </View>
      ) : null}
    </Card>
  );
}

export function VerifyStatus() {
  const { navigate, replace, goBack, canGoBack, params, myDogs, dogsLoaded, activeDog, setActiveDogId, lastNotification, reloadDogs } = useApp();
  const dog = myDogs.find((d) => d.id === (params.dogId ?? activeDog?.id)) ?? myDogs[0];
  const focusIds: string[] = useMemo(() => params.submissionIds ?? [], [params.submissionIds]);
  const submissions = useAsync(
    () => (dog ? api.listDogSubmissions(dog.id) : Promise.resolve([])),
    [dog?.id, lastNotification?.id],
  );

  useEffect(() => {
    if (!dog) return;
    return api.subscribeToSubmissions(`dog_id=eq.${dog.id}`, () => {
      submissions.reload(true);
      reloadDogs().catch(() => undefined);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dog?.id]);

  const focus = useMemo(() => {
    const all = submissions.data ?? [];
    const batch = focusIds.length ? all.filter((s) => focusIds.includes(s.id)) : all.slice(0, 1);
    return batch;
  }, [submissions.data, focusIds]);

  if (!dogsLoaded) return <Loading />;
  if (!dog) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <Header title="Verification Status" icon={Shield} onBack={canGoBack ? goBack : undefined} />
        <EmptyState icon={PawPrint} title="No dogs yet" message="Add a dog and upload documents to get verified." actionLabel="Add Dog Profile" onAction={() => navigate("add-dog")} />
      </View>
    );
  }

  const anyFailed = focus.some((s) => s.status === "verification_failed");
  const allVerified = focus.length > 0 && focus.every((s) => s.status === "vet_verified");
  const pending = focus.filter((s) => s.status === "owner_submitted");

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header title="Verification Status" icon={Shield} onBack={canGoBack ? goBack : undefined} />
      <ProgressBar step={3} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        {myDogs.length > 1 && <MyDogSelector dogs={myDogs} activeId={dog.id} onSelect={(id) => { setActiveDogId(id); replace("verify-status", { dogId: id }); }} label="Dog" />}

        {submissions.loading ? (
          <Loading />
        ) : submissions.error ? (
          <ErrorView message={submissions.error} onRetry={() => submissions.reload()} />
        ) : (submissions.data ?? []).length === 0 ? (
          <EmptyState
            icon={Shield}
            title="Get Verified"
            message={`Upload ${dog.name}'s documents to unlock verified matches.`}
            actionLabel="Start Verification"
            onAction={() => navigate("verify-upload", { dogId: dog.id })}
          />
        ) : (
          <>
            <View style={{ alignItems: "center", gap: 12, paddingVertical: 12 }}>
              {allVerified ? (
                <>
                  <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: T.successLight, alignItems: "center", justifyContent: "center" }}>
                    <CheckCircle size={48} color={T.success} strokeWidth={1.5} />
                  </View>
                  <Text style={{ fontSize: 20, color: T.dark, fontFamily: FONT_BOLD, textAlign: "center" }}>
                    {focus.length > 1 ? "Your documents have been verified!" : "Your document has been verified!"}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: T.secondaryLight }}>
                    <Award size={16} color={T.warning} />
                    <Text style={{ fontSize: 14, color: T.warning, fontFamily: FONT_BOLD }}>
                      {dog.tier > 0 ? `Badge awarded: Tier ${dog.tier} Verified` : "Add a vaccination card to earn Tier 1"}
                    </Text>
                  </View>
                </>
              ) : anyFailed ? (
                <>
                  <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: T.errorLight, alignItems: "center", justifyContent: "center" }}>
                    <XCircle size={48} color={T.error} strokeWidth={1.5} />
                  </View>
                  <Text style={{ fontSize: 20, color: T.dark, fontFamily: FONT_BOLD, textAlign: "center" }}>Verification Failed</Text>
                  <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT, textAlign: "center" }}>
                    See the reviewer&apos;s remarks below, then upload a clearer or complete document.
                  </Text>
                  <Btn title="Re-upload Document" icon={RotateCcw} onPress={() => navigate("verify-upload", { dogId: dog.id, type: focus.find((s) => s.status === "verification_failed")?.submission_type })} />
                </>
              ) : (
                <>
                  <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: T.secondaryLight, alignItems: "center", justifyContent: "center" }}>
                    <Clock size={48} color={T.warning} strokeWidth={1.5} />
                  </View>
                  <Text style={{ fontSize: 20, color: T.dark, fontFamily: FONT_BOLD }}>Under Review</Text>
                  <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT, textAlign: "center", lineHeight: 20 }}>
                    {pending[0]?.verifier_name ?? "Your verifier"} will review your document{pending.length > 1 ? "s" : ""}. You&apos;ll get a notification as soon as it&apos;s done.
                  </Text>
                </>
              )}
              <TextLink label="View Audit Trail" onPress={() => navigate("audit-trail", { dogId: dog.id })} />
            </View>

            <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>All submissions for {dog.name}</Text>
            {(submissions.data ?? []).map((s) => (
              <SubmissionRow key={s.id} s={s} />
            ))}
          </>
        )}

        <Btn title="Upload more documents" icon={Upload} variant="outline" onPress={() => navigate("verify-upload", { dogId: dog.id })} />
        <Btn title={`View ${dog.name}'s Health Records`} onPress={() => navigate("dog-profile", { dogId: dog.id, tab: "health" })} />
      </ScrollView>
    </View>
  );
}

/* ── Audit trail ────────────────────────────────────────────────── */
// Colors are getters so they follow the active theme.
const AUDIT_STYLE = {
  submitted: { Icon: Upload, get color() { return T.accent; }, label: "Submitted" },
  approved: { Icon: CheckCircle, get color() { return T.success; }, label: "Approved" },
  rejected: { Icon: XCircle, get color() { return T.error; }, label: "Rejected" },
  tier_changed: { Icon: Award, get color() { return T.secondaryDark; }, label: "Badge updated" },
};

export function AuditTrailScreen() {
  const { goBack, params } = useApp();
  const dogId: string = params.dogId;
  const dog = useAsync(() => api.getDog(dogId), [dogId]);
  const entries = useAsync(() => api.getAuditTrail(dogId), [dogId]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header title="Audit Trail" icon={History} subtitle={dog.data ? `${dog.data.name} • ${dog.data.breed}` : undefined} onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
        {dog.data && (
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <DogImage uri={dog.data.img} width={48} height={48} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD }}>{dog.data.name}</Text>
              <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>{TIER_DESCRIPTIONS[dog.data.tier]}</Text>
            </View>
            <VeriBadge tier={dog.data.tier} />
          </Card>
        )}
        <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, lineHeight: 18 }}>
          Every submission and verification decision is recorded here and cannot be edited.
        </Text>
        {entries.loading ? (
          <Loading />
        ) : entries.error ? (
          <ErrorView message={entries.error} onRetry={() => entries.reload()} />
        ) : (entries.data ?? []).length === 0 ? (
          <EmptyState icon={History} title="No activity yet" message="No documents have been submitted for this dog." />
        ) : (
          (entries.data ?? []).map((e) => {
            const style = AUDIT_STYLE[e.action];
            return (
              <View key={e.id} style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: T.white, alignItems: "center", justifyContent: "center", ...shadow }}>
                  <style.Icon size={17} color={style.color} />
                </View>
                <View style={{ flex: 1, paddingBottom: 6 }}>
                  <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>
                    {style.label}: {e.details}
                  </Text>
                  <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>
                    {e.actor_name ? `${e.actor_name} • ` : ""}
                    {formatDate(e.created_at)} ({timeAgo(e.created_at)})
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
