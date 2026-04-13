export type Mode = 'home' | 'hostel';

export type LifeArea = 'spiritual' | 'physical' | 'mental' | 'work';

export type TimeBlockCategory = 'morning_routine' | 'work_block' | 'night_routine';

export interface HabitIcon {
  ios: string;
  android: string;
  web: string;
}

/** Catalog row for achievements (Firestore `achievement_defs` + UI). */
export type AchievementUnlockType = 'streak' | 'detox' | 'consistency' | 'special' | 'phase';

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  icon: HabitIcon;
  type: AchievementUnlockType;
}

export interface Habit {
  id: number;
  name: string;
  icon: string;       // JSON-encoded HabitIcon
  color: string;
  mode: Mode;
  lifeArea: LifeArea;
  targetPerDay: number;
  /** Lower sorts first; used for Home daily order. */
  sortOrder: number;
  createdAt: string;
}

export function parseHabitIcon(raw: string): HabitIcon {
  try {
    return JSON.parse(raw);
  } catch {
    return { ios: 'star.fill', android: 'star', web: 'star' };
  }
}

export interface Entry {
  id: number;
  habitId: number;
  date: string;
  completed: number; // 0 | 1 (SQLite has no boolean)
}

export interface Metrics {
  date: string;
  screenTime: number;
  riskScore: number;
  relapse: number; // 0 | 1
  /** Minutes slept (logged on Body screen). */
  sleepMinutes: number;
  /** Step count for the day (manual log). */
  steps: number;
}

export interface ModeRow {
  currentMode: Mode;
}

export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

export type ChallengeCategory =
  | 'discipline'
  | 'physical'
  | 'mental'
  | 'spiritual'
  | 'detox'
  | 'streak'
  | 'consistency'
  | 'special';

export interface Challenge {
  id: number;
  /** Stable id from catalog (e.g. streak_7). */
  defId?: string;
  name: string;
  description: string;
  duration: number;
  progress: number;
  startedAt: string | null;
  completedAt: string | null;
  category: ChallengeCategory;
  /** Short rule text shown on the card (e.g. “No social apps”). */
  rules: string;
  difficulty?: ChallengeDifficulty;
  xp?: number;
}

/** One finished challenge run (persisted; not removed on template reset). */
export interface ChallengeCompletionRecord {
  id: number;
  sourceChallengeId: number | null;
  name: string;
  duration: number;
  completedAt: string;
}

/** Lifetime aggregates; survives per-challenge reset. */
export interface ChallengeStats {
  totalCompleted: number;
  totalDaysCompleted: number;
}

export type SpiritualCadence = 'daily' | 'weekly';

export interface SpiritualChallengeDef {
  id: number;
  slug: string;
  title: string;
  description: string;
  cadence: SpiritualCadence;
  sortOrder: number;
}

/** Spiritual tracker row with today’s completion and streak. */
export interface SpiritualChallengeDashboard extends SpiritualChallengeDef {
  completedToday: boolean;
  /** Consecutive days (daily) or consecutive full ISO weeks (weekly). */
  streak: number;
  /** Distinct days completed in the current ISO week (Mon–Sun); weekly cadence only. */
  weekDaysComplete: number;
}

export type MealQuality = 'healthy' | 'junk';

export interface DietMeal {
  id: number;
  date: string;
  slot: string;
  quality: MealQuality;
  overeating: number; // 0 | 1
  /** Hour of day (0–23) when the meal was eaten — used for late-eating insights. */
  hour: number;
}

export interface DietRules {
  noLateEating: boolean;
  /** Meals at or after this hour count as “late” (default 21). */
  lateHour: number;
  lightDinner: boolean;
  noJunkWeekdays: boolean;
}

export interface BodyWeightEntry {
  date: string;
  kg: number;
}

export interface ExerciseEntry {
  id: number;
  date: string;
  type: string;
  durationMinutes: number;
}

export interface UrgeLog {
  id: number;
  loggedAt: string;
  intensity: number;
  triggerTag: string;
  note: string;
}

export interface DailyReset {
  date: string;
  morningPlan: string;
  nightReflection: string;
  morningSavedAt: string | null;
  nightSavedAt: string | null;
}

export interface Intervention {
  id: number;
  date: string;
  action: string;
  completed: number; // 0 | 1
}

export type ChatSender = 'user' | 'ai';

export interface ChatMessage {
  id: string;
  text: string;
  sender: ChatSender;
  timestamp: number;
}

export interface RelapseEvent {
  id: number;
  occurredAt: string;
  triggerTag: string;
  note: string;
  hourOfDay: number;
}

export interface TimeBlock {
  id: number;
  category: TimeBlockCategory;
  label: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
  active: number;
}

export interface AchievementUnlockRow {
  achievementId: string;
  unlockedAt: string;
}
