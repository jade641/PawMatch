import { StatusBar } from "expo-status-bar";
import { AlertCircle, ArrowLeft, Eye, EyeOff, Moon, PawPrint, Star, Sun } from "lucide-react-native";
import { type ComponentType, type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  type StyleProp,
  Switch,
  Text,
  TextInput,
  type TextInputProps,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BRAND, FONT, FONT_BOLD, FONT_MEDIUM, initials, shadow, T, type Tone } from "../constants/theme";
import { useThemePreference } from "../contexts/ThemeContext";

type IconType = ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;

/* ── Dialogs that also work on web ──────────────────────────────── */
export function showMessage(title: string, message?: string) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export function confirmAction(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
  destructive = false,
) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: confirmLabel, style: destructive ? "destructive" : "default", onPress: onConfirm },
  ]);
}

/* ── Layout ─────────────────────────────────────────────────────── */
/**
 * Orange gradient page header. `children` render under the title; `overlap`
 * adds bottom space so the first card below can pull up over the hero.
 */
export function HeroHeader({
  title,
  subtitle,
  eyebrow,
  onBack,
  leading,
  right,
  overlap = 0,
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onBack?: () => void;
  /** Rendered before the title when there is no back button, e.g. the brand logo. */
  leading?: ReactNode;
  right?: ReactNode;
  overlap?: number;
  children?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: Math.max(insets.top, 16) + 8,
        paddingBottom: 22 + overlap,
        paddingHorizontal: 20,
        overflow: "hidden",
        borderBottomLeftRadius: 28,
        borderBottomRightRadius: 28,
      }}
    >
      <StatusBar style="light" />
      {/* A native view pinned to all four edges resizes with the header. The previous <Svg
          width/height="100%"> didn't track the header's size on Android, leaving it half-painted. */}
      <LinearGradient
        colors={[BRAND.orange, BRAND.orangeDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{ position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(255,255,255,0.08)", top: -60, right: -50 }} />
      <View style={{ position: "absolute", width: 120, height: 120, borderRadius: 60, backgroundColor: "rgba(255,255,255,0.06)", bottom: -40, left: -30 }} />
      <PawPrint size={20} color="#fff" style={{ position: "absolute", bottom: 18 + overlap, right: 36, opacity: 0.18, transform: [{ rotate: "20deg" }] }} />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {onBack && (
          <TouchableOpacity
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}
          >
            <ArrowLeft size={20} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
        {!onBack && leading}
        <View style={{ flex: 1 }}>
          {eyebrow ? (
            <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", fontFamily: FONT_BOLD, letterSpacing: 0.8, textTransform: "uppercase" }}>
              {eyebrow}
            </Text>
          ) : null}
          <Text style={{ fontSize: 22, color: "#fff", fontFamily: FONT_BOLD, letterSpacing: -0.3 }} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontFamily: FONT, marginTop: 2 }} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

/** Translucent round icon button for use on a HeroHeader. */
export function HeroIconButton({ icon: Icon, label, onPress, badge }: { icon: IconType; label: string; onPress: () => void; badge?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, new activity` : label}
      hitSlop={6}
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}
    >
      <Icon size={20} color="#fff" strokeWidth={2} />
      {badge && (
        <View
          style={{
            position: "absolute",
            top: 6,
            right: 7,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: T.error,
            borderWidth: 1.5,
            borderColor: T.white,
          }}
        />
      )}
    </TouchableOpacity>
  );
}

export function Header({
  title,
  subtitle,
  icon: Icon,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: IconType;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: Math.max(insets.top, 16) + 8,
        paddingBottom: 12,
        paddingHorizontal: 16,
        backgroundColor: T.white,
        borderBottomWidth: 1,
        borderBottomColor: T.border,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      {onBack && (
        <TouchableOpacity
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: T.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ArrowLeft size={20} color={T.dark} strokeWidth={1.75} />
        </TouchableOpacity>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {Icon && <Icon size={18} color={T.dark} strokeWidth={1.75} />}
          <Text numberOfLines={1} style={{ fontSize: 17, color: T.dark, fontFamily: FONT_BOLD, flexShrink: 1 }}>
            {title}
          </Text>
        </View>
        {subtitle ? (
          <Text numberOfLines={1} style={{ fontSize: 12, color: T.medium, marginTop: 2, fontFamily: FONT }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const base: ViewStyle = { backgroundColor: T.white, borderRadius: 16, padding: 16, ...shadow };
  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[base, style]}
      >
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function SectionTitle({ title, icon: Icon, right }: { title: string; icon?: IconType; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {Icon && <Icon size={17} color={T.dark} strokeWidth={1.75} />}
        <Text style={{ fontSize: 15, color: T.dark, fontFamily: FONT_BOLD }}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

/** Inline navigation link, e.g. "See all →". */
export function TextLink({ label, onPress, style }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="link" accessibilityLabel={label} hitSlop={8} style={style}>
      {/* primaryDark: the brand orange is too light for small text (WCAG AA). */}
      <Text style={{ fontSize: 13, color: T.primaryDark, fontFamily: FONT_BOLD }}>{label} →</Text>
    </TouchableOpacity>
  );
}

/** Small pill action for the right side of a Header, e.g. "Reset". */
export function HeaderAction({ icon: Icon, label, onPress }: { icon?: IconType; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: T.primaryLight }}
    >
      {Icon && <Icon size={14} color={T.primaryDark} strokeWidth={2} />}
      <Text style={{ fontSize: 12, color: T.primaryDark, fontFamily: FONT_BOLD }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function InfoRow({ label, value, last }: { label: string; value: ReactNode; last?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: T.bg,
      }}
    >
      <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT }}>{label}</Text>
      {typeof value === "string" || typeof value === "number" ? (
        <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_MEDIUM, flexShrink: 1, textAlign: "right" }}>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

/** White card with an icon badge, a title and an optional subtitle above its content. */
export function SectionCard({ icon: Icon, title, subtitle, children }: {
  icon: IconType;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ backgroundColor: T.white, borderRadius: 22, padding: 18, ...shadow }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: T.primaryLight, alignItems: "center", justifyContent: "center" }}>
          <Icon size={17} color={T.primary} strokeWidth={2.25} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, color: T.dark, fontFamily: FONT_BOLD }}>{title}</Text>
          {subtitle ? <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, marginTop: 1 }}>{subtitle}</Text> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

/** Row of equal-width segment tabs; the selected one is filled with the brand color. */
export function SegmentedTabs<K extends string>({ tabs, value, onChange, style }: {
  tabs: { id: K; label: string; icon?: IconType }[];
  value: K;
  onChange: (id: K) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: "row", margin: 20, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: T.border }, style]}>
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = value === id;
        return (
          <TouchableOpacity
            key={id}
            onPress={() => onChange(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{ flex: 1, paddingVertical: 10, backgroundColor: active ? T.primary : T.white, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}
          >
            {Icon && <Icon size={14} color={active ? "#fff" : T.medium} strokeWidth={1.6} />}
            <Text style={{ fontSize: 12, color: active ? "#fff" : T.medium, fontFamily: FONT_BOLD }}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* ── Controls ───────────────────────────────────────────────────── */
type BtnVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

export function Btn({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  disabled,
  loading,
  icon: Icon,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress: () => void;
  /** Defaults to `title`; set it when the visible title is ambiguous out of context. */
  accessibilityLabel?: string;
  variant?: BtnVariant;
  size?: "small" | "medium" | "large" | "hero";
  disabled?: boolean;
  loading?: boolean;
  icon?: IconType;
  style?: StyleProp<ViewStyle>;
}) {
  const palette: Record<BtnVariant, { bg: string; border: string; fg: string }> = {
    primary: { bg: T.primary, border: T.primary, fg: "#fff" },
    secondary: { bg: T.primaryLight, border: T.primaryLight, fg: T.primaryDark },
    outline: { bg: T.white, border: T.primary, fg: T.primary },
    ghost: { bg: "transparent", border: "transparent", fg: T.primary },
    danger: { bg: T.white, border: T.error, fg: T.error },
  };
  const c = palette[variant];
  const hero = size === "hero";
  const height = size === "small" ? 38 : size === "large" ? 54 : hero ? 56 : 48;
  const inactive = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[
        {
          minHeight: height,
          paddingHorizontal: size === "small" ? 14 : 20,
          borderRadius: hero ? 16 : 12,
          borderWidth: 1.5,
          backgroundColor: c.bg,
          borderColor: c.border,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: hero ? 10 : 8,
          opacity: disabled ? 0.5 : loading && hero ? 0.8 : 1,
        },
        hero && { shadowColor: c.bg, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 18, elevation: 6 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <>
          {Icon && <Icon size={size === "small" ? 15 : hero ? 20 : 18} color={c.fg} strokeWidth={hero ? 2.5 : 2} />}
          <Text style={{ color: c.fg, fontSize: size === "small" ? 13 : hero ? 17 : 15, fontFamily: FONT_BOLD }}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function Field({
  label,
  error,
  hint,
  secure,
  multiline,
  style,
  ...input
}: {
  label?: string;
  error?: string;
  hint?: string;
  secure?: boolean;
  style?: StyleProp<ViewStyle>;
} & Omit<TextInputProps, "style" | "secureTextEntry">) {
  const [hidden, setHidden] = useState(true);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      {label ? (
        <Text style={{ fontSize: 13, color: T.dark, marginBottom: 6, fontFamily: FONT_MEDIUM }}>{label}</Text>
      ) : null}
      <View
        style={{
          flexDirection: "row",
          alignItems: multiline ? "flex-start" : "center",
          borderWidth: 1,
          borderColor: error ? T.error : T.border,
          borderRadius: 12,
          backgroundColor: T.white,
          paddingHorizontal: 14,
        }}
      >
        <TextInput
          {...input}
          accessibilityLabel={input.accessibilityLabel ?? label ?? input.placeholder}
          placeholderTextColor={T.light}
          secureTextEntry={secure && hidden}
          multiline={multiline}
          style={{
            flex: 1,
            minHeight: multiline ? 96 : 48,
            paddingVertical: multiline ? 12 : 0,
            fontSize: 15,
            color: T.dark,
            fontFamily: FONT,
            textAlignVertical: multiline ? "top" : "center",
          }}
        />
        {secure && (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button" accessibilityLabel={hidden ? "Show password" : "Hide password"}
            hitSlop={8}
            style={{ padding: 4 }}
          >
            {hidden ? <Eye size={20} color={T.medium} /> : <EyeOff size={20} color={T.medium} />}
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text style={{ fontSize: 12, color: T.error, marginTop: 4, fontFamily: FONT }}>{error}</Text>
      ) : hint ? (
        <Text style={{ fontSize: 12, color: T.medium, marginTop: 4, fontFamily: FONT }}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  icon: Icon,
  disabled,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconType;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress || disabled}
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? T.primary : T.border,
        backgroundColor: active ? T.primary : T.white,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {Icon && <Icon size={13} color={active ? "#fff" : T.dark} strokeWidth={1.75} />}
      <Text style={{ fontSize: 12, color: active ? "#fff" : T.dark, fontFamily: FONT_MEDIUM }}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Tag({ label, tone = "neutral" }: { label: string; tone?: Tone | "brand" }) {
  const colors: Record<Tone | "brand", [string, string]> = {
    success: [T.successLight, T.success],
    warning: [T.warningLight, T.warning],
    danger: [T.errorLight, T.error],
    info: [T.accentLight, T.accentDark],
    neutral: [T.bg, T.dark],
    brand: [T.primaryLight, T.primaryDark],
  };
  const [bg, fg] = colors[tone];
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: bg, alignSelf: "flex-start" }}>
      <Text style={{ fontSize: 12, color: fg, fontFamily: FONT_MEDIUM }}>{label}</Text>
    </View>
  );
}

/* ── Appearance ─────────────────────────────────────────────────── */
/** "Dark Mode" row with an on / off switch for Settings screens. */
export function DarkModeToggle() {
  const { preference, scheme, setPreference } = useThemePreference();
  const on = scheme === "dark";
  const toggle = () => setPreference(on ? "light" : "dark");
  const Icon = on ? Moon : Sun;
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityLabel="Dark mode"
      accessibilityState={{ checked: on }}
      style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: on ? T.accentLight : T.secondaryLight,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={20} color={on ? T.accent : T.secondaryDark} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: T.dark, fontFamily: FONT_MEDIUM }}>Dark Mode</Text>
        <Text style={{ fontSize: 12, color: T.medium, fontFamily: FONT, marginTop: 2 }}>
          {preference === "system" ? `${on ? "On" : "Off"} • following your phone` : on ? "On" : "Off"}
        </Text>
      </View>
      <Switch
        value={on}
        onValueChange={toggle}
        trackColor={{ true: T.primary, false: T.light }}
        thumbColor="#fff"
        ios_backgroundColor={T.light}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

/* ── Trust indicators ───────────────────────────────────────────── */
export function VeriBadge({ tier }: { tier: number }) {
  const bg = tier >= 3 ? T.secondaryDark : tier === 2 ? T.primary : tier === 1 ? T.accent : T.light;
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
      <Text style={{ color: "#fff", fontSize: 10, fontFamily: FONT_BOLD, letterSpacing: 0.4 }}>
        {tier > 0 ? `TIER ${tier}` : "UNVERIFIED"}
      </Text>
    </View>
  );
}

export function ScoreBar({ score, showLabel }: { score: number; showLabel?: boolean }) {
  const color = score >= 80 ? T.success : score >= 60 ? T.secondaryDark : T.error;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ flex: 1, height: 6, backgroundColor: T.bg, borderRadius: 3, overflow: "hidden" }}>
        <View style={{ width: `${Math.max(0, Math.min(100, score))}%`, height: "100%", backgroundColor: color }} />
      </View>
      {showLabel && <Text style={{ fontSize: 12, color, fontFamily: FONT_BOLD }}>{score}%</Text>}
    </View>
  );
}

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }} accessibilityLabel={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          color={i <= Math.round(rating) ? T.star : T.light}
          fill={i <= Math.round(rating) ? T.star : "transparent"}
          strokeWidth={1.5}
        />
      ))}
    </View>
  );
}

export function Avatar({
  name,
  size = 40,
  color = T.primary,
  uri,
}: {
  name: string;
  size?: number;
  color?: string;
  /** Profile picture; falls back to initials when absent. */
  uri?: string | null;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: T.primaryLight }}
        accessibilityLabel={`${name}'s profile picture`}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#fff", fontSize: size * 0.38, fontFamily: FONT_BOLD }}>{initials(name)}</Text>
    </View>
  );
}

/** PawMatch paw mark — same artwork as the app icon and splash screen. */
export function BrandLogo({ size }: { size: number }) {
  return (
    <Image
      source={require("../assets/images/logo.png")}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

export function DogImage({
  uri,
  width,
  height,
  radius = 12,
  style,
}: {
  uri: string | null | undefined;
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  if (!uri) {
    return (
      <View
        style={[
          {
            width,
            height,
            borderRadius: radius,
            backgroundColor: T.primaryLight,
            alignItems: "center",
            justifyContent: "center",
          },
          style,
        ]}
      >
        <PawPrint size={Math.min(height, typeof width === "number" ? width : height) * 0.4} color={T.primary} strokeWidth={1.5} />
      </View>
    );
  }
  return (
    <View style={[{ width, height, borderRadius: radius, overflow: "hidden", backgroundColor: T.bg }, style]}>
      <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
    </View>
  );
}

/* ── States ─────────────────────────────────────────────────────── */
export function Loading({ message }: { message?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, minHeight: 200 }}>
      <ActivityIndicator size="large" color={T.primary} />
      {message ? <Text style={{ marginTop: 12, color: T.medium, fontFamily: FONT }}>{message}</Text> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }}>
      <AlertCircle size={40} color={T.error} strokeWidth={1.5} />
      <Text style={{ color: T.dark, textAlign: "center", fontFamily: FONT, lineHeight: 20 }}>{message}</Text>
      {onRetry && <Btn title="Try again" variant="outline" size="small" onPress={onRetry} />}
    </View>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon: IconType;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ alignItems: "center", padding: 28, gap: 10 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: T.primaryLight,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={34} color={T.primary} strokeWidth={1.5} />
      </View>
      <Text style={{ fontSize: 17, color: T.dark, fontFamily: FONT_BOLD, textAlign: "center" }}>{title}</Text>
      <Text style={{ fontSize: 14, color: T.medium, fontFamily: FONT, textAlign: "center", lineHeight: 20 }}>
        {message}
      </Text>
      {actionLabel && onAction ? <Btn title={actionLabel} onPress={onAction} style={{ marginTop: 6 }} /> : null}
    </View>
  );
}

export function ListItem({
  icon: Icon,
  title,
  subtitle,
  onPress,
  danger,
  right,
  last,
}: {
  icon: IconType;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: ReactNode;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: pressed ? T.bg : T.white,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: T.border,
      })}
    >
      <Icon size={20} color={danger ? T.error : T.dark} strokeWidth={1.5} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: danger ? T.error : T.dark, fontFamily: FONT_MEDIUM }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontSize: 12, color: T.medium, marginTop: 2, fontFamily: FONT }}>{subtitle}</Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Text style={{ fontSize: 18, color: T.light }}>›</Text> : null)}
    </Pressable>
  );
}
