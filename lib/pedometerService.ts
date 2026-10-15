import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pedometer } from "expo-sensors";
import { Platform } from "react-native";
import { todayISO } from "@/lib/dateUtils";
import { getMetrics, saveMetrics } from "./firestoreDatabase";

const STEPS_KEY_PREFIX = "detox_steps_daily_";
export const DEFAULT_STEP_GOAL = 10000;

export interface StepMetricsSummary {
  steps: number;
  goal: number;
  distanceKm: number;
  caloriesKcal: number;
  percentage: number;
  intensity: "Normal" | "Active" | "Intense";
}

/** Check if the device has a physical pedometer sensor available */
export async function isPedometerAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return await Pedometer.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Get today's recorded steps */
export async function getTodaySteps(date?: string): Promise<number> {
  const day = date ?? todayISO();
  try {
    const raw = await AsyncStorage.getItem(`${STEPS_KEY_PREFIX}${day}`);
    if (raw != null) {
      return parseInt(raw, 10) || 0;
    }
    const m = await getMetrics(day).catch(() => null);
    if (m?.steps !== undefined && m.steps !== null) {
      const v = Number(m.steps);
      await AsyncStorage.setItem(`${STEPS_KEY_PREFIX}${day}`, String(v)).catch(() => {});
      return v;
    }
  } catch {}
  return 0;
}

/** Save steps count for a specific date and sync to Firestore */
export async function saveDailySteps(steps: number, date?: string): Promise<void> {
  const day = date ?? todayISO();
  const sanitized = Math.max(0, steps);
  try {
    await AsyncStorage.setItem(`${STEPS_KEY_PREFIX}${day}`, String(sanitized));
    await saveMetrics({ steps: sanitized, date: day }).catch(() => {});
  } catch (err) {
    console.warn("Failed to persist steps:", err);
  }
}

/** Query hardware sensor for steps taken in the 24-hour window of a specific date (default: today) */
export async function syncPedometerSensorSteps(date?: string): Promise<number | null> {
  if (Platform.OS === "web") return null;
  const day = date ?? todayISO();
  const isToday = day === todayISO();

  try {
    const available = await Pedometer.isAvailableAsync();
    if (!available) return null;

    const startOfDay = new Date(day + "T00:00:00");
    const endOfDay = isToday ? new Date() : new Date(day + "T23:59:59");

    const result = await Pedometer.getStepCountAsync(startOfDay, endOfDay);
    if (result && typeof result.steps === "number") {
      await saveDailySteps(result.steps, day);
      return result.steps;
    }
  } catch (err) {
    console.log("Pedometer hardware query not available on this device:", err);
  }
  return null;
}

/** Subscribe to live step updates while walking (returns incremental step deltas) */
export function subscribeLivePedometer(
  onStepIncrement: (delta: number) => void,
): { remove: () => void } {
  if (Platform.OS === "web") {
    return { remove: () => {} };
  }

  try {
    let lastReportedSteps = 0;
    const subscription = Pedometer.watchStepCount((result) => {
      if (result && typeof result.steps === "number") {
        const delta = result.steps - lastReportedSteps;
        if (delta > 0) {
          lastReportedSteps = result.steps;
          onStepIncrement(delta);
        }
      }
    });
    return subscription;
  } catch {
    return { remove: () => {} };
  }
}

/** Calculate distance, calories, and intensity summary from step count */
export function computeStepMetrics(
  steps: number,
  goal: number = DEFAULT_STEP_GOAL,
): StepMetricsSummary {
  const distanceKm = parseFloat((steps * 0.000762).toFixed(2));
  const caloriesKcal = Math.round(steps * 0.04);
  const percentage = goal > 0 ? Math.min(100, Math.round((steps / goal) * 100)) : 0;

  let intensity: "Normal" | "Active" | "Intense" = "Normal";
  if (steps >= 8000) {
    intensity = "Intense";
  } else if (steps >= 3500) {
    intensity = "Active";
  }

  return {
    steps,
    goal,
    distanceKm,
    caloriesKcal,
    percentage,
    intensity,
  };
}
