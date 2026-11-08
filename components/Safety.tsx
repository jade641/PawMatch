import { Ban, Check, EllipsisVertical, Flag, ShieldOff, UserX } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT, FONT_BOLD, FONT_MEDIUM, formatDate, REPORT_REASONS, T } from "../constants/theme";
import { useApp } from "../contexts/AppContext";
import { useAsync } from "../hooks/useAsync";
import * as api from "../services/api";
import type { ReportReason } from "../types";
import { Avatar, Btn, Card, Chip, confirmAction, EmptyState, ErrorView, Field, Header, Loading, showMessage } from "./ui";

/** The user a safety action is about, plus where it happened (shown to admins). */
export interface SafetyTarget {
  userId: string;
  name: string;
  matchRequestId?: number;
  dogId?: string;
}

/* ── Bottom sheet ───────────────────────────────────────────────── */
function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable onPress={onClose} accessibilityLabel="Close" style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}>
          {/* Swallow taps on the sheet itself so only the backdrop closes it. */}
          <Pressable
            onPress={() => undefined}
            style={{ backgroundColor: T.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 10, paddingHorizontal: 12, paddingBottom: 12 + insets.bottom, maxHeight: "90%" }}
          >
            <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: T.border, marginBottom: 10 }} />
            {children}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SheetAction({ label, icon: Icon, color, onPress }: { label: string; icon: typeof Flag; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 12 }}
    >
      <Icon size={20} color={color} strokeWidth={2} />
      <Text style={{ fontSize: 15, color, fontFamily: FONT_BOLD }}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ── Report form ────────────────────────────────────────────────── */
function ReportForm({ target, onDone, onCancel }: { target: SafetyTarget; onDone: (blocked: boolean) => void; onCancel: () => void }) {
  const { showToast } = useApp();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!reason) {
      showMessage("Choose a reason", "Tell us what happened so the PawMatch team can review it.");
      return;
    }
    if (reason === "other" && !details.trim()) {
      showMessage("Add details", "Describe what happened so the PawMatch team can review it.");
      return;
    }
    setSending(true);
    try {
      await api.reportUser({ reportedId: target.userId, reason, details, matchRequestId: target.matchRequestId, dogId: target.dogId });
    } catch (e) {
      setSending(false);
      showMessage("Couldn't send report", api.errorMessage(e));
      return;
    }
    let blocked = false;
    if (alsoBlock) {
      try {
        await api.blockUser(target.userId);
        blocked = true;
      } catch (e) {
        showMessage("Report sent, but couldn't block", api.errorMessage(e));
      }
    }
    setSending(false);
    showToast("Report sent", "Thank you. The PawMatch team will review it.", "success");
    onDone(blocked);
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 8, gap: 12 }}>
      <View>
        <Text style={{ fontSize: 17, color: T.dark, fontFamily: FONT_BOLD }}>Report {target.name}</Text>
        <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT, marginTop: 4, lineHeight: 19 }}>
          Reports are private. {target.name} won&apos;t know who reported them. The PawMatch team reviews every report.
        </Text>
      </View>
      <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT_MEDIUM }}>What happened?</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {REPORT_REASONS.map((r) => (
          <Chip key={r.id} label={r.label} active={reason === r.id} onPress={() => setReason(r.id)} />
        ))}
      </View>
      <Field
        label={reason === "other" ? "Details" : "Details (optional)"}
        value={details}
        onChangeText={setDetails}
        placeholder="What did they say or do? Include dates if you can."
        multiline
        maxLength={1000}
        style={{ marginBottom: 0 }}
      />
      <TouchableOpacity
        onPress={() => setAlsoBlock((b) => !b)}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: alsoBlock }}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, backgroundColor: T.bg }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            borderWidth: 2,
            borderColor: alsoBlock ? T.primary : T.light,
            backgroundColor: alsoBlock ? T.primary : T.white,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {alsoBlock && <Check size={14} color="#fff" strokeWidth={3} />}
        </View>
        <Text style={{ flex: 1, fontSize: 13, color: T.dark, fontFamily: FONT }}>Also block {target.name}</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Btn title="Cancel" variant="outline" onPress={onCancel} disabled={sending} style={{ flex: 1 }} />
        <Btn title="Send Report" icon={Flag} variant="danger" loading={sending} onPress={submit} style={{ flex: 1 }} />
      </View>
    </ScrollView>
  );
}

/* ── ⋮ menu: report or block ────────────────────────────────────── */
/**
 * Header button that opens "Report" / "Block" for another user. `onBlocked` runs after a
 * successful block, e.g. to leave a screen whose content is now hidden.
 */
export function SafetyMenuButton({ target, onBlocked, onUnblocked }: {
  target: SafetyTarget;
  onBlocked?: () => void;
  onUnblocked?: () => void;
}) {
  const { showToast } = useApp();
  const [mode, setMode] = useState<"closed" | "menu" | "report">("closed");
  const blocked = useAsync(() => api.hasBlocked(target.userId), [target.userId]);
  const close = () => setMode("closed");

  const block = () => {
    close();
    confirmAction(
      `Block ${target.name}?`,
      "You won't see each other's dogs, and neither of you can send match requests or messages. Any active request between you will be closed. They won't be told.",
      "Block",
      async () => {
        try {
          await api.blockUser(target.userId);
          blocked.setData(true);
          showToast(`${target.name} blocked`, "You can unblock them in Settings → Blocked Users.", "success");
          onBlocked?.();
        } catch (e) {
          showMessage("Couldn't block", api.errorMessage(e));
        }
      },
      true,
    );
  };

  const unblock = async () => {
    close();
    try {
      await api.unblockUser(target.userId);
      blocked.setData(false);
      showToast(`${target.name} unblocked`, undefined, "success");
      onUnblocked?.();
    } catch (e) {
      showMessage("Couldn't unblock", api.errorMessage(e));
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setMode("menu")}
        accessibilityRole="button"
        accessibilityLabel={`More options for ${target.name}`}
        hitSlop={8}
        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: T.bg, alignItems: "center", justifyContent: "center" }}
      >
        <EllipsisVertical size={18} color={T.dark} strokeWidth={2} />
      </TouchableOpacity>

      <Sheet visible={mode !== "closed"} onClose={close}>
        {mode === "report" ? (
          <ReportForm
            target={target}
            onCancel={close}
            onDone={(didBlock) => {
              close();
              if (didBlock) {
                blocked.setData(true);
                onBlocked?.();
              }
            }}
          />
        ) : (
          <>
            <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT_MEDIUM, paddingHorizontal: 8, marginBottom: 6 }} numberOfLines={1}>
              {target.name}
            </Text>
            <SheetAction label={`Report ${target.name}`} icon={Flag} color={T.error} onPress={() => setMode("report")} />
            {blocked.data ? (
              <SheetAction label={`Unblock ${target.name}`} icon={ShieldOff} color={T.dark} onPress={unblock} />
            ) : (
              <SheetAction label={`Block ${target.name}`} icon={Ban} color={T.error} onPress={block} />
            )}
            <Btn title="Cancel" variant="outline" onPress={close} style={{ marginTop: 6 }} />
          </>
        )}
      </Sheet>
    </>
  );
}

/* ── Settings → Blocked users ───────────────────────────────────── */
export function BlockedUsersScreen() {
  const { goBack, canGoBack, showToast } = useApp();
  const blocks = useAsync(() => api.listMyBlocks(), []);

  const unblock = (userId: string, name: string) =>
    confirmAction(
      `Unblock ${name}?`,
      "You'll see each other's dogs again and can send requests. Requests closed by the block stay closed.",
      "Unblock",
      async () => {
        try {
          await api.unblockUser(userId);
          blocks.setData((list) => (list ?? []).filter((b) => b.blocked_id !== userId));
          showToast(`${name} unblocked`, undefined, "success");
        } catch (e) {
          showMessage("Couldn't unblock", api.errorMessage(e));
        }
      },
    );

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header title="Blocked Users" icon={UserX} onBack={canGoBack ? goBack : undefined} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}>
        <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT, lineHeight: 19 }}>
          Blocked users can&apos;t send you match requests or messages, and you won&apos;t see each other&apos;s dogs. They
          aren&apos;t told that you blocked them.
        </Text>
        {blocks.loading ? (
          <Loading />
        ) : blocks.error ? (
          <ErrorView message={blocks.error} onRetry={() => blocks.reload()} />
        ) : (blocks.data ?? []).length === 0 ? (
          <EmptyState icon={UserX} title="No blocked users" message="People you block from a chat or a profile will appear here." />
        ) : (
          (blocks.data ?? []).map((b) => (
            <Card key={b.blocked_id} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Avatar name={b.full_name} size={44} uri={api.avatarUrl(b.avatar_url)} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD }} numberOfLines={1}>{b.full_name}</Text>
                <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>Blocked {formatDate(b.created_at)}</Text>
              </View>
              <Btn title="Unblock" size="small" variant="outline" onPress={() => unblock(b.blocked_id, b.full_name)} />
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}
