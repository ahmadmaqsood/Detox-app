import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { todayISO } from "@/lib/dateUtils";
import { saveMetrics } from "./firestoreDatabase";

const WATER_STORAGE_KEY_PREFIX = "detox_water_glasses_";
const WATER_REMINDER_KEY = "detox_water_hourly_reminder_enabled";
const WATER_NOTIFICATION_TAG = "detox_hourly_water_reminder";

export const GLASS_ML = 250;
export const DEFAULT_GLASS_TARGET = 8; // 2,000 ml

/** Get today's logged water glasses */
export async function getTodayWaterGlasses(date?: string): Promise<number> {
  const day = date ?? todayISO();
  try {
    const raw = await AsyncStorage.getItem(`${WATER_STORAGE_KEY_PREFIX}${day}`);
    if (raw != null) {
      return parseInt(raw, 10) || 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

/** Set water glasses for today and sync to Firestore metrics */
export async function setTodayWaterGlasses(count: number, date?: string): Promise<number> {
  const day = date ?? todayISO();
  const sanitized = Math.max(0, count);
  try {
    await AsyncStorage.setItem(`${WATER_STORAGE_KEY_PREFIX}${day}`, String(sanitized));
    await saveMetrics({ waterGlasses: sanitized, date: day }).catch(() => {});
  } catch (err) {
    console.warn("Failed to save water glasses:", err);
  }
  return sanitized;
}

/** Increment water glasses by 1 */
export async function addWaterGlass(date?: string): Promise<number> {
  const current = await getTodayWaterGlasses(date);
  return await setTodayWaterGlasses(current + 1, date);
}

/** Decrement water glasses by 1 */
export async function removeWaterGlass(date?: string): Promise<number> {
  const current = await getTodayWaterGlasses(date);
  return await setTodayWaterGlasses(Math.max(0, current - 1), date);
}

/** Check if hourly water reminder is enabled */
export async function getWaterHourlyReminderEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(WATER_REMINDER_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

/** Schedule hourly water reminders (between 9 AM and 9 PM) */
export async function setWaterHourlyReminderEnabled(enabled: boolean): Promise<boolean> {
  try {
    await AsyncStorage.setItem(WATER_REMINDER_KEY, enabled ? "true" : "false");
  } catch {}

  if (Platform.OS === "web") return enabled;

  try {
    // 1. Cancel existing reminders
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if (notif.content.data?.tag === WATER_NOTIFICATION_TAG) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }

    if (!enabled) return false;

    // 2. Request permission if needed
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      if (req.status !== "granted") return false;
    }

    // 3. Schedule reminders every hour from 9:00 to 21:00 (9 AM to 9 PM)
    for (let hour = 9; hour <= 21; hour += 1) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "💧 Time to Hydrate!",
          body: "Drink a fresh glass of water to keep your body and brain energized.",
          sound: true,
          priority: Notifications.AndroidNotificationPriority.DEFAULT,
          data: { tag: WATER_NOTIFICATION_TAG, hour },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute: 0,
        },
      });
    }

    return true;
  } catch (err) {
    console.warn("Failed to configure hourly water reminders:", err);
    return false;
  }
}
