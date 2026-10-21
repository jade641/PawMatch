import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  Eye,
  EyeOff,
  FileCheck,
  Heart,
  IdCard,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  PawPrint,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  User,
  Users,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  BRAND,
  DAVAO_DISTRICTS,
  DEFAULT_LOCATION,
  districtLocation,
  FONT,
  FONT_BOLD,
  FONT_MEDIUM,
  T,
} from "../constants/theme";
import { homeScreenFor, useApp } from "../contexts/AppContext";
import * as api from "../services/api";
import type { VerifierRole } from "../types";
import { BrandLogo, Btn, Chip, ErrorView, Field, showMessage } from "./ui";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePassword(password: string): string | undefined {
  if (password.length < 8) return "Use at least 8 characters";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return "Include at least one letter and one number";
  return undefined;
}

function AuthLayout({ children, title, subtitle, icon: Icon = PawPrint }: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  icon?: typeof PawPrint;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.white }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, paddingTop: Math.max(insets.top, 16) + 24, paddingBottom: 40 }}
      >
        <View style={{ alignItems: "center", marginBottom: 28 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: T.primaryLight,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 14,
            }}
          >
            <Icon size={34} color={T.primary} strokeWidth={1.75} />
          </View>
          <Text style={{ fontSize: 26, color: T.dark, fontFamily: FONT_BOLD }}>{title}</Text>
          <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT, marginTop: 6, textAlign: "center" }}>
            {subtitle}
          </Text>
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function TextLink({ prefix, label, onPress }: { prefix?: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ alignItems: "center", paddingVertical: 14 }}>
      <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT }}>
        {prefix ? `${prefix} ` : ""}
        <Text style={{ color: T.primary, fontFamily: FONT_BOLD }}>{label}</Text>
      </Text>
    </TouchableOpacity>
  );
}

/* ── Boot ───────────────────────────────────────────────────────── */
export function BootScreen() {
  const { bootError, retryBoot, signOut } = useApp();
  const insets = useSafeAreaInsets();
  // flexGrow keeps the content centred when it fits; when a long error or large font
  // makes it taller than the screen, it scrolls instead of overflowing both edges.
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: T.primary }}
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <View
        style={{
          width: 110,
          height: 110,
          borderRadius: 55,
          backgroundColor: "rgba(255,255,255,0.2)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <BrandLogo size={64} />
      </View>
      <Text style={{ fontSize: 32, color: "#fff", fontFamily: FONT_BOLD, textAlign: "center" }}>PawMatch</Text>
      <Text style={{ fontSize: 15, color: "rgba(255,255,255,0.85)", fontFamily: FONT, marginTop: 6, textAlign: "center" }}>
        Verified. Local. Trusted.
      </Text>
      <View style={{ marginTop: 40, minHeight: 120, alignSelf: "stretch" }}>
        {bootError ? (
          <>
            <View style={{ backgroundColor: T.white, borderRadius: 16 }}>
              <ErrorView message={bootError} onRetry={retryBoot} />
            </View>
            {/* Retrying can't fix a broken account, so always leave a way out. */}
            <TouchableOpacity onPress={signOut} accessibilityRole="button" style={{ alignSelf: "center", paddingVertical: 14, paddingHorizontal: 20, marginTop: 8 }}>
              <Text style={{ fontSize: 14, color: "#fff", fontFamily: FONT_BOLD }}>Sign out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator color="#fff" size="large" />
        )}
      </View>
    </ScrollView>
  );
}

/* ── Backend not configured ─────────────────────────────────────── */
export function SetupRequired() {
  return (
    <AuthLayout title="Setup required" subtitle="PawMatch can't connect to its backend yet." icon={KeyRound}>
      <View style={{ backgroundColor: T.bg, borderRadius: 16, padding: 16, gap: 8 }}>
        <Text style={{ fontFamily: FONT_BOLD, color: T.dark }}>For the development team</Text>
        <Text style={{ fontFamily: FONT, color: T.dark, lineHeight: 20 }}>
          Create a <Text style={{ fontFamily: FONT_BOLD }}>.env</Text> file in the project root with your Supabase
          project URL and anon key, then restart Expo:
        </Text>
        <Text style={{ fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12, color: T.dark }}>
          EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co{"\n"}EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
        </Text>
        <Text style={{ fontFamily: FONT, color: T.medium, lineHeight: 20 }}>
          See BETA-TESTING.md for the full backend setup.
        </Text>
      </View>
    </AuthLayout>
  );
}

/* ── Landing carousel ───────────────────────────────────────────── */
const LANDING_PAGES = [
  {
    icon: Heart,
    get color() { return T.primary; },
    get tint() { return T.primaryLight; },
    title: "Find Your Dog's\nPerfect Match",
    description: "Smart compatibility scoring for responsible breeding in Davao City.",
    chips: [
      { icon: Sparkles, label: "96% Match" },
      { icon: MapPin, label: "Davao City" },
    ],
  },
  {
    icon: ShieldCheck,
    get color() { return T.success; },
    get tint() { return T.successLight; },
    title: "Verified Health\nRecords",
    description: "Upload documents and get verified by licensed vets or certified breeders.",
    chips: [
      { icon: Stethoscope, label: "Vet Verified" },
      { icon: FileCheck, label: "Records on file" },
    ],
  },
  {
    icon: Users,
    get color() { return T.accent; },
    get tint() { return T.accentLight; },
    title: "Meet Trusted\nDog Owners",
    description: "Check ratings, badges, and past interactions before you connect with another owner.",
    chips: [
      { icon: Star, label: "4.9 Rating" },
      { icon: BadgeCheck, label: "Trusted Breeder" },
    ],
  },
];

type LandingContent = (typeof LANDING_PAGES)[number];

/** Gentle up-and-down bobbing loop for the floating hero chips. */
function useFloat(delay: number) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [v, delay]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
}

function FloatingChip({ chip, color, delay, style }: {
  chip: LandingContent["chips"][number];
  color: string;
  delay: number;
  style: object;
}) {
  const translateY = useFloat(delay);
  const ChipIcon = chip.icon;
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 16,
          backgroundColor: T.white,
          shadowColor: color,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.18,
          shadowRadius: 16,
          elevation: 6,
          transform: [{ translateY }],
        },
        style,
      ]}
    >
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: color, alignItems: "center", justifyContent: "center" }}>
        <ChipIcon size={14} color="#fff" strokeWidth={2.5} />
      </View>
      <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT_BOLD }}>{chip.label}</Text>
    </Animated.View>
  );
}

function LandingSlide({ content, width, index, scrollX }: {
  content: LandingContent;
  width: number;
  index: number;
  scrollX: Animated.Value;
}) {
  const Icon = content.icon;
  const range = [(index - 1) * width, index * width, (index + 1) * width];
  const heroScale = scrollX.interpolate({ inputRange: range, outputRange: [0.7, 1, 0.7], extrapolate: "clamp" });
  const textOpacity = scrollX.interpolate({ inputRange: range, outputRange: [0, 1, 0], extrapolate: "clamp" });
  const textShift = scrollX.interpolate({ inputRange: range, outputRange: [40, 0, -40], extrapolate: "clamp" });
  const hero = Math.min(width - 96, 260);

  return (
    <View style={{ width, flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
      <Animated.View style={{ width: hero + 60, height: hero + 60, alignItems: "center", justifyContent: "center", transform: [{ scale: heroScale }] }}>
        <View style={{ position: "absolute", width: hero + 40, height: hero + 40, borderRadius: (hero + 40) / 2, borderWidth: 1.5, borderColor: content.tint, borderStyle: "dashed" }} />
        <View style={{ position: "absolute", width: hero, height: hero, borderRadius: hero / 2, backgroundColor: content.tint }} />
        <View
          style={{
            width: hero * 0.56,
            height: hero * 0.56,
            borderRadius: hero * 0.18,
            backgroundColor: content.color,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ rotate: "-8deg" }],
            shadowColor: content.color,
            shadowOffset: { width: 0, height: 14 },
            shadowOpacity: 0.35,
            shadowRadius: 24,
            elevation: 10,
          }}
        >
          <View style={{ transform: [{ rotate: "8deg" }] }}>
            <Icon size={hero * 0.26} color="#fff" strokeWidth={1.75} />
          </View>
        </View>
        <PawPrint size={22} color={content.color} style={{ position: "absolute", top: 18, right: 46, opacity: 0.35, transform: [{ rotate: "20deg" }] }} />
        <PawPrint size={16} color={content.color} style={{ position: "absolute", bottom: 30, left: 40, opacity: 0.3, transform: [{ rotate: "-25deg" }] }} />
        <FloatingChip chip={content.chips[0]} color={content.color} delay={0} style={{ top: 26, left: -6 }} />
        <FloatingChip chip={content.chips[1]} color={content.color} delay={900} style={{ bottom: 22, right: -10 }} />
      </Animated.View>

      <Animated.View style={{ alignItems: "center", marginTop: 36, opacity: textOpacity, transform: [{ translateX: textShift }] }}>
        <Text style={{ fontSize: 30, lineHeight: 38, color: T.dark, fontFamily: FONT_BOLD, textAlign: "center", letterSpacing: -0.5 }}>
          {content.title}
        </Text>
        <Text style={{ fontSize: 16, lineHeight: 24, color: T.medium, fontFamily: FONT, textAlign: "center", marginTop: 14, maxWidth: 320 }}>
          {content.description}
        </Text>
      </Animated.View>
    </View>
  );
}

export function Landing() {
  const { navigate } = useApp();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const [scrollX] = useState(() => new Animated.Value(0));
  const scrollRef = useRef<ScrollView>(null);
  const last = page === LANDING_PAGES.length - 1;
  const accent = LANDING_PAGES[page].color;

  const finish = () => navigate("login");

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== page) setPage(i);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.white }}>
      {/* Soft tinted backdrop that blends into white */}
      <LinearGradient
        colors={[LANDING_PAGES[page].tint, T.white]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: "70%" }}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 24,
          paddingTop: Math.max(insets.top, 16) + 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: T.primary, alignItems: "center", justifyContent: "center" }}>
            <BrandLogo size={22} />
          </View>
          <Text style={{ fontSize: 19, color: T.dark, fontFamily: FONT_BOLD, letterSpacing: -0.3 }}>PawMatch</Text>
        </View>
        {!last && (
          <TouchableOpacity
            onPress={() => finish()}
            style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: T.white, opacity: 0.9 }}
          >
            <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT_MEDIUM }}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={Platform.OS === "web" ? onScrollEnd : undefined}
        style={{ flex: 1 }}
      >
        {LANDING_PAGES.map((content, i) => (
          <LandingSlide key={i} content={content} width={width} index={i} scrollX={scrollX} />
        ))}
      </Animated.ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 28 }}>
          {LANDING_PAGES.map((p, i) => {
            const range = [(i - 1) * width, i * width, (i + 1) * width];
            return (
              <TouchableOpacity key={i} onPress={() => goTo(i)} hitSlop={8}>
                <Animated.View
                  style={{
                    height: 8,
                    borderRadius: 4,
                    width: scrollX.interpolate({ inputRange: range, outputRange: [8, 28, 8], extrapolate: "clamp" }),
                    backgroundColor: i === page ? p.color : T.light,
                  }}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={() => (last ? finish() : goTo(page + 1))}
          activeOpacity={0.85}
          accessibilityRole="button"
          style={{
            height: 56,
            borderRadius: 18,
            backgroundColor: accent,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            shadowColor: accent,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 18,
            elevation: 6,
          }}
        >
          <Text style={{ fontSize: 17, color: "#fff", fontFamily: FONT_BOLD }}>{last ? "Get Started" : "Next"}</Text>
          <ArrowRight size={20} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </View>
    </View>
  );
}

/* ── Shared auth shell (Login / Register) ───────────────────────── */
function AuthShell({ title, subtitle, onBack, children, footer }: {
  title: string;
  subtitle: string;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, 16);
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingBottom: Math.max(insets.bottom, 16) + 16 }}>
        {/* Hero header */}
        <View style={{ paddingTop: top + (onBack ? 12 : 28), paddingBottom: 72, paddingHorizontal: 24, overflow: "hidden" }}>
          <LinearGradient colors={[BRAND.orange, BRAND.orangeDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          <View style={{ position: "absolute", width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(255,255,255,0.08)", top: -70, right: -60 }} />
          <View style={{ position: "absolute", width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.07)", bottom: -40, left: -40 }} />
          <PawPrint size={26} color="#fff" style={{ position: "absolute", top: top + 40, right: 34, opacity: 0.25, transform: [{ rotate: "20deg" }] }} />
          <PawPrint size={18} color="#fff" style={{ position: "absolute", bottom: 90, right: 90, opacity: 0.18, transform: [{ rotate: "-15deg" }] }} />

          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={8}
              style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center", marginBottom: 18 }}
            >
              <ArrowLeft size={20} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
              <BrandLogo size={38} />
            </View>
          )}
          <Text style={{ fontSize: 30, color: "#fff", fontFamily: FONT_BOLD, letterSpacing: -0.5 }}>{title}</Text>
          <Text style={{ fontSize: 15, lineHeight: 22, color: "rgba(255,255,255,0.88)", fontFamily: FONT, marginTop: 6 }}>{subtitle}</Text>
        </View>

        {/* Form card */}
        <View
          style={{
            marginTop: -44,
            marginHorizontal: 16,
            padding: 22,
            borderRadius: 24,
            backgroundColor: T.white,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.08,
            shadowRadius: 24,
            elevation: 6,
          }}
        >
          {children}
        </View>
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AuthButton({ title, loading, onPress, style }: { title: string; loading?: boolean; onPress: () => void; style?: object }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!loading, busy: !!loading }}
      style={[
        {
          height: 56,
          borderRadius: 16,
          backgroundColor: T.primary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          opacity: loading ? 0.8 : 1,
          shadowColor: T.primary,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.3,
          shadowRadius: 18,
          elevation: 6,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Text style={{ fontSize: 17, color: "#fff", fontFamily: FONT_BOLD }}>{title}</Text>
          <ArrowRight size={20} color="#fff" strokeWidth={2.5} />
        </>
      )}
    </TouchableOpacity>
  );
}

/** Auth input: leading icon, highlighted border while focused. */
function AuthField({ icon: Icon, label, error, hint, secure, ...input }: {
  icon: typeof Mail;
  label: string;
  error?: string;
  hint?: string;
  secure?: boolean;
} & Omit<TextInputProps, "style" | "secureTextEntry">) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const active = focused && !error;
  return (
    <View style={{ marginBottom: 16 }}>
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
          borderColor: error ? T.error : active ? T.primary : T.border,
          backgroundColor: active ? T.white : T.inputBg,
        }}
      >
        <Icon size={20} color={error ? T.error : active ? T.primary : T.medium} strokeWidth={2} />
        <TextInput
          {...input}
          accessibilityLabel={label}
          placeholderTextColor={T.light}
          secureTextEntry={secure && hidden}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={[
            { flex: 1, height: "100%", fontSize: 15, color: T.dark, fontFamily: FONT },
            Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null,
          ]}
        />
        {secure && (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
            hitSlop={8}
            style={{ padding: 4 }}
          >
            {hidden ? <Eye size={20} color={T.medium} /> : <EyeOff size={20} color={T.medium} />}
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text style={{ fontSize: 12, color: T.error, marginTop: 6, fontFamily: FONT }}>{error}</Text>
      ) : hint ? (
        <Text style={{ fontSize: 12, color: T.medium, marginTop: 6, fontFamily: FONT }}>{hint}</Text>
      ) : null}
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT_BOLD, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12, marginTop: 4 }}>
      {children}
    </Text>
  );
}

/** 0–4 strength score shown under the new-password field. */
function passwordStrength(pw: string) {
  if (!pw) return null;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw) || pw.length >= 12) score++;
  const levels = [
    { label: "Too weak", color: T.error },
    { label: "Weak", color: T.error },
    { label: "Fair", color: T.secondaryDark },
    { label: "Good", color: T.success },
    { label: "Strong", color: T.success },
  ];
  return { score, ...levels[score] };
}

function StrengthMeter({ strength }: { strength: NonNullable<ReturnType<typeof passwordStrength>> }) {
  return (
    <View style={{ marginTop: -8, marginBottom: 16 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i < strength.score ? strength.color : T.border }} />
        ))}
      </View>
      <Text style={{ fontSize: 12, fontFamily: FONT_MEDIUM, color: strength.color, marginTop: 6 }}>
        {strength.label} password
      </Text>
    </View>
  );
}

/** "Step n of 2" intro block for the password-reset flow. */
function StepHeader({ step, icon: Icon, title, text }: { step: number; icon: typeof Mail; title: string; text: string }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 18 }}>
        {[1, 2].map((i) => (
          <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: i <= step ? T.primary : T.border }} />
        ))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: T.primaryLight, alignItems: "center", justifyContent: "center" }}>
          <Icon size={24} color={T.primary} strokeWidth={2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: T.primary, fontFamily: FONT_BOLD, letterSpacing: 0.8, textTransform: "uppercase" }}>
            Step {step} of 2
          </Text>
          <Text style={{ fontSize: 17, color: T.dark, fontFamily: FONT_BOLD, marginTop: 2 }}>{title}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 14, lineHeight: 21, color: T.medium, fontFamily: FONT, marginTop: 12 }}>{text}</Text>
    </View>
  );
}

/* ── Login ──────────────────────────────────────────────────────── */
const DEMO_PASSWORD = process.env.EXPO_PUBLIC_DEMO_PASSWORD;
const DEMO_ACCOUNTS = [
  { label: "Dog Owner", email: "demo.owner@pawmatch.app" },
  { label: "Veterinarian", email: "demo.vet@pawmatch.app" },
];

export function Login() {
  const { navigate } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);

  const submit = async () => {
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address";
    if (!password) next.password = "Password is required";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await api.signIn(email, password);
      // Navigation happens in AppProvider once the session is loaded.
    } catch (e) {
      setLoading(false);
      if (api.isEmailNotConfirmed(e)) {
        const address = email.trim().toLowerCase();
        api.resendSignupCode(address).catch(() => undefined);
        navigate("verify-email", { email: address });
        return;
      }
      showMessage("Sign in failed", api.errorMessage(e));
    }
  };

  const signInWithGoogle = async () => {
    setSocialLoading(true);
    try {
      await api.signInWithGoogle();
    } catch (e) {
      showMessage("Sign in failed", api.errorMessage(e));
    } finally {
      setSocialLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome Back!"
      subtitle="Sign in to find your dog's perfect match."
      footer={
        <>
          <TextLink prefix="Don't have an account?" label="Sign Up" onPress={() => navigate("register")} />
          {DEMO_PASSWORD ? (
            <View style={{ marginHorizontal: 16, padding: 14, backgroundColor: T.white, borderRadius: 16, borderWidth: 1, borderColor: T.border, alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 13, color: T.dark, fontFamily: FONT_BOLD }}>Demo Access (beta)</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {DEMO_ACCOUNTS.map((d) => (
                  <Chip
                    key={d.email}
                    label={d.label}
                    onPress={() => {
                      setEmail(d.email);
                      setPassword(DEMO_PASSWORD);
                      setErrors({});
                    }}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </>
      }
    >
      <AuthField
        icon={Mail}
        label="Email Address"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
        }}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        error={errors.email}
      />
      <AuthField
        icon={Lock}
        label="Password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
        }}
        placeholder="Enter your password"
        secure
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        error={errors.password}
        onSubmitEditing={submit}
      />
      <TouchableOpacity
        onPress={() => navigate("forgot-password", { email })}
        hitSlop={8}
        style={{ alignSelf: "flex-end", marginTop: -2, marginBottom: 20 }}
      >
        <Text style={{ color: T.primary, fontFamily: FONT_BOLD, fontSize: 14 }}>Forgot Password?</Text>
      </TouchableOpacity>

      <AuthButton title="Sign In" loading={loading} onPress={submit} />

      {api.socialLoginEnabled && (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 22 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: T.border }} />
            <Text style={{ marginHorizontal: 12, fontSize: 13, color: T.medium, fontFamily: FONT }}>or continue with</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: T.border }} />
          </View>
          <TouchableOpacity
            onPress={signInWithGoogle}
            disabled={socialLoading}
            activeOpacity={0.8}
            style={{
              height: 52,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              borderRadius: 16,
              borderWidth: 1,
              backgroundColor: T.white,
              borderColor: "rgba(255,99,27,0.3)",
            }}
          >
            {socialLoading ? (
              <ActivityIndicator color={T.primary} />
            ) : (
              <Image source={require("./Logo/google.png")} style={{ width: 24, height: 24 }} resizeMode="contain" />
            )}
            <Text style={{ fontSize: 15, fontFamily: FONT_BOLD, color: "#ff631b" }}>Continue with Google</Text>
          </TouchableOpacity>
        </>
      )}
    </AuthShell>
  );
}

/* ── Registration (Figure 9) ────────────────────────────────────── */
export function Register() {
  const { navigate, refreshSession, switchPortal, showToast } = useApp();
  const [role, setRole] = useState<"owner" | "verifier">("owner");
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirm: "",
    district: DEFAULT_LOCATION as string,
    phone: "",
    verifierRole: "Licensed Veterinarian" as VerifierRole,
    clinic: "",
    licenseNumber: "",
  });
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const e: Record<string, string | undefined> = {};
    if (form.fullName.trim().length < 2) e.fullName = "Enter your full name";
    if (!EMAIL_RE.test(form.email.trim())) e.email = "Enter a valid email address";
    e.password = validatePassword(form.password);
    if (form.confirm !== form.password) e.confirm = "Passwords do not match";
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13) e.phone = "Enter a valid mobile number, e.g. 0917 123 4567";
    if (role === "verifier") {
      if (form.clinic.trim().length < 2) e.clinic = "Enter your clinic or kennel";
      if (form.licenseNumber.trim().length < 3) e.licenseNumber = "Enter your PRC license or certification number";
    }
    setErrors(e);
    return Object.values(e).every((v) => !v);
  };

  /**
   * One login per email: a dog owner who is also a vet / breeder adds the professional
   * profile to their existing account, proving it's theirs with that account's password.
   */
  const addToExistingAccount = async () => {
    try {
      await api.signIn(form.email, form.password);
    } catch (e) {
      if (api.isEmailNotConfirmed(e)) {
        showMessage("Confirm your email first", "This email is registered but not confirmed yet. Confirm it, then sign up as Vet / Breeder again.");
      } else {
        showMessage(
          "Email already registered",
          "This email already has a PawMatch account. To add a vet / breeder profile to it, enter that account's current password.",
        );
      }
      return;
    }
    try {
      await api.addVerifierProfile(form.verifierRole, form.clinic, form.licenseNumber);
    } catch (e) {
      // Already signed in at this point, so the user lands in their existing account.
      showMessage("Couldn't add your vet / breeder profile", api.errorMessage(e));
      return;
    }
    await refreshSession();
    switchPortal("vet");
    showToast("Vet / breeder profile added", "Your dog owner account is unchanged. The PawMatch team will review your license.", "success");
  };

  const submit = async () => {
    if (!validate()) return;
    if (!agree) {
      showMessage("Terms required", "Please agree to the Terms of Service and Privacy Policy.");
      return;
    }
    setLoading(true);
    try {
      const { needsConfirmation, alreadyRegistered } = await api.signUp({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        phone: form.phone,
        location: districtLocation(form.district),
        role,
        verifierRole: form.verifierRole,
        clinic: form.clinic,
        licenseNumber: form.licenseNumber,
      });
      if (alreadyRegistered) {
        if (role === "verifier") await addToExistingAccount();
        else showMessage("Email already registered", "An account with this email already exists. Sign in instead.");
      } else if (needsConfirmation) {
        navigate("verify-email", { email: form.email.trim().toLowerCase() });
      }
      // Otherwise the new session signs the user in automatically.
    } catch (e) {
      showMessage("Registration failed", api.errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const strength = passwordStrength(form.password);

  return (
    <AuthShell
      title="Create Account"
      subtitle="Join PawMatch and start finding trusted matches in Davao City."
      onBack={() => navigate("login")}
      footer={<TextLink prefix="Already have an account?" label="Sign In" onPress={() => navigate("login")} />}
    >
      <SectionLabel>I am a</SectionLabel>
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 22 }}>
        {(
          [
            { id: "owner", label: "Dog Owner", desc: "Find matches", Icon: PawPrint },
            { id: "verifier", label: "Vet / Breeder", desc: "Verify records", Icon: Stethoscope },
          ] as const
        ).map(({ id, label, desc, Icon }) => {
          const selected = role === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => setRole(id)}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={{
                flex: 1,
                padding: 14,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: selected ? T.primary : T.border,
                backgroundColor: selected ? T.primaryLight : T.white,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 13,
                    backgroundColor: selected ? T.primary : T.bg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={20} color={selected ? "#fff" : T.medium} strokeWidth={2} />
                </View>
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    borderWidth: 2,
                    borderColor: selected ? T.primary : T.light,
                    backgroundColor: selected ? T.primary : T.white,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {selected && <Check size={12} color="#fff" strokeWidth={3.5} />}
                </View>
              </View>
              <Text style={{ fontSize: 15, fontFamily: FONT_BOLD, color: selected ? T.primaryDark : T.dark }}>{label}</Text>
              <Text style={{ fontSize: 12, fontFamily: FONT, color: T.medium, marginTop: 2 }}>{desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <SectionLabel>Account details</SectionLabel>
      <AuthField icon={User} label="Full Name" value={form.fullName} onChangeText={(v) => set("fullName", v)} placeholder={role === "verifier" ? "e.g. Dr. Patricia Reyes" : "Enter your full name"} autoComplete="name" error={errors.fullName} />
      <AuthField icon={Mail} label="Email Address" value={form.email} onChangeText={(v) => set("email", v)} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={errors.email} />
      <AuthField icon={Phone} label="Phone Number" value={form.phone} onChangeText={(v) => set("phone", v)} placeholder="0917 123 4567" keyboardType="phone-pad" autoComplete="tel" error={errors.phone} />
      <AuthField
        icon={Lock}
        label="Password"
        value={form.password}
        onChangeText={(v) => set("password", v)}
        placeholder="Create a password"
        secure
        autoComplete="new-password"
        error={errors.password}
        hint={strength ? undefined : "At least 8 characters with a letter and a number"}
      />
      {strength && !errors.password && <StrengthMeter strength={strength} />}
      <AuthField icon={Lock} label="Confirm Password" value={form.confirm} onChangeText={(v) => set("confirm", v)} placeholder="Re-enter your password" secure autoComplete="new-password" error={errors.confirm} />

      <SectionLabel>Location</SectionLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
        {[DEFAULT_LOCATION, ...DAVAO_DISTRICTS].map((d) => (
          <Chip key={d} label={d} active={form.district === d} onPress={() => set("district", d)} />
        ))}
      </View>

      {role === "verifier" && (
        <View style={{ backgroundColor: T.primaryLight, borderRadius: 18, padding: 16, marginBottom: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <ShieldCheck size={18} color={T.primaryDark} strokeWidth={2.25} />
            <Text style={{ fontSize: 14, color: T.primaryDark, fontFamily: FONT_BOLD }}>Professional details</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {(["Licensed Veterinarian", "Certified Breeder"] as const).map((r) => (
              <Chip key={r} label={r} active={form.verifierRole === r} onPress={() => set("verifierRole", r)} />
            ))}
          </View>
          <AuthField icon={Building2} label="Clinic / Kennel" value={form.clinic} onChangeText={(v) => set("clinic", v)} placeholder="e.g. Davao Animal Clinic" error={errors.clinic} />
          <AuthField icon={IdCard} label="License / Certification No." value={form.licenseNumber} onChangeText={(v) => set("licenseNumber", v)} placeholder="PRC license number" autoCapitalize="characters" error={errors.licenseNumber} />
          <Text style={{ fontSize: 12, color: T.primaryDark, fontFamily: FONT, lineHeight: 18 }}>
            Verifier accounts are reviewed by the PawMatch team before you can receive documents to verify.
          </Text>
          <Text style={{ fontSize: 12, color: T.primaryDark, fontFamily: FONT, lineHeight: 18, marginTop: 8 }}>
            Already a dog owner on PawMatch? Use the same email and password. Your vet / breeder profile is added to
            that account and you can switch between the two.
          </Text>
        </View>
      )}

      <TouchableOpacity
        onPress={() => setAgree((a) => !a)}
        activeOpacity={0.8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agree }}
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
          padding: 14,
          borderRadius: 14,
          backgroundColor: T.bg,
          marginBottom: 20,
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            borderWidth: 2,
            borderColor: agree ? T.primary : T.light,
            backgroundColor: agree ? T.primary : T.white,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 1,
          }}
        >
          {agree && <Check size={14} color="#fff" strokeWidth={3} />}
        </View>
        <Text style={{ flex: 1, fontSize: 13, color: T.dark, fontFamily: FONT, lineHeight: 19 }}>
          I agree to the <Text style={{ fontFamily: FONT_BOLD, color: T.primary }}>Terms of Service</Text> and{" "}
          <Text style={{ fontFamily: FONT_BOLD, color: T.primary }}>Privacy Policy</Text>, including the processing of my
          dogs&apos; health records for verification.
        </Text>
      </TouchableOpacity>

      <AuthButton title="Create Account" loading={loading} onPress={submit} />
    </AuthShell>
  );
}

/* ── Confirm email with the emailed code ────────────────────────── */
const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyEmail() {
  const { params, resetTo, showToast } = useApp();
  const email: string = params.email ?? "";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = async () => {
    if (!/^\d{6,8}$/.test(code.trim())) {
      setError("Enter the code from the email");
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      await api.verifySignupCode(email, code);
      showToast("Email confirmed", "Welcome to PawMatch!", "success");
      // AppProvider moves the now signed-in user to their home screen.
    } catch (e) {
      setError(api.errorMessage(e));
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await api.resendSignupCode(email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      showToast("Code sent", `Check ${email} (and the spam folder).`, "success");
    } catch (e) {
      showMessage("Couldn't resend", api.errorMessage(e));
    }
  };

  return (
    <AuthLayout title="Confirm your email" subtitle={`Enter the code we emailed to ${email || "you"}.`} icon={Mail}>
      <Field
        label="Confirmation Code"
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
        placeholder="Code from the email"
        keyboardType="number-pad"
        maxLength={8}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        error={error}
        onSubmitEditing={submit}
      />
      <Btn title="Confirm Email" size="large" loading={loading} onPress={submit} />
      <Text style={{ fontSize: 13, color: T.medium, fontFamily: FONT, textAlign: "center", marginTop: 16, lineHeight: 19 }}>
        Can&apos;t find it? Check your spam or promotions folder. The code expires after 1 hour.
      </Text>
      {cooldown > 0 ? (
        <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT, textAlign: "center", paddingVertical: 14 }}>
          Resend code in {cooldown}s
        </Text>
      ) : (
        <TextLink prefix="Didn't get the email?" label="Resend code" onPress={resend} />
      )}
      <TextLink label="Back to Sign In" onPress={() => resetTo("login")} />
    </AuthLayout>
  );
}

/* ── Forgot password ────────────────────────────────────────────── */
export function ForgotPassword() {
  const { navigate, goBack, params } = useApp();
  const [email, setEmail] = useState<string>(params.email ?? "");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address");
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      await api.sendPasswordReset(email);
      navigate("reset-password", { email: email.trim().toLowerCase() });
    } catch (e) {
      showMessage("Couldn't send the code", api.errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Forgot Password?"
      subtitle="No worries! We'll help you get back into your account."
      onBack={goBack}
      footer={<TextLink prefix="Remember your password?" label="Sign In" onPress={goBack} />}
    >
      <StepHeader step={1} icon={Mail} title="Enter your email" text="We'll send a reset code to the email linked to your PawMatch account." />
      <AuthField
        icon={Mail}
        label="Email Address"
        value={email}
        onChangeText={(v) => {
          setEmail(v);
          if (error) setError(undefined);
        }}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={submit}
        error={error}
      />
      <AuthButton title="Send Reset Code" loading={loading} onPress={submit} style={{ marginTop: 4 }} />
    </AuthShell>
  );
}

/* ── Reset password with emailed code ───────────────────────────── */
export function ResetPassword() {
  const { params, goBack, refreshSession, resetTo, showToast, portal } = useApp();
  const email: string = params.email ?? "";
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async () => {
    const e: Record<string, string | undefined> = {};
    if (!/^\d{6,8}$/.test(code.trim())) e.code = "Enter the code from the email";
    e.password = validatePassword(password);
    if (confirm !== password) e.confirm = "Passwords do not match";
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;

    setLoading(true);
    try {
      await api.resetPasswordWithCode(email, code, password);
      const s = await refreshSession();
      showToast("Password updated", "You're signed in with your new password.", "success");
      resetTo(s ? homeScreenFor(s, portal) : "login");
    } catch (err) {
      showMessage("Reset failed", api.errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await api.sendPasswordReset(email);
      showToast("Code sent", `Check ${email} for a new code.`, "success");
    } catch (e) {
      showMessage("Couldn't resend", api.errorMessage(e));
    } finally {
      setResending(false);
    }
  };

  const clear = (key: string) => {
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const strength = passwordStrength(password);

  return (
    <AuthShell
      title="Reset Password"
      subtitle="Almost there! Choose a new password for your account."
      onBack={goBack}
      footer={<TextLink label="Back to Sign In" onPress={() => resetTo("login")} />}
    >
      <StepHeader
        step={2}
        icon={KeyRound}
        title="Check your inbox"
        text={`Enter the code we emailed to ${email || "you"}, then set your new password.`}
      />
      <AuthField
        icon={KeyRound}
        label="Reset Code"
        value={code}
        onChangeText={(v) => {
          setCode(v.replace(/\D/g, ""));
          clear("code");
        }}
        placeholder="Code from the email"
        keyboardType="number-pad"
        maxLength={8}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        error={errors.code}
      />
      <AuthField
        icon={Lock}
        label="New Password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          clear("password");
        }}
        placeholder="Enter a new password"
        secure
        autoComplete="new-password"
        error={errors.password}
        hint={strength ? undefined : "At least 8 characters with a letter and a number"}
      />
      {strength && !errors.password && <StrengthMeter strength={strength} />}
      <AuthField
        icon={Lock}
        label="Confirm Password"
        value={confirm}
        onChangeText={(v) => {
          setConfirm(v);
          clear("confirm");
        }}
        placeholder="Re-enter your new password"
        secure
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={errors.confirm}
      />
      <AuthButton title="Reset Password" loading={loading} onPress={submit} style={{ marginTop: 4 }} />
      <TouchableOpacity onPress={resend} disabled={resending} style={{ alignItems: "center", paddingTop: 18 }}>
        <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT }}>
          Didn&apos;t get the email?{" "}
          <Text style={{ color: T.primary, fontFamily: FONT_BOLD }}>{resending ? "Sending…" : "Resend code"}</Text>
        </Text>
      </TouchableOpacity>
    </AuthShell>
  );
}
