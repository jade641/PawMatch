import { Ban, Camera, CheckCircle, EyeOff, Flag, Mail, PawPrint, Phone, RotateCcw, Search, ShieldCheck, ShieldOff, UserCheck, XCircle } from "lucide-react-native";
import { useState } from "react";
import { Image, KeyboardAvoidingView, Linking, Platform, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import {
  APPLICATION_STATUS,
  applicationStatus,
  FONT,
  FONT_BOLD,
  FONT_MEDIUM,
  formatDate,
  PHOTO_VERIFICATION_STATUS,
  REPORT_STATUS,
  reportReasonLabel,
  T,
  timeAgo,
} from "../constants/theme";
import { useApp, useSession } from "../contexts/AppContext";
import { useAsync } from "../hooks/useAsync";
import * as api from "../services/api";
import type { AdminPhotoVerification, ApplicationStatus, ReportStatus, RestrictedItem, UserReport, VerifierApplication } from "../types";
import { Avatar, Btn, Card, confirmAction, DogImage, EmptyState, ErrorView, Header, InfoRow, Loading, SectionTitle, showMessage, Tag } from "./ui";

/** All applications, refreshed when an admin alert arrives. */
function useApplications() {
  const { lastNotification } = useApp();
  return useAsync(() => api.listVerifierApplications(), [lastNotification?.id]);
}

/** All user reports, refreshed when an admin alert arrives. */
function useReports() {
  const { lastNotification } = useApp();
  return useAsync(() => api.listReports(), [lastNotification?.id]);
}

/** Switches the Admin tab between applications, reports and restricted listings / accounts. */
function AdminSwitcher({ current }: { current: "admin-verifiers" | "admin-reports" | "admin-restricted" | "admin-photos" }) {
  const { replace } = useApp();
  const items = [
    { id: "admin-verifiers" as const, label: "Applications", Icon: UserCheck },
    { id: "admin-reports" as const, label: "Reports", Icon: Flag },
    { id: "admin-photos" as const, label: "Photos", Icon: Camera },
    { id: "admin-restricted" as const, label: "Restricted", Icon: Ban },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, backgroundColor: T.white }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingTop: 12 }}>
      {items.map(({ id, label, Icon }) => {
        const active = id === current;
        return (
          <TouchableOpacity
            key={id}
            onPress={() => !active && replace(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: active ? T.primary : T.border,
              backgroundColor: active ? T.primaryLight : T.white,
            }}
          >
            <Icon size={15} color={active ? T.primaryDark : T.medium} strokeWidth={2} />
            <Text style={{ fontSize: 12, color: active ? T.primaryDark : T.medium, fontFamily: FONT_BOLD }} numberOfLines={1}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function ApplicationCard({ a }: { a: VerifierApplication }) {
  const { navigate } = useApp();
  const status = APPLICATION_STATUS[applicationStatus(a)];
  return (
    <Card onPress={() => navigate("admin-verifier-detail", { verifierId: a.id })} style={{ flexDirection: "row", gap: 12 }}>
      <Avatar name={a.name} size={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD, flexShrink: 1 }} numberOfLines={1}>
            {a.name}
          </Text>
          <Tag label={status.label} tone={status.tone} />
        </View>
        <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT_MEDIUM }} numberOfLines={1}>
          {a.role}
          {a.clinic ? ` • ${a.clinic}` : ""}
        </Text>
        <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }} numberOfLines={1}>
          License: {a.license_number || "not provided"}
        </Text>
        <Text style={{ fontSize: 11, color: T.light, fontFamily: FONT }}>Applied {timeAgo(a.created_at)}</Text>
      </View>
    </Card>
  );
}

/* ── Application queue ──────────────────────────────────────────── */
export function AdminVerifiers() {
  const { goBack, canGoBack } = useApp();
  const apps = useApplications();
  const [filter, setFilter] = useState<"all" | ApplicationStatus>("pending");
  const [search, setSearch] = useState("");
  const all = apps.data ?? [];
  const query = search.trim().toLowerCase();
  const list = all
    .filter((a) => filter === "all" || applicationStatus(a) === filter)
    .filter((a) => `${a.name} ${a.email} ${a.clinic} ${a.license_number}`.toLowerCase().includes(query));
  const filters: { id: "all" | ApplicationStatus; label: string }[] = [
    { id: "pending", label: "Pending" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Not Approved" },
    { id: "all", label: "All" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header title="Verifier Applications" subtitle="Veterinarians and breeders" icon={ShieldCheck} onBack={canGoBack ? goBack : undefined} />
      <AdminSwitcher current="admin-verifiers" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, backgroundColor: T.white }} contentContainerStyle={{ gap: 8, padding: 12, paddingHorizontal: 20 }}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: filter === f.id ? T.primary : T.bg }}
          >
            <Text style={{ fontSize: 13, color: filter === f.id ? "#fff" : T.dark, fontFamily: FONT_BOLD }}>
              {f.label}
              {f.id !== "all" ? ` (${all.filter((a) => applicationStatus(a) === f.id).length})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={{ padding: 20, paddingBottom: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, height: 46, borderRadius: 12, borderWidth: 1, borderColor: T.border, backgroundColor: T.white }}>
          <Search size={18} color={T.medium} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, email, clinic or license"
            placeholderTextColor={T.light}
            autoCapitalize="none"
            style={{ flex: 1, fontSize: 14, color: T.dark, fontFamily: FONT }}
          />
        </View>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => apps.reload(true)} tintColor={T.primary} />}
      >
        {apps.loading ? (
          <Loading />
        ) : apps.error ? (
          <ErrorView message={apps.error} onRetry={() => apps.reload()} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title={filter === "pending" && !query ? "No applications waiting" : "No applications found"}
            message={filter === "pending" && !query ? "New veterinarian and breeder sign-ups will appear here and you'll get an alert." : "Nothing matches this filter."}
          />
        ) : (
          list.map((a) => <ApplicationCard key={a.id} a={a} />)
        )}
      </ScrollView>
    </View>
  );
}

/* ── Review one application ─────────────────────────────────────── */
export function AdminVerifierDetail() {
  const { goBack, params, showToast } = useApp();
  const session = useSession();
  const verifierId: string = params.verifierId;
  const apps = useApplications();
  const [notes, setNotes] = useState("");
  const [deciding, setDeciding] = useState<"approve" | "reject" | null>(null);

  const a = apps.data?.find((x) => x.id === verifierId);

  if (apps.loading || !a) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <Header title="Application" onBack={goBack} />
        {apps.loading ? <Loading /> : <ErrorView message={apps.error ?? "Application not found."} onRetry={() => apps.reload()} />}
      </View>
    );
  }

  const statusId = applicationStatus(a);
  const status = APPLICATION_STATUS[statusId];
  const isSelf = a.user_id === session.user.id;

  const decide = (decision: "approve" | "reject") => {
    if (decision === "reject" && !notes.trim()) {
      showMessage("Remarks required", "Tell the applicant why, so they know what to fix.");
      return;
    }
    const revoking = decision === "reject" && statusId === "approved";
    confirmAction(
      decision === "approve" ? `Approve ${a.name}?` : revoking ? "Revoke approval?" : "Reject application?",
      decision === "approve"
        ? `Owners will be able to choose ${a.name} to verify their dogs' documents.`
        : revoking
          ? `${a.name} will no longer appear to owners or be able to review documents. They'll see your remarks.`
          : `${a.name} will be notified with your remarks. They can re-submit by correcting their license number.`,
      decision === "approve" ? "Approve" : revoking ? "Revoke" : "Reject",
      async () => {
        setDeciding(decision);
        try {
          await api.reviewVerifier(a.id, decision, notes);
          showToast(decision === "approve" ? "Verifier approved" : revoking ? "Approval revoked" : "Application rejected", "The applicant has been notified.", "success");
          setNotes("");
          await apps.reload(true);
        } catch (e) {
          showMessage("Couldn't save decision", api.errorMessage(e));
        } finally {
          setDeciding(null);
        }
      },
      decision === "reject",
    );
  };

  const openLink = (url: string) => Linking.openURL(url).catch(() => showMessage("Couldn't open", url.replace(/^\w+:/, "")));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title="Application" subtitle={a.role} icon={ShieldCheck} onBack={goBack} />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => apps.reload(true)} tintColor={T.primary} />}
      >
        <Card style={{ alignItems: "center", gap: 4 }}>
          <Avatar name={a.name} size={72} />
          <Text style={{ fontSize: 19, color: T.dark, fontFamily: FONT_BOLD, marginTop: 8, textAlign: "center" }}>{a.name}</Text>
          <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT }}>
            {a.role} • {a.location}
          </Text>
          <View style={{ marginTop: 6 }}>
            <Tag label={status.label} tone={status.tone} />
          </View>
        </Card>

        <Card style={{ gap: 4 }}>
          <SectionTitle title="Credentials" />
          <InfoRow label="License No." value={a.license_number || "Not provided"} />
          <InfoRow label={a.role === "Certified Breeder" ? "Kennel" : "Clinic"} value={a.clinic || "—"} />
          <InfoRow label="Applied" value={formatDate(a.created_at)} />
          <InfoRow label="Documents reviewed" value={a.documents_reviewed} last />
          <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, lineHeight: 18, marginTop: 6 }}>
            {a.role === "Certified Breeder"
              ? "Ask for a copy of their kennel club certificate and check that the name and number match."
              : "Look up the license number with the PRC and check that the name matches."}
          </Text>
        </Card>

        <Card style={{ gap: 4 }}>
          <SectionTitle title="Contact" />
          <InfoRow label="Email" value={a.email} />
          <InfoRow label="Phone" value={a.phone ?? "—"} last />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <Btn title="Email" icon={Mail} variant="outline" size="small" onPress={() => openLink(`mailto:${a.email}`)} style={{ flex: 1 }} />
            {a.phone ? <Btn title="Call" icon={Phone} variant="outline" size="small" onPress={() => openLink(`tel:${a.phone}`)} style={{ flex: 1 }} /> : null}
          </View>
        </Card>

        {a.reviewed_at && (
          <Card style={{ gap: 6 }}>
            <SectionTitle title="Last decision" />
            <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_MEDIUM }}>
              {status.label} on {formatDate(a.reviewed_at)}
              {a.reviewer_name ? ` by ${a.reviewer_name}` : ""}
            </Text>
            {a.review_notes ? <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT }}>Remarks: {a.review_notes}</Text> : null}
          </Card>
        )}

        {isSelf ? (
          <Card>
            <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT, lineHeight: 19 }}>
              This is your own application. Another administrator has to review it.
            </Text>
          </Card>
        ) : (
          <Card style={{ gap: 12 }}>
            <SectionTitle title="Your decision" />
            {statusId !== "rejected" && (
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder={
                  statusId === "approved"
                    ? "Reason for revoking (required) — the verifier will see this"
                    : "Remarks (required when rejecting) — e.g. license number not found"
                }
                placeholderTextColor={T.light}
                multiline
                maxLength={1000}
                style={{
                  minHeight: 90,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: T.border,
                  backgroundColor: T.bg,
                  padding: 12,
                  fontSize: 14,
                  color: T.dark,
                  fontFamily: FONT,
                  textAlignVertical: "top",
                }}
              />
            )}
            {statusId === "pending" ? (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Btn title="Approve" icon={CheckCircle} loading={deciding === "approve"} disabled={!!deciding} onPress={() => decide("approve")} style={{ flex: 1 }} />
                <Btn title="Reject" icon={XCircle} variant="danger" loading={deciding === "reject"} disabled={!!deciding} onPress={() => decide("reject")} style={{ flex: 1 }} />
              </View>
            ) : statusId === "approved" ? (
              <Btn title="Revoke approval" icon={ShieldOff} variant="danger" loading={deciding === "reject"} disabled={!!deciding} onPress={() => decide("reject")} />
            ) : (
              <>
                <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT, lineHeight: 19 }}>
                  The applicant can re-submit by correcting their license number. You can also approve now if this was a mistake.
                </Text>
                <Btn title="Approve" icon={CheckCircle} variant="outline" loading={deciding === "approve"} disabled={!!deciding} onPress={() => decide("approve")} />
              </>
            )}
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ── User reports ───────────────────────────────────────────────── */
function ReportCard({ r }: { r: UserReport }) {
  const { navigate } = useApp();
  const status = REPORT_STATUS[r.status];
  return (
    <Card onPress={() => navigate("admin-report-detail", { reportId: r.id })} style={{ flexDirection: "row", gap: 12 }}>
      <Avatar name={r.reported_name} size={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD, flexShrink: 1 }} numberOfLines={1}>
            {r.reported_name}
          </Text>
          <Tag label={status.label} tone={status.tone} />
        </View>
        <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT_MEDIUM }} numberOfLines={1}>
          {reportReasonLabel(r.reason)}
        </Text>
        <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }} numberOfLines={1}>
          Reported by {r.reporter_name}
          {r.reported_report_count > 1 ? ` • ${r.reported_report_count} reports in total` : ""}
        </Text>
        <Text style={{ fontSize: 11, color: T.light, fontFamily: FONT }}>{timeAgo(r.created_at)}</Text>
      </View>
    </Card>
  );
}

export function AdminReports() {
  const { goBack, canGoBack } = useApp();
  const reports = useReports();
  const [filter, setFilter] = useState<"all" | ReportStatus>("open");
  const all = reports.data ?? [];
  const list = all.filter((r) => filter === "all" || r.status === filter);
  const filters: { id: "all" | ReportStatus; label: string }[] = [
    { id: "open", label: "Open" },
    { id: "resolved", label: "Resolved" },
    { id: "dismissed", label: "Dismissed" },
    { id: "all", label: "All" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header title="User Reports" subtitle="Reported owners and conversations" icon={Flag} onBack={canGoBack ? goBack : undefined} />
      <AdminSwitcher current="admin-reports" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, backgroundColor: T.white }} contentContainerStyle={{ gap: 8, padding: 12, paddingHorizontal: 20 }}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: filter === f.id ? T.primary : T.bg }}
          >
            <Text style={{ fontSize: 13, color: filter === f.id ? "#fff" : T.dark, fontFamily: FONT_BOLD }}>
              {f.label}
              {f.id !== "all" ? ` (${all.filter((r) => r.status === f.id).length})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => reports.reload(true)} tintColor={T.primary} />}
      >
        {reports.loading ? (
          <Loading />
        ) : reports.error ? (
          <ErrorView message={reports.error} onRetry={() => reports.reload()} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Flag}
            title={filter === "open" ? "No open reports" : "No reports found"}
            message={filter === "open" ? "New reports from owners will appear here and you'll get an alert." : "Nothing matches this filter."}
          />
        ) : (
          list.map((r) => <ReportCard key={r.id} r={r} />)
        )}
      </ScrollView>
    </View>
  );
}

export function AdminReportDetail() {
  const { goBack, params, showToast } = useApp();
  const session = useSession();
  const reportId = Number(params.reportId);
  const reports = useReports();
  const [notes, setNotes] = useState("");
  const [deciding, setDeciding] = useState<"resolved" | "dismissed" | null>(null);

  const r = reports.data?.find((x) => x.id === reportId);

  if (reports.loading || !r) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <Header title="Report" onBack={goBack} />
        {reports.loading ? <Loading /> : <ErrorView message={reports.error ?? "Report not found."} onRetry={() => reports.reload()} />}
      </View>
    );
  }

  const status = REPORT_STATUS[r.status];
  const involved = session.user.id === r.reporter_id || session.user.id === r.reported_id;

  const decide = (decision: "resolved" | "dismissed") => {
    if (decision === "resolved" && !notes.trim()) {
      showMessage("Remarks required", "Note what action was taken, e.g. warned the owner or removed a listing.");
      return;
    }
    confirmAction(
      decision === "resolved" ? "Mark as resolved?" : "Dismiss report?",
      decision === "resolved"
        ? `${r.reporter_name} will be told their report was reviewed.`
        : `No action is taken against ${r.reported_name}. ${r.reporter_name} will be told their report was reviewed.`,
      decision === "resolved" ? "Resolve" : "Dismiss",
      async () => {
        setDeciding(decision);
        try {
          await api.reviewReport(r.id, decision, notes);
          showToast(decision === "resolved" ? "Report resolved" : "Report dismissed", "The reporter has been notified.", "success");
          setNotes("");
          await reports.reload(true);
        } catch (e) {
          showMessage("Couldn't save decision", api.errorMessage(e));
        } finally {
          setDeciding(null);
        }
      },
    );
  };

  const openLink = (url: string) => Linking.openURL(url).catch(() => showMessage("Couldn't open", url.replace(/^\w+:/, "")));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title="Report" subtitle={reportReasonLabel(r.reason)} icon={Flag} onBack={goBack} />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => reports.reload(true)} tintColor={T.primary} />}
      >
        <Card style={{ alignItems: "center", gap: 4 }}>
          <Avatar name={r.reported_name} size={72} />
          <Text style={{ fontSize: 19, color: T.dark, fontFamily: FONT_BOLD, marginTop: 8, textAlign: "center" }}>{r.reported_name}</Text>
          <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT }}>Reported user</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
            <Tag label={status.label} tone={status.tone} />
            {r.reported_report_count > 1 ? <Tag label={`${r.reported_report_count} reports in total`} tone="danger" /> : null}
          </View>
        </Card>

        <Card style={{ gap: 4 }}>
          <SectionTitle title="What was reported" />
          <InfoRow label="Reason" value={reportReasonLabel(r.reason)} />
          <InfoRow label="Reported" value={formatDate(r.created_at)} />
          {r.dog_name ? <InfoRow label="About dog" value={r.dog_name} /> : null}
          <InfoRow label="Where" value={r.match_request_id ? "In a chat" : "From a profile"} last={!r.details} />
          {r.details ? (
            <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT, lineHeight: 20, marginTop: 8 }}>{r.details}</Text>
          ) : null}
        </Card>

        <Card style={{ gap: 4 }}>
          <SectionTitle title="Reported user" />
          <InfoRow label="Email" value={r.reported_email} />
          <InfoRow label="Phone" value={r.reported_phone ?? "—"} last />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <Btn title="Email" icon={Mail} variant="outline" size="small" onPress={() => openLink(`mailto:${r.reported_email}`)} style={{ flex: 1 }} />
            {r.reported_phone ? (
              <Btn title="Call" icon={Phone} variant="outline" size="small" onPress={() => openLink(`tel:${r.reported_phone}`)} style={{ flex: 1 }} />
            ) : null}
          </View>
        </Card>

        <Card style={{ gap: 4 }}>
          <SectionTitle title="Reported by" />
          <InfoRow label="Name" value={r.reporter_name} />
          <InfoRow label="Email" value={r.reporter_email} last />
        </Card>

        {r.reviewed_at && (
          <Card style={{ gap: 6 }}>
            <SectionTitle title="Decision" />
            <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_MEDIUM }}>
              {status.label} on {formatDate(r.reviewed_at)}
              {r.reviewer_name ? ` by ${r.reviewer_name}` : ""}
            </Text>
            {r.admin_notes ? <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT }}>Remarks: {r.admin_notes}</Text> : null}
          </Card>
        )}

        {!involved && <ModerationCard userId={r.reported_id} name={r.reported_name} />}

        {r.status === "open" &&
          (involved ? (
            <Card>
              <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT, lineHeight: 19 }}>
                You are part of this report. Another administrator has to review it.
              </Text>
            </Card>
          ) : (
            <Card style={{ gap: 12 }}>
              <SectionTitle title="Your decision" />
              <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, lineHeight: 18 }}>
                Contact the reported user if you need their side, then note what you did. The reporter only sees that the
                report was reviewed, not your remarks.
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Remarks (required when resolving) — e.g. warned the owner"
                placeholderTextColor={T.light}
                multiline
                maxLength={1000}
                style={{
                  minHeight: 90,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: T.border,
                  backgroundColor: T.bg,
                  padding: 12,
                  fontSize: 14,
                  color: T.dark,
                  fontFamily: FONT,
                  textAlignVertical: "top",
                }}
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Btn title="Resolve" icon={CheckCircle} loading={deciding === "resolved"} disabled={!!deciding} onPress={() => decide("resolved")} style={{ flex: 1 }} />
                <Btn title="Dismiss" icon={XCircle} variant="outline" loading={deciding === "dismissed"} disabled={!!deciding} onPress={() => decide("dismissed")} style={{ flex: 1 }} />
              </View>
            </Card>
          ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ── Hide listings and suspend accounts ─────────────────────────── */
function ModerationCard({ userId, name }: { userId: string; name: string }) {
  const { showToast } = useApp();
  const status = useAsync(() => api.getUserModeration(userId), [userId]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<void>, done: string) => {
    setBusy(key);
    try {
      await action();
      showToast(done, undefined, "success");
      setReason("");
      await status.reload(true);
    } catch (e) {
      showMessage("Couldn't save", api.errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  /** Hiding and suspending show the reason to the user, so it can't be blank. */
  const hasReason = () => {
    if (reason.trim()) return true;
    showMessage("Reason required", "Add a reason first. The user will see it.");
    return false;
  };

  if (status.loading) return <Loading />;
  if (status.error || !status.data) return <ErrorView message={status.error ?? "Couldn't load this account."} onRetry={() => status.reload()} />;
  const { role, suspended_at, suspended_reason, dogs } = status.data;

  const hide = (dogId: string, dogName: string) => {
    if (!hasReason()) return;
    confirmAction(
      `Hide ${dogName}?`,
      "Other owners won't see this listing, and its active match requests will be closed. You can restore it later.",
      "Hide",
      () => run(dogId, () => api.setDogHidden(dogId, true, reason), `${dogName} hidden`),
      true,
    );
  };
  const restore = (dogId: string, dogName: string) =>
    confirmAction(`Restore ${dogName}?`, "Other owners will see this listing again.", "Restore", () =>
      run(dogId, () => api.setDogHidden(dogId, false), `${dogName} restored`),
    );
  const suspend = () => {
    if (!hasReason()) return;
    confirmAction(
      `Suspend ${name}?`,
      "They won't be able to use PawMatch, all their dogs will be hidden, and their active match requests will be closed. You can reinstate them later.",
      "Suspend",
      () => run("account", () => api.setUserSuspended(userId, true, reason), `${name} suspended`),
      true,
    );
  };
  const reinstate = () =>
    confirmAction(`Reinstate ${name}?`, "They'll be able to use PawMatch again. Closed requests stay closed.", "Reinstate", () =>
      run("account", () => api.setUserSuspended(userId, false), `${name} reinstated`),
    );

  return (
    <Card style={{ gap: 12 }}>
      <SectionTitle title="Moderation" right={<Tag label={suspended_at ? "Suspended" : "Active"} tone={suspended_at ? "danger" : "success"} />} />
      {suspended_at ? (
        <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT, lineHeight: 19 }}>
          Suspended {formatDate(suspended_at)}: {suspended_reason}
        </Text>
      ) : (
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Reason (required to hide or suspend) — the user will see this"
          placeholderTextColor={T.light}
          multiline
          maxLength={500}
          style={{
            minHeight: 72,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: T.border,
            backgroundColor: T.bg,
            padding: 12,
            fontSize: 14,
            color: T.dark,
            fontFamily: FONT,
            textAlignVertical: "top",
          }}
        />
      )}

      {dogs.map((d) => (
        <View key={d.id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <DogImage uri={d.img} width={48} height={48} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }} numberOfLines={1}>{d.name}</Text>
            <Text style={{ fontSize: 12, color: d.hidden_at ? T.error : T.medium, fontFamily: FONT }} numberOfLines={2}>
              {d.hidden_at ? `Hidden: ${d.hidden_reason ?? ""}` : d.breed}
            </Text>
          </View>
          {d.hidden_at ? (
            <Btn title="Restore" icon={RotateCcw} size="small" variant="outline" loading={busy === d.id} disabled={!!busy} onPress={() => restore(d.id, d.name)} />
          ) : (
            <Btn title="Hide" icon={EyeOff} size="small" variant="danger" loading={busy === d.id} disabled={!!busy || !!suspended_at} onPress={() => hide(d.id, d.name)} />
          )}
        </View>
      ))}

      {role === "admin" ? (
        <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>Administrator accounts can&apos;t be suspended.</Text>
      ) : suspended_at ? (
        <Btn title="Reinstate account" icon={RotateCcw} variant="outline" loading={busy === "account"} disabled={!!busy} onPress={reinstate} />
      ) : (
        <Btn title="Suspend account" icon={Ban} variant="danger" loading={busy === "account"} disabled={!!busy} onPress={suspend} />
      )}
    </Card>
  );
}

export function AdminRestricted() {
  const { goBack, canGoBack, showToast } = useApp();
  const items = useAsync(() => api.listRestricted(), []);
  const [busy, setBusy] = useState<string | null>(null);

  const undo = (item: RestrictedItem) => {
    const isDog = item.kind === "dog";
    confirmAction(
      isDog ? `Restore ${item.title}?` : `Reinstate ${item.title}?`,
      isDog ? "Other owners will see this listing again." : "They'll be able to use PawMatch again. Closed requests stay closed.",
      isDog ? "Restore" : "Reinstate",
      async () => {
        setBusy(item.target_id);
        try {
          await (isDog ? api.setDogHidden(item.target_id, false) : api.setUserSuspended(item.target_id, false));
          showToast(isDog ? `${item.title} restored` : `${item.title} reinstated`, undefined, "success");
          await items.reload(true);
        } catch (e) {
          showMessage("Couldn't save", api.errorMessage(e));
        } finally {
          setBusy(null);
        }
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header title="Restricted" subtitle="Hidden listings and suspended accounts" icon={Ban} onBack={canGoBack ? goBack : undefined} />
      <AdminSwitcher current="admin-restricted" />
      <ScrollView
        style={{ marginTop: 12 }}
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => items.reload(true)} tintColor={T.primary} />}
      >
        {items.loading ? (
          <Loading />
        ) : items.error ? (
          <ErrorView message={items.error} onRetry={() => items.reload()} />
        ) : (items.data ?? []).length === 0 ? (
          <EmptyState icon={Ban} title="Nothing restricted" message="Listings you hide and accounts you suspend from a report will appear here." />
        ) : (
          (items.data ?? []).map((item) => {
            const Icon = item.kind === "dog" ? PawPrint : Ban;
            return (
              <Card key={`${item.kind}:${item.target_id}`} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: T.errorLight, alignItems: "center", justifyContent: "center" }}>
                    <Icon size={19} color={T.error} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD }} numberOfLines={1}>{item.title}</Text>
                    <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }} numberOfLines={1}>{item.subtitle}</Text>
                  </View>
                  <Tag label={item.kind === "dog" ? "Hidden" : "Suspended"} tone="danger" />
                </View>
                <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT, lineHeight: 19 }}>{item.reason}</Text>
                <Text style={{ fontSize: 11, color: T.medium, fontFamily: FONT }}>
                  {timeAgo(item.restricted_at)}
                  {item.restricted_by ? ` by ${item.restricted_by}` : ""}
                </Text>
                <Btn
                  title={item.kind === "dog" ? "Restore listing" : "Reinstate account"}
                  icon={RotateCcw}
                  size="small"
                  variant="outline"
                  loading={busy === item.target_id}
                  disabled={!!busy}
                  onPress={() => undo(item)}
                />
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

/* ── Photo Verified badge ───────────────────────────────────────── */
/** All submitted photos, refreshed when an admin alert arrives. */
function usePhotoVerifications() {
  const { lastNotification } = useApp();
  return useAsync(() => api.listPhotoVerifications(), [lastNotification?.id]);
}

function PhotoCard({ v }: { v: AdminPhotoVerification }) {
  const { navigate } = useApp();
  const status = PHOTO_VERIFICATION_STATUS[v.status];
  return (
    <Card onPress={() => navigate("admin-photo-detail", { verificationId: v.id })} style={{ flexDirection: "row", gap: 12 }}>
      <DogImage uri={v.dog_img} width={48} height={48} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD, flexShrink: 1 }} numberOfLines={1}>{v.dog_name}</Text>
          <Tag label={status.label} tone={status.tone} />
        </View>
        <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT_MEDIUM }} numberOfLines={1}>{v.owner_name}</Text>
        <Text style={{ fontSize: 11, color: T.light, fontFamily: FONT }}>{timeAgo(v.submitted_at)}</Text>
      </View>
    </Card>
  );
}

export function AdminPhotos() {
  const { goBack, canGoBack } = useApp();
  const photos = usePhotoVerifications();
  const [filter, setFilter] = useState<"all" | AdminPhotoVerification["status"]>("pending");
  const all = photos.data ?? [];
  const list = all.filter((v) => filter === "all" || v.status === filter);
  const filters: { id: typeof filter; label: string }[] = [
    { id: "pending", label: "Waiting" },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Not Approved" },
    { id: "all", label: "All" },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header title="Photo Verification" subtitle="Photos sent for the badge" icon={Camera} onBack={canGoBack ? goBack : undefined} />
      <AdminSwitcher current="admin-photos" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, backgroundColor: T.white }} contentContainerStyle={{ gap: 8, padding: 12, paddingHorizontal: 20 }}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.id}
            onPress={() => setFilter(f.id)}
            style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: filter === f.id ? T.primary : T.bg }}
          >
            <Text style={{ fontSize: 13, color: filter === f.id ? "#fff" : T.dark, fontFamily: FONT_BOLD }}>
              {f.label}
              {f.id !== "all" ? ` (${all.filter((v) => v.status === f.id).length})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => photos.reload(true)} tintColor={T.primary} />}
      >
        {photos.loading ? (
          <Loading />
        ) : photos.error ? (
          <ErrorView message={photos.error} onRetry={() => photos.reload()} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Camera}
            title={filter === "pending" ? "No photos waiting" : "No photos found"}
            message={filter === "pending" ? "Photos sent by owners will appear here and you'll get an alert." : "Nothing matches this filter."}
          />
        ) : (
          list.map((v) => <PhotoCard key={v.id} v={v} />)
        )}
      </ScrollView>
    </View>
  );
}

export function AdminPhotoDetail() {
  const { goBack, params, showToast } = useApp();
  const session = useSession();
  const verificationId: string = params.verificationId;
  const photos = usePhotoVerifications();
  const v = photos.data?.find((x) => x.id === verificationId);
  const photoUrl = useAsync(() => (v?.photo_path ? api.getVerificationPhotoUrl(v.photo_path) : Promise.resolve(null)), [v?.photo_path]);
  const [notes, setNotes] = useState("");
  const [deciding, setDeciding] = useState<"approve" | "reject" | null>(null);

  if (photos.loading || !v) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <Header title="Photo Verification" onBack={goBack} />
        {photos.loading ? <Loading /> : <ErrorView message={photos.error ?? "Photo not found."} onRetry={() => photos.reload()} />}
      </View>
    );
  }

  const status = PHOTO_VERIFICATION_STATUS[v.status];

  const decide = (decision: "approve" | "reject") => {
    if (decision === "reject" && !notes.trim()) {
      showMessage("Remarks required", "Tell the owner what to fix, e.g. the code isn't readable.");
      return;
    }
    confirmAction(
      decision === "approve" ? `Verify ${v.dog_name}?` : "Reject this photo?",
      decision === "approve"
        ? `${v.dog_name} will show the Photo Verified badge to every owner.`
        : `${v.owner_name} will see your remarks and can try again with a new code.`,
      decision === "approve" ? "Verify" : "Reject",
      async () => {
        setDeciding(decision);
        try {
          await api.reviewPhotoVerification(v.id, decision, notes);
          showToast(decision === "approve" ? "Badge awarded" : "Photo rejected", "The owner has been notified.", "success");
          setNotes("");
          await photos.reload(true);
        } catch (e) {
          showMessage("Couldn't save decision", api.errorMessage(e));
        } finally {
          setDeciding(null);
        }
      },
      decision === "reject",
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title={v.dog_name} subtitle={`${v.dog_breed} • ${v.owner_name}`} icon={Camera} onBack={goBack} right={<Tag label={status.label} tone={status.tone} />} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Card style={{ alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT }}>The paper must show this code</Text>
          <Text selectable style={{ fontSize: 30, color: T.primaryDark, fontFamily: FONT_BOLD, letterSpacing: 2 }}>{v.code}</Text>
        </Card>

        <Card style={{ gap: 10 }}>
          <SectionTitle title="Verification photo" />
          {!v.photo_path ? (
            <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT }}>This photo was deleted after review.</Text>
          ) : photoUrl.error ? (
            <ErrorView message={photoUrl.error} onRetry={() => photoUrl.reload()} />
          ) : !photoUrl.data ? (
            <Loading message="Loading photo…" />
          ) : (
            <TouchableOpacity onPress={() => Linking.openURL(photoUrl.data as string).catch(() => undefined)} activeOpacity={0.9} accessibilityRole="imagebutton" accessibilityLabel="Open full size">
              <Image source={{ uri: photoUrl.data }} style={{ width: "100%", height: 320, borderRadius: 12, backgroundColor: T.bg }} resizeMode="contain" />
            </TouchableOpacity>
          )}
        </Card>

        <Card style={{ gap: 10 }}>
          <SectionTitle title="Photo on the listing" />
          <DogImage uri={v.dog_img} width="100%" height={240} />
        </Card>

        {v.reviewed_at && (
          <Card style={{ gap: 6 }}>
            <SectionTitle title="Decision" />
            <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_MEDIUM }}>
              {status.label} on {formatDate(v.reviewed_at)}
              {v.reviewer_name ? ` by ${v.reviewer_name}` : ""}
            </Text>
            {v.review_notes ? <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT }}>Remarks: {v.review_notes}</Text> : null}
          </Card>
        )}

        {v.status === "pending" &&
          (v.owner_id === session.user.id ? (
            <Card>
              <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT, lineHeight: 19 }}>
                This is your own dog. Another administrator has to review it.
              </Text>
            </Card>
          ) : (
            <Card style={{ gap: 12 }}>
              <SectionTitle title="Your decision" />
              {["The code on the paper matches exactly", "The dog is next to the code", "It looks like the same dog as the listing", "It isn't a photo of a screen or an edited image"].map((c) => (
                <View key={c} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <CheckCircle size={16} color={T.success} strokeWidth={2.25} />
                  <Text style={{ flex: 1, fontSize: 13, color: T.dark, fontFamily: FONT }}>{c}</Text>
                </View>
              ))}
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Remarks (required when rejecting) — the owner will see this"
                placeholderTextColor={T.light}
                multiline
                maxLength={1000}
                style={{
                  minHeight: 80,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: T.border,
                  backgroundColor: T.bg,
                  padding: 12,
                  fontSize: 14,
                  color: T.dark,
                  fontFamily: FONT,
                  textAlignVertical: "top",
                }}
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Btn title="Verify" icon={CheckCircle} loading={deciding === "approve"} disabled={!!deciding} onPress={() => decide("approve")} style={{ flex: 1 }} />
                <Btn title="Reject" icon={XCircle} variant="danger" loading={deciding === "reject"} disabled={!!deciding} onPress={() => decide("reject")} style={{ flex: 1 }} />
              </View>
            </Card>
          ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
