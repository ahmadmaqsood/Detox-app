import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  getAntiLazinessEnabled,
  getHardMode,
  getInsightSignals,
  getMetrics,
} from "@/lib/database";
import { getNotificationsEnabled } from "@/lib/notificationPrefs";

let handlerInstalled = false;

export function ensureNotificationHandler(): void {
  if (handlerInstalled || Platform.OS === "web") return;
  handlerInstalled = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

function buildSmartBodies(
  s: Awaited<ReturnType<typeof getInsightSignals>>,
  riskScore: number,
  hardMode: boolean,
) {
  const prefix = hardMode ? "⚔️ HARD MODE — " : "";
  let midday =
    s.todayTotal > 0 && s.todayDone >= s.todayTotal
      ? "All habits done for today — strong discipline."
      : s.todayTotal > 0
        ? `${s.todayTotal - s.todayDone} habit(s) left today. One tap each.`
        : "Open Life Hub for your full system. Finish habits — no skipping.";

  if (riskScore >= (hardMode ? 55 : 65)) {
    midday = `${prefix}Risk ${riskScore}. ${midday}`;
  }

  const evening =
    riskScore >= (hardMode ? 52 : 70)
      ? `${prefix}High risk (${riskScore}) — night window. Log screen time. Do one habit before bed.`
      : "Night = higher urge window. Put the phone down early; log screen time if you slipped.";

  const morning =
    s.currentStreak > 0
      ? `${prefix}${s.currentStreak}-day streak — win the morning with one habit before noon.`
      : `${prefix}New day: one habit before noon. No negotiation.`;

  return { midday, evening, morning };
}

/**
 * Clears scheduled local notifications and schedules the next batch using current data
 * (time-of-day copy, risk, inactivity). Call on app launch and when notification prefs change.
 * No-op on web.
 */
export async function rescheduleSmartNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  ensureNotificationHandler();

  const enabled = await getNotificationsEnabled();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("detox-default", {
      name: "Detox reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#4ADE80",
    });
  }

  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const [signals, metrics, hardMode, antiLazy] = await Promise.all([
    getInsightSignals(),
    getMetrics(),
    getHardMode(),
    getAntiLazinessEnabled(),
  ]);

  const riskScore = metrics?.riskScore ?? 0;
  const { midday, evening, morning } = buildSmartBodies(
    signals,
    riskScore,
    hardMode,
  );

  const slots: {
    hour: number;
    minute: number;
    title: string;
    body: string;
  }[] = [
    { hour: 9, minute: 30, title: "Detox — morning", body: morning },
    { hour: 14, minute: 0, title: "Detox — check-in", body: midday },
    { hour: 21, minute: 0, title: "Detox — evening", body: evening },
  ];

  const channel = Platform.OS === "android" ? "detox-default" : undefined;

  for (const slot of slots) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: slot.title,
        body: slot.body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: slot.hour,
        minute: slot.minute,
        channelId: channel,
      },
    });
  }

  if (antiLazy) {
    const moveSlots = [
      {
        hour: 12,
        minute: 30,
        title: "Stand up now",
        body: "Anti-laziness: 2-min walk, stretch, or water. Move before you scroll.",
      },
      {
        hour: 16,
        minute: 0,
        title: "Movement break",
        body: "You've been still too long. Walk one room or 20 squats.",
      },
    ];
    for (const slot of moveSlots) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: slot.title,
          body: slot.body,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: slot.hour,
          minute: slot.minute,
          channelId: channel,
        },
      });
    }
  }
}
