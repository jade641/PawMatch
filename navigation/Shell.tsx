import {
  Bell,
  ClipboardList,
  DogIcon,
  FileCheck,
  Heart,
  Home,
  Shield,
  ShieldCheck,
  Stethoscope,
  User,
  X,
} from "lucide-react-native";
import { type ComponentType, type ReactNode, useEffect, useState } from "react";
import { Animated, BackHandler, Platform, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dropShadow, FONT, FONT_BOLD, FONT_MEDIUM, T } from "../constants/theme";
import { isVetPortal, useApp } from "../contexts/AppContext";
import type { Screen } from "../types";

type Tab = { icon: ComponentType<any>; label: string; screens: Screen[] };

const OWNER_TABS: Tab[] = [
  { icon: Home, label: "Home", screens: ["home", "notifications"] },
  {
    icon: Heart,
    label: "Match",
    screens: ["match", "filter", "match-profile", "send-request", "requests"],
  },
  { icon: DogIcon, label: "Dog", screens: ["dog-profile", "add-dog", "edit-dog"] },
  { icon: Shield, label: "Verify", screens: ["verify-upload", "verify-choose", "verify-status", "audit-trail"] },
  {
    icon: User,
    label: "Profile",
    screens: ["owner-profile", "owner-settings", "reputation", "settings", "edit-profile", "change-password"],
  },
];

const VET_TABS: Tab[] = [
  { icon: Home, label: "Home", screens: ["vet-dashboard", "notifications"] },
  { icon: ClipboardList, label: "Requests", screens: ["vet-requests", "vet-request-detail"] },
  { icon: FileCheck, label: "Records", screens: ["vet-records"] },
  { icon: Stethoscope, label: "Profile", screens: ["vet-profile", "vet-settings", "vet-professional", "edit-profile", "change-password"] },
];

/** Appended to the owner or vet tabs for administrators. */
const ADMIN_TAB: Tab = { icon: ShieldCheck, label: "Admin", screens: ["admin-verifiers", "admin-verifier-detail"] };

/** Full-screen pages without the tab bar. */
const NO_NAV: Screen[] = [
  "boot",
  "setup-required",
  "landing",
  "login",
  "register",
  "forgot-password",
  "reset-password",
  "verify-email",
  "conversation",
];

function BottomNav({ tabs }: { tabs: Tab[] }) {
  const { screen, resetTo, unreadCount } = useApp();
  const insets = useSafeAreaInsets();
  const styles = makeStyles();
  const activeIndex = tabs.findIndex((t) => t.screens.includes(screen));

  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {tabs.map((tab, i) => {
        const active = i === activeIndex;
        const Icon = tab.icon;
        const showBadge = i === 0 && unreadCount > 0 && !active;
        return (
          <TouchableOpacity
            key={tab.label}
            onPress={() => resetTo(tab.screens[0])}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityLabel={showBadge ? `${tab.label}, unread notifications` : tab.label}
            accessibilityState={{ selected: active }}
          >
            <View>
              <Icon size={23} color={active ? T.primary : T.medium} strokeWidth={1.6} />
              {showBadge && <View style={styles.badgeDot} />}
            </View>
            <Text style={[styles.tabLabel, { color: active ? T.primary : T.medium }]}>{tab.label}</Text>
            {active && <View style={styles.activeDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ToastBanner() {
  const { toast, dismissToast, openNotification } = useApp();
  const insets = useSafeAreaInsets();
  const styles = makeStyles();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!toast) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== "web" }).start();
    const timer = setTimeout(dismissToast, 4500);
    return () => clearTimeout(timer);
  }, [toast, anim, dismissToast]);

  if (!toast) return null;
  const accent = toast.tone === "error" ? T.error : toast.tone === "success" ? T.success : T.primary;

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          top: Math.max(insets.top, 12) + 8,
          borderLeftColor: accent,
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
        },
      ]}
    >
      <TouchableOpacity
        style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1 }}
        activeOpacity={0.8}
        onPress={() => {
          if (toast.notification) openNotification(toast.notification);
          dismissToast();
        }}
      >
        <Bell size={18} color={accent} style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONT_BOLD, color: T.dark, fontSize: 14 }} numberOfLines={2}>
            {toast.title}
          </Text>
          {toast.message ? (
            <Text style={{ fontFamily: FONT, color: T.medium, fontSize: 12, marginTop: 2 }} numberOfLines={3}>
              {toast.message}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
      <TouchableOpacity onPress={dismissToast} hitSlop={10} accessibilityLabel="Dismiss notification">
        <X size={16} color={T.medium} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { screen, session, portal, canGoBack, goBack } = useApp();
  const styles = makeStyles();

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack) {
        goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack, goBack]);

  const isVet = !!session && isVetPortal(session, portal);
  const showNav = !!session && !NO_NAV.includes(screen);
  const tabs = isVet ? VET_TABS : OWNER_TABS;

  return (
    <View style={styles.shell}>
      <View style={styles.content}>{children}</View>
      {showNav && <BottomNav tabs={session.user.role === "admin" ? [...tabs, ADMIN_TAB] : tabs} />}
      <ToastBanner />
    </View>
  );
}

// Built while rendering (not StyleSheet.create at load time) so the colors follow the active theme.
const makeStyles = () => ({
  shell: { flex: 1, backgroundColor: T.bg },
  content: { flex: 1 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: T.border,
    backgroundColor: T.white,
  },
  tab: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 },
  tabLabel: { fontSize: 11, fontFamily: FONT_MEDIUM },
  activeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: T.primary },
  badgeDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: T.error,
    borderWidth: 1.5,
    borderColor: T.white,
  },
  toast: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 1000,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: T.white,
    borderLeftWidth: 4,
    ...dropShadow(4, 12, 0.15),
  },
} as const);
