import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SystemUI from "expo-system-ui";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { applyColorScheme, type ColorScheme, T } from "../constants/theme";

/** What the user picked in Settings; "system" follows the phone's light / dark setting. */
export type ThemePreference = "system" | "light" | "dark";

const APPEARANCE_KEY = "pawmatch.appearance";

interface ThemeContextValue {
  preference: ThemePreference;
  /** The theme actually shown. */
  scheme: ColorScheme;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(APPEARANCE_KEY)
      .then((saved) => {
        if (saved === "system" || saved === "light" || saved === "dark") setPreferenceState(saved);
      })
      .catch(() => undefined);
  }, []);

  const scheme: ColorScheme = preference === "system" ? (system === "dark" ? "dark" : "light") : preference;
  // Swap the shared palette before any child renders with it.
  applyColorScheme(scheme);

  useEffect(() => {
    // Android navigation bar area and the background behind screens.
    SystemUI.setBackgroundColorAsync(T.bg).catch(() => undefined);
  }, [scheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(APPEARANCE_KEY, next).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ preference, scheme, setPreference }), [preference, scheme, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useThemePreference must be used within a ThemePreferenceProvider");
  return context;
}
