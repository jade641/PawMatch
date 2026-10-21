import * as WebBrowser from "expo-web-browser";
import {
  Bell,
  Building2,
  CheckCircle,
  ChevronRight,
  ClipboardList,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  HelpCircle,
  IdCard,
  Inbox,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  PawPrint,
  Pencil,
  Phone,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Star,
  Stethoscope,
  User,
  XCircle,
} from "lucide-react-native";
import { type ComponentType, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { BRAND, capitalize, docLabel, FONT, FONT_BOLD, FONT_MEDIUM, formatAge, formatDate, shadow, SUBMISSION_STATUS, T, timeAgo } from "../constants/theme";
import { useApp, useSession } from "../contexts/AppContext";
import { useAsync } from "../hooks/useAsync";
import * as api from "../services/api";
import type { Submission, SubmissionStatus } from "../types";
import {
  Avatar,
  Btn,
  confirmAction,
  DogImage,
  EmptyState,
  ErrorView,
  Field,
  HeroHeader,
  HeroIconButton,
  InfoRow,
  Loading,
  DarkModeToggle,
  showMessage,
  Tag,
  VeriBadge,
} from "./ui";

type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

/** Verifier's submission queue, refreshed live as owners submit documents. */
function useQueue() {
  const { lastNotification } = useApp();
  const session = useSession();
  const queue = useAsync(() => api.listVerifierQueue(session.user.id), [session.user.id, lastNotification?.id]);
  useEffect(
    () => api.subscribeToSubmissions(`verifier_user_id=eq.${session.user.id}`, () => queue.reload(true)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session.user.id],
  );
  return queue;
}

/* ── Shared building blocks ─────────────────────────────────────── */
function Panel({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[{ backgroundColor: T.white, borderRadius: 22, padding: 18, ...shadow }, style]}>{children}</View>;
}

function PanelTitle({ icon: Icon, title, subtitle, right }: { icon: IconType; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: T.primaryLight, alignItems: "center", justifyContent: "center" }}>
        <Icon size={17} color={T.primary} strokeWidth={2.25} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, color: T.dark, fontFamily: FONT_BOLD }}>{title}</Text>
        {subtitle ? <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, marginTop: 1 }}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <Text style={{ fontSize: 16, color: T.dark, fontFamily: FONT_BOLD }}>{title}</Text>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8}>
          <Text style={{ fontSize: 13, color: T.primary, fontFamily: FONT_BOLD }}>{action} →</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** Grouped list of tappable rows inside one card. */
function MenuGroup({ items }: {
  items: { icon: IconType; title: string; subtitle?: string; onPress: () => void; danger?: boolean; badge?: number; tint?: string; color?: string }[];
}) {
  return (
    <View style={{ backgroundColor: T.white, borderRadius: 22, paddingVertical: 4, ...shadow }}>
      {items.map((it, i) => (
        <TouchableOpacity
          key={it.title}
          onPress={it.onPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderBottomWidth: i < items.length - 1 ? 1 : 0,
            borderBottomColor: T.bg,
          }}
        >
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 13,
              backgroundColor: it.danger ? T.errorLight : it.tint ?? T.primaryLight,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <it.icon size={19} color={it.danger ? T.error : it.color ?? T.primary} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, color: it.danger ? T.error : T.dark, fontFamily: FONT_BOLD }}>{it.title}</Text>
            {it.subtitle ? <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, marginTop: 2 }}>{it.subtitle}</Text> : null}
          </View>
          {it.badge ? (
            <View style={{ minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: T.primary, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 12, color: "#fff", fontFamily: FONT_BOLD }}>{it.badge}</Text>
            </View>
          ) : null}
          <ChevronRight size={18} color={T.light} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function statusStyle(status: SubmissionStatus) {
  if (status === "vet_verified") return { Icon: CheckCircle, color: T.success, tint: T.successLight };
  if (status === "verification_failed") return { Icon: XCircle, color: T.error, tint: T.errorLight };
  return { Icon: Clock, color: T.warning, tint: T.warningLight };
}

function PendingApprovalBanner() {
  const session = useSession();
  const v = session.verifier;
  if (!v || v.approved) return null;
  const rejected = !!v.reviewed_at;
  const color = rejected ? T.error : T.warning;
  const Icon = rejected ? XCircle : ShieldAlert;
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 12,
        padding: 16,
        borderRadius: 20,
        backgroundColor: rejected ? T.errorLight : T.warningLight,
        borderLeftWidth: 4,
        borderLeftColor: color,
      }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: T.white, alignItems: "center", justifyContent: "center" }}>
        <Icon size={20} color={color} strokeWidth={2.25} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD }}>
          {rejected ? "Account not approved" : "Account pending approval"}
        </Text>
        {rejected ? (
          <>
            {v.review_notes ? <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT, lineHeight: 19 }}>Reason: {v.review_notes}</Text> : null}
            <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT, lineHeight: 19 }}>
              Correct your license number under Profile → Professional Information to send it for another review.
            </Text>
          </>
        ) : (
          <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT, lineHeight: 19 }}>
            The PawMatch team is checking your license ({v.license_number || "not provided"}). Owners can send you
            documents once your account is approved.
          </Text>
        )}
      </View>
    </View>
  );
}

function SubmissionCard({ s }: { s: Submission }) {
  const { navigate } = useApp();
  const status = SUBMISSION_STATUS[s.status];
  const st = statusStyle(s.status);
  return (
    <TouchableOpacity
      onPress={() => navigate("vet-request-detail", { submissionId: s.id })}
      activeOpacity={0.8}
      accessibilityRole="button"
      style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: T.white, borderRadius: 20, padding: 12, ...shadow }}
    >
      <View>
        <DogImage uri={s.dog?.img} width={64} height={64} radius={16} />
        <View
          style={{
            position: "absolute",
            right: -4,
            bottom: -4,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: st.tint,
            borderWidth: 2,
            borderColor: T.white,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <st.Icon size={12} color={st.color} strokeWidth={2.5} />
        </View>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD }} numberOfLines={1}>
          {s.dog?.name ?? "Deleted dog"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <FileText size={13} color={T.primary} strokeWidth={2} />
          <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT_MEDIUM }} numberOfLines={1}>
            {docLabel(s.submission_type)}
          </Text>
        </View>
        <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }} numberOfLines={1}>
          {s.dog?.breed ?? "—"} • {s.dog?.owner?.display_name ?? "—"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4, gap: 8 }}>
          <Tag label={status.label} tone={status.tone} />
          <Text style={{ fontSize: 11, color: T.light, fontFamily: FONT }}>{timeAgo(s.created_at)}</Text>
        </View>
      </View>
      <ChevronRight size={18} color={T.light} />
    </TouchableOpacity>
  );
}

function QueueBody({ queue, list, empty }: {
  queue: ReturnType<typeof useQueue>;
  list: Submission[];
  empty: { icon: IconType; title: string; message: string };
}) {
  if (queue.loading) return <Loading />;
  if (queue.error) return <ErrorView message={queue.error} onRetry={() => queue.reload()} />;
  if (list.length === 0) {
    return (
      <Panel>
        <EmptyState icon={empty.icon} title={empty.title} message={empty.message} />
      </Panel>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      {list.map((s) => (
        <SubmissionCard key={s.id} s={s} />
      ))}
    </View>
  );
}

/* ── Dashboard ──────────────────────────────────────────────────── */
export function VetDashboard() {
  const { navigate, unreadCount } = useApp();
  const session = useSession();
  const v = session.verifier;
  const queue = useQueue();
  const all = queue.data ?? [];
  const today = new Date().toDateString();
  const pending = all.filter((s) => s.status === "owner_submitted");
  const stats = [
    { Icon: Clock, n: pending.length, label: "Pending Reviews", tint: T.primaryLight, color: T.primary, go: () => navigate("vet-requests") },
    { Icon: CheckCircle, n: all.filter((s) => s.status === "vet_verified").length, label: "Verified", tint: T.successLight, color: T.success, go: () => navigate("vet-records") },
    { Icon: XCircle, n: all.filter((s) => s.status === "verification_failed").length, label: "Rejected", tint: T.errorLight, color: T.error, go: () => navigate("vet-records") },
    {
      Icon: FileCheck,
      n: all.filter((s) => s.reviewed_at && new Date(s.reviewed_at).toDateString() === today).length,
      label: "Reviewed Today",
      tint: T.accentLight,
      color: T.accent,
      go: () => navigate("vet-records"),
    },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = v?.name ?? session.user.full_name;
  const statusPill = v?.approved
    ? { Icon: ShieldCheck, label: "Approved Verifier" }
    : v?.reviewed_at
      ? { Icon: XCircle, label: "Not Approved" }
      : { Icon: Clock, label: "Pending Approval" };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => queue.reload(true)} tintColor={T.primary} />}
      >
        <HeroHeader
          eyebrow="Veterinarian Portal"
          title={`${greeting},`}
          overlap={48}
          right={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <HeroIconButton icon={Bell} label="Notifications" onPress={() => navigate("notifications")} badge={unreadCount > 0} />
              <TouchableOpacity
                onPress={() => navigate("vet-profile")}
                accessibilityRole="button"
                accessibilityLabel="My profile"
                style={{ borderRadius: 21, borderWidth: 2, borderColor: "rgba(255,255,255,0.7)" }}
              >
                <Avatar name={name} size={38} color={BRAND.orangeDeep} uri={api.avatarUrl(session.user.avatar_url)} />
              </TouchableOpacity>
            </View>
          }
        >
          <Text style={{ fontSize: 26, color: "#fff", fontFamily: FONT_BOLD, letterSpacing: -0.5, marginTop: 2 }} numberOfLines={1}>
            {name}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)" }}>
              <statusPill.Icon size={14} color="#fff" strokeWidth={2.25} />
              <Text style={{ fontSize: 12, color: "#fff", fontFamily: FONT_BOLD }}>{statusPill.label}</Text>
            </View>
            {v?.clinic ? (
              // maxWidth + flexShrink let a long clinic name wrap to its own row and truncate there,
              // instead of pushing the chip past the screen edge.
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", maxWidth: "100%" }}>
                <Building2 size={14} color="#fff" strokeWidth={2.25} />
                <Text style={{ fontSize: 12, color: "#fff", fontFamily: FONT_BOLD, flexShrink: 1 }} numberOfLines={1}>
                  {v.clinic}
                </Text>
              </View>
            ) : null}
          </View>
        </HeroHeader>

        <View style={{ marginTop: -48, paddingHorizontal: 16, gap: 22 }}>
          {/* Stats 2×2 */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {stats.map((s) => (
              <TouchableOpacity
                key={s.label}
                onPress={s.go}
                activeOpacity={0.8}
                style={{ flexGrow: 1, flexBasis: "45%", backgroundColor: T.white, borderRadius: 20, padding: 16, ...shadow }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: s.tint, alignItems: "center", justifyContent: "center" }}>
                    <s.Icon size={20} color={s.color} strokeWidth={2} />
                  </View>
                  <ChevronRight size={16} color={T.light} />
                </View>
                <Text style={{ fontSize: 28, color: T.dark, fontFamily: FONT_BOLD, marginTop: 12 }}>{queue.loading ? "–" : s.n}</Text>
                <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT_MEDIUM, marginTop: 2 }}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <PendingApprovalBanner />

          {/* Primary call to action */}
          <TouchableOpacity
            onPress={() => navigate("vet-requests")}
            activeOpacity={0.9}
            style={{ borderRadius: 24, padding: 20, overflow: "hidden", backgroundColor: T.ink }}
          >
            <View style={{ position: "absolute", right: -30, top: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: T.primary, opacity: 0.9 }} />
            <ClipboardList size={34} color="#fff" strokeWidth={2} style={{ position: "absolute", right: 22, top: 20 }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Stethoscope size={14} color={T.secondary} strokeWidth={2.25} />
              <Text style={{ fontSize: 11, color: T.secondary, fontFamily: FONT_BOLD, letterSpacing: 1 }}>REVIEW QUEUE</Text>
            </View>
            <Text style={{ fontSize: 20, lineHeight: 26, color: "#fff", fontFamily: FONT_BOLD, marginTop: 8, maxWidth: "75%" }}>
              {pending.length === 0
                ? "You're all caught up!"
                : `${pending.length} document${pending.length === 1 ? "" : "s"} waiting for your review`}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                alignSelf: "flex-start",
                gap: 4,
                marginTop: 14,
                paddingVertical: 9,
                paddingLeft: 16,
                paddingRight: 10,
                borderRadius: 14,
                backgroundColor: T.primary,
              }}
            >
              <Text style={{ color: "#fff", fontFamily: FONT_BOLD, fontSize: 14 }}>{pending.length === 0 ? "Open Queue" : "Start Reviewing"}</Text>
              <ChevronRight size={18} color="#fff" strokeWidth={2.5} />
            </View>
          </TouchableOpacity>

          <MenuGroup
            items={[
              { icon: ClipboardList, title: "Verification Requests", subtitle: `${pending.length} waiting for you`, badge: pending.length, onPress: () => navigate("vet-requests") },
              { icon: FileText, title: "Verification Records", subtitle: "Everything you have approved or rejected", tint: T.accentLight, color: T.accent, onPress: () => navigate("vet-records") },
            ]}
          />

          <View>
            <SectionHeader title="Waiting for review" action="View all" onAction={() => navigate("vet-requests")} />
            <QueueBody
              queue={queue}
              list={pending.slice(0, 5)}
              empty={{ icon: CheckCircle, title: "All caught up", message: "New documents from dog owners will appear here and you'll get an alert." }}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* ── Queue ──────────────────────────────────────────────────────── */
export function VetRequests() {
  const { goBack, canGoBack } = useApp();
  const queue = useQueue();
  const [filter, setFilter] = useState<"all" | SubmissionStatus>("owner_submitted");
  const list = (queue.data ?? []).filter((s) => filter === "all" || s.status === filter);
  const filters: { id: "all" | SubmissionStatus; label: string }[] = [
    { id: "owner_submitted", label: "Pending" },
    { id: "vet_verified", label: "Verified" },
    { id: "verification_failed", label: "Failed" },
    { id: "all", label: "All" },
  ];
  const count = (id: "all" | SubmissionStatus) => (queue.data ?? []).filter((s) => id === "all" || s.status === id).length;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <HeroHeader
        title="Verification Requests"
        subtitle="Documents sent to you by dog owners"
        onBack={canGoBack ? goBack : undefined}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16, marginHorizontal: -20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {filters.map((f) => {
            const active = filter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => setFilter(f.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 20,
                  backgroundColor: active ? T.white : "rgba(255,255,255,0.2)",
                }}
              >
                <Text style={{ fontSize: 13, color: active ? T.primaryDark : "#fff", fontFamily: FONT_BOLD }}>{f.label}</Text>
                <View style={{ minWidth: 20, paddingHorizontal: 6, height: 20, borderRadius: 10, backgroundColor: active ? T.primaryLight : "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 11, color: active ? T.primaryDark : "#fff", fontFamily: FONT_BOLD }}>{count(f.id)}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </HeroHeader>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => queue.reload(true)} tintColor={T.primary} />}
      >
        <QueueBody queue={queue} list={list} empty={{ icon: Inbox, title: "No requests found", message: "Nothing in this list yet." }} />
      </ScrollView>
    </View>
  );
}

/* ── Review a submission ────────────────────────────────────────── */
export function VetRequestDetail() {
  const { goBack, params, showToast } = useApp();
  const session = useSession();
  const submissionId: string = params.submissionId;
  const submission = useAsync(() => api.getSubmission(submissionId), [submissionId]);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docError, setDocError] = useState<string>();
  const [notes, setNotes] = useState("");
  const [deciding, setDeciding] = useState<"approve" | "reject" | null>(null);

  const path = submission.data?.document_url;
  const isPdf = !!path && path.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api
      .getDocumentUrl(path)
      .then((url) => !cancelled && setDocUrl(url))
      .catch((e) => !cancelled && setDocError(api.errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (submission.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <HeroHeader title="Review Document" onBack={goBack} />
        <Loading />
      </View>
    );
  }
  if (submission.error || !submission.data) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <HeroHeader title="Review Document" onBack={goBack} />
        <ErrorView message={submission.error ?? "Submission not found."} onRetry={() => submission.reload()} />
      </View>
    );
  }

  const s = submission.data;
  const dog = s.dog;
  const status = SUBMISSION_STATUS[s.status];
  const st = statusStyle(s.status);
  const canReview = s.status === "owner_submitted" && s.verifier_user_id === session.user.id;

  const decide = (decision: "approve" | "reject") => {
    if (decision === "reject" && !notes.trim()) {
      showMessage("Remarks required", "Explain why the document was rejected so the owner can fix it.");
      return;
    }
    confirmAction(
      decision === "approve" ? "Approve document?" : "Reject document?",
      decision === "approve"
        ? `${docLabel(s.submission_type)} for ${dog?.name ?? "this dog"} will be marked Veterinarian Verified. This is recorded in the audit trail and cannot be undone.`
        : "The owner will be notified with your remarks and can re-upload.",
      decision === "approve" ? "Approve" : "Reject",
      async () => {
        setDeciding(decision);
        try {
          await api.reviewSubmission(s.id, decision, notes);
          showToast(decision === "approve" ? "Document verified" : "Document rejected", "The owner has been notified.", "success");
          await submission.reload(true);
        } catch (e) {
          showMessage("Couldn't save decision", api.errorMessage(e));
        } finally {
          setDeciding(null);
        }
      },
      decision === "reject",
    );
  };

  const checklist = ["Document is clear and legible", "It belongs to this dog", "It is complete and still valid"];

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <HeroHeader eyebrow="Review Document" title={docLabel(s.submission_type)} onBack={goBack} overlap={40}>
          <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, marginTop: 12, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)" }}>
            <st.Icon size={14} color="#fff" strokeWidth={2.25} />
            <Text style={{ fontSize: 12, color: "#fff", fontFamily: FONT_BOLD }}>{status.label}</Text>
          </View>
        </HeroHeader>

        <View style={{ marginTop: -40, paddingHorizontal: 16, gap: 16 }}>
          {/* Dog */}
          <Panel>
            <View style={{ flexDirection: "row", gap: 14 }}>
              <DogImage uri={dog?.img} width={84} height={84} radius={20} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <Text style={{ fontSize: 19, color: T.dark, fontFamily: FONT_BOLD, flexShrink: 1 }} numberOfLines={1}>
                    {dog?.name ?? "Deleted dog"}
                  </Text>
                  <VeriBadge tier={dog?.tier ?? 0} />
                </View>
                {dog && (
                  <>
                    <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT_MEDIUM }}>{dog.breed}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                      {[formatAge(dog.age), capitalize(dog.sex), capitalize(dog.size), dog.color].map((t) => (
                        <View key={t} style={{ paddingVertical: 3, paddingHorizontal: 9, borderRadius: 10, backgroundColor: T.bg }}>
                          <Text style={{ fontSize: 11, color: T.dark, fontFamily: FONT_MEDIUM }}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            </View>
            {dog?.owner && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, padding: 12, borderRadius: 16, backgroundColor: T.bg }}>
                <Avatar name={dog.owner.display_name} size={38} uri={api.avatarUrl(dog.owner.avatar_url)} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, color: T.medium, fontFamily: FONT_BOLD, letterSpacing: 0.6 }}>OWNER</Text>
                  <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>{dog.owner.display_name}</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <MapPin size={12} color={T.medium} />
                  <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>{dog.owner.location}</Text>
                </View>
              </View>
            )}
          </Panel>

          {/* Document */}
          <Panel>
            <PanelTitle icon={FileText} title="Submitted Document" subtitle={`Submitted ${formatDate(s.created_at)}`} />
            {s.reviewed_at && <InfoRow label="Reviewed" value={formatDate(s.reviewed_at)} last />}
            {docError ? (
              <ErrorView message={docError} />
            ) : !docUrl ? (
              <Loading message="Loading document…" />
            ) : isPdf ? (
              <TouchableOpacity
                onPress={() => WebBrowser.openBrowserAsync(docUrl)}
                activeOpacity={0.8}
                style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: T.primary, borderStyle: "dashed", backgroundColor: T.primaryLight }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: T.white, alignItems: "center", justifyContent: "center" }}>
                  <FileText size={22} color={T.primary} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>PDF document</Text>
                  <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>Tap to open in your browser</Text>
                </View>
                <ExternalLink size={18} color={T.primary} />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync(docUrl)} activeOpacity={0.9}>
                  <Image source={{ uri: docUrl }} style={{ width: "100%", height: 320, borderRadius: 16, backgroundColor: T.bg }} resizeMode="contain" />
                  <View style={{ position: "absolute", right: 10, bottom: 10, flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.6)" }}>
                    <ExternalLink size={13} color="#fff" />
                    <Text style={{ fontSize: 12, color: "#fff", fontFamily: FONT_BOLD }}>Full size</Text>
                  </View>
                </TouchableOpacity>
              </>
            )}
          </Panel>

          {/* Decision */}
          {canReview ? (
            <Panel>
              <PanelTitle icon={Stethoscope} title="Your Decision" subtitle="This is recorded in the audit trail" />
              <View style={{ gap: 8, marginBottom: 14 }}>
                {checklist.map((c) => (
                  <View key={c} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <CheckCircle size={16} color={T.success} strokeWidth={2.25} />
                    <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT }}>{c}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 13, color: T.dark, marginBottom: 8, fontFamily: FONT_MEDIUM }}>Remarks</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Required when rejecting — e.g. photo is blurry, rabies vaccine expired"
                placeholderTextColor={T.light}
                multiline
                maxLength={1000}
                style={[
                  {
                    minHeight: 100,
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: T.border,
                    backgroundColor: T.inputBg,
                    padding: 14,
                    fontSize: 14,
                    color: T.dark,
                    fontFamily: FONT,
                    textAlignVertical: "top",
                  },
                  Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null,
                ]}
              />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <DecisionButton
                  label="Reject"
                  icon={XCircle}
                  color={T.error}
                  outline
                  loading={deciding === "reject"}
                  disabled={!!deciding}
                  onPress={() => decide("reject")}
                />
                <DecisionButton
                  label="Approve"
                  icon={CheckCircle}
                  color={T.success}
                  loading={deciding === "approve"}
                  disabled={!!deciding}
                  onPress={() => decide("approve")}
                />
              </View>
            </Panel>
          ) : (
            <View style={{ flexDirection: "row", gap: 14, padding: 18, borderRadius: 22, backgroundColor: st.tint }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: T.white, alignItems: "center", justifyContent: "center" }}>
                <st.Icon size={22} color={st.color} strokeWidth={2.25} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD }}>{status.label}</Text>
                {s.reviewed_at ? <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>on {formatDate(s.reviewed_at)}</Text> : null}
                {s.notes ? <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT, lineHeight: 19, marginTop: 4 }}>Remarks: {s.notes}</Text> : null}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function DecisionButton({ label, icon: Icon, color, outline, loading, disabled, onPress }: {
  label: string;
  icon: IconType;
  color: string;
  outline?: boolean;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={{
        flex: 1,
        height: 54,
        borderRadius: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderWidth: 1.5,
        borderColor: color,
        backgroundColor: outline ? T.white : color,
        opacity: disabled && !loading ? 0.6 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={outline ? color : "#fff"} />
      ) : (
        <>
          <Icon size={19} color={outline ? color : "#fff"} strokeWidth={2.25} />
          <Text style={{ fontSize: 16, color: outline ? color : "#fff", fontFamily: FONT_BOLD }}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/* ── Records ────────────────────────────────────────────────────── */
export function VetRecords() {
  const { goBack, canGoBack } = useApp();
  const queue = useQueue();
  const [search, setSearch] = useState("");
  const allReviewed = (queue.data ?? []).filter((s) => s.status !== "owner_submitted");
  const reviewed = allReviewed
    .filter((s) => `${s.dog?.name ?? ""} ${s.dog?.owner?.display_name ?? ""} ${docLabel(s.submission_type)}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => (b.reviewed_at ?? "").localeCompare(a.reviewed_at ?? ""));
  const approved = allReviewed.filter((s) => s.status === "vet_verified").length;

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <HeroHeader title="Verification Records" subtitle="Everything you have approved or rejected" onBack={canGoBack ? goBack : undefined}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16, paddingHorizontal: 14, height: 50, borderRadius: 16, backgroundColor: T.white }}>
          <Search size={19} color={T.medium} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by dog, owner or document"
            placeholderTextColor={T.light}
            style={[{ flex: 1, height: "100%", fontSize: 14, color: T.dark, fontFamily: FONT }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          {[
            { label: "Reviewed", n: allReviewed.length },
            { label: "Approved", n: approved },
            { label: "Rejected", n: allReviewed.length - approved },
          ].map((x) => (
            <View key={x.label} style={{ flex: 1, paddingVertical: 8, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center" }}>
              <Text style={{ fontSize: 18, color: "#fff", fontFamily: FONT_BOLD }}>{queue.loading ? "–" : x.n}</Text>
              <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", fontFamily: FONT_MEDIUM }}>{x.label}</Text>
            </View>
          ))}
        </View>
      </HeroHeader>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => queue.reload(true)} tintColor={T.primary} />}
      >
        <QueueBody queue={queue} list={reviewed} empty={{ icon: FileText, title: "No records found", message: "Documents you approve or reject are kept here." }} />
      </ScrollView>
    </View>
  );
}

/* ── Verifier profile ───────────────────────────────────────────── */
export function VetProfile() {
  const { navigate, refreshSession, showToast, switchPortal } = useApp();
  const session = useSession();
  const v = session.verifier;
  const queue = useQueue();
  const [editing, setEditing] = useState(false);
  const [clinic, setClinic] = useState(v?.clinic ?? "");
  const [license, setLicense] = useState(v?.license_number ?? "");
  const [saving, setSaving] = useState(false);

  if (!v) return <ErrorView message="This account has no verifier profile." />;

  const reviewed = (queue.data ?? []).filter((s) => s.status !== "owner_submitted").length;
  const pending = (queue.data ?? []).filter((s) => s.status === "owner_submitted").length;
  const approval = v.approved
    ? { Icon: CheckCircle, label: "Approved verifier", color: T.success, tint: T.successLight }
    : v.reviewed_at
      ? { Icon: XCircle, label: "Not approved", color: T.error, tint: T.errorLight }
      : { Icon: Clock, label: "Pending approval", color: T.warning, tint: T.warningLight };

  const toggleAvailable = async (available: boolean) => {
    try {
      await api.updateVerifierProfile(session.user.id, { available });
      await refreshSession();
    } catch (e) {
      showMessage("Couldn't update availability", api.errorMessage(e));
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.updateVerifierProfile(session.user.id, { clinic: clinic.trim(), license_number: license.trim() });
      await refreshSession();
      setEditing(false);
      showToast("Professional details updated", undefined, "success");
    } catch (e) {
      showMessage("Couldn't save", api.errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const infoRows = [
    { icon: IdCard, label: "License No.", value: v.license_number || "—" },
    { icon: Building2, label: "Clinic", value: v.clinic || "—" },
    { icon: Mail, label: "Email", value: session.user.email },
    { icon: Phone, label: "Phone", value: session.user.phone ?? "—" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <HeroHeader
          eyebrow="Veterinarian Portal"
          title="My Profile"
          overlap={60}
          right={<HeroIconButton icon={Settings} label="Settings" onPress={() => navigate("vet-settings")} />}
        />

        <View style={{ marginTop: -60, paddingHorizontal: 16, gap: 16 }}>
          {/* Identity card */}
          <Panel style={{ alignItems: "center", paddingTop: 0 }}>
            <View style={{ marginTop: -2, padding: 5, borderRadius: 50, backgroundColor: T.white, transform: [{ translateY: -36 }], marginBottom: -36, ...shadow }}>
              <Avatar name={v.name} size={84} uri={api.avatarUrl(v.avatar)} />
            </View>
            <Text style={{ fontSize: 20, color: T.dark, fontFamily: FONT_BOLD, marginTop: 12, textAlign: "center" }}>{v.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
              <Stethoscope size={13} color={T.medium} />
              <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT }}>{v.role}</Text>
              <Text style={{ color: T.light }}>•</Text>
              <MapPin size={13} color={T.medium} />
              <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT }}>{session.user.location}</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, backgroundColor: approval.tint }}>
              <approval.Icon size={14} color={approval.color} strokeWidth={2.25} />
              <Text style={{ fontSize: 12, color: approval.color, fontFamily: FONT_BOLD }}>{approval.label}</Text>
            </View>

            <View style={{ flexDirection: "row", alignSelf: "stretch", marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: T.bg }}>
              {[
                { n: String(reviewed), label: "Reviewed", Icon: FileCheck },
                { n: String(pending), label: "Pending", Icon: Clock },
                { n: v.rating > 0 ? v.rating.toFixed(1) : "—", label: "Rating", Icon: Star },
              ].map((x, i) => (
                <View key={x.label} style={{ flex: 1, alignItems: "center", borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: T.bg }}>
                  <Text style={{ fontSize: 22, color: T.dark, fontFamily: FONT_BOLD }}>{queue.loading && x.label !== "Rating" ? "–" : x.n}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <x.Icon size={12} color={T.medium} />
                    <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>{x.label}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Panel>

          <PendingApprovalBanner />

          {/* Availability */}
          <Panel style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: v.available ? T.successLight : T.bg, alignItems: "center", justifyContent: "center" }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: v.available ? T.success : T.light }} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD }}>Available for reviews</Text>
              <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, marginTop: 2 }}>
                Owners see you as <Text style={{ fontFamily: FONT_BOLD, color: v.available ? T.success : T.medium }}>{v.available ? "Available" : "Busy"}</Text>
              </Text>
            </View>
            <Switch value={v.available} onValueChange={toggleAvailable} trackColor={{ true: T.primary, false: T.light }} thumbColor="#fff" />
          </Panel>

          {/* Professional information */}
          <Panel>
            <PanelTitle
              icon={FileText}
              title="Professional Information"
              right={
                !editing ? (
                  <TouchableOpacity
                    onPress={() => setEditing(true)}
                    hitSlop={8}
                    style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, backgroundColor: T.primaryLight }}
                  >
                    <Pencil size={13} color={T.primaryDark} strokeWidth={2.25} />
                    <Text style={{ fontSize: 13, color: T.primaryDark, fontFamily: FONT_BOLD }}>Edit</Text>
                  </TouchableOpacity>
                ) : undefined
              }
            />
            {editing ? (
              <>
                <Field label="Clinic / Kennel" value={clinic} onChangeText={setClinic} />
                <Field
                  label="License / Certification No."
                  value={license}
                  onChangeText={setLicense}
                  autoCapitalize="characters"
                  hint="Changing this sends your account back to the PawMatch team for approval."
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Btn title="Cancel" variant="outline" onPress={() => setEditing(false)} style={{ flex: 1 }} />
                  <Btn title="Save" loading={saving} onPress={save} style={{ flex: 1 }} />
                </View>
              </>
            ) : (
              <View style={{ gap: 4 }}>
                {infoRows.map((r, i) => (
                  <View
                    key={r.label}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 10,
                      borderBottomWidth: i < infoRows.length - 1 ? 1 : 0,
                      borderBottomColor: T.bg,
                    }}
                  >
                    <r.icon size={18} color={T.medium} strokeWidth={2} />
                    <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT, width: 86 }}>{r.label}</Text>
                    <Text style={{ flex: 1, fontSize: 14, color: T.dark, fontFamily: FONT_MEDIUM, textAlign: "right" }} numberOfLines={1}>
                      {r.value}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </Panel>

          <MenuGroup
            items={[
              { icon: ClipboardList, title: "Verification Requests", subtitle: "Documents waiting for you", badge: pending, onPress: () => navigate("vet-requests") },
              { icon: FileText, title: "Verification Records", subtitle: "Your review history", tint: T.accentLight, color: T.accent, onPress: () => navigate("vet-records") },
            ]}
          />

          {session.owner && (
            <MenuGroup
              items={[
                { icon: PawPrint, title: "Switch to Dog Owner", subtitle: "Your dogs, matches and messages", tint: T.secondaryLight, color: T.secondaryDark, onPress: () => switchPortal("owner") },
              ]}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ── Verifier settings ──────────────────────────────────────────── */
export function VetSettings() {
  const { navigate, goBack, signOut } = useApp();
  const session = useSession();
  const name = session.verifier?.name ?? session.user.full_name;
  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <HeroHeader title="Settings" subtitle="Manage your veterinarian account" onBack={goBack} overlap={36} />
        <View style={{ marginTop: -36, paddingHorizontal: 16, gap: 22 }}>
          <Panel style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Avatar name={name} size={52} uri={api.avatarUrl(session.user.avatar_url)} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, color: T.dark, fontFamily: FONT_BOLD }} numberOfLines={1}>
                {name}
              </Text>
              <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT, marginTop: 2 }} numberOfLines={1}>
                {session.user.email}
              </Text>
            </View>
          </Panel>

          <View>
            <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT_BOLD, letterSpacing: 0.8, marginBottom: 10, marginLeft: 4 }}>ACCOUNT</Text>
            <MenuGroup
              items={[
                { icon: User, title: "Edit Profile", subtitle: "Name, phone and location", onPress: () => navigate("edit-profile") },
                { icon: KeyRound, title: "Change Password", subtitle: "Keep your account secure", tint: T.secondaryLight, color: T.secondaryDark, onPress: () => navigate("change-password") },
                { icon: Bell, title: "Notifications", subtitle: "Alerts for new documents", tint: T.accentLight, color: T.accent, onPress: () => navigate("notifications") },
              ]}
            />
          </View>

          <View>
            <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT_BOLD, letterSpacing: 0.8, marginBottom: 10, marginLeft: 4 }}>APPEARANCE</Text>
            <Panel>
              <DarkModeToggle />
            </Panel>
          </View>

          <View>
            <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT_BOLD, letterSpacing: 0.8, marginBottom: 10, marginLeft: 4 }}>SUPPORT</Text>
            <MenuGroup
              items={[{ icon: HelpCircle, title: "Help & About", subtitle: "FAQs and app information", tint: T.successLight, color: T.success, onPress: () => navigate("settings") }]}
            />
          </View>

          <MenuGroup
            items={[
              {
                icon: LogOut,
                title: "Log Out",
                subtitle: "Sign out of your veterinarian account",
                danger: true,
                onPress: () => confirmAction("Log out?", "You'll need to sign in again to review documents.", "Log Out", signOut),
              },
            ]}
          />
        </View>
      </ScrollView>
    </View>
  );
}
