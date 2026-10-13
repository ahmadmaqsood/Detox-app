export type Mode = 'home' | 'hostel';

export type LifeArea = 'spiritual' | 'physical' | 'mental' | 'work';

export type TimeBlockCategory = 'morning_routine' | 'work_block' | 'night_routine';

export interface HabitIcon {
  ios: string;
  android: string;
  web: string;
  library?: 'MaterialCommunityIcons' | 'AntDesign' | 'Ionicons' | 'MaterialIcons';
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
  /** True if this habit is an extra task activated during Detox Protocol */
  detoxOnly?: boolean;
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

export interface DailyHabitEntry {
  id: number;
  name: string;
  completed: boolean;
  time: string | null;
  detoxOnly?: boolean;
}

export interface DailyProgressEntry {
  date: string;
  mode: Mode;
  totalHabits: number;
  checkedHabits: number;
  leftHabits: number;
  completionPercentage: number;
  motivationalMessage: string;
  habits: DailyHabitEntry[];
  isDetoxDay?: boolean;
  updatedAt?: any;
}

export interface RecoveryActionEntry {
  action: string;
  actionName?: string;
  completed: boolean;
  timestamp: string;
}

export interface DailyInterventionDoc {
  date: string;
  totalActions: number;
  completedActions: number;
  leftActions: number;
  actions: RecoveryActionEntry[];
  updatedAt?: any;
}

export type EnergyLevel = 'low' | 'medium' | 'high';
export type MoodState = 'great' | 'balanced' | 'stressed' | 'low';

export interface Metrics {
  date: string;
  screenTime: number;
  riskScore: number;
  relapse: number; // 0 | 1
  /** Minutes slept (logged on Body screen). */
  sleepMinutes: number;
  /** Step count for the day. */
  steps: number;
  /** Water glasses consumed today (250ml each). */
  waterGlasses?: number;
  /** Height in centimeters for BMI. */
  heightCm?: number;
  /** Weight in kilograms. */
  weightKg?: number;
  /** Bedtime string, e.g. "23:00". */
  bedTime?: string;
  /** Wake time string, e.g. "06:30". */
  wakeTime?: string;
  /** Daily energy rating. */
  energyRating?: EnergyLevel;
  /** Daily mood rating. */
  moodRating?: MoodState;
  /** Minutes spent outdoors / in sunlight. */
  outdoorMinutes?: number;
  /** Minutes spent stretching. */
  stretchingMinutes?: number;
  /** Minutes of intentional workout / gym. */
  workoutMinutes?: number;
  /** Minutes of walking logged. */
  walkMinutes?: number;
  /** Minutes of deep work focus logged. */
  deepWorkMinutes?: number;
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

export type ChallengeStatus = 'locked' | 'active' | 'completed';

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
  status?: ChallengeStatus;
}

/** An item in the completedChallenges array inside users/{uid}/challenges/state. */
export interface CompletedChallengeItem {
  id: number;
  defId: string;
  name: string;
  duration: number;
  xp: number;
  completedAt: string;
}

/** Single consolidated document at users/{uid}/challenges/state */
export interface ChallengesStateDoc {
  activeChallengeId: number;
  currentProgress: number;
  lastCompletedDate: string | null;
  completedChallenges: CompletedChallengeItem[];
  updatedAt?: any;
}

/** An item in the unlockedAchievements array inside users/{uid}/achievements/state. */
export interface UnlockedAchievementItem {
  id: string; // defId (e.g. "streak_1")
  title: string;
  unlockedAt: string;
}

/** Single consolidated document at users/{uid}/achievements/state */
export interface AchievementsStateDoc {
  unlockedAchievements: UnlockedAchievementItem[];
  updatedAt?: any;
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

export interface CoachExchange {
  id: string;
  userMessage: string;
  userTimestamp: number;
  assistantReply: string;
  assistantTimestamp: number;
}

export interface DailyCoachChatDoc {
  date: string; // YYYY-MM-DD
  createdAt: number;
  updatedAt?: any;
  exchanges: CoachExchange[];
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

export type DeepWorkCategory = 'programming' | 'learning' | 'reading' | 'work' | 'other';
export type DeepWorkTaskType = 'todo' | 'event';
export type DeepWorkSessionStatus = 'completed' | 'abandoned';
export type DeepWorkAbandonReason =
  | 'distraction_urge'
  | 'phone_notification'
  | 'mental_fatigue'
  | 'external_interruption'
  | 'other';

export interface DeepWorkTask {
  id: string | number;
  title: string;
  category: DeepWorkCategory;
  type: DeepWorkTaskType;
  eventTime?: string | null;
  date: string;
  completed: number; // 0 | 1
  targetMinutes: number;
  completedMinutes: number;
  createdAt: string;
}

export interface DeepWorkSession {
  id: string | number;
  taskId?: string | number | null;
  taskTitle: string;
  category: DeepWorkCategory;
  scheduledMinutes: number;
  actualMinutes: number;
  status: DeepWorkSessionStatus;
  abandonReason?: string | null;
  interruptionCount: number;
  date: string;
  startedAt: string;
  endedAt: string;
}
