import { CheckCircle, Clock3, Inbox, MapPin, MessageCircle, PawPrint, Send, ShieldCheck, Star, XCircle } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT, FONT_BOLD, FONT_MEDIUM, formatTime, REQUEST_STATUS, shadow, T, timeAgo } from "../constants/theme";
import { useApp, useSession } from "../contexts/AppContext";
import { useAsync } from "../hooks/useAsync";
import * as api from "../services/api";
import type { MatchRequest, Message } from "../types";
import {
  Btn,
  Card,
  confirmAction,
  DogImage,
  EmptyState,
  ErrorView,
  Field,
  Header,
  HeaderAction,
  Loading,
  SegmentedTabs,
  showMessage,
  Tag,
} from "./ui";

export function otherSide(request: MatchRequest, me: string) {
  const iAmRequester = request.requester_user_id === me;
  return {
    iAmRequester,
    otherDog: iAmRequester ? request.dog : request.requester_dog,
    myDog: iAmRequester ? request.requester_dog : request.dog,
    otherName: iAmRequester ? (request.dog?.owner?.display_name ?? "Dog owner") : request.requester_name,
  };
}

/* ── Requests inbox ─────────────────────────────────────────────── */
export function RequestsScreen() {
  const { navigate, goBack, canGoBack, lastNotification } = useApp();
  const session = useSession();
  const [tab, setTab] = useState<"received" | "sent">("received");
  const requests = useAsync(() => api.listMyRequests(), [lastNotification?.id]);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await requests.reload(true);
    setRefreshing(false);
  };

  const list = (requests.data ?? []).filter((r) =>
    tab === "received" ? r.recipient_user_id === session.user.id : r.requester_user_id === session.user.id,
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header title="Requests & Messages" icon={MessageCircle} onBack={canGoBack ? goBack : undefined} />
      <SegmentedTabs
        tabs={[
          { id: "received", label: "Received" },
          { id: "sent", label: "Sent" },
        ]}
        value={tab}
        onChange={setTab}
        style={{ marginBottom: 8 }}
      />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={T.primary} />}
      >
        {requests.loading ? (
          <Loading />
        ) : requests.error ? (
          <ErrorView message={requests.error} onRetry={() => requests.reload()} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={tab === "received" ? "No requests yet" : "You haven't sent any requests"}
            message={
              tab === "received"
                ? "When another owner wants to pair with your dog, the request will appear here."
                : "Use the Breeding Matcher to find a compatible partner and send a request."
            }
            actionLabel={tab === "sent" ? "Open Matcher" : undefined}
            onAction={tab === "sent" ? () => navigate("filter") : undefined}
          />
        ) : (
          list.map((r) => {
            const { otherDog, myDog, otherName } = otherSide(r, session.user.id);
            const status = REQUEST_STATUS[r.status];
            return (
              <Card
                key={r.id}
                onPress={() => navigate("conversation", { requestId: r.id })}
                accessibilityLabel={`${otherDog?.name ?? "Deleted dog"} and ${myDog?.name ?? "your dog"}, ${status.label}, from ${otherName}`}
                style={{ flexDirection: "row", gap: 12 }}
              >
                <DogImage uri={otherDog?.img} width={56} height={56} />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD, flexShrink: 1 }} numberOfLines={1}>
                      {otherDog?.name ?? "Deleted dog"} × {myDog?.name ?? "—"}
                    </Text>
                    <Tag label={status.label} tone={status.tone} />
                  </View>
                  <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }} numberOfLines={1}>
                    {otherName} • {otherDog?.breed ?? ""}
                  </Text>
                  <Text style={{ fontSize: 11, color: T.medium, fontFamily: FONT }}>
                    {r.compatibility_score != null ? `${r.compatibility_score}% compatible • ` : ""}
                    {timeAgo(r.updated_at)}
                  </Text>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

/* ── Chat (Figure 13) ───────────────────────────────────────────── */
function Bubble({ message, mine }: { message: Message; mine: boolean }) {
  return (
    <View
      style={{
        alignSelf: mine ? "flex-end" : "flex-start",
        maxWidth: "82%",
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
        borderBottomRightRadius: mine ? 4 : 18,
        borderBottomLeftRadius: mine ? 18 : 4,
        backgroundColor: mine ? T.primary : T.white,
        marginBottom: 8,
        ...shadow,
        elevation: 1,
      }}
    >
      <Text style={{ fontSize: 14, lineHeight: 20, color: mine ? "#fff" : T.dark, fontFamily: FONT }}>{message.body}</Text>
      <Text style={{ marginTop: 4, fontSize: 10, color: mine ? "rgba(255,255,255,0.75)" : T.medium, textAlign: "right", fontFamily: FONT }}>
        {formatTime(message.created_at)}
      </Text>
    </View>
  );
}

function ReviewForm({ request, otherName, onDone }: { request: MatchRequest; otherName: string; onDone: () => void }) {
  const { showToast } = useApp();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) {
    return <Btn title={`Rate ${otherName}`} icon={Star} variant="secondary" size="small" onPress={() => setOpen(true)} />;
  }

  const submit = async () => {
    if (rating === 0) {
      showMessage("Choose a rating", "Tap the stars to rate your experience.");
      return;
    }
    setSaving(true);
    try {
      await api.createReview(request.id, rating, comment);
      showToast("Review posted", `Thanks for rating ${otherName}.`, "success");
      onDone();
    } catch (e) {
      showMessage("Couldn't post review", api.errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ gap: 10 }}>
      <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>Rate your experience with {otherName}</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <TouchableOpacity
            key={i}
            onPress={() => setRating(i)}
            accessibilityRole="button"
            accessibilityLabel={`${i} star${i > 1 ? "s" : ""}`}
            accessibilityState={{ selected: i === rating }}
            hitSlop={4}
          >
            <Star size={30} color={i <= rating ? T.star : T.light} fill={i <= rating ? T.star : "transparent"} strokeWidth={1.5} />
          </TouchableOpacity>
        ))}
      </View>
      <Field
        value={comment}
        onChangeText={setComment}
        accessibilityLabel="Review comment"
        placeholder="How was communication, honesty of records, the dog's health…"
        multiline
        maxLength={1000}
        style={{ marginBottom: 0 }}
      />
      <Btn title="Post Review" loading={saving} onPress={submit} />
    </Card>
  );
}

export function ConversationScreen() {
  const { navigate, goBack, params, lastNotification, showToast } = useApp();
  const session = useSession();
  const insets = useSafeAreaInsets();
  const requestId = Number(params.requestId);
  const request = useAsync(() => api.getRequest(requestId), [requestId]);
  const messages = useAsync(() => api.listMessages(requestId), [requestId]);
  const myReviews = useAsync(() => api.listMyWrittenReviews(session.user.id), [session.user.id, requestId]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [acting, setActing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const unsubMessages = api.subscribeToMessages(requestId, (m) =>
      messages.setData((list) => (list?.some((x) => x.id === m.id) ? list : [...(list ?? []), m])),
    );
    const unsubRequest = api.subscribeToRequest(requestId, () => request.reload(true));
    return () => {
      unsubMessages();
      unsubRequest();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  // Realtime can miss events while the app is backgrounded; notifications are a second signal.
  useEffect(() => {
    if (lastNotification?.data?.match_request_id && Number(lastNotification.data.match_request_id) === requestId) {
      request.reload(true);
      messages.reload(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastNotification?.id]);

  if (request.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <Header title="Chat" onBack={goBack} />
        <Loading />
      </View>
    );
  }
  if (request.error || !request.data) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <Header title="Chat" onBack={goBack} />
        <ErrorView message={request.error ?? "This conversation is no longer available."} onRetry={() => request.reload()} />
      </View>
    );
  }

  const r = request.data;
  const { iAmRequester, otherDog, myDog, otherName } = otherSide(r, session.user.id);
  const status = REQUEST_STATUS[r.status];
  const canChat = r.status === "pending" || r.status === "accepted" || r.status === "completed";
  const canReview = (r.status === "accepted" || r.status === "completed") && !(myReviews.data ?? []).some((x) => x.match_request_id === r.id);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const m = await api.sendMessage(r.id, body);
      messages.setData((list) => (list?.some((x) => x.id === m.id) ? list : [...(list ?? []), m]));
      setDraft("");
    } catch (e) {
      showMessage("Message not sent", api.errorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const act = async (action: "accept" | "decline" | "cancel" | "complete") => {
    setActing(true);
    try {
      await api.respondToRequest(r.id, action);
      await request.reload(true);
      const done = { accept: "Request accepted", decline: "Request declined", cancel: "Request cancelled", complete: "Marked as completed" };
      showToast(done[action], `${otherName} has been notified.`, "success");
    } catch (e) {
      showMessage("Couldn't update request", api.errorMessage(e));
    } finally {
      setActing(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header
        title="Chat"
        subtitle="Discuss the pairing, schedule, and next steps."
        onBack={goBack}
        right={
          otherDog ? (
            <HeaderAction icon={PawPrint} label="Profile" onPress={() => navigate("match-profile", { dogId: otherDog.id })} />
          ) : undefined
        }
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ borderRadius: 22, overflow: "hidden", backgroundColor: T.white, marginBottom: 14, ...shadow }}>
          <View style={{ padding: 14, backgroundColor: T.primary, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <DogImage uri={otherDog?.img} width={56} height={56} radius={16} style={{ borderWidth: 2, borderColor: "rgba(255,255,255,0.6)" }} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Text style={{ fontSize: 18, color: "#fff", fontFamily: FONT_BOLD }}>{otherDog?.name ?? "Deleted dog"}</Text>
                {otherDog?.verified && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.2)" }}>
                    <ShieldCheck size={12} color="#fff" />
                    <Text style={{ fontSize: 11, color: "#fff", fontFamily: FONT_BOLD }}>Tier {otherDog.tier} verified</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", marginTop: 2, fontFamily: FONT }}>
                {otherDog?.breed} • {otherName}
              </Text>
              {otherDog?.owner?.location ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <MapPin size={11} color="rgba(255,255,255,0.9)" />
                  <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", fontFamily: FONT }}>{otherDog.owner.location}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={{ padding: 14, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT_MEDIUM }}>
                {myDog ? `With your ${myDog.name}` : "Breeding request"}
                {r.compatibility_score != null ? ` • ${r.compatibility_score}% compatible` : ""}
              </Text>
              <Tag label={status.label} tone={status.tone} />
            </View>

            {r.status === "pending" && !iAmRequester && (
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Btn title="Accept" icon={CheckCircle} size="small" loading={acting} onPress={() => act("accept")} style={{ flex: 1 }} />
                <Btn
                  title="Decline"
                  icon={XCircle}
                  size="small"
                  variant="danger"
                  disabled={acting}
                  onPress={() => confirmAction("Decline request?", `${otherName} will be notified.`, "Decline", () => act("decline"), true)}
                  style={{ flex: 1 }}
                />
              </View>
            )}
            {r.status === "pending" && iAmRequester && (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <Text style={{ flex: 1, fontSize: 12, color: T.medium, fontFamily: FONT }}>Waiting for {otherName} to respond.</Text>
                <Btn
                  title="Cancel request"
                  size="small"
                  variant="danger"
                  disabled={acting}
                  onPress={() => confirmAction("Cancel request?", "The other owner will be notified.", "Cancel request", () => act("cancel"), true)}
                />
              </View>
            )}
            {r.status === "accepted" && (
              <Btn
                title="Mark breeding as completed"
                size="small"
                variant="outline"
                loading={acting}
                onPress={() => confirmAction("Mark as completed?", "Use this once the pairing has taken place. It counts toward both owners' history.", "Mark completed", () => act("complete"))}
              />
            )}
          </View>
        </View>

        {canReview && <ReviewForm request={r} otherName={otherName} onDone={() => myReviews.reload(true)} />}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 12 }}>
          <MessageCircle size={16} color={T.dark} strokeWidth={1.7} />
          <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>Messages</Text>
        </View>
        {messages.loading ? (
          <Loading />
        ) : messages.error ? (
          <ErrorView message={messages.error} onRetry={() => messages.reload()} />
        ) : (messages.data ?? []).length === 0 ? (
          <Text style={{ color: T.medium, fontFamily: FONT, fontSize: 13 }}>No messages yet. Say hello!</Text>
        ) : (
          (messages.data ?? []).map((m) => <Bubble key={m.id} message={m} mine={m.sender_id === session.user.id} />)
        )}
      </ScrollView>

      <View style={{ padding: 12, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: T.white, borderTopWidth: 1, borderTopColor: T.border, gap: 6 }}>
        {canChat ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={`Message ${otherName}…`}
                placeholderTextColor={T.light}
                accessibilityLabel={`Message ${otherName}`}
                multiline
                maxLength={2000}
                style={{
                  flex: 1,
                  maxHeight: 120,
                  minHeight: 44,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: T.border,
                  backgroundColor: T.bg,
                  paddingHorizontal: 16,
                  paddingTop: 12,
                  paddingBottom: 10,
                  fontSize: 14,
                  color: T.dark,
                  fontFamily: FONT,
                }}
              />
              <TouchableOpacity
                onPress={send}
                disabled={sending || !draft.trim()}
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityState={{ disabled: sending || !draft.trim(), busy: sending }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: draft.trim() ? T.primary : T.light,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Send size={18} color="#fff" strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Clock3 size={11} color={T.medium} />
              <Text style={{ fontSize: 11, color: T.medium, fontFamily: FONT }}>Messages are only visible to the two owners.</Text>
            </View>
          </>
        ) : (
          <Text style={{ textAlign: "center", color: T.medium, fontFamily: FONT, paddingVertical: 8 }}>
            This request was {r.status}. Messaging is closed.
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
