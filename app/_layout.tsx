import { Roboto_400Regular, Roboto_500Medium, Roboto_700Bold, useFonts } from "@expo-google-fonts/roboto";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { T } from "../constants/theme";
import { AppProvider } from "../contexts/AppContext";
import { ThemePreferenceProvider, useThemePreference } from "../contexts/ThemeContext";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Roboto_400Regular, Roboto_500Medium, Roboto_700Bold });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemePreferenceProvider>
        <AppProvider>
          <ThemedNavigator />
        </AppProvider>
      </ThemePreferenceProvider>
    </SafeAreaProvider>
  );
}

function ThemedNavigator() {
  const { scheme } = useThemePreference();
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, colors: { ...base.colors, background: T.bg, card: T.white, text: T.dark, border: T.border } };
  return (
    <ThemeProvider value={navTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth-callback" />
      </Stack>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}
