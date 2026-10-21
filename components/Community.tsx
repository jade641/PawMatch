import Constants from "expo-constants";
import * as Linking from "expo-linking";
import {
  Award,
  Bell,
  Calendar,
  Camera,
  Check,
  CheckCircle,
  Clock,
  Crown,
  FileText,
  Heart,
  HelpCircle,
  Info,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  PawPrint,
  Phone,
  Scale,
  Shield,
  ShieldCheck,
  Star,
  Stethoscope,
  User,
  UserCheck,
  XCircle,
} from "lucide-react-native";
import { type ComponentType, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import {
  DAVAO_DISTRICTS,
  DEFAULT_LOCATION,
  districtLocation,
  districtOf,
  FONT,
  FONT_BOLD,
  FONT_MEDIUM,
  formatDate,
  REQUEST_STATUS,
  T,
  timeAgo,
} from "../constants/theme";
import { useApp, useSession } from "../contexts/AppContext";
import { useAsync } from "../hooks/useAsync";
import * as api from "../services/api";
import { pickImage, type PickedFile } from "../services/media";
import { WEIGHTS } from "../services/compatibility";
import type { AppNotification, Dog, NotificationType, OwnerProfile } from "../types";
import { otherSide } from "./Conversation";
import {
  Avatar,
  Btn,
  Card,
  Chip,
  DogImage,
  EmptyState,
  ErrorView,
  Field,
  Header,
  HeaderAction,
  HeroHeader,
  ListItem,
  Loading,
  SectionCard,
  SegmentedTabs,
  showMessage,
  Stars,
  Tag,
  VeriBadge,
} from "./ui";

/* ── Badges ─────────────────────────────────────────────────────── */
interface BadgeDef {
  Icon: ComponentType<any>;
  label: string;
  hint: string;
  earned: (o: OwnerProfile, dogs: Dog[]) => boolean;
}

const BADGES: BadgeDef[] = [
  { Icon: CheckCircle, label: "Verified Owner", hint: "Get a dog's vaccination card verified", earned: (o) => !!o.verified_at },
  { Icon: Stethoscope, label: "Health Champion", hint: "Reach Tier 2 with any dog", earned: (_, d) => d.some((x) => x.tier >= 2) },
  { Icon: Crown, label: "Pedigree Pro", hint: "Reach Tier 3 with any dog", earned: (_, d) => d.some((x) => x.tier >= 3) },
  { Icon: Heart, label: "First Match", hint: "Complete your first breeding match", earned: (o) => o.completed_matches >= 1 },
  {
    Icon: Award,
    label: "Trusted Breeder",
    hint: "3+ completed matches with a 4.5★ average",
    earned: (o) => o.completed_matches >= 3 && o.review_count >= 3 && o.rating >= 4.5,
  },
  {
    Icon: Calendar,
    label: "Active Member",
    hint: "Be a member for 30 days",
    earned: (o) => Date.now() - new Date(o.created_at).getTime() > 30 * 24 * 3600 * 1000,
  },
];

/* ── Reputation & History (Figure 19) ───────────────────────────── */
export function ReputationScreen() {
  const { navigate, goBack, canGoBack, params, lastNotification } = useApp();
  const session = useSession();
  const userId: string = params.userId ?? session.user.id;
  const isMe = userId === session.user.id;
  const [tab, setTab] = useState<"badges" | "history" | "reviews">("reviews");

  const owner = useAsync(() => api.getOwner(userId), [userId, lastNotification?.id]);
  const reviews = useAsync(() => api.listReviewsFor(userId), [userId, lastNotification?.id]);
  const dogs = useAsync(() => api.listMyDogs(userId), [userId]);
  const history = useAsync(() => (isMe ? api.listMyRequests() : Promise.resolve([])), [isMe]);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([owner.reload(true), reviews.reload(true), dogs.reload(true), history.reload(true)]);
    setRefreshing(false);
  };

  if (owner.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <Header title="Reputation & History" icon={Star} onBack={canGoBack ? goBack : undefined} />
        <Loading />
      </View>
    );
  }
  if (owner.error || !owner.data) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <Header title="Reputation & History" icon={Star} onBack={canGoBack ? goBack : undefined} />
        <ErrorView message={owner.error ?? "This owner profile isn't available."} onRetry={() => owner.reload()} />
      </View>
    );
  }

  const o = owner.data;
  const dogList = dogs.data ?? [];
  const tabs = [
    { id: "badges" as const, label: "Badges", icon: Award },
    { id: "history" as const, label: isMe ? "History" : "Dogs", icon: FileText },
    { id: "reviews" as const, label: `Reviews (${o.review_count})`, icon: MessageSquare },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header title="Reputation & History" icon={Star} onBack={canGoBack ? goBack : undefined} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={T.primary} />}
      >
        <View style={{ padding: 20, flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: T.white }}>
          <Avatar name={o.display_name} size={64} uri={api.avatarUrl(o.avatar_url)} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 18, color: T.dark, fontFamily: FONT_BOLD }}>{o.display_name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Stars rating={o.rating} />
              <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT_BOLD }}>{o.review_count > 0 ? o.rating.toFixed(1) : "—"}</Text>
            </View>
            <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>
              {o.completed_matches} completed match{o.completed_matches === 1 ? "" : "es"}
              {o.verified_at ? ` • Verified since ${formatDate(o.verified_at, { day: undefined })}` : " • Not yet verified"}
            </Text>
            <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>{o.location} • Member since {formatDate(o.created_at, { day: undefined })}</Text>
          </View>
        </View>

        <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} style={{ marginBottom: 14 }} />

        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {tab === "badges" && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {BADGES.map((b) => {
                const earned = b.earned(o, dogList);
                return (
                  <View
                    key={b.label}
                    style={{
                      width: "48%",
                      padding: 12,
                      borderRadius: 14,
                      backgroundColor: earned ? T.primaryLight : T.white,
                      borderWidth: 1,
                      borderColor: earned ? T.primary + "40" : T.border,
                      gap: 6,
                      opacity: earned ? 1 : 0.6,
                    }}
                  >
                    <b.Icon size={22} color={earned ? T.primary : T.light} strokeWidth={1.6} />
                    <Text style={{ fontSize: 13, color: earned ? T.primaryDark : T.medium, fontFamily: FONT_BOLD }}>{b.label}</Text>
                    <Text style={{ fontSize: 11, color: T.medium, fontFamily: FONT }}>{earned ? "Earned" : b.hint}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {tab === "history" &&
            (isMe ? (
              history.loading ? (
                <Loading />
              ) : history.error ? (
                <ErrorView message={history.error} onRetry={() => history.reload()} />
              ) : (history.data ?? []).length === 0 ? (
                <EmptyState icon={FileText} title="No history yet" message="Your breeding requests and their outcomes will be listed here." />
              ) : (
                (history.data ?? []).map((r) => {
                  const { iAmRequester, otherDog: other } = otherSide(r, session.user.id);
                  const status = REQUEST_STATUS[r.status];
                  const Icon = r.status === "completed" || r.status === "accepted" ? CheckCircle : r.status === "pending" ? Clock : XCircle;
                  return (
                    <Card key={r.id} onPress={() => navigate("conversation", { requestId: r.id })} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: T.primaryLight, alignItems: "center", justifyContent: "center" }}>
                        <Icon size={17} color={T.primary} strokeWidth={1.6} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_MEDIUM }}>
                          {iAmRequester ? "Request to" : "Request from"} {other?.name ?? "a deleted dog"}
                          {other?.breed ? ` (${other.breed})` : ""}
                        </Text>
                        <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>{formatDate(r.created_at)}</Text>
                      </View>
                      <Tag label={status.label} tone={status.tone} />
                    </Card>
                  );
                })
              )
            ) : dogs.loading ? (
              <Loading />
            ) : dogs.error ? (
              <ErrorView message={dogs.error} onRetry={() => dogs.reload()} />
            ) : dogList.length === 0 ? (
              <EmptyState icon={PawPrint} title="No dogs listed" message="This owner hasn't added any dogs yet." />
            ) : (
              dogList.map((d) => (
                <Card key={d.id} onPress={() => navigate("match-profile", { dogId: d.id })} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <DogImage uri={d.img} width={48} height={48} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>{d.name}</Text>
                    <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>{d.breed}</Text>
                  </View>
                  <VeriBadge tier={d.tier} />
                </Card>
              ))
            ))}

          {tab === "reviews" &&
            (reviews.loading ? (
              <Loading />
            ) : reviews.error ? (
              <ErrorView message={reviews.error} onRetry={() => reviews.reload()} />
            ) : (reviews.data ?? []).length === 0 ? (
              <EmptyState icon={MessageSquare} title="No reviews yet" message="Reviews appear after owners complete a breeding match together." />
            ) : (
              (reviews.data ?? []).map((r) => (
                <Card key={r.id} style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <Avatar name={r.reviewer?.display_name ?? "?"} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>{r.reviewer?.display_name ?? "PawMatch owner"}</Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Stars rating={r.rating} size={12} />
                        <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>{formatDate(r.created_at, { day: undefined })}</Text>
                      </View>
                    </View>
                  </View>
                  {r.comment ? <Text style={{ fontSize: 14, lineHeight: 20, color: T.dark, fontFamily: FONT }}>{r.comment}</Text> : null}
                  {r.dog?.name ? <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>re: {r.dog.name}</Text> : null}
                </Card>
              ))
            ))}

          {isMe && (
            <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, textAlign: "center" }}>
              Reviews are written from a conversation once a breeding request has been accepted.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ── Notifications ──────────────────────────────────────────────── */
const NOTIFICATION_ICONS: Record<NotificationType, ComponentType<any>> = {
  match_request: Heart,
  request_update: CheckCircle,
  message: MessageSquare,
  verification_request: FileText,
  verification_result: Shield,
  review: Star,
  match_alert: PawPrint,
  verifier_application: UserCheck,
  verifier_review: ShieldCheck,
  system: Info,
};

/** Icon, text and unread dot of a notification row; the caller provides the pressable container. */
export function NotificationBody({ n, compact }: { n: AppNotification; compact?: boolean }) {
  const Icon = NOTIFICATION_ICONS[n.type] ?? Bell;
  return (
    <>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: T.primaryLight, alignItems: "center", justifyContent: "center" }}>
        <Icon size={17} color={T.primary} strokeWidth={1.6} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14, color: T.dark, fontFamily: n.read ? FONT_MEDIUM : FONT_BOLD }}>{n.title}</Text>
        {n.body ? (
          <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT, lineHeight: 18 }} numberOfLines={compact ? 2 : undefined}>
            {n.body}
          </Text>
        ) : null}
        <Text style={{ fontSize: 11, color: T.medium, fontFamily: FONT, marginTop: 2 }}>{timeAgo(n.created_at)}</Text>
      </View>
      {!n.read && (
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.primary, marginTop: 6 }}
          accessible
          accessibilityLabel="Unread"
        />
      )}
    </>
  );
}

export function NotificationsScreen() {
  const { goBack, canGoBack, notifications, markAllRead, openNotification, reloadNotifications, unreadCount } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await reloadNotifications();
    setRefreshing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header
        title="Notifications"
        icon={Bell}
        onBack={canGoBack ? goBack : undefined}
        right={
          unreadCount > 0 ? <HeaderAction icon={Check} label="Mark all read" onPress={markAllRead} /> : undefined
        }
      />
      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={T.primary} />}
      >
        {notifications.length === 0 ? (
          <EmptyState icon={Bell} title="No Notifications" message="You're all caught up! Match requests, messages and verification results will appear here." />
        ) : (
          notifications.map((n) => (
            <Card key={n.id} onPress={() => openNotification(n)} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: n.read ? T.white : T.highlight }}>
              <NotificationBody n={n} />
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

/* ── Help & About ───────────────────────────────────────────────── */
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "";

export function SettingsScreen() {
  const { goBack, canGoBack, session } = useApp();
  const version = Constants.expoConfig?.version ?? "1.0.0";

  const contact = (subject: string) => {
    if (!SUPPORT_EMAIL) {
      showMessage("Support", "Please contact the PawMatch team through your beta tester group chat.");
      return;
    }
    Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
        `\n\n---\nApp version: ${version}\nPlatform: ${Platform.OS}\nUser: ${session?.user.email ?? ""}`,
      )}`,
    ).catch(() => showMessage("Support", `Email us at ${SUPPORT_EMAIL}`));
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header title="Help & About" icon={HelpCircle} onBack={canGoBack ? goBack : undefined} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <Card style={{ gap: 8 }}>
          <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD }}>How compatibility is scored</Text>
          <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT, lineHeight: 20 }}>
            PawMatch uses a Weighted Sum Model: breed {WEIGHTS.breed * 100}%, age {WEIGHTS.age * 100}%, sex{" "}
            {WEIGHTS.sex * 100}% and temperament {WEIGHTS.temperament * 100}%.
          </Text>
          <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT, lineHeight: 20 }}>
            Same breed scores 100, a breed from the same group 70, otherwise 20. Age gaps of up to 1 year score 100, 2
            years 80, 3 years 60 and more 30. Only opposite-sex dogs are recommended. Temperament scores 100 when the
            dogs share traits, 70 when neutral, and 40 when energy levels clash. The top 3 are shown.
          </Text>
        </Card>
        <Card style={{ gap: 8 }}>
          <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD }}>Verification tiers</Text>
          <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT, lineHeight: 20 }}>
            Tier 1: vaccination card verified.{"\n"}Tier 2: plus a veterinary health clearance.{"\n"}Tier 3: plus a pedigree
            certificate or DNA test.
          </Text>
          <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT, lineHeight: 20 }}>
            Documents are reviewed by licensed veterinarians or certified breeders approved by the PawMatch team. Only
            you and your chosen verifier can open your documents; everyone else sees the badge and the audit trail.
          </Text>
        </Card>
        <View style={{ borderRadius: 16, overflow: "hidden" }}>
          <ListItem icon={Mail} title="Contact support" subtitle={SUPPORT_EMAIL || undefined} onPress={() => contact("PawMatch support")} />
          <ListItem icon={MessageSquare} title="Report a problem or give feedback" onPress={() => contact("PawMatch beta feedback")} />
          <ListItem
            icon={Scale}
            title="Terms & Privacy"
            subtitle="How we handle your data"
            onPress={() =>
              showMessage(
                "Terms & Privacy",
                "PawMatch stores your profile, your dogs' profiles and the documents you submit in order to provide matching and verification. Documents are private to you and the verifier you choose. Do not upload documents you are not authorised to share. This is a beta build for research use by the University of Mindanao PawMatch team.",
              )
            }
            last
          />
        </View>
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>PawMatch Mobile • Version {version} (beta)</Text>
          <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>University of Mindanao • Davao City</Text>
        </View>
      </ScrollView>
    </View>
  );
}

/* ── Edit profile ───────────────────────────────────────────────── */
export function EditProfileScreen() {
  const { goBack, refreshSession, showToast } = useApp();
  const session = useSession();
  const [name, setName] = useState(session.user.full_name);
  const [phone, setPhone] = useState(session.user.phone ?? "");
  const [district, setDistrict] = useState<string>(districtOf(session.user.location) ?? DEFAULT_LOCATION);
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [saving, setSaving] = useState(false);
  const currentPhoto = api.avatarUrl(session.user.avatar_url);

  const choosePhoto = async () => {
    const picked = await pickImage(true);
    if (picked) setPhoto(picked);
  };

  const save = async () => {
    if (name.trim().length < 2) {
      showMessage("Name required", "Enter your full name.");
      return;
    }
    setSaving(true);
    try {
      await api.updateMyProfile(name, phone, districtLocation(district));
    } catch (e) {
      showMessage("Couldn't save", api.errorMessage(e));
      setSaving(false);
      return;
    }
    let photoError: string | null = null;
    if (photo) {
      try {
        await api.setProfilePicture(session.user.id, photo.uri, photo.mimeType);
      } catch (e) {
        photoError = api.errorMessage(e);
      }
    }
    await refreshSession();
    setSaving(false);
    if (photoError) {
      // Stay on the screen with the picked photo so the owner can retry it.
      showMessage("Details saved, photo not updated", photoError);
      return;
    }
    showToast("Profile updated", undefined, "success");
    goBack();
  };

  const role = session.owner && session.verifier ? "Dog Owner & Verifier" : session.verifier ? "Verifier" : "Dog Owner";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <HeroHeader title="Edit Profile" subtitle="Keep your details up to date" onBack={goBack} overlap={54} />

        {/* Avatar overlapping the hero */}
        <View style={{ alignItems: "center", marginTop: -56, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={choosePhoto}
            disabled={saving}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={currentPhoto || photo ? "Change profile picture" : "Add profile picture"}
            style={{
              padding: 5,
              borderRadius: 60,
              backgroundColor: T.white,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.12,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            <Avatar name={name.trim() || session.user.full_name} size={100} uri={photo?.uri ?? currentPhoto} />
            <View
              style={{
                position: "absolute",
                right: 4,
                bottom: 4,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: T.primary,
                borderWidth: 3,
                borderColor: T.white,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Camera size={15} color="#fff" strokeWidth={2.5} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={choosePhoto} disabled={saving} hitSlop={8} accessibilityRole="button">
            <Text style={{ fontSize: 13, color: T.primary, fontFamily: FONT_BOLD, marginTop: 10 }}>
              {currentPhoto || photo ? "Change photo" : "Add photo"}
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 19, color: T.dark, fontFamily: FONT_BOLD, marginTop: 12, textAlign: "center", paddingHorizontal: 24 }} numberOfLines={1}>
            {name.trim() || session.user.full_name}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20, backgroundColor: T.primaryLight }}>
            <PawPrint size={13} color={T.primaryDark} strokeWidth={2.25} />
            <Text style={{ fontSize: 12, color: T.primaryDark, fontFamily: FONT_BOLD }}>{role}</Text>
          </View>
        </View>

        <View style={{ paddingHorizontal: 16, gap: 16 }}>
          <SectionCard icon={User} title="Personal Info">
            <IconField icon={User} label="Full Name" value={name} onChangeText={setName} autoComplete="name" placeholder="Enter your full name" />
            <IconField
              icon={Mail}
              label="Email"
              value={session.user.email}
              editable={false}
              locked
              hint="Contact support to change your email address."
            />
            <IconField icon={Phone} label="Phone Number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="0917 123 4567" last />
          </SectionCard>

          <SectionCard icon={MapPin} title="Location" subtitle={`Currently set to ${district}`}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[DEFAULT_LOCATION, ...DAVAO_DISTRICTS].map((d) => (
                <Chip key={d} label={d} active={district === d} onPress={() => setDistrict(d)} />
              ))}
            </View>
          </SectionCard>

          <Btn title="Save Changes" icon={Check} size="hero" loading={saving} onPress={save} style={{ marginTop: 4 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Input with a leading icon; `locked` renders a read-only field with a lock badge. */
function IconField({ icon: Icon, label, hint, locked, last, ...input }: {
  icon: typeof User;
  label: string;
  hint?: string;
  locked?: boolean;
  last?: boolean;
} & Omit<TextInputProps, "style">) {
  const [focused, setFocused] = useState(false);
  const active = focused && !locked;
  return (
    <View style={{ marginBottom: last ? 0 : 16 }}>
      <Text style={{ fontSize: 13, color: T.dark, marginBottom: 8, fontFamily: FONT_MEDIUM }}>{label}</Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          height: 54,
          paddingHorizontal: 14,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: active ? T.primary : T.border,
          backgroundColor: locked ? T.bg : active ? T.white : T.inputBg,
        }}
      >
        <Icon size={20} color={active ? T.primary : T.medium} strokeWidth={2} />
        <TextInput
          {...input}
          accessibilityLabel={label}
          placeholderTextColor={T.light}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[
            { flex: 1, height: "100%", fontSize: 15, color: locked ? T.medium : T.dark, fontFamily: FONT },
            Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null,
          ]}
        />
        {locked && <Lock size={16} color={T.light} strokeWidth={2.25} />}
      </View>
      {hint ? <Text style={{ fontSize: 12, color: T.medium, marginTop: 6, fontFamily: FONT }}>{hint}</Text> : null}
    </View>
  );
}

/* ── Change password ────────────────────────────────────────────── */
export function ChangePasswordScreen() {
  const { goBack, showToast } = useApp();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      showMessage("Weak password", "Use at least 8 characters with a letter and a number.");
      return;
    }
    if (password !== confirm) {
      showMessage("Passwords don't match", "Re-enter the same password in both fields.");
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(password);
      showToast("Password changed", undefined, "success");
      goBack();
    } catch (e) {
      showMessage("Couldn't change password", api.errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title="Change Password" icon={KeyRound} onBack={goBack} />
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Field label="New Password" value={password} onChangeText={setPassword} secure autoComplete="new-password" hint="At least 8 characters with a letter and a number" />
        <Field label="Confirm New Password" value={confirm} onChangeText={setConfirm} secure autoComplete="new-password" />
        <Btn title="Update Password" size="large" loading={saving} onPress={save} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
