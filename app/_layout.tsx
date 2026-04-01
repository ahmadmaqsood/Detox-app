import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import "react-native-gesture-handler";
import "react-native-reanimated";

import { initDB, isOnboardingComplete, recordLastActiveNow } from "@/lib/database";
import {
  ensureNotificationHandler,
  rescheduleSmartNotifications,
} from "@/lib/smartNotifications";
import { AppearanceProvider, useAppearance } from "@/store/AppearanceContext";
import { DetoxProvider } from "@/store/DetoxContext";
import { FocusProvider } from "@/store/FocusContext";
import { HardModeProvider } from "@/store/HardModeContext";
import { ModeProvider } from "@/store/ModeContext";
import { colors } from "@/theme/colors";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(drawer)",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    (async () => {
      await initDB();
      await isOnboardingComplete();
      setDbReady(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, dbReady]);

  if (!loaded || !dbReady) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <AppearanceProvider>
      <RootLayoutNavInner />
    </AppearanceProvider>
  );
}

function RootLayoutNavInner() {
  const router = useRouter();
  const segments = useSegments();
  const { scheme } = useAppearance();
  const t = scheme === "light" ? colors.light : colors.dark;

  // Silence Expo Go-only push warning from expo-notifications (remote push not supported in Go).
  if (__DEV__ && Constants.appOwnership === "expo") {
    const origError = console.error;
    console.error = (...args: any[]) => {
      const first = args[0];
      if (
        typeof first === "string" &&
        first.includes("expo-notifications: Android Push notifications (remote notifications)")
      ) {
        return;
      }
      return origError(...args);
    };
  }

  const navigationTheme = useMemo(() => {
    const base = scheme === "light" ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: t.background,
        card: t.card,
        text: t.textPrimary,
        border: t.border,
        primary: t.accent,
      },
    };
  }, [scheme, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const inOnboarding = segments[0] === "onboarding";
      const done = await isOnboardingComplete();
      if (cancelled) return;
      if (!done && !inOnboarding) {
        router.replace("/onboarding");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [segments, router]);

  useEffect(() => {
    ensureNotificationHandler();
    void rescheduleSmartNotifications();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        void recordLastActiveNow();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider value={navigationTheme}>
      <HardModeProvider>
      <ModeProvider>
        <DetoxProvider>
          <FocusProvider>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: t.background },
                headerTintColor: t.textPrimary,
                headerShadowVisible: false,
                contentStyle: { backgroundColor: t.background },
                animation: "fade_from_bottom",
                animationDuration: 250,
              }}
            >
              <Stack.Screen
                name="(drawer)"
                options={{ headerShown: false, animation: "fade" }}
              />
              <Stack.Screen
                name="onboarding"
                options={{ headerShown: false, animation: "fade" }}
              />
              <Stack.Screen
                name="addHabit"
                options={{
                  title: "Add Habit",
                  presentation: "modal",
                  animation: "slide_from_bottom",
                  animationDuration: 300,
                }}
              />
              <Stack.Screen
                name="habitDetail"
                options={{
                  title: "Habit Detail",
                  animation: "ios_from_right",
                  animationDuration: 300,
                }}
              />
              <Stack.Screen
                name="relapseLog"
                options={{
                  title: "Log relapse",
                  presentation: "modal",
                  animation: "slide_from_bottom",
                  animationDuration: 300,
                }}
              />
            </Stack>
            <StatusBar style={scheme === "dark" ? "light" : "dark"} />
          </FocusProvider>
        </DetoxProvider>
      </ModeProvider>
      </HardModeProvider>
    </ThemeProvider>
  );
}
