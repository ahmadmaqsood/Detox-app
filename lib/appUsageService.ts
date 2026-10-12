import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Alert, Linking, Platform } from "react-native";
import { todayISO } from "@/lib/dateUtils";

export interface AppTimerConfig {
  packageName: string;
  appName: string;
  iconName: string;
  limitMinutes: number;
  usedMinutesToday: number;
  enabled: boolean;
  lastNotifiedAt?: string | null;
}

const STORAGE_KEY = "detox_app_timers_config";

export const DEFAULT_TARGET_APPS: AppTimerConfig[] = [
  {
    packageName: "com.android.chrome",
    appName: "Google Chrome",
    iconName: "globe",
    limitMinutes: 30,
    usedMinutesToday: 0,
    enabled: true,
  },
  {
    packageName: "com.whatsapp",
    appName: "WhatsApp",
    iconName: "chatbubble-ellipses",
    limitMinutes: 45,
    usedMinutesToday: 0,
    enabled: true,
  },
  {
    packageName: "com.google.android.youtube",
    appName: "YouTube",
    iconName: "logo-youtube",
    limitMinutes: 45,
    usedMinutesToday: 0,
    enabled: true,
  },
  {
    packageName: "com.instagram.android",
    appName: "Instagram",
    iconName: "logo-instagram",
    limitMinutes: 30,
    usedMinutesToday: 0,
    enabled: true,
  },
  {
    packageName: "com.zhiliaoapp.musically",
    appName: "TikTok",
    iconName: "musical-notes",
    limitMinutes: 20,
    usedMinutesToday: 0,
    enabled: false,
  },
  {
    packageName: "com.facebook.katana",
    appName: "Facebook",
    iconName: "logo-facebook",
    limitMinutes: 30,
    usedMinutesToday: 0,
    enabled: false,
  },
  {
    packageName: "com.netflix.mediaclient",
    appName: "Netflix",
    iconName: "tv",
    limitMinutes: 60,
    usedMinutesToday: 0,
    enabled: false,
  },
];

/** Open Android Settings to grant PACKAGE_USAGE_STATS permission */
export async function openAndroidUsageAccessSettings(): Promise<void> {
  if (Platform.OS === "android") {
    try {
      // Intent to open Android Special App Access -> Usage Access settings
      await Linking.sendIntent("android.settings.USAGE_ACCESS_SETTINGS");
      return;
    } catch {
      // Fallback to general settings
      try {
        await Linking.openSettings();
        return;
      } catch (err) {
        console.warn("Could not open settings:", err);
      }
    }
  }
  Alert.alert(
    "Android Settings",
    "Open Phone Settings > Apps > Special App Access > Usage Access, and enable access for Detox App.",
  );
}

/** Get configured app timers from storage */
export async function getAppTimers(): Promise<AppTimerConfig[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TARGET_APPS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_TARGET_APPS;
  } catch {
    return DEFAULT_TARGET_APPS;
  }
}

/** Save updated app timers configuration */
export async function saveAppTimers(timers: AppTimerConfig[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
  } catch (err) {
    console.error("Failed to save app timers:", err);
  }
}

/** Update a single app timer limit or toggle state */
export async function updateAppTimer(
  packageName: string,
  updates: Partial<AppTimerConfig>,
): Promise<AppTimerConfig[]> {
  const current = await getAppTimers();
  const next = current.map((t) =>
    t.packageName === packageName ? { ...t, ...updates } : t,
  );
  await saveAppTimers(next);
  return next;
}

/** Add a custom app to the tracking list */
export async function addCustomAppTimer(
  appName: string,
  limitMinutes: number = 30,
): Promise<AppTimerConfig[]> {
  const current = await getAppTimers();
  const pkg = `custom.${appName.toLowerCase().replace(/\s+/g, ".")}`;
  const exists = current.some((c) => c.packageName === pkg || c.appName.toLowerCase() === appName.toLowerCase());
  if (exists) return current;

  const newApp: AppTimerConfig = {
    packageName: pkg,
    appName,
    iconName: "apps",
    limitMinutes,
    usedMinutesToday: 0,
    enabled: true,
  };
  const next = [...current, newApp];
  await saveAppTimers(next);
  return next;
}

/** Fire an instant notification alert when an app exceeds its limit */
export async function triggerAppLimitExceededNotification(
  appName: string,
  limitMinutes: number,
  usedMinutes: number,
): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      await Notifications.requestPermissionsAsync();
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🚨 Time's Up: Close ${appName}!`,
        body: `You have spent ${usedMinutes}m on ${appName} (Limit: ${limitMinutes}m). Close it now to save your mental health!`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { type: "app_limit_exceeded", appName },
      },
      trigger: null, // deliver immediately
    });
  } catch (err) {
    console.warn("Failed to trigger app limit notification:", err);
  }
}

/** Schedule an active session timer for an app (e.g. 30m Chrome countdown) */
export async function startAppSessionTimer(
  appName: string,
  durationMinutes: number,
): Promise<string> {
  if (Platform.OS === "web") return "web_timer";

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      await Notifications.requestPermissionsAsync();
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ ${appName} Session Ended!`,
        body: `Your ${durationMinutes}-minute session for ${appName} has finished. Please close the app and step away.`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(10, durationMinutes * 60),
      },
    });

    return identifier;
  } catch (err) {
    console.warn("Failed to schedule session timer:", err);
    return "";
  }
}
