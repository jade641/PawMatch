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
import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BRAND, capitalize, districtOf, FONT, FONT_BOLD, oppositeSex, shadow, T } from "../constants/theme";
import { useApp, useSession } from "../contexts/AppContext";
import { useAsync } from "../hooks/useAsync";
import * as api from "../services/api";
import type { MatchPreferences } from "../services/compatibility";
import { TEMPERAMENT_OPTIONS } from "../services/compatibility";
import type { RankedMatch, Size } from "../types";
import { NotificationBody } from "./Community";
import { BreedInput, ColorCombobox, MatchCard, MyDogSelector } from "./DogWidgets";
import { FloatingMatchResults } from "./FloatingMatchResults";
import {
  Avatar,
  BrandLogo,
  Btn,
  Card,
  Chip,
  EmptyState,
  ErrorView,
  Header,
  HeaderAction,
  HeroHeader,
  HeroIconButton,
  Loading,
  SectionTitle,
  TextLink,
} from "./ui";

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

      <Btn title="Add Dog Profile" icon={Plus} size="hero" onPress={() => navigate("add-dog")} style={{ marginTop: 20 }} />
    </View>
  );
}

/* ── Home Dashboard (Figure 10) ─────────────────────────────────── */
export function HomeScreen() {
  const {
    navigate,
    myDogs,
    activeDog,
    setActiveDogId,
    notifications,
    unreadCount,
    openNotification,
    lastNotification,
    reloadNotifications,
  } = useApp();
  const session = useSession();
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

  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([requests.reload(true), verifiedNearby.reload(true), top.reload(true), reloadNotifications()]);
    setRefreshing(false);
  };

  const stats = [
    { Icon: Heart, n: incomingPending, t: "Match\nRequests", color: T.primary, tint: T.primaryLight, go: () => navigate("requests") },
    {
      Icon: CheckCircle,
      // Show a dash rather than a misleading 0 when the count couldn't be loaded.
      n: verifiedNearby.error ? "–" : (verifiedNearby.data ?? 0),
      t: district ? `Verified in\n${district}` : "Verified\nDogs",
      color: T.success,
      tint: T.successLight,
      go: () => navigate("match"),
    },
    { Icon: Bell, n: unreadCount, t: "Unread\nAlerts", color: T.accent, tint: T.accentLight, go: () => navigate("notifications") },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: T.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={T.primary} />}
      >
        <HeroHeader
          title="PawMatch"
          overlap={42}
          leading={
            <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}>
              <BrandLogo size={22} />
            </View>
          }
          right={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <HeroIconButton icon={MessageCircle} label="Requests and messages" onPress={() => navigate("requests")} badge={incomingPending > 0} />
              <HeroIconButton icon={Bell} label="Notifications" onPress={() => navigate("notifications")} badge={unreadCount > 0} />
              <TouchableOpacity
                onPress={() => navigate("owner-profile")}
                accessibilityRole="button"
                accessibilityLabel="My profile"
                style={{ borderRadius: 21, borderWidth: 2, borderColor: "rgba(255,255,255,0.7)" }}
              >
                <Avatar name={session.user.full_name} size={38} color={BRAND.orangeDeep} uri={api.avatarUrl(session.user.avatar_url)} />
              </TouchableOpacity>
            </View>
          }
        >
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
        </HeroHeader>

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
              accessibilityRole="button"
              accessibilityLabel={`${s.n} ${s.t.replace("\n", " ")}`}
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

        {myDogs.length === 0 ? (
          <NoDogPrompt />
        ) : (
          <>
            <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => navigate("filter")}
                style={{ borderRadius: 24, padding: 20, overflow: "hidden", gap: 8, backgroundColor: T.ink }}
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
                  right={<TextLink label="Browse all" onPress={() => navigate("match")} />}
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
                    message={`No ${activeDog ? oppositeSex(activeDog.sex) : "compatible"} dogs are listed yet. Check back soon — you'll be alerted when a compatible match joins.`}
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
              notifications.length > 0 ? <TextLink label="See all" onPress={() => navigate("notifications")} /> : undefined
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
                  accessibilityRole="button"
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
                  <NotificationBody n={n} compact />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
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
        sex: activeDog ? oppositeSex(activeDog.sex) : undefined,
        size: size ?? undefined,
        verifiedOnly,
        location: nearMe ? (district ?? "Davao") : undefined,
      }),
    [debounced, verifiedOnly, nearMe, size, activeDog?.id, district],
  );

  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await dogs.reload(true);
    setRefreshing(false);
  };

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
              accessibilityLabel="Search dogs by name, breed or color"
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
            <Chip key={s} label={capitalize(s)} icon={Ruler} active={size === s} onPress={() => setSize(size === s ? null : s)} />
          ))}
        </ScrollView>
        {myDogs.length > 1 && <MyDogSelector dogs={myDogs} activeId={activeDog?.id} onSelect={setActiveDogId} />}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={T.primary} />}
        keyboardShouldPersistTaps="handled"
      >
        {activeDog ? (
          <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT }}>
            Showing {oppositeSex(activeDog.sex)} dogs ranked by compatibility with {activeDog.name}.
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
  const runId = useRef(0);

  const update = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  const run = async () => {
    if (!activeDog) return;
    // Switching dogs mid-request must not show results computed for the previous dog.
    const id = ++runId.current;
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
      if (id !== runId.current) return;
      setResults(r);
      setSelectedDogId(r[0]?.dog.id ?? null);
    } catch (e) {
      if (id === runId.current) setError(api.errorMessage(e));
    } finally {
      if (id === runId.current) setLoading(false);
    }
  };

  const reset = () => {
    runId.current++;
    setLoading(false);
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
        right={<HeaderAction icon={RefreshCw} label="Reset" onPress={reset} />}
      />

      {myDogs.length === 0 ? (
        <NoDogPrompt />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Card style={{ gap: 4 }}>
            <MyDogSelector
              dogs={myDogs}
              activeId={activeDog?.id}
              onSelect={(id) => {
                runId.current++;
                setLoading(false);
                setActiveDogId(id);
                setResults(null);
              }}
              label="Find a partner for"
            />
            {activeDog && (
              <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, marginTop: 8 }}>
                Only {oppositeSex(activeDog.sex)} dogs are considered — sex compatibility is a
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
                icon={Search}
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
