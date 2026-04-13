import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { useEffect, useMemo, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import "react-native-gesture-handler";
import "react-native-reanimated";

import { resolveAuthNavigation } from "@/lib/authNavigation";
import {
  initDB,
  isOnboardingComplete,
  recordLastActiveNow,
  syncOnboardingFromLocalToFirestore,
} from "@/lib/firestoreDatabase";
import {
  ensureNotificationHandler,
  rescheduleSmartNotifications,
} from "@/lib/smartNotifications";
import { AppearanceProvider, useAppearance } from "@/store/AppearanceContext";
import { AuthProvider, useAuth } from "@/store/AuthContext";
import { DetoxProvider } from "@/store/DetoxContext";
import { FocusProvider } from "@/store/FocusContext";
import { HardModeProvider } from "@/store/HardModeContext";
import { ModeProvider } from "@/store/ModeContext";
import { colors } from "@/theme/colors";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  /** Load `app/index.tsx` first so `/` runs auth routing before opening the drawer. */
  initialRouteName: "index",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <AppearanceProvider>
      <AuthProvider>
        <RootLayoutNavInner />
      </AuthProvider>
    </AppearanceProvider>
  );
}

function RootLayoutNavInner() {
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();
  const { scheme } = useAppearance();
  const { user, ready: authReady } = useAuth();
  const t = scheme === "light" ? colors.light : colors.dark;
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!(__DEV__ && Constants.appOwnership === "expo")) return;
    const origError = console.error;
    console.error = (...args: any[]) => {
      const first = args[0];
      if (
        typeof first === "string" &&
        first.includes(
          "expo-notifications: Android Push notifications (remote notifications)",
        )
      ) {
        return;
      }
      return origError(...args);
    };
    return () => {
      console.error = origError;
    };
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;
    let cancelled = false;
    void (async () => {
      try {
        await syncOnboardingFromLocalToFirestore();
        await initDB();
      } catch (e) {
        if (!cancelled) console.warn("Post-login init", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

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
    if (!authReady) return;
    let cancelled = false;
    void (async () => {
      const onboardingDone = await isOnboardingComplete();
      if (cancelled) return;

      const next = resolveAuthNavigation({
        pathname: pathname ?? "/",
        segments: segments as string[],
        user,
        onboardingDone,
      });
      if (next.action === "replace") {
        router.replace(next.href);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, user, segments, pathname, router]);

  useEffect(() => {
    ensureNotificationHandler();
    if (!authReady || !user) return;
    void rescheduleSmartNotifications();
  }, [authReady, user]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      const cameToForeground =
        /inactive|background/.test(prev) && next === "active";

      if (next === "active") {
        // Only show onboarding when returning from background — not when navigating
        // onboarding → login (avoids sending users back to slide 1).
        if (
          cameToForeground &&
          !(pathname?.startsWith("/onboarding") ?? false)
        ) {
          router.replace("/onboarding");
        }
        if (user) {
          void recordLastActiveNow().catch(() => {});
        }
      }
    });
    return () => sub.remove();
  }, [pathname, router, user]);

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
                name="(auth)"
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
