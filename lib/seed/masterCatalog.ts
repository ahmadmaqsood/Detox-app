import type { HabitIcon } from "@/lib/types";

export type SeedChallengeCategory =
  | "streak"
  | "detox"
  | "mental"
  | "physical"
  | "discipline"
  | "consistency"
  | "special";

export type SeedAchievementType =
  | "streak"
  | "detox"
  | "consistency"
  | "special"
  | "phase";

export interface MasterAchievementSeed {
  id: string;
  type: SeedAchievementType;
  title: string;
  description: string;
  icon: HabitIcon;
}

export interface MasterChallengeSeed {
  id: number;
  defId: string;
  name: string;
  description: string;
  duration: number;
  category: SeedChallengeCategory;
  rules: string;
  difficulty: "easy" | "medium" | "hard";
  xp: number;
}

function ic(ios: string, android: string, web: string): HabitIcon {
  return { ios, android, web };
}

function tierForDuration(duration: number): { difficulty: "easy" | "medium" | "hard"; xp: number } {
  if (duration <= 7) return { difficulty: "easy", xp: 25 };
  if (duration <= 30) return { difficulty: "medium", xp: 50 };
  return { difficulty: "hard", xp: 100 };
}

function achTypeForCategory(cat: SeedChallengeCategory): SeedAchievementType {
  if (cat === "streak") return "streak";
  if (cat === "detox") return "detox";
  if (cat === "consistency") return "consistency";
  if (cat === "mental" || cat === "physical") return "phase";
  return "special";
}

/** Single source used by the Admin seed script and kept in repo (not bundled for UI). */
export const MASTER_ACHIEVEMENTS: MasterAchievementSeed[] = [
  // STREAK
  { id: "streak_1", type: "streak", title: "Day One", description: "Start your journey (1 day)", icon: ic("flame", "whatshot", "whatshot") },
  { id: "streak_3", type: "streak", title: "Spark", description: "3-day streak", icon: ic("flame", "local_fire_department", "local_fire_department") },
  { id: "streak_5", type: "streak", title: "Warming Up", description: "5-day streak", icon: ic("flame.fill", "whatshot", "whatshot") },
  { id: "streak_7", type: "streak", title: "Week Strong", description: "7-day streak", icon: ic("bolt.fill", "flash_on", "flash_on") },
  { id: "streak_10", type: "streak", title: "Double Digits", description: "10-day streak", icon: ic("star.fill", "grade", "grade") },
  { id: "streak_14", type: "streak", title: "2 Weeks Lock", description: "14-day streak", icon: ic("lock.fill", "lock", "lock") },
  { id: "streak_21", type: "streak", title: "Habit Formed", description: "21-day streak", icon: ic("checkmark.circle", "task_alt", "task_alt") },
  { id: "streak_30", type: "streak", title: "1 Month Strong", description: "30-day streak", icon: ic("calendar", "calendar_month", "calendar_month") },
  { id: "streak_45", type: "streak", title: "Locked In", description: "45-day streak", icon: ic("shield.fill", "security", "security") },
  { id: "streak_60", type: "streak", title: "Unbreakable", description: "60-day streak", icon: ic("flame.circle.fill", "local_fire_department", "local_fire_department") },
  { id: "streak_90", type: "streak", title: "Monk Mode", description: "90-day streak", icon: ic("brain.head.profile", "psychology", "psychology") },
  { id: "streak_120", type: "streak", title: "Warrior", description: "120-day streak", icon: ic("shield.lefthalf.fill", "security", "security") },
  { id: "streak_150", type: "streak", title: "Legend", description: "150-day streak", icon: ic("crown.fill", "workspace_premium", "workspace_premium") },
  { id: "streak_180", type: "streak", title: "Reborn", description: "180-day streak", icon: ic("sun.max.fill", "wb_sunny", "wb_sunny") },
  // DETOX
  { id: "detox_1", type: "detox", title: "Clean Start", description: "1 day clean", icon: ic("sparkles", "auto_awesome", "auto_awesome") },
  { id: "detox_3", type: "detox", title: "Resisting", description: "3 days clean", icon: ic("shield", "shield", "shield") },
  { id: "detox_7", type: "detox", title: "Detox Week", description: "7 days clean", icon: ic("shield.fill", "health_and_safety", "health_and_safety") },
  { id: "detox_10", type: "detox", title: "Control Rising", description: "10 days clean", icon: ic("hand.raised", "pan_tool", "pan_tool") },
  { id: "detox_14", type: "detox", title: "Clarity", description: "14 days clean", icon: ic("eye.fill", "visibility", "visibility") },
  { id: "detox_21", type: "detox", title: "Rewired", description: "21 days clean", icon: ic("brain", "psychology_alt", "psychology_alt") },
  { id: "detox_30", type: "detox", title: "Clean Month", description: "30 days clean", icon: ic("sparkles", "auto_awesome", "auto_awesome") },
  { id: "detox_45", type: "detox", title: "Inner Power", description: "45 days clean", icon: ic("bolt.fill", "flash_on", "flash_on") },
  { id: "detox_60", type: "detox", title: "Self Control", description: "60 days clean", icon: ic("hand.raised.fill", "pan_tool", "pan_tool") },
  { id: "detox_90", type: "detox", title: "Freedom Mind", description: "90 days clean", icon: ic("lock.shield.fill", "security", "security") },
  { id: "detox_120", type: "detox", title: "Mastery", description: "120 days clean", icon: ic("star.fill", "grade", "grade") },
  { id: "detox_180", type: "detox", title: "Freedom", description: "180 days clean", icon: ic("flag.fill", "emoji_events", "emoji_events") },
  // MENTAL
  { id: "mental_3", type: "phase", title: "Clear Mind", description: "3 days focused thinking", icon: ic("brain", "psychology", "psychology") },
  { id: "mental_7", type: "phase", title: "Focused", description: "7 days distraction free", icon: ic("lightbulb", "emoji_objects", "emoji_objects") },
  { id: "mental_14", type: "phase", title: "Deep Thinker", description: "14 days mental clarity", icon: ic("brain.head.profile", "psychology_alt", "psychology_alt") },
  { id: "mental_30", type: "phase", title: "Sharp Mind", description: "30 days clarity", icon: ic("sparkles", "auto_awesome", "auto_awesome") },
  // PHYSICAL
  { id: "physical_3", type: "phase", title: "Active Start", description: "3 days movement", icon: ic("figure.walk", "directions_walk", "directions_walk") },
  { id: "physical_7", type: "phase", title: "Getting Strong", description: "7 days active", icon: ic("figure.run", "directions_run", "directions_run") },
  { id: "physical_14", type: "phase", title: "Fitness Flow", description: "14 days active", icon: ic("heart.fill", "favorite", "favorite") },
  { id: "physical_30", type: "phase", title: "Fit Mode", description: "30 days active", icon: ic("bolt.heart.fill", "favorite", "favorite") },
  // DISCIPLINE
  { id: "discipline_3", type: "special", title: "Self Control", description: "3 days discipline", icon: ic("lock", "lock", "lock") },
  { id: "discipline_7", type: "special", title: "Disciplined", description: "7 days discipline", icon: ic("shield", "security", "security") },
  { id: "discipline_14", type: "special", title: "No Excuses", description: "14 days discipline", icon: ic("checkmark.seal", "verified", "verified") },
  { id: "discipline_30", type: "special", title: "Iron Discipline", description: "30 days discipline", icon: ic("crown.fill", "workspace_premium", "workspace_premium") },
  // CONSISTENCY
  { id: "consistency_3", type: "consistency", title: "Getting There", description: "3 days consistency", icon: ic("chart.line.uptrend.xyaxis", "trending_up", "trending_up") },
  { id: "consistency_7", type: "consistency", title: "Stable", description: "7 days consistency", icon: ic("chart.bar.fill", "bar_chart", "bar_chart") },
  { id: "consistency_14", type: "consistency", title: "Consistent", description: "14 days consistency", icon: ic("chart.xyaxis.line", "timeline", "timeline") },
  { id: "consistency_30", type: "consistency", title: "Unstoppable", description: "30 days consistency", icon: ic("chart.line.uptrend.xyaxis", "trending_up", "trending_up") },
  // SPECIAL
  { id: "urge_1", type: "special", title: "First Control", description: "Resist 1 urge", icon: ic("hand.thumbsup", "thumb_up", "thumb_up") },
  { id: "urge_5", type: "special", title: "Strong Mind", description: "Resist 5 urges", icon: ic("hand.thumbsup.fill", "thumb_up", "thumb_up") },
  { id: "night_3", type: "special", title: "Night Control", description: "3 nights clean", icon: ic("moon", "nightlight", "nightlight") },
  { id: "night_7", type: "special", title: "Night Guardian", description: "7 nights clean", icon: ic("moon.stars.fill", "nightlight", "nightlight") },
  { id: "morning_7", type: "special", title: "Early Riser", description: "7 days early wake", icon: ic("sunrise.fill", "wb_twilight", "wb_twilight") },
  { id: "perfect_day", type: "special", title: "Perfect Day", description: "All habits done", icon: ic("star.fill", "grade", "grade") },
  { id: "perfect_week", type: "special", title: "Perfect Week", description: "7 perfect days", icon: ic("calendar", "calendar_month", "calendar_month") },
];

function durationForDefId(defId: string): number {
  const m = /^([a-z]+)_(\d+)$/.exec(defId);
  if (m) return Math.max(1, parseInt(m[2], 10));
  if (defId === "perfect_day") return 1;
  if (defId === "perfect_week") return 7;
  return 7;
}

function categoryForAchievement(a: MasterAchievementSeed): SeedChallengeCategory {
  const t = a.type;
  if (t === "streak") return "streak";
  if (t === "detox") return "detox";
  if (t === "consistency") return "consistency";
  if (t === "phase") {
    if (a.id.startsWith("mental_")) return "mental";
    if (a.id.startsWith("physical_")) return "physical";
  }
  if (a.id.startsWith("discipline_")) return "discipline";
  return "special";
}

/** Parallel challenge rows (same order as achievements). */
export const MASTER_CHALLENGES: MasterChallengeSeed[] = MASTER_ACHIEVEMENTS.map((a, i) => {
  const category = categoryForAchievement(a);
  const duration = durationForDefId(a.id);
  const { difficulty, xp } = tierForDuration(duration);
  return {
    id: i + 1,
    defId: a.id,
    name: a.title,
    description: a.description,
    duration,
    category,
    rules: a.description,
    difficulty,
    xp,
  };
});
