import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import * as api from "../services/api";
import type { AppNotification, Dog, Screen, Session } from "../types";

type Params = Record<string, any>;

interface Route {
  screen: Screen;
  params: Params;
}

export interface Toast {
  id: number;
  title: string;
  message?: string;
  tone: "info" | "success" | "error";
  notification?: AppNotification;
}

/** Screens a signed-in user is moved away from automatically after sign-in. */
const SIGNED_OUT_SCREENS: Screen[] = ["boot", "setup-required", "landing", "login", "register", "forgot-password", "verify-email"];
const PORTAL_KEY = "pawmatch.portal";

/** Which side of the app an account with both an owner and a vet / breeder profile is using. */
export type Portal = "owner" | "vet";

export function isVetPortal(session: Session, portal: Portal) {
  return !!session.verifier && (!session.owner || portal === "vet");
}

export function homeScreenFor(session: Session, portal: Portal = "owner"): Screen {
  return isVetPortal(session, portal) ? "vet-dashboard" : "home";
}

interface AppContextValue {
  screen: Screen;
  params: Params;
  canGoBack: boolean;
  navigate: (screen: Screen, params?: Params) => void;
  replace: (screen: Screen, params?: Params) => void;
  goBack: () => void;
  resetTo: (screen: Screen, params?: Params) => void;

  session: Session | null;
  bootError: string | null;
  retryBoot: () => void;
  refreshSession: () => Promise<Session | null>;
  signOut: () => Promise<void>;

  portal: Portal;
  /** Switches between the owner and vet sides and opens that side's home screen. */
  switchPortal: (portal: Portal) => void;

  myDogs: Dog[];
  dogsLoaded: boolean;
  reloadDogs: () => Promise<Dog[]>;
  activeDog: Dog | null;
  setActiveDogId: (id: string) => void;

  notifications: AppNotification[];
  unreadCount: number;
  lastNotification: AppNotification | null;
  reloadNotifications: () => Promise<void>;
  markAllRead: () => Promise<void>;
  setNotificationRead: (n: AppNotification, read: boolean) => Promise<void>;
  deleteNotification: (n: AppNotification) => Promise<void>;
  openNotification: (n: AppNotification) => void;

  toast: Toast | null;
  showToast: (title: string, message?: string, tone?: Toast["tone"]) => void;
  dismissToast: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([
    { screen: isSupabaseConfigured ? "boot" : "setup-required", params: {} },
  ]);
  const [session, setSession] = useState<Session | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [myDogs, setMyDogs] = useState<Dog[]>([]);
  const [dogsLoaded, setDogsLoaded] = useState(false);
  const [activeDogId, setActiveDogId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [lastNotification, setLastNotification] = useState<AppNotification | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [portal, setPortal] = useState<Portal>("owner");

  const route = stack[stack.length - 1];
  const screenRef = useRef<Screen>(route.screen);
  const sessionUidRef = useRef<string | null>(null);
  const portalRef = useRef<Portal>("owner");
  const sessionLoadId = useRef(0);

  useEffect(() => {
    screenRef.current = route.screen;
  }, [route.screen]);

  /* ── Navigation ──────────────────────────────────────────────── */
  const navigate = useCallback((screen: Screen, params: Params = {}) => {
    setStack((s) => [...s, { screen, params }].slice(-30));
  }, []);
  const replace = useCallback((screen: Screen, params: Params = {}) => {
    setStack((s) => [...s.slice(0, -1), { screen, params }]);
  }, []);
  const goBack = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);
  const resetTo = useCallback((screen: Screen, params: Params = {}) => {
    setStack([{ screen, params }]);
  }, []);

  /* ── Toasts ──────────────────────────────────────────────────── */
  const showToast = useCallback((title: string, message?: string, tone: Toast["tone"] = "info") => {
    setToast({ id: Date.now(), title, message, tone });
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  /* ── Session & dogs ──────────────────────────────────────────── */
  const reloadDogs = useCallback(async () => {
    const uid = sessionUidRef.current;
    if (!uid) return [];
    const dogs = await api.listMyDogs(uid);
    setMyDogs(dogs);
    setDogsLoaded(true);
    setActiveDogId((current) => (current && dogs.some((d) => d.id === current) ? current : (dogs[0]?.id ?? null)));
    return dogs;
  }, []);

  const choosePortal = useCallback((p: Portal) => {
    portalRef.current = p;
    setPortal(p);
    AsyncStorage.setItem(PORTAL_KEY, p).catch(() => undefined);
  }, []);

  const loadSession = useCallback(async () => {
    const id = ++sessionLoadId.current;
    const s = await api.fetchSession();
    // A newer load (e.g. right after adding a vet profile) wins over a slower, older one.
    if (id !== sessionLoadId.current) return s;
    sessionUidRef.current = s?.user.id ?? null;
    setSession(s);
    if (s?.owner) {
      await reloadDogs();
    } else {
      setMyDogs([]);
      setDogsLoaded(true);
    }
    return s;
  }, [reloadDogs]);

  const clearSignedInState = useCallback(() => {
    sessionUidRef.current = null;
    setSession(null);
    setMyDogs([]);
    setDogsLoaded(false);
    setActiveDogId(null);
    setNotifications([]);
    setLastNotification(null);
  }, []);

  /** Applies the saved portal, restores the session and opens the right first screen. */
  const restoreSession = useCallback(
    async (savedPortal: string | null) => {
      try {
        if (savedPortal === "vet" || savedPortal === "owner") choosePortal(savedPortal);
        const s = await loadSession();
        if (s) {
          resetTo(homeScreenFor(s, portalRef.current));
        } else {
          // Always open on the landing carousel when signed out.
          resetTo("landing");
        }
      } catch (e) {
        setBootError(api.errorMessage(e));
      }
    },
    [loadSession, resetTo, choosePortal],
  );

  const startBoot = useCallback(() => {
    AsyncStorage.getItem(PORTAL_KEY)
      .catch(() => null)
      .then(restoreSession);
  }, [restoreSession]);

  /** "Try again" on the boot screen. */
  const boot = useCallback(() => {
    if (!isSupabaseConfigured) {
      resetTo("setup-required");
      return;
    }
    setBootError(null);
    resetTo("boot");
    startBoot();
  }, [resetTo, startBoot]);

  useEffect(() => {
    // The initial stack already shows "boot" (or "setup-required"), so only the async part runs here.
    if (!isSupabaseConfigured) return;
    startBoot();

    const { data } = supabase.auth.onAuthStateChange((event, authSession) => {
      if (event === "SIGNED_IN") {
        const uid = authSession?.user.id ?? null;
        if (!uid || uid === sessionUidRef.current) return;
        // Defer: Supabase calls must not run inside the auth callback itself.
        setTimeout(async () => {
          try {
            const s = await loadSession();
            if (s && SIGNED_OUT_SCREENS.includes(screenRef.current)) resetTo(homeScreenFor(s, portalRef.current));
          } catch (e) {
            showToast("Couldn't load your profile", api.errorMessage(e), "error");
          }
        }, 0);
      } else if (event === "SIGNED_OUT") {
        clearSignedInState();
        resetTo("login");
      }
    });
    return () => data.subscription.unsubscribe();
  }, [startBoot, loadSession, resetTo, showToast, clearSignedInState]);

  const refreshSession = useCallback(async () => {
    try {
      return await loadSession();
    } catch (e) {
      showToast("Couldn't refresh your profile", api.errorMessage(e), "error");
      return null;
    }
  }, [loadSession, showToast]);

  const signOut = useCallback(async () => {
    try {
      await api.signOut();
    } catch {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    }
    clearSignedInState();
    resetTo("login");
  }, [clearSignedInState, resetTo]);

  const switchPortal = useCallback(
    (p: Portal) => {
      choosePortal(p);
      resetTo(p === "vet" ? "vet-dashboard" : "home");
    },
    [choosePortal, resetTo],
  );

  /* ── Notifications (Supabase Realtime) ───────────────────────── */
  const reloadNotifications = useCallback(async () => {
    try {
      setNotifications(await api.listNotifications());
    } catch {
      // Non-critical; the list refreshes on the next visit.
    }
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let active = true;
    // A slow first load must not overwrite the list after sign-out or an account switch.
    api
      .listNotifications()
      .then((list) => active && setNotifications(list))
      .catch(() => undefined);
    const unsubscribe = api.subscribeToNotifications(userId, (n) => {
      setNotifications((list) => [n, ...list.filter((x) => x.id !== n.id)]);
      setLastNotification(n);
      // Silent alerts (e.g. "Profile completed") only appear in the Notifications list.
      if (!n.data?.silent) setToast({ id: Date.now(), title: n.title, message: n.body, tone: "info", notification: n });
      if (n.type === "verification_result") reloadDogs().catch(() => undefined);
      if (n.type === "verifier_review") loadSession().catch(() => undefined);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId, reloadDogs, loadSession]);

  const markAllRead = useCallback(async () => {
    setNotifications((list) => list.map((n) => ({ ...n, read: true })));
    await api.markNotificationsRead().catch(() => undefined);
  }, []);

  /** Optimistic; the list goes back to its previous state if the change fails. */
  const setNotificationRead = useCallback(async (n: AppNotification, read: boolean) => {
    setNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, read } : x)));
    try {
      await (read ? api.markNotificationsRead([n.id]) : api.markNotificationUnread(n.id));
    } catch (e) {
      setNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, read: n.read } : x)));
      throw e;
    }
  }, []);

  const deleteNotification = useCallback(async (n: AppNotification) => {
    setNotifications((list) => list.filter((x) => x.id !== n.id));
    try {
      await api.deleteNotification(n.id);
    } catch (e) {
      setNotifications((list) => [...list, n].sort((a, b) => b.created_at.localeCompare(a.created_at)));
      throw e;
    }
  }, []);

  const openNotification = useCallback(
    (n: AppNotification) => {
      if (!n.read) {
        setNotifications((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
        api.markNotificationsRead([n.id]).catch(() => undefined);
      }
      const d = n.data ?? {};
      // Accounts with both profiles: open the alert on the side of the app it belongs to.
      if (n.type === "verification_request" || n.type === "verifier_review") choosePortal("vet");
      else if (n.type !== "system" && n.type !== "verifier_application") choosePortal("owner");
      switch (n.type) {
        case "match_request":
        case "request_update":
        case "message":
          if (d.match_request_id) navigate("conversation", { requestId: Number(d.match_request_id) });
          break;
        case "review":
          navigate("reputation");
          break;
        case "verification_request":
          if (d.submission_id) navigate("vet-request-detail", { submissionId: d.submission_id });
          break;
        case "verification_result":
          navigate("verify-status", { dogId: d.dog_id });
          break;
        case "verifier_application":
          if (d.verifier_id) navigate("admin-verifier-detail", { verifierId: d.verifier_id });
          break;
        case "verifier_review":
          navigate("vet-profile");
          break;
        case "system":
          if (d.kind === "complete_profile" || d.kind === "profile_completed" || d.kind === "location_updated") navigate("edit-profile");
          else navigate("notifications");
          break;
        case "match_alert":
          if (d.for_dog_id) setActiveDogId(d.for_dog_id);
          if (d.dog_id) navigate("match-profile", { dogId: d.dog_id });
          break;
        default:
          navigate("notifications");
      }
    },
    [navigate, choosePortal],
  );

  const activeDog = useMemo(
    () => myDogs.find((d) => d.id === activeDogId) ?? myDogs[0] ?? null,
    [myDogs, activeDogId],
  );

  const value: AppContextValue = {
    screen: route.screen,
    params: route.params,
    canGoBack: stack.length > 1,
    navigate,
    replace,
    goBack,
    resetTo,
    session,
    bootError,
    retryBoot: boot,
    refreshSession,
    signOut,
    portal,
    switchPortal,
    myDogs,
    dogsLoaded,
    reloadDogs,
    activeDog,
    setActiveDogId,
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    lastNotification,
    reloadNotifications,
    markAllRead,
    setNotificationRead,
    deleteNotification,
    openNotification,
    toast,
    showToast,
    dismissToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within an AppProvider");
  return context;
}

/**
 * Owner screens that need the user's location (adding a dog, sending a match request) call this.
 * While the profile is incomplete it swaps the screen for Edit Profile, which returns here once
 * the location is saved, and returns true so the caller renders nothing in the meantime.
 */
export function useLocationGate(): boolean {
  const { session, screen, params, replace } = useApp();
  const blocked = !!session?.owner && !session.user.profile_completed;
  useEffect(() => {
    if (blocked) replace("edit-profile", { requireLocation: true, next: { screen, params } });
    // Runs once per screen visit; screen and params are fixed for this route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked]);
  return blocked;
}

/** Signed-in session; only call from screens that require authentication. */
export function useSession(): Session {
  const { session } = useApp();
  if (!session) throw new Error("This screen requires a signed-in user");
  return session;
}
