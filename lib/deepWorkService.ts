import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { todayISO } from "@/lib/dateUtils";
import {
  saveDeepWorkSession as saveFsDeepWorkSession,
  getDeepWorkSessions as getFsDeepWorkSessions,
  getLastDeepWorkSession as getFsLastDeepWorkSession,
  getDeepWorkTasks as getFsDeepWorkTasks,
  addDeepWorkTask as addFsDeepWorkTask,
  toggleDeepWorkTask as toggleFsDeepWorkTask,
  deleteDeepWorkTask as deleteFsDeepWorkTask,
  getDeepWorkWeeklySummary as getFsDeepWorkWeeklySummary,
  getDeepWorkDailyTargetMinutes as getFsDeepWorkDailyTargetMinutes,
  setDeepWorkDailyTargetMinutes as setFsDeepWorkDailyTargetMinutes,
} from "@/lib/firestoreDatabase";
import {
  saveDeepWorkSession as saveSqliteDeepWorkSession,
  getDeepWorkSessions as getSqliteDeepWorkSessions,
  getDeepWorkTasks as getSqliteDeepWorkTasks,
  addDeepWorkTask as addSqliteDeepWorkTask,
  toggleDeepWorkTask as toggleSqliteDeepWorkTask,
  deleteDeepWorkTask as deleteSqliteDeepWorkTask,
  getDeepWorkWeeklySummary as getSqliteDeepWorkWeeklySummary,
  getDeepWorkDailyTargetMinutes as getSqliteDeepWorkDailyTargetMinutes,
  setDeepWorkDailyTargetMinutes as setSqliteDeepWorkDailyTargetMinutes,
} from "@/lib/database";
import type {
  DeepWorkCategory,
  DeepWorkSession,
  DeepWorkTask,
  DeepWorkTaskType,
  DeepWorkAbandonReason,
} from "@/lib/types";

export const FOCUS_PRESETS = [25, 50, 90] as const;
export const DURATION_GRID = [5, 10, 15, 20, 25, 30, 45, 50, 90] as const;

export interface ActiveDeepWorkSession {
  taskId: string | number | null;
  taskTitle: string;
  category: DeepWorkCategory;
  durationMinutes: number;
  startedAtTimestamp: number;
  isPaused: boolean;
  remainingSeconds: number;
  interruptionCount: number;
}

const ACTIVE_SESSION_STORAGE_KEY = "@detox/deep_work_active_session_v1";

export const CATEGORY_INFO: Record<
  DeepWorkCategory,
  { label: string; iconIos: string; iconMaterial: string; color: string }
> = {
  programming: {
    label: "Programming",
    iconIos: "chevron.left.forwardslash.chevron.right",
    iconMaterial: "code",
    color: "#38BDF8",
  },
  learning: {
    label: "Learning",
    iconIos: "book.closed.fill",
    iconMaterial: "school",
    color: "#A78BFA",
  },
  reading: {
    label: "Reading",
    iconIos: "text.book.closed.fill",
    iconMaterial: "menu-book",
    color: "#34D399",
  },
  work: {
    label: "Work",
    iconIos: "briefcase.fill",
    iconMaterial: "work",
    color: "#F59E0B",
  },
  other: {
    label: "Other",
    iconIos: "sparkles",
    iconMaterial: "bolt",
    color: "#94A3B8",
  },
};

export const ABANDON_REASONS: {
  key: DeepWorkAbandonReason;
  label: string;
  emoji: string;
}[] = [
  { key: "distraction_urge", label: "Urge / Social Media", emoji: "📱" },
  { key: "phone_notification", label: "Phone Call / Alert", emoji: "🔔" },
  { key: "mental_fatigue", label: "Mental Fatigue / Boredom", emoji: "🥱" },
  { key: "external_interruption", label: "External Interruption", emoji: "👥" },
  { key: "other", label: "Other Reason", emoji: "⚡" },
];

/** Persist running timer so user never loses state across navigation */
export async function saveActiveSession(session: ActiveDeepWorkSession): Promise<void> {
  try {
    await AsyncStorage.setItem(
      ACTIVE_SESSION_STORAGE_KEY,
      JSON.stringify(session),
    );
  } catch {
    // ignore
  }
}

export async function getActiveSession(): Promise<ActiveDeepWorkSession | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function clearActiveSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Schedule completion notification */
export async function scheduleFocusCompleteNotification(
  taskTitle: string,
  durationMinutes: number,
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "🎯 Deep Work Complete!",
        body: `You crushed ${durationMinutes} minutes of focus on "${taskTitle}". Great job!`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, durationMinutes * 60),
      },
    });
    return id;
  } catch {
    return null;
  }
}

export async function cancelFocusNotification(notificationId: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // ignore
  }
}

// ─── Data Access Layer: Firestore Primary, SQLite Fallback ───────

export async function getDeepWorkTasks(date: string = todayISO()): Promise<DeepWorkTask[]> {
  try {
    const tasks = await getFsDeepWorkTasks(date);
    if (tasks && tasks.length > 0) return tasks;
  } catch (e) {
    console.warn("Firestore getDeepWorkTasks fallback to SQLite:", e);
  }
  try {
    return await getSqliteDeepWorkTasks(date);
  } catch {
    return [];
  }
}

export async function addDeepWorkTask(
  task: Omit<DeepWorkTask, "id" | "createdAt" | "completedMinutes" | "completed"> & {
    id?: string | number;
    completedMinutes?: number;
    completed?: number;
  },
): Promise<string | number> {
  // Save to SQLite for offline resilience
  try {
    addSqliteDeepWorkTask(task).catch(() => {});
  } catch {
    // ignore
  }

  // Primary: save to Firestore
  try {
    return await addFsDeepWorkTask(task);
  } catch (e) {
    console.warn("Firestore addDeepWorkTask failed, returning sqlite:", e);
    return await addSqliteDeepWorkTask(task);
  }
}

export async function toggleDeepWorkTask(
  id: string | number,
  completed: boolean,
): Promise<void> {
  try {
    if (typeof id === "number") {
      toggleSqliteDeepWorkTask(id, completed).catch(() => {});
    }
  } catch {
    // ignore
  }
  try {
    await toggleFsDeepWorkTask(id, completed);
  } catch (e) {
    console.warn("Firestore toggleDeepWorkTask failed:", e);
    if (typeof id === "number") {
      await toggleSqliteDeepWorkTask(id, completed);
    }
  }
}

export async function deleteDeepWorkTask(id: string | number): Promise<void> {
  try {
    if (typeof id === "number") {
      deleteSqliteDeepWorkTask(id).catch(() => {});
    }
  } catch {
    // ignore
  }
  try {
    await deleteFsDeepWorkTask(id);
  } catch (e) {
    console.warn("Firestore deleteDeepWorkTask failed:", e);
    if (typeof id === "number") {
      await deleteSqliteDeepWorkTask(id);
    }
  }
}

export async function saveDeepWorkSession(
  session: Omit<DeepWorkSession, "id">,
): Promise<string | number> {
  // Mirror to SQLite for offline persistence
  try {
    saveSqliteDeepWorkSession({
      ...session,
      taskId: typeof session.taskId === "number" ? session.taskId : null,
    }).catch(() => {});
  } catch {
    // ignore
  }

  // Primary: Save directly to Cloud Firestore
  try {
    const fsId = await saveFsDeepWorkSession(session);
    return fsId;
  } catch (e) {
    console.warn("Firestore saveDeepWorkSession failed, saving sqlite:", e);
    return await saveSqliteDeepWorkSession({
      ...session,
      taskId: typeof session.taskId === "number" ? session.taskId : null,
    });
  }
}

export async function getDeepWorkSessions(
  date?: string,
): Promise<DeepWorkSession[]> {
  try {
    const sessions = await getFsDeepWorkSessions(date);
    if (sessions && sessions.length > 0) return sessions;
  } catch (e) {
    console.warn("Firestore getDeepWorkSessions fallback to SQLite:", e);
  }
  try {
    return await getSqliteDeepWorkSessions(date);
  } catch {
    return [];
  }
}

export async function getLastDeepWorkSession(): Promise<DeepWorkSession | null> {
  try {
    const fsLast = await getFsLastDeepWorkSession();
    if (fsLast) return fsLast;
  } catch (e) {
    console.warn("Firestore getLastDeepWorkSession fallback:", e);
  }
  try {
    const recent = await getSqliteDeepWorkSessions(todayISO());
    return recent && recent.length > 0 ? recent[0] : null;
  } catch {
    return null;
  }
}

export async function getDeepWorkWeeklySummary(
  endDate: string = todayISO(),
): Promise<{ date: string; minutes: number }[]> {
  try {
    const weekly = await getFsDeepWorkWeeklySummary(endDate);
    const totalMinutes = weekly.reduce((acc, w) => acc + w.minutes, 0);
    if (totalMinutes > 0) return weekly;
  } catch (e) {
    console.warn("Firestore getDeepWorkWeeklySummary fallback to SQLite:", e);
  }
  try {
    return await getSqliteDeepWorkWeeklySummary(endDate);
  } catch {
    return [];
  }
}

export async function getDeepWorkDailyTargetMinutes(): Promise<number> {
  try {
    return await getFsDeepWorkDailyTargetMinutes();
  } catch (e) {
    console.warn("Firestore getDeepWorkDailyTargetMinutes fallback:", e);
    return await getSqliteDeepWorkDailyTargetMinutes();
  }
}

export async function setDeepWorkDailyTargetMinutes(min: number): Promise<void> {
  try {
    setSqliteDeepWorkDailyTargetMinutes(min).catch(() => {});
  } catch {
    // ignore
  }
  try {
    await setFsDeepWorkDailyTargetMinutes(min);
  } catch (e) {
    console.warn("Firestore setDeepWorkDailyTargetMinutes fallback:", e);
    await setSqliteDeepWorkDailyTargetMinutes(min);
  }
}

