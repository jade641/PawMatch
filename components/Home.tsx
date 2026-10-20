import {
  Bell,
  CheckCircle,
  ChevronRight,
  Heart,
  MapPin,
  MessageCircle,
  Palette,
  PawPrint,
  Plus,
  RefreshCw,
  Ruler,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { districtOf, FONT, FONT_BOLD, shadow, T, timeAgo } from "../constants/theme";
import { useApp, useSession } from "../contexts/AppContext";
import { useAsync } from "../hooks/useAsync";
import * as api from "../services/api";
import type { MatchPreferences } from "../services/compatibility";
import { TEMPERAMENT_OPTIONS } from "../services/compatibility";
import type { RankedMatch, Size } from "../types";
import { BreedInput, ColorCombobox, MatchCard, MyDogSelector } from "./DogWidgets";
import { FloatingMatchResults } from "./FloatingMatchResults";
import { Avatar, BrandLogo, Btn, Card, Chip, EmptyState, ErrorView, Header, Loading, SectionTitle } from "./ui";

function NoDogPrompt() {
  const { navigate } = useApp();
  const steps = [
    { Icon: PawPrint, title: "Create a dog profile", text: "Breed, age, size and temperament" },
    { Icon: ShieldCheck, title: "Verify health records", text: "Get checked by a licensed vet" },
    { Icon: Heart, title: "Get matched", text: "See the most compatible partners" },
  ];
  return (
    <View style={{ marginHorizontal: 20, marginBottom: 24, borderRadius: 24, backgroundColor: T.white, padding: 20, ...shadow }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 }}>
        <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: T.primaryLight, alignItems: "center", justifyContent: "center" }}>
          <PawPrint size={28} color={T.primary} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, color: T.dark, fontFamily: FONT_BOLD }}>Add your first dog</Text>
          <Text style={{ fontSize: 13, lineHeight: 19, color: T.medium, fontFamily: FONT, marginTop: 2 }}>
            Get started in three easy steps.
          </Text>
        </View>
      </View>

      {steps.map((s, i) => (
        <View key={s.title} style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ alignItems: "center" }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: i === 0 ? T.primary : T.bg, alignItems: "center", justifyContent: "center" }}>
              <s.Icon size={16} color={i === 0 ? "#fff" : T.medium} strokeWidth={2} />
            </View>
            {i < steps.length - 1 && <View style={{ width: 2, flex: 1, minHeight: 14, backgroundColor: T.border, marginVertical: 4 }} />}
          </View>
          <View style={{ flex: 1, paddingTop: 6, paddingBottom: i < steps.length - 1 ? 14 : 0 }}>
            <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_BOLD }}>{s.title}</Text>
            <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, marginTop: 2 }}>{s.text}</Text>
          </View>
        </View>
      ))}

      <TouchableOpacity
        onPress={() => navigate("add-dog")}
        activeOpacity={0.85}
        accessibilityRole="button"
        style={{
          marginTop: 20,
          height: 52,
          borderRadius: 16,
          backgroundColor: T.primary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          shadowColor: T.primary,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.28,
          shadowRadius: 14,
          elevation: 5,
        }}
      >
        <Plus size={20} color="#fff" strokeWidth={2.5} />
        <Text style={{ fontSize: 16, color: "#fff", fontFamily: FONT_BOLD }}>Add Dog Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

function HeaderIcon({ onPress, label, badge, children }: { onPress: () => void; label: string; badge?: boolean; children: React.ReactNode }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}
    >
      {children}
      {badge && <Dot />}
    </TouchableOpacity>
  );
}

/* ── Home Dashboard (Figure 10) ─────────────────────────────────── */
export function HomeScreen() {
  const { navigate, myDogs, activeDog, setActiveDogId, notifications, unreadCount, openNotification, lastNotification } =
    useApp();
  const session = useSession();
  const insets = useSafeAreaInsets();
  const firstName = session.user.full_name.split(" ")[0] || session.user.full_name;
  const district = districtOf(session.user.location);

  const requests = useAsync(() => api.listMyRequests(), [lastNotification?.id]);
  const verifiedNearby = useAsync(
    () => api.countVerifiedDogs(session.user.id, district ?? undefined),
    [session.user.id, district],
  );
  const top = useAsync(
    async () => (activeDog ? (await api.recommendMatches(activeDog, {}, 3)).results : []),
    [activeDog?.id],
  );

  const incomingPending = (requests.data ?? []).filter(
    (r) => r.recipient_user_id === session.user.id && r.status === "pending",
  ).length;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const refresh = () => {
    requests.reload(true);
    verifiedNearby.reload(true);
    top.reload(true);
  };

  const stats = [
    { Icon: Heart, n: incomingPending, t: "Match\nRequests", color: T.primary, tint: T.primaryLight, go: () => navigate("requests") },
    { Icon: CheckCircle, n: verifiedNearby.data ?? 0, t: district ? `Verified in\n${district}` : "Verified\nDogs", color: T.success, tint: T.successLight, go: () => navigate("match") },
    { Icon: Bell, n: unreadCount, t: "Unread\nAlerts", color: T.accent, tint: T.accentLight, go: () => navigate("notifications") },
  ];

  const actions = [
    { Icon: Sparkles, label: "Find Match", color: T.primary, tint: T.primaryLight, go: () => navigate(myDogs.length ? "filter" : "add-dog") },
    { Icon: Search, label: "Browse", color: T.accent, tint: T.accentLight, go: () => navigate("match") },
    { Icon: Plus, label: "Add Dog", color: T.success, tint: T.successLight, go: () => navigate("add-dog") },
    { Icon: MessageCircle, label: "Messages", color: T.secondaryDark, tint: T.secondaryLight, go: () => navigate("requests") },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={T.primary} />}
      >
        {/* Hero */}
        <View style={{ paddingTop: Math.max(insets.top, 16) + 8, paddingBottom: 64, paddingHorizontal: 20, overflow: "hidden", borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
          <LinearGradient colors={[T.primary, T.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.08)", top: -60, right: -50 }} />
          <View style={{ position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.06)", bottom: -30, left: -30 }} />
          <PawPrint size={22} color="#fff" style={{ position: "absolute", bottom: 74, right: 40, opacity: 0.2, transform: [{ rotate: "20deg" }] }} />

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}>
                <BrandLogo size={22} />
              </View>
              <Text style={{ fontSize: 19, color: "#fff", fontFamily: FONT_BOLD, letterSpacing: -0.3 }}>PawMatch</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <HeaderIcon onPress={() => navigate("requests")} label="Requests and messages" badge={incomingPending > 0}>
                <MessageCircle size={20} color="#fff" strokeWidth={2} />
              </HeaderIcon>
              <HeaderIcon onPress={() => navigate("notifications")} label="Notifications" badge={unreadCount > 0}>
                <Bell size={20} color="#fff" strokeWidth={2} />
              </HeaderIcon>
              <TouchableOpacity
                onPress={() => navigate("owner-profile")}
                accessibilityRole="button"
                accessibilityLabel="My profile"
                style={{ borderRadius: 21, borderWidth: 2, borderColor: "rgba(255,255,255,0.7)" }}
              >
                <Avatar name={session.user.full_name} size={38} color={T.primaryDark} uri={api.avatarUrl(session.user.avatar_url)} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", fontFamily: FONT, marginTop: 24 }}>{greeting} 👋</Text>
          <Text style={{ fontSize: 28, color: "#fff", fontFamily: FONT_BOLD, letterSpacing: -0.5, marginTop: 2 }}>{firstName}</Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-start",
              gap: 6,
              marginTop: 10,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.2)",
            }}
          >
            <MapPin size={14} color="#fff" strokeWidth={2.25} />
            <Text style={{ fontSize: 13, color: "#fff", fontFamily: FONT_BOLD }}>{session.user.location || "Davao City"}</Text>
          </View>
        </View>

        {/* Stats card overlapping the hero */}
        <View
          style={{
            marginTop: -40,
            marginHorizontal: 20,
            marginBottom: 24,
            flexDirection: "row",
            borderRadius: 22,
            backgroundColor: T.white,
            paddingVertical: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.08,
            shadowRadius: 20,
            elevation: 6,
          }}
        >
          {stats.map((s, i) => (
            <TouchableOpacity
              key={s.t}
              onPress={s.go}
              activeOpacity={0.7}
              style={{ flex: 1, alignItems: "center", borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: T.border, paddingHorizontal: 6 }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: s.tint, alignItems: "center", justifyContent: "center" }}>
                <s.Icon size={19} color={s.color} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: 22, marginTop: 8, color: T.dark, fontFamily: FONT_BOLD }}>{s.n}</Text>
              <Text style={{ fontSize: 11, marginTop: 2, textAlign: "center", color: T.medium, lineHeight: 14, fontFamily: FONT }}>{s.t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick actions */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontSize: 16, color: T.dark, fontFamily: FONT_BOLD, marginBottom: 12 }}>Quick Actions</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {actions.map((a) => (
              <TouchableOpacity key={a.label} onPress={a.go} activeOpacity={0.75} style={{ alignItems: "center", width: "23%" }}>
                <View style={{ width: 58, height: 58, borderRadius: 20, backgroundColor: T.white, alignItems: "center", justifyContent: "center", ...shadow }}>
                  <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: a.tint, alignItems: "center", justifyContent: "center" }}>
                    <a.Icon size={20} color={a.color} strokeWidth={2} />
                  </View>
                </View>
                <Text style={{ fontSize: 12, color: T.dark, fontFamily: FONT_BOLD, marginTop: 8 }}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {myDogs.length === 0 ? (
          <NoDogPrompt />
        ) : (
          <>
            <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigate("filter")}
                style={{ borderRadius: 24, padding: 20, overflow: "hidden", gap: 8, backgroundColor: T.dark }}
              >
                <View style={{ position: "absolute", right: -30, top: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: T.primary, opacity: 0.9 }} />
                <View style={{ position: "absolute", right: 30, bottom: -50, width: 100, height: 100, borderRadius: 50, backgroundColor: "rgba(255,255,255,0.06)" }} />
                <Heart size={36} color="#fff" strokeWidth={2} style={{ position: "absolute", right: 20, top: 18 }} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Sparkles size={14} color={T.secondary} strokeWidth={2.25} />
                  <Text style={{ fontSize: 11, color: T.secondary, fontFamily: FONT_BOLD, letterSpacing: 1 }}>BREEDING MATCH</Text>
                </View>
                <Text style={{ fontSize: 19, lineHeight: 25, color: "#fff", fontFamily: FONT_BOLD, maxWidth: "78%" }}>
                  Set your preferred traits and instantly see the 3 best candidates.
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    alignSelf: "flex-start",
                    gap: 4,
                    marginTop: 8,
                    paddingVertical: 9,
                    paddingLeft: 16,
                    paddingRight: 10,
                    borderRadius: 14,
                    backgroundColor: T.primary,
                  }}
                >
                  <Text style={{ color: "#fff", fontFamily: FONT_BOLD, fontSize: 14 }}>Open Matcher</Text>
                  <ChevronRight size={18} color="#fff" strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={{ marginBottom: 24 }}>
              <View style={{ paddingHorizontal: 20 }}>
                <SectionTitle
                  title="Your Top Matches Today"
                  right={
                    <TouchableOpacity onPress={() => navigate("match")}>
                      <Text style={{ fontSize: 12, color: T.primary, fontFamily: FONT_BOLD }}>Browse all →</Text>
                    </TouchableOpacity>
                  }
                />
                {myDogs.length > 1 && (
                  <View style={{ marginBottom: 12 }}>
                    <MyDogSelector dogs={myDogs} activeId={activeDog?.id} onSelect={setActiveDogId} />
                  </View>
                )}
              </View>
              {top.loading ? (
                <Loading />
              ) : top.error ? (
                <ErrorView message={top.error} onRetry={() => top.reload()} />
              ) : (top.data ?? []).length === 0 ? (
                <Card style={{ marginHorizontal: 20, borderRadius: 22 }}>
                  <EmptyState
                    icon={Search}
                    title="No compatible dogs yet"
                    message={`No ${activeDog?.sex === "male" ? "female" : "male"} dogs are listed yet. Check back soon — you'll be alerted when a compatible match joins.`}
                  />
                </Card>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 6 }}>
                  {(top.data ?? []).map((m, i) => (
                    <MatchCard
                      key={m.dog.id}
                      match={m}
                      width={270}
                      banner={i === 0 ? `Top Match for ${activeDog?.name}` : undefined}
                      onView={() => navigate("match-profile", { dogId: m.dog.id })}
                      onRequest={() => navigate("send-request", { dogId: m.dog.id })}
                    />
                  ))}
                </ScrollView>
              )}
            </View>
          </>
        )}

        <View style={{ paddingHorizontal: 20 }}>
          <SectionTitle
            title="Recent Activity"
            right={
              notifications.length > 0 ? (
                <TouchableOpacity onPress={() => navigate("notifications")}>
                  <Text style={{ fontSize: 12, color: T.primary, fontFamily: FONT_BOLD }}>See all →</Text>
                </TouchableOpacity>
              ) : undefined
            }
          />
          {notifications.length === 0 ? (
            <View style={{ borderRadius: 22, backgroundColor: T.white, paddingVertical: 26, paddingHorizontal: 20, alignItems: "center", ...shadow }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: T.bg, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                <Bell size={24} color={T.light} strokeWidth={2} />
              </View>
              <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD }}>No activity yet</Text>
              <Text style={{ fontSize: 13, lineHeight: 19, color: T.medium, fontFamily: FONT, textAlign: "center", marginTop: 4 }}>
                Requests, messages and verification results will appear here.
              </Text>
            </View>
          ) : (
            <View style={{ borderRadius: 22, backgroundColor: T.white, paddingVertical: 6, ...shadow }}>
              {notifications.slice(0, 4).map((n, i, list) => (
                <TouchableOpacity
                  key={n.id}
                  onPress={() => openNotification(n)}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    alignItems: "flex-start",
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderBottomWidth: i < list.length - 1 ? 1 : 0,
                    borderBottomColor: T.bg,
                  }}
                >
                  <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: T.primaryLight, alignItems: "center", justifyContent: "center" }}>
                    <Bell size={17} color={T.primary} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: T.dark, fontFamily: n.read ? FONT : FONT_BOLD }}>{n.title}</Text>
                    <Text style={{ fontSize: 12, marginTop: 2, color: T.medium, fontFamily: FONT }} numberOfLines={2}>
                      {n.body}
                    </Text>
                    <Text style={{ fontSize: 11, marginTop: 4, color: T.light, fontFamily: FONT }}>{timeAgo(n.created_at)}</Text>
                  </View>
                  {!n.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: T.primary, marginTop: 6 }} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Dot() {
  return (
    <View
      style={{
        position: "absolute",
        top: -3,
        right: -4,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: T.error,
        borderWidth: 1.5,
        borderColor: T.white,
      }}
    />
  );
}

/* ── Browse / Search (Figure 12, FR4) ───────────────────────────── */
const SIZES: Size[] = ["small", "medium", "large"];

export function MatchScreen() {
  const { navigate, myDogs, activeDog, setActiveDogId } = useApp();
  const session = useSession();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [nearMe, setNearMe] = useState(false);
  const [size, setSize] = useState<Size | null>(null);
  const district = districtOf(session.user.location);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const dogs = useAsync(
    () =>
      api.browseDogs({
        excludeOwnerId: session.user.id,
        search: debounced,
        sex: activeDog ? (activeDog.sex === "male" ? "female" : "male") : undefined,
        size: size ?? undefined,
        verifiedOnly,
        location: nearMe ? (district ?? "Davao") : undefined,
      }),
    [debounced, verifiedOnly, nearMe, size, activeDog?.id, district],
  );

  const ranked: RankedMatch[] = useMemo(() => {
    const scored = api.scoreDogs(activeDog, dogs.data ?? []);
    return activeDog ? scored.sort((a, b) => b.compatibility.exact - a.compatibility.exact) : scored;
  }, [dogs.data, activeDog]);

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: Math.max(insets.top, 16) + 8, paddingBottom: 12, backgroundColor: T.white, gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 14,
              height: 46,
              borderRadius: 12,
              backgroundColor: T.bg,
              borderWidth: 1,
              borderColor: T.border,
            }}
          >
            <Search size={18} color={T.medium} strokeWidth={1.5} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search dogs, breeds, colors..."
              placeholderTextColor={T.light}
              style={{ flex: 1, fontSize: 14, color: T.dark, fontFamily: FONT }}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity
            onPress={() => navigate("filter")}
            accessibilityRole="button" accessibilityLabel="Open breeding matcher"
            style={{ width: 46, height: 46, borderRadius: 12, backgroundColor: T.primary, alignItems: "center", justifyContent: "center" }}
          >
            <SlidersHorizontal size={20} color="#fff" strokeWidth={1.75} />
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label="Verified" icon={ShieldCheck} active={verifiedOnly} onPress={() => setVerifiedOnly((v) => !v)} />
          <Chip label={district ? `Near Me (${district})` : "Near Me"} icon={MapPin} active={nearMe} onPress={() => setNearMe((v) => !v)} />
          {SIZES.map((s) => (
            <Chip key={s} label={s[0].toUpperCase() + s.slice(1)} icon={Ruler} active={size === s} onPress={() => setSize(size === s ? null : s)} />
          ))}
          <Chip label="Requests" icon={MessageCircle} onPress={() => navigate("requests")} />
        </ScrollView>
        {myDogs.length > 1 && <MyDogSelector dogs={myDogs} activeId={activeDog?.id} onSelect={setActiveDogId} />}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => dogs.reload(true)} tintColor={T.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {activeDog ? (
          <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>
            Showing {activeDog.sex === "male" ? "female" : "male"} dogs ranked by compatibility with {activeDog.name}.
          </Text>
        ) : (
          <NoDogPrompt />
        )}
        {dogs.loading ? (
          <Loading />
        ) : dogs.error ? (
          <ErrorView message={dogs.error} onRetry={() => dogs.reload()} />
        ) : ranked.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No dogs found"
            message="Try a different search or remove some filters."
          />
        ) : (
          ranked.map((m, i) => (
            <MatchCard
              key={m.dog.id}
              match={m}
              banner={activeDog && i === 0 && !debounced ? `Top Match for ${activeDog.name}` : undefined}
              onView={() => navigate("match-profile", { dogId: m.dog.id })}
              onRequest={() => navigate("send-request", { dogId: m.dog.id })}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

/* ── Breeding Matcher (Figure 11) ───────────────────────────────── */
type Prefs = { breed: string; color: string; size: Size | "any"; temperament: string; verifiedOnly: boolean };
const EMPTY_PREFS: Prefs = { breed: "", color: "", size: "any", temperament: "", verifiedOnly: false };

export function FilterScreen() {
  const { navigate, goBack, myDogs, activeDog, setActiveDogId } = useApp();
  const [prefs, setPrefs] = useState<Prefs>(EMPTY_PREFS);
  const [results, setResults] = useState<RankedMatch[] | null>(null);
  const [selectedDogId, setSelectedDogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const update = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  const run = async () => {
    if (!activeDog) return;
    setLoading(true);
    setError(undefined);
    try {
      const preferences: MatchPreferences = {
        breed: prefs.breed || undefined,
        color: prefs.color && prefs.color !== "Mixed / Multiple colors" ? prefs.color : undefined,
        size: prefs.size,
        temperament: prefs.temperament || undefined,
        verifiedOnly: prefs.verifiedOnly,
      };
      const { results: r } = await api.recommendMatches(activeDog, preferences, 3);
      setResults(r);
      setSelectedDogId(r[0]?.dog.id ?? null);
    } catch (e) {
      setError(api.errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setPrefs(EMPTY_PREFS);
    setResults(null);
    setSelectedDogId(null);
    setError(undefined);
  };

  const label = (text: string, Icon: typeof PawPrint) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <Icon size={15} color={T.dark} strokeWidth={1.75} />
      <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT_BOLD }}>{text}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <Header
        title="Breeding Matcher"
        subtitle="Enter your ideal traits, then choose from the top 3 dogs."
        onBack={goBack}
        right={
          <TouchableOpacity
            onPress={reset}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: T.primaryLight }}
          >
            <RefreshCw size={14} color={T.primaryDark} strokeWidth={2} />
            <Text style={{ fontSize: 12, color: T.primaryDark, fontFamily: FONT_BOLD }}>Reset</Text>
          </TouchableOpacity>
        }
      />

      {myDogs.length === 0 ? (
        <NoDogPrompt />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Card style={{ gap: 4 }}>
            <MyDogSelector dogs={myDogs} activeId={activeDog?.id} onSelect={(id) => { setActiveDogId(id); setResults(null); }} label="Find a partner for" />
            {activeDog && (
              <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, marginTop: 8 }}>
                Only {activeDog.sex === "male" ? "female" : "male"} dogs are considered — sex compatibility is a
                biological requirement for breeding.
              </Text>
            )}
          </Card>

          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <Search size={16} color={T.dark} strokeWidth={1.8} />
              <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD }}>Tell us what you want</Text>
            </View>

            {label("Breed", PawPrint)}
            <BreedInput value={prefs.breed} onChange={(v) => update("breed", v)} placeholder="Any breed — e.g. Shih Tzu" />

            {label("Color", Palette)}
            <ColorCombobox value={prefs.color} onChange={(v) => update("color", v)} placeholder="Any color" />

            {label("Height / Build", Ruler)}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
              {(["any", ...SIZES] as const).map((s) => (
                <Chip key={s} label={s === "any" ? "Any" : s[0].toUpperCase() + s.slice(1)} active={prefs.size === s} onPress={() => update("size", s)} />
              ))}
            </ScrollView>

            {label("Temperament", Heart)}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
              <Chip label="Any" active={!prefs.temperament} onPress={() => update("temperament", "")} />
              {TEMPERAMENT_OPTIONS.map((t) => (
                <Chip key={t} label={t} active={prefs.temperament === t} onPress={() => update("temperament", t)} />
              ))}
            </ScrollView>

            {label("Verification", ShieldCheck)}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
              <Chip label="Any dog" active={!prefs.verifiedOnly} onPress={() => update("verifiedOnly", false)} />
              <Chip label="Verified only" active={prefs.verifiedOnly} onPress={() => update("verifiedOnly", true)} />
            </View>

            <Btn title="Show my 3 best matches" icon={Sparkles} loading={loading} disabled={!activeDog} onPress={run} />
          </Card>

          {error ? (
            <ErrorView message={error} onRetry={run} />
          ) : results === null ? (
            <Card style={{ gap: 6 }}>
              <Text style={{ fontSize: 16, color: T.dark, fontFamily: FONT_BOLD }}>Ready when you are.</Text>
              <Text style={{ fontSize: 13, lineHeight: 18, color: T.medium, fontFamily: FONT }}>
                Tap the button above and the three most compatible dogs will appear here.
              </Text>
            </Card>
          ) : results.length === 0 ? (
            <Card>
              <EmptyState
                icon={Plus}
                title="No dogs match these traits"
                message="Loosen a filter (for example breed or color) and try again."
              />
            </Card>
          ) : (
            <FloatingMatchResults
              matches={results}
              forDogName={activeDog?.name ?? "your dog"}
              selectedDogId={selectedDogId}
              onSelectDog={setSelectedDogId}
              onViewDog={(m) => navigate("match-profile", { dogId: m.dog.id })}
              onRequestDog={(m) => navigate("send-request", { dogId: m.dog.id })}
            />
          )}
        </ScrollView>
      )}
    </View>
  );
}
