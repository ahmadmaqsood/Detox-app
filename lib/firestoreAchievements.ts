import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  getDetoxStreak,
  getEntriesCompletionSummary,
  getGlobalLongestStreak,
  getGlobalStreak,
  getTotalChallengesCompleted,
  getTotalHabitsCount,
  getUnlockedAchievementIds,
  hasCompletedRecoveryPlanOnce,
  unlockAchievement,
} from "@/lib/firestoreDatabase";
import type { AchievementDefinition, AchievementUnlockType } from "@/lib/types";

export type AchievementType = AchievementUnlockType;
export type AchievementDefV2 = AchievementDefinition;

type Stats = {
  current: number;
  longest: number;
  rate: number;
  total: number;
  detoxDays: number;
  habitsCount: number;
  challengesCompleted: number;
  hasUrgeWin: boolean;
};

async function loadStats(): Promise<Stats> {
  const [current, longest, summary, detoxDays, habitsCount, challengesCompleted, hasUrgeWin] =
    await Promise.all([
      getGlobalStreak(),
      getGlobalLongestStreak(),
      getEntriesCompletionSummary(),
      getDetoxStreak(),
      getTotalHabitsCount(),
      getTotalChallengesCompleted(),
      hasCompletedRecoveryPlanOnce(),
    ]);
  return {
    current,
    longest,
    rate: summary.rate,
    total: summary.total,
    detoxDays,
    habitsCount,
    challengesCompleted,
    hasUrgeWin,
  };
}

/** Unlock predicates keyed by achievement id (catalog ids must match Firestore `achievement_defs`). */
const RULES: Record<string, (s: Stats) => boolean> = {
  // streak
  streak_1: (s) => s.longest >= 1 || s.current >= 1,
  streak_2: (s) => s.longest >= 2 || s.current >= 2,
  streak_3: (s) => s.longest >= 3 || s.current >= 3,
  streak_4: (s) => s.longest >= 4 || s.current >= 4,
  streak_5: (s) => s.longest >= 5 || s.current >= 5,
  streak_7: (s) => s.longest >= 7,
  streak_10: (s) => s.longest >= 10,
  streak_14: (s) => s.longest >= 14,
  streak_21: (s) => s.longest >= 21,
  streak_28: (s) => s.longest >= 28,
  streak_30: (s) => s.longest >= 30,
  streak_45: (s) => s.longest >= 45,
  streak_60: (s) => s.longest >= 60,
  streak_90: (s) => s.longest >= 90,
  streak_120: (s) => s.longest >= 120,
  streak_150: (s) => s.longest >= 150,
  streak_180: (s) => s.longest >= 180,

  // detox
  detox_1: (s) => s.detoxDays >= 1,
  detox_2: (s) => s.detoxDays >= 2,
  detox_3: (s) => s.detoxDays >= 3,
  detox_5: (s) => s.detoxDays >= 5,
  detox_7: (s) => s.detoxDays >= 7,
  detox_10: (s) => s.detoxDays >= 10,
  detox_14: (s) => s.detoxDays >= 14,
  detox_21: (s) => s.detoxDays >= 21,
  detox_30: (s) => s.detoxDays >= 30,
  detox_45: (s) => s.detoxDays >= 45,
  detox_60: (s) => s.detoxDays >= 60,
  detox_90: (s) => s.detoxDays >= 90,
  detox_120: (s) => s.detoxDays >= 120,
  detox_180: (s) => s.detoxDays >= 180,

  // consistency (volume + rate)
  consistency_3: (s) => s.total >= 3 && s.rate >= 35,
  consistency_7: (s) => s.total >= 7 && s.rate >= 40,
  consistency_14: (s) => s.total >= 14 && s.rate >= 45,
  consistency_30: (s) => s.total >= 30 && s.rate >= 50,
  consistency_50: (s) => s.total >= 20 && s.rate >= 50,
  consistency_60_30: (s) => s.total >= 30 && s.rate >= 60,
  consistency_65_40: (s) => s.total >= 40 && s.rate >= 65,
  consistency_70: (s) => s.total >= 40 && s.rate >= 70,
  consistency_70_60: (s) => s.total >= 60 && s.rate >= 70,
  consistency_75_80: (s) => s.total >= 80 && s.rate >= 75,
  consistency_80: (s) => s.total >= 60 && s.rate >= 80,
  consistency_85_120: (s) => s.total >= 120 && s.rate >= 85,
  consistency_90: (s) => s.total >= 100 && s.rate >= 90,

  // mental / physical / discipline — proxy on global streak until per-area stats exist
  mental_3: (s) => s.longest >= 3,
  mental_7: (s) => s.longest >= 7,
  mental_14: (s) => s.longest >= 14,
  mental_30: (s) => s.longest >= 30,
  physical_3: (s) => s.longest >= 3,
  physical_7: (s) => s.longest >= 7,
  physical_14: (s) => s.longest >= 14,
  physical_30: (s) => s.longest >= 30,
  discipline_3: (s) => s.longest >= 3,
  discipline_7: (s) => s.longest >= 7,
  discipline_14: (s) => s.longest >= 14,
  discipline_30: (s) => s.longest >= 30,

  // habits created
  habits_3: (s) => s.habitsCount >= 3,
  habits_5: (s) => s.habitsCount >= 5,
  habits_10: (s) => s.habitsCount >= 10,
  habits_15: (s) => s.habitsCount >= 15,
  habits_20: (s) => s.habitsCount >= 20,

  // urge control (first full plan)
  first_urge_control: (s) => s.hasUrgeWin,
  urge_plans_1: (s) => s.hasUrgeWin,
  urge_1: (s) => s.hasUrgeWin,
  urge_5: () => false,

  night_3: () => false,
  night_7: () => false,
  morning_7: () => false,
  perfect_day: () => false,
  perfect_week: () => false,

  // challenges
  challenges_1: (s) => s.challengesCompleted >= 1,
  challenges_2: (s) => s.challengesCompleted >= 2,
  challenges_3: (s) => s.challengesCompleted >= 3,
  challenges_5: (s) => s.challengesCompleted >= 5,
  challenges_10: (s) => s.challengesCompleted >= 10,

  // legacy phase_* ids if present in older catalogs
  phase_7: (s) => s.longest >= 7,
  phase_14: (s) => s.longest >= 14,
  phase_30: (s) => s.longest >= 30,
  phase_45: (s) => s.longest >= 45,
  phase_60: (s) => s.longest >= 60,
  phase_90: (s) => s.longest >= 90,
  phase_120: (s) => s.longest >= 120,
  phase_150: (s) => s.longest >= 150,
  phase_180: (s) => s.longest >= 180,
};

async function notify(def: AchievementDefV2) {
  if (Platform.OS === "web") return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Achievement unlocked",
        body: `${def.title} — ${def.description}`,
        sound: true,
      },
      trigger: null,
    });
  } catch {
    // ignore
  }
}

/** Unlock any newly earned achievements. Returns IDs just unlocked. */
export async function syncFirestoreAchievements(): Promise<string[]> {
  const { getAchievementDefinitions } = await import("@/lib/firestoreDatabase");
  const defs = await getAchievementDefinitions();
  if (defs.length === 0) return [];

  const stats = await loadStats();
  const unlocked = new Set(
    (await getUnlockedAchievementIds()).map((r) => r.achievementId),
  );
  const newly: string[] = [];

  for (const def of defs) {
    if (unlocked.has(def.id)) continue;
    const rule = RULES[def.id];
    if (rule?.(stats)) {
      await unlockAchievement(def.id, {
        title: def.title,
        description: def.description,
        icon: def.icon,
        type: def.type,
      });
      newly.push(def.id);
      notify(def).catch(() => {});
    }
  }
  return newly;
}
