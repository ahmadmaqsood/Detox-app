import { getFirebaseAuth, getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import { defaultHabits } from "@/lib/seed";
import { MASTER_ACHIEVEMENTS, MASTER_CHALLENGES } from "@/lib/seed/masterCatalog";
import type {
  AchievementDefinition,
  BodyWeightEntry,
  Challenge,
  ChallengeCategory,
  ChallengeCompletionRecord,
  ChallengesStateDoc,
  ChallengeStats,
  ChallengeStatus,
  CoachExchange,
  CompletedChallengeItem,
  DailyCoachChatDoc,
  DailyHabitEntry,
  DailyInterventionDoc,
  DailyProgressEntry,
  DailyReset,
  DeepWorkCategory,
  DeepWorkSession,
  DeepWorkTask,
  DeepWorkTaskType,
  DietMeal,
  DietRules,
  EnergyLevel,
  ExerciseEntry,
  Habit,
  HabitDifficultyLevels,
  HabitDifficultyTier,
  HabitIcon,
  HabitLifecycleStage,
  LifeArea,
  MealQuality,
  Metrics,
  Mode,
  MoodState,
  RecoveryActionEntry,
  RelapseEvent,
  RoutineExperiment,
  SpiritualCadence,
  SpiritualChallengeDashboard,
  TimeBlock,
  TimeBlockCategory,
  TimeSlot,
  UnlockedAchievementItem,
  UrgeLog
} from "@/lib/types";
import {
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  startAfter,
  Timestamp,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { Platform } from "react-native";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addCalendarDays(iso: string, delta: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

async function forEachDocInBatches(
  q: ReturnType<typeof query>,
  onBatch: (docs: Array<{ id: string; data: () => unknown }>) => void | Promise<void>,
  maxDocs = 50_000,
): Promise<void> {
  let last: any | null = null;
  let seen = 0;
  while (true) {
    const qy = last ? query(q, startAfter(last), limit(10_000)) : query(q, limit(10_000));
    const snap = await getDocs(qy);
    if (snap.empty) return;
    await onBatch(snap.docs as any);
    seen += snap.size;
    if (seen >= maxDocs) return;
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 10_000) return;
  }
}

export async function requireUid(): Promise<string> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase not configured. Check app.json expo.extra.firebase.webConfig.");
  }
  const u = getFirebaseAuth()?.currentUser;
  if (!u) throw new Error("AUTH_REQUIRED");
  return u.uid;
}

function userRoot(uid: string) {
  const db = getFirestoreDb();
  if (!db) throw new Error("Firestore unavailable.");
  return {
    db,
    meta: collection(db, "users", uid, "meta"),
    habits: collection(db, "users", uid, "habits"),
    entries: collection(db, "users", uid, "entries"),
    interventions: collection(db, "users", uid, "interventions"),
    appOpens: collection(db, "users", uid, "app_open_events"),
    challenges: collection(db, "users", uid, "challenges"),
    challengeHistory: collection(db, "users", uid, "challenge_completion_history"),
    challengeLogs: collection(db, "users", uid, "challenge_logs"),
    insightSnapshots: collection(db, "users", uid, "insight_snapshots"),
    achievements: collection(db, "users", uid, "achievements"),
    deepWorkTasks: collection(db, "users", uid, "deep_work_tasks"),
    deepWorkSessions: collection(db, "users", uid, "deep_work_sessions"),
    coachDailyChats: collection(db, "users", uid, "coach_daily_chats"),
    spiritual: collection(db, "users", uid, "spiritual"),
    timeBlocks: collection(db, "users", uid, "time_blocks"),
    timeBlockLogs: collection(db, "users", uid, "time_block_logs"),
    bodyWeights: collection(db, "users", uid, "body_weights"),
    bodyExercise: collection(db, "users", uid, "body_exercise"),
    dietMeals: collection(db, "users", uid, "diet_meals"),
    urgeLogs: collection(db, "users", uid, "urge_logs"),
    dailyReset: collection(db, "users", uid, "daily_reset"),
  };
}

function metaStateRef(db: ReturnType<typeof getFirestoreDb> extends infer T ? any : any, uid: string) {
  return doc(db, "users", uid, "meta", "state");
}

async function migrateMetaDocsToState(uid: string): Promise<void> {
  const { db } = userRoot(uid);
  const stateRef = doc(db, "users", uid, "meta", "state");
  const stateSnap = await getDoc(stateRef);
  const state = (stateSnap.data() as any) ?? {};

  // Pull legacy meta docs (best-effort) and merge into the single state doc.
  const legacyIds = [
    "seeded",
    "_counters",
    "mode",
    "detox_enabled",
    "detox_started_at",
    "hard_mode",
    "focus_lock_enabled",
    "onboarding_complete",
    "last_active",
    "user_level",
    "insights",
  ] as const;

  const legacySnaps = await Promise.all(
    legacyIds.map((id) => getDoc(doc(db, "users", uid, "meta", id))),
  );

  const patch: Record<string, unknown> = {};
  // If state doc doesn't exist, we build a full state from legacy docs.
  // If it exists, we only fill missing fields.
  const setIfMissing = (key: string, value: unknown) => {
    if (state[key] === undefined && value !== undefined) patch[key] = value;
  };

  for (let i = 0; i < legacyIds.length; i++) {
    const id = legacyIds[i];
    const snap = legacySnaps[i];
    if (!snap.exists()) continue;
    const data = snap.data() as any;
    switch (id) {
      case "seeded":
        setIfMissing("seeded", { value: Boolean(data?.value), seededAt: data?.seededAt ?? null });
        break;
      case "_counters":
        setIfMissing("counters", data ?? {});
        break;
      case "mode":
        setIfMissing("mode", data?.currentMode ?? "hostel");
        break;
      case "detox_enabled":
        setIfMissing("detox_enabled", Boolean(data?.value));
        break;
      case "detox_started_at":
        setIfMissing("detox_started_at", data?.value ?? null);
        break;
      case "hard_mode":
        setIfMissing("hard_mode", Boolean(data?.value));
        break;
      case "focus_lock_enabled":
        setIfMissing("focus_lock_enabled", Boolean(data?.value));
        break;
      case "onboarding_complete":
        setIfMissing("onboarding_complete", Boolean(data?.value));
        break;
      case "last_active":
        setIfMissing("last_active_at", data?.at ?? null);
        break;
      case "user_level":
        setIfMissing("user_level", data ?? {});
        break;
      case "insights":
        setIfMissing("insights", data ?? {});
        break;
    }
  }

  if (!stateSnap.exists()) {
    // Initialize defaults if missing.
    if (patch.seeded === undefined) patch.seeded = { value: false, seededAt: null };
    if (patch.counters === undefined) patch.counters = {};
    if (patch.mode === undefined) patch.mode = "hostel";
    if (patch.detox_enabled === undefined) patch.detox_enabled = false;
    if (patch.hard_mode === undefined) patch.hard_mode = false;
    if (patch.focus_lock_enabled === undefined) patch.focus_lock_enabled = false;
    if (patch.onboarding_complete === undefined) patch.onboarding_complete = false;
  }

  if (Object.keys(patch).length > 0) {
    await setDoc(stateRef, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
  }
}

async function allocId(uid: string, key: string): Promise<number> {
  const { db } = userRoot(uid);
  const stateRef = doc(db, "users", uid, "meta", "state");
  const field = `next_${key}`;
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(stateRef);
      const data = (snap.data() as any) ?? {};
      const counters = (data.counters ?? {}) as any;
      const cur = (typeof counters[field] === "number" ? counters[field] : null) as number | null;
      const next = typeof cur === "number" ? cur + 1 : 1;
      tx.set(stateRef, { counters: { ...counters, [field]: next } }, { merge: true });
      return next;
    });
  } catch (e) {
    console.warn(`allocId transaction for ${key} fallback to timestamp:`, e);
    return Date.now();
  }
}

const seededUsersCache = new Set<string>();

async function ensureSeeded(uid: string): Promise<void> {
  if (seededUsersCache.has(uid)) return;

  const { db } = userRoot(uid);
  const stateRef = doc(db, "users", uid, "meta", "state");
  const stateSnap = await getDoc(stateRef);
  const seededVal = Boolean((stateSnap.data() as any)?.seeded?.value);
  if (seededVal) {
    seededUsersCache.add(uid);
    return;
  }

  await migrateMetaDocsToState(uid);
  const againSnap = await getDoc(stateRef);
  if (Boolean((againSnap.data() as any)?.seeded?.value)) {
    seededUsersCache.add(uid);
    return;
  }

  await runTransaction(db, async (tx) => {
    const again = await tx.get(stateRef);
    const againSeeded = Boolean((again.data() as any)?.seeded?.value);
    if (againSeeded) {
      seededUsersCache.add(uid);
      return;
    }

    // Seed habits with stable numeric ids.
    let i = 0;
    for (const h of defaultHabits) {
      i++;
      const hid = i;
      tx.set(doc(db, "users", uid, "habits", String(hid)), {
        id: hid,
        name: h.name,
        icon: JSON.stringify(h.icon),
        color: h.color,
        mode: h.mode,
        lifeArea: h.lifeArea,
        targetPerDay: h.targetPerDay,
        sortOrder: h.sortOrder ?? 0,
        createdAt: todayISO(),
      });
    }

    // Initialize consolidated challenges/state and achievements/state documents
    tx.set(
      doc(db, "users", uid, "challenges", "state"),
      {
        activeChallengeId: 1,
        currentProgress: 0,
        lastCompletedDate: null,
        completedChallenges: [],
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    tx.set(
      doc(db, "users", uid, "achievements", "state"),
      {
        unlockedAchievements: [],
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    const data = (again.data() as any) ?? {};
    const counters = (data.counters ?? {}) as any;
    tx.set(
      stateRef,
      {
        seeded: { value: true, seededAt: serverTimestamp() },
        mode: data.mode ?? "hostel",
        detox_enabled: Boolean(data.detox_enabled ?? false),
        counters: {
          ...counters,
          next_habit: defaultHabits.length,
          next_intervention: 0,
          next_urge_session: 0,
          next_challenge_history: 0,
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
  seededUsersCache.add(uid);
}

// ───────────────────────────────────────────────────────────────
// Public API (mirrors former SQLite layer where needed)
// ───────────────────────────────────────────────────────────────

export async function initDB(): Promise<void> {
  const uid = await requireUid();
  await ensureSeeded(uid);
  await recordLastActiveNow();
  // Consolidated insights history on `meta/insights` (replaces per-day `insight_snapshots`).
  try {
    await persistInsightsMeta(uid);
  } catch {
    // ignore
  }
  // Best-effort achievements sync on launch
  import("@/lib/firestoreAchievements")
    .then((m) => m.syncFirestoreAchievements())
    .catch(() => { });
  // Sync background steps from hardware pedometer sensor
  import("@/lib/pedometerService")
    .then((m) => m.syncPedometerSensorSteps())
    .catch(() => { });
}

export async function recordLastActiveNow(): Promise<void> {
  if (!getFirebaseAuth()?.currentUser) return;
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await migrateMetaDocsToState(uid);
  await setDoc(doc(db, "users", uid, "meta", "state"), { last_active_at: serverTimestamp() }, { merge: true });
}

export async function getFocusLockEnabled(): Promise<boolean> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await migrateMetaDocsToState(uid);
  const snap = await getDoc(doc(db, "users", uid, "meta", "state"));
  return Boolean((snap.data() as any)?.focus_lock_enabled);
}

export async function setFocusLockEnabled(enabled: boolean): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await migrateMetaDocsToState(uid);
  await setDoc(
    doc(db, "users", uid, "meta", "state"),
    { focus_lock_enabled: enabled, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function recordAppOpenEvent(): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const ref = doc(collection(db, "users", uid, "app_open_events"));
  await setDoc(ref, { openedAt: serverTimestamp() });
}

export async function getAppOpenCountSince(sinceIso: string): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const qy = query(
    collection(db, "users", uid, "app_open_events"),
    where("openedAt", ">=", new Date(sinceIso)),
  );
  const snap = await getDocs(qy);
  return snap.size;
}

export async function isOnboardingComplete(): Promise<boolean> {
  const user = getFirebaseAuth()?.currentUser ?? null;
  if (!user) {
    const { getLocalOnboardingComplete } = await import("@/lib/onboardingLocal");
    return getLocalOnboardingComplete();
  }
  const db = getFirestoreDb();
  if (!db) return false;
  await migrateMetaDocsToState(user.uid);
  const snap = await getDoc(doc(db, "users", user.uid, "meta", "state"));
  return Boolean((snap.data() as any)?.onboarding_complete);
}

/** Call after email/password sign-in if user finished onboarding before creating an account. */
export async function syncOnboardingFromLocalToFirestore(): Promise<void> {
  const { getLocalOnboardingComplete } = await import("@/lib/onboardingLocal");
  if (!(await getLocalOnboardingComplete())) return;
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await migrateMetaDocsToState(uid);
  await setDoc(
    doc(db, "users", uid, "meta", "state"),
    { onboarding_complete: true, onboarding_completed_at: serverTimestamp() },
    { merge: true },
  );
}

export async function setOnboardingComplete(): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await migrateMetaDocsToState(uid);
  await setDoc(doc(db, "users", uid, "meta", "state"), { onboarding_complete: true, onboarding_completed_at: serverTimestamp() }, { merge: true });
}

export async function getMode(): Promise<Mode> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await migrateMetaDocsToState(uid);
  const snap = await getDoc(doc(db, "users", uid, "meta", "state"));
  const m = (snap.data() as any)?.mode;
  return m === "home" || m === "hostel" ? m : "hostel";
}

export async function setMode(mode: Mode): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await migrateMetaDocsToState(uid);
  await setDoc(doc(db, "users", uid, "meta", "state"), { mode, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getDetoxEnabled(): Promise<boolean> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await migrateMetaDocsToState(uid);
  const snap = await getDoc(doc(db, "users", uid, "meta", "state"));
  return Boolean((snap.data() as any)?.detox_enabled);
}

export async function setDetoxEnabled(enabled: boolean): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const today = todayISO();
  await migrateMetaDocsToState(uid);
  await setDoc(doc(db, "users", uid, "meta", "state"), { detox_enabled: enabled, updatedAt: serverTimestamp() }, { merge: true });
  if (enabled) {
    await setDoc(doc(db, "users", uid, "meta", "state"), { detox_started_at: today }, { merge: true });
  }
  // Record detox status on today's daily entry in Firestore
  await setDoc(
    doc(db, "users", uid, "entries", today),
    { isDetoxDay: enabled, updatedAt: serverTimestamp() },
    { merge: true },
  );
  invalidateHabitsCache();
}

export async function getDetoxStartDate(): Promise<string | null> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await migrateMetaDocsToState(uid);
  const snap = await getDoc(doc(db, "users", uid, "meta", "state"));
  return (snap.data() as any)?.detox_started_at ?? null;
}

/** Consecutive days where Detox Mode was activated and ≥75% of habits were completed. */
export async function getDetoxStreak(): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const entriesSnap = await getDocs(collection(db, "users", uid, "entries"));
  const entriesMap = new Map<string, any>();
  for (const d of entriesSnap.docs) {
    entriesMap.set(d.id, d.data());
  }

  const checkDetoxDaySuccess = (dayKey: string): boolean => {
    const data = entriesMap.get(dayKey);
    if (!data) return false;
    const isDetox = Boolean(data.isDetoxDay);
    if (!isDetox) return false;
    const rate = typeof data.completionPercentage === "number" ? data.completionPercentage / 100 : 0;
    return rate >= 0.75;
  };

  const today = todayISO();
  let streak = 0;

  if (checkDetoxDaySuccess(today)) {
    streak += 1;
  }

  let checkDate = addCalendarDays(today, -1);
  while (true) {
    if (checkDetoxDaySuccess(checkDate)) {
      streak += 1;
      checkDate = addCalendarDays(checkDate, -1);
    } else {
      break;
    }
  }

  return streak;
}

export interface DetoxDayRecord {
  date: string;
  mode: Mode;
  completionPercentage: number;
  checkedHabits: number;
  totalHabits: number;
  successful: boolean;
}

export async function getDetoxDaysHistory(): Promise<DetoxDayRecord[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDocs(
    query(
      collection(db, "users", uid, "entries"),
      where("isDetoxDay", "==", true),
    ),
  );
  const records: DetoxDayRecord[] = [];
  for (const d of snap.docs) {
    const data = d.data() as any;
    const pct = Number(data.completionPercentage ?? 0);
    records.push({
      date: data.date || d.id,
      mode: data.mode ?? "home",
      completionPercentage: pct,
      checkedHabits: Number(data.checkedHabits ?? 0),
      totalHabits: Number(data.totalHabits ?? 0),
      successful: pct >= 75,
    });
  }
  return records.sort((a, b) => b.date.localeCompare(a.date));
}

export async function getHardMode(): Promise<boolean> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await migrateMetaDocsToState(uid);
  const snap = await getDoc(doc(db, "users", uid, "meta", "state"));
  return Boolean((snap.data() as any)?.hard_mode);
}

export async function setHardMode(enabled: boolean): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await migrateMetaDocsToState(uid);
  await setDoc(doc(db, "users", uid, "meta", "state"), { hard_mode: enabled, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getHardModeStreak(): Promise<number> {
  return getOverallStreak();
}

// ───────────────────────────────────────────────────────────────
// In-Memory Habit & Progress Cache (Instant reads & 0ms screen switches)
// ───────────────────────────────────────────────────────────────

interface HabitCacheState {
  allHabits: Habit[] | null;
  todayHabits: Map<string, (Habit & { completed: number })[]>;
  todayEntry: DailyProgressEntry | null;
  modeStreaks: Map<Mode, number>;
  overallStreak: number | null;
  lastFetchedAt: number;
}

const habitCache: HabitCacheState = {
  allHabits: null,
  todayHabits: new Map(),
  todayEntry: null,
  modeStreaks: new Map(),
  overallStreak: null,
  lastFetchedAt: 0,
};

export function invalidateHabitsCache(): void {
  habitCache.allHabits = null;
  habitCache.todayHabits.clear();
  habitCache.todayEntry = null;
  habitCache.modeStreaks.clear();
  habitCache.overallStreak = null;
  habitCache.lastFetchedAt = 0;
}

export async function addHabit(
  habit: Pick<Habit, "name"> & {
    icon?: string | HabitIcon;
    color?: string;
    mode?: Mode;
    lifeArea?: Habit["lifeArea"];
    targetPerDay?: number;
    sortOrder?: number;
    detoxOnly?: boolean;
    difficultyLevels?: HabitDifficultyLevels;
    timeSlot?: TimeSlot;
    stackedAfterHabitId?: number;
    stackAnchorName?: string;
    prerequisiteHabitIds?: number[];
    lifecycleStage?: HabitLifecycleStage;
    usefulnessRating?: number;
  },
): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const id = await allocId(uid, "habit");
  const iconStr =
    typeof habit.icon === "object"
      ? JSON.stringify(habit.icon)
      : (habit.icon ??
        JSON.stringify({ ios: "star.fill", android: "star", web: "star" }));
  let sortOrder = habit.sortOrder;
  if (sortOrder === undefined) {
    try {
      const existingSnap = await getDocs(
        query(collection(db, "users", uid, "habits"), where("mode", "==", habit.mode ?? "home"))
      );
      const maxSort = existingSnap.docs.reduce(
        (m, d) => Math.max(m, Number((d.data() as any).sortOrder ?? 0)),
        0
      );
      sortOrder = maxSort + 10;
    } catch {
      sortOrder = 10;
    }
  }

  const docPayload: any = {
    id,
    name: habit.name,
    icon: iconStr,
    color: habit.color ?? "#4ADE80",
    mode: habit.mode ?? "home",
    lifeArea: habit.lifeArea ?? "mental",
    targetPerDay: habit.targetPerDay ?? 1,
    sortOrder,
    detoxOnly: Boolean(habit.detoxOnly),
    createdAt: todayISO(),
    lifecycleStage: habit.lifecycleStage ?? "building",
  };
  if (habit.difficultyLevels) docPayload.difficultyLevels = habit.difficultyLevels;
  if (habit.timeSlot) docPayload.timeSlot = habit.timeSlot;
  if (habit.stackedAfterHabitId != null) docPayload.stackedAfterHabitId = habit.stackedAfterHabitId;
  if (habit.stackAnchorName) docPayload.stackAnchorName = habit.stackAnchorName;
  if (habit.prerequisiteHabitIds?.length) docPayload.prerequisiteHabitIds = habit.prerequisiteHabitIds;
  if (habit.usefulnessRating != null) docPayload.usefulnessRating = habit.usefulnessRating;

  await setDoc(doc(db, "users", uid, "habits", String(id)), docPayload);
  invalidateHabitsCache();
  return id;
}

export async function reorderHabits(orderedHabitIds: number[]): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const batch = writeBatch(db);
  orderedHabitIds.forEach((id, index) => {
    const sortOrder = (index + 1) * 10;
    batch.update(doc(db, "users", uid, "habits", String(id)), {
      sortOrder,
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
  invalidateHabitsCache();
}

export async function getAllHabits(
  mode?: Mode,
  forceRefresh = false,
  includeArchived = false,
): Promise<Habit[]> {
  const uid = await requireUid();
  const now = Date.now();
  if (!forceRefresh && habitCache.allHabits && now - habitCache.lastFetchedAt < 60000) {
    let cached = habitCache.allHabits;
    if (!includeArchived) {
      cached = cached.filter((h) => !h.archived);
    }
    if (mode) {
      return cached.filter((h) => h.mode === mode);
    }
    return cached;
  }

  await ensureSeeded(uid);
  const { db } = userRoot(uid);
  const snap = await getDocs(
    query(
      collection(db, "users", uid, "habits"),
      orderBy("mode", "asc"),
      orderBy("sortOrder", "asc"),
      orderBy("createdAt", "desc"),
    ),
  );
  const active = snap.docs
    .map((d) => d.data() as Habit & { deleted?: boolean })
    .filter((h) => h?.deleted !== true && (includeArchived || !h?.archived)) as Habit[];

  habitCache.allHabits = active;
  habitCache.lastFetchedAt = Date.now();

  if (mode) {
    return active.filter((h) => h.mode === mode);
  }
  return active;
}

export async function getHabitById(id: number): Promise<Habit | null> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDoc(doc(db, "users", uid, "habits", String(id)));
  return snap.exists() ? (snap.data() as Habit) : null;
}

/**
 * Strips all keys whose values are `undefined` recursively,
 * ensuring Firestore setDoc/updateDoc never fails on "Unsupported field value: undefined".
 */
export function sanitizeFirestoreData<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeFirestoreData) as unknown as T;
  }
  if (typeof data === "object" && !(data instanceof Timestamp) && !(data instanceof Date)) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeFirestoreData(value);
      }
    }
    return cleaned;
  }
  return data;
}

export async function updateHabit(
  id: number,
  updates: Partial<
    Pick<
      Habit,
      | "name"
      | "color"
      | "mode"
      | "targetPerDay"
      | "lifeArea"
      | "sortOrder"
      | "detoxOnly"
      | "difficultyLevels"
      | "timeSlot"
      | "stackedAfterHabitId"
      | "stackAnchorName"
      | "prerequisiteHabitIds"
      | "lifecycleStage"
      | "usefulnessRating"
      | "effectivenessScore"
      | "archived"
    > & {
      icon: string | HabitIcon;
    }
  >,
): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const rawPatch: any = { ...updates, updatedAt: serverTimestamp() };
  if (updates.icon && typeof updates.icon === "object") {
    rawPatch.icon = JSON.stringify(updates.icon);
  }
  const patch = sanitizeFirestoreData(rawPatch);
  await setDoc(doc(db, "users", uid, "habits", String(id)), patch, { merge: true });
  invalidateHabitsCache();
}

export async function deleteHabit(id: number): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  // Soft delete (keeps old entries coherent). UI will stop showing it.
  await setDoc(doc(db, "users", uid, "habits", String(id)), { deleted: true, deletedAt: serverTimestamp() }, { merge: true });
  invalidateHabitsCache();
}

export function getMotivationalMessage(percentage: number, pendingCount: number): string {
  if (percentage === 100) {
    return "Outstanding discipline! You completed 100% of your habits today. Pure mastery!";
  }
  if (percentage >= 80) {
    return `Almost at the finish line! ${percentage}% completed. Just ${pendingCount} more habit${pendingCount === 1 ? "" : "s"} left to conquer today!`;
  }
  if (percentage >= 50) {
    return `Great momentum! You're over halfway there at ${percentage}%. Put in that extra effort for the remaining ${pendingCount} habit${pendingCount === 1 ? "" : "s"}!`;
  }
  if (percentage > 0) {
    return `Good start at ${percentage}%! Build on this momentum—push forward to complete ${pendingCount} more habit${pendingCount === 1 ? "" : "s"} today!`;
  }
  return "The journey begins with a single step. Complete your first habit today to get the momentum going!";
}

export async function getDailyEntry(date?: string, forceRefresh = false): Promise<DailyProgressEntry | null> {
  const day = date ?? todayISO();
  const isToday = day === todayISO();
  if (!forceRefresh && isToday && habitCache.todayEntry && Date.now() - habitCache.lastFetchedAt < 60000) {
    return habitCache.todayEntry;
  }
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDoc(doc(db, "users", uid, "entries", day));
  if (!snap.exists()) return null;
  const data = snap.data() as DailyProgressEntry;
  if (isToday) {
    habitCache.todayEntry = data;
  }
  return data;
}

export async function getTodayHabits(
  mode?: Mode,
  isDetox = false,
  forceRefresh = false,
  targetDate?: string,
): Promise<(Habit & { completed: number; completedTier?: HabitDifficultyTier })[]> {
  const uid = await requireUid();
  const day = targetDate ?? todayISO();
  const isToday = day === todayISO();
  const cacheKey = `${mode ?? "all"}_detox_${isDetox ? "1" : "0"}_${day}`;
  const now = Date.now();

  if (!forceRefresh && isToday && habitCache.todayHabits.has(cacheKey) && now - habitCache.lastFetchedAt < 60000) {
    return habitCache.todayHabits.get(cacheKey)!;
  }

  await ensureSeeded(uid);
  const { db } = userRoot(uid);

  const habitsQ = mode
    ? query(
      collection(db, "users", uid, "habits"),
      where("mode", "==", mode),
      orderBy("sortOrder", "asc"),
      orderBy("createdAt", "asc"),
    )
    : query(
      collection(db, "users", uid, "habits"),
      orderBy("sortOrder", "asc"),
      orderBy("createdAt", "asc"),
    );

  // Parallel fetch: habits and daily entry document in ONE roundtrip
  const [habitsSnap, dayDoc] = await Promise.all([
    getDocs(habitsQ),
    getDoc(doc(db, "users", uid, "entries", day)),
  ]);

  const rawHabits = habitsSnap.docs
    .map((d) => d.data() as any)
    .filter((h) => h?.deleted !== true && !h?.archived) as Habit[];

  // When Detox is OFF: hide detoxOnly tasks (they only activate during Detox).
  // When Detox is ON: show ALL mode habits PLUS any detoxOnly tasks!
  const habits = rawHabits.filter((h) => {
    if (h.detoxOnly) {
      return isDetox;
    }
    return true;
  });

  const dayData = dayDoc.exists() ? (dayDoc.data() as any) : null;
  if (dayData && isToday) {
    habitCache.todayEntry = dayData as DailyProgressEntry;
  }

  const dayHabitsMap = new Map<number, { completed: boolean; completedTier?: HabitDifficultyTier }>();
  if (Array.isArray(dayData?.habits)) {
    for (const h of dayData.habits) {
      if (h?.id != null) {
        dayHabitsMap.set(Number(h.id), {
          completed: Boolean(h.completed),
          completedTier: h.completedTier,
        });
      }
    }
  }

  const entries = habits.map((h) => {
    const record = dayHabitsMap.get(h.id);
    return {
      ...h,
      completed: record?.completed ? 1 : 0,
      completedTier: record?.completedTier,
    };
  });

  if (isToday) {
    habitCache.todayHabits.set(cacheKey, entries);
    habitCache.lastFetchedAt = Date.now();
  }

  return entries;
}

export async function toggleHabit(
  habitId: number,
  targetDate?: string,
  activeMode?: Mode,
  tier?: HabitDifficultyTier,
): Promise<boolean> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const day = targetDate ?? todayISO();
  const entryRef = doc(db, "users", uid, "entries", day);
  const toggledAt = new Date().toISOString();

  // Use cached habits for ultra-fast response
  const allHabits = await getAllHabits();
  const targetHabit = allHabits.find((h) => Number(h.id) === Number(habitId));
  const habitName = targetHabit?.name ?? `Habit #${habitId}`;

  // Mode: prioritize activeMode -> targetHabit.mode -> getMode()
  const currentMode: Mode = activeMode ?? (targetHabit?.mode as Mode | undefined) ?? (await getMode());

  // 1. Read existing single daily document
  let existingData: any = null;
  try {
    const entrySnap = await getDoc(entryRef);
    if (entrySnap.exists()) {
      existingData = entrySnap.data();
    }
  } catch (err) {
    console.warn("Failed to get daily entry for toggle:", err);
  }

  const isDetox = Boolean(existingData?.isDetoxDay ?? (await getDetoxEnabled().catch(() => false)));

  // Filter habits for the active mode (include detoxOnly tasks if detox is active)
  const modeHabits = allHabits.filter((h) => {
    if ((h.mode ?? "home") !== currentMode) return false;
    if (h.detoxOnly && !isDetox) return false;
    return true;
  });

  const existingHabitsList: DailyHabitEntry[] = Array.isArray(existingData?.habits) ? existingData.habits : [];

  const existingMap = new Map<number, {
    completed: boolean;
    time?: string | null;
    completedTier?: HabitDifficultyTier;
  }>();
  for (const eh of existingHabitsList) {
    if (eh?.id != null) {
      existingMap.set(Number(eh.id), {
        completed: Boolean(eh.completed),
        time: eh.time ?? null,
        completedTier: eh.completedTier,
      });
    }
  }

  // Determine target habit toggle state
  const currentEntry = existingMap.get(Number(habitId));
  const nextCompleted = currentEntry ? !currentEntry.completed : true;

  // Build consolidated array of habit objects for current mode
  const updatedHabits: DailyHabitEntry[] = modeHabits.map((h) => {
    const hid = Number(h.id);
    if (hid === Number(habitId)) {
      return {
        id: hid,
        name: h.name ?? habitName,
        completed: nextCompleted,
        time: nextCompleted ? toggledAt : null,
        completedTier: nextCompleted ? (tier ?? currentEntry?.completedTier ?? "standard") : undefined,
      };
    }
    const existing = existingMap.get(hid);
    return {
      id: hid,
      name: h.name ?? `Habit #${hid}`,
      completed: existing?.completed ?? false,
      time: existing?.time ?? null,
      completedTier: existing?.completedTier,
    };
  });

  // Root-level metrics
  const totalHabits = modeHabits.length;
  const checkedHabits = updatedHabits.filter((h) => h.completed).length;
  const leftHabits = Math.max(0, totalHabits - checkedHabits);
  const completionPercentage = totalHabits > 0 ? Math.round((checkedHabits / totalHabits) * 100) : 0;
  const motivationalMessage = getMotivationalMessage(completionPercentage, leftHabits);

  const entryPayload: DailyProgressEntry = {
    date: day,
    mode: currentMode,
    isDetoxDay: isDetox,
    totalHabits,
    checkedHabits,
    leftHabits,
    completionPercentage,
    motivationalMessage,
    habits: updatedHabits,
  };

  // 2. Persist to Firestore
  try {
    await setDoc(
      entryRef,
      {
        ...entryPayload,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (err) {
    console.warn("Failed to setDoc daily entry for toggle:", err);
  }

  // 3. Directly update in-memory cache so subsequent reads reflect this immediately!
  if (day === todayISO()) {
    habitCache.todayEntry = entryPayload;
    // Update todayHabits for all cached modes
    for (const [cacheKey, list] of habitCache.todayHabits.entries()) {
      habitCache.todayHabits.set(
        cacheKey,
        list.map((h) =>
          Number(h.id) === Number(habitId) ? { ...h, completed: nextCompleted ? 1 : 0 } : h
        ),
      );
    }
    habitCache.modeStreaks.clear();
    habitCache.overallStreak = null;
    habitCache.lastFetchedAt = Date.now();
  } else {
    invalidateHabitsCache();
  }

  // Auto-progress sequential challenges based on daily habit checklist threshold (>= 50%)
  syncAutoChallengeProgress(uid, entryPayload).catch((err) => {
    console.warn("Failed to auto progress challenge:", err);
  });

  // Update user progression + monthly achievements (best-effort).
  updateUserProgressAfterToggle(nextCompleted).catch(() => { });
  return nextCompleted;
}

async function updateUserProgressAfterToggle(completedNow: boolean): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const stateRef = doc(db, "users", uid, "meta", "state");
  try {
    const snap = await getDoc(stateRef);
    const cur = (snap.data() as any)?.user_level?.xp ?? 0;
    const xp = Math.max(0, cur + (completedNow ? 8 : 0));
    const rank =
      xp >= 2000
        ? "pro"
        : xp >= 900
          ? "advanced"
          : xp >= 250
            ? "intermediate"
            : "beginner";
    await setDoc(stateRef, { user_level: { xp, rank, updatedAt: serverTimestamp() } }, { merge: true });
  } catch (e) {
    console.warn("Failed to update user progression:", e);
  }

  const streak = await getGlobalStreak();
  const milestones = [
    { days: 30, id: "month_1", name: "Month 1 — Discipline" },
    { days: 60, id: "month_2", name: "Month 2 — Momentum" },
    { days: 90, id: "month_3", name: "Month 3 — Transformation" },
    { days: 120, id: "month_4", name: "Month 4 — Identity" },
    { days: 150, id: "month_5", name: "Month 5 — Mastery" },
    { days: 180, id: "month_6", name: "Month 6 — Pro Level" },
  ];
  for (const m of milestones) {
    if (streak < m.days) continue;
    await unlockAchievement(m.id, { title: m.name });
  }

  // Unlock dynamic achievements + notify
  try {
    const { syncFirestoreAchievements } = await import("@/lib/firestoreAchievements");
    await syncFirestoreAchievements();
  } catch {
    // ignore
  }
}

export async function getHabitHistory(
  habitId: number,
  days: number = 30,
): Promise<{ date: string; completed: number; completedTier?: HabitDifficultyTier }[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const to = todayISO();
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  const fromISO = from.toISOString().slice(0, 10);

  // Read single daily documents in range
  const snaps = await Promise.all(
    Array.from({ length: days }, (_, i) => {
      const d = new Date(fromISO + "T00:00:00");
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      return getDoc(doc(db, "users", uid, "entries", iso));
    }),
  );
  const out: { date: string; completed: number; completedTier?: HabitDifficultyTier }[] = [];
  for (let i = 0; i < snaps.length; i++) {
    const d = new Date(fromISO + "T00:00:00");
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dayData = snaps[i].exists() ? (snaps[i].data() as any) : null;
    let completed = 0;
    let completedTier: HabitDifficultyTier | undefined;
    if (Array.isArray(dayData?.habits)) {
      const found = dayData.habits.find((h: any) => h.id === habitId);
      completed = found?.completed ? 1 : 0;
      completedTier = found?.completedTier;
    } else {
      // Legacy doc fallback
      const legSnap = await getDoc(doc(db, "users", uid, "entries", `${habitId}_${iso}`));
      completed = (legSnap.data() as any)?.completed === true ? 1 : 0;
    }
    if (iso >= fromISO && iso <= to) out.push({ date: iso, completed, completedTier });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ─── Routine Experiments (A/B Routine Testing — System 1) ─────

export async function getRoutineExperiments(): Promise<RoutineExperiment[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  try {
    const snap = await getDoc(doc(db, "users", uid, "meta", "experiments"));
    if (!snap.exists()) return [];
    return (snap.data()?.experiments as RoutineExperiment[]) ?? [];
  } catch {
    return [];
  }
}

export async function saveRoutineExperiment(experiment: RoutineExperiment): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const current = await getRoutineExperiments();
  const idx = current.findIndex((e) => e.id === experiment.id);
  const updated = idx >= 0
    ? current.map((e, i) => (i === idx ? experiment : e))
    : [experiment, ...current];
  await setDoc(
    doc(db, "users", uid, "meta", "experiments"),
    {
      experiments: updated,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function completeRoutineExperiment(
  id: string,
  winner: "A" | "B" | "inconclusive",
  recommendation?: string,
  results?: { completionRateA: number; completionRateB: number },
): Promise<void> {
  const current = await getRoutineExperiments();
  const target = current.find((e) => e.id === id);
  if (!target) return;
  target.status = "completed";
  target.winner = winner;
  target.results = {
    completionRateA: results?.completionRateA ?? target.results?.completionRateA ?? 0,
    completionRateB: results?.completionRateB ?? target.results?.completionRateB ?? 0,
    recommendation: recommendation ?? target.results?.recommendation ?? "Experiment concluded.",
  };
  await saveRoutineExperiment(target);
}

export async function cancelRoutineExperiment(id: string): Promise<void> {
  const current = await getRoutineExperiments();
  const target = current.find((e) => e.id === id);
  if (!target) return;
  target.status = "cancelled";
  await saveRoutineExperiment(target);
}

export async function deleteRoutineExperiment(id: string): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const current = await getRoutineExperiments();
  const updated = current.filter((e) => e.id !== id);
  await setDoc(
    doc(db, "users", uid, "meta", "experiments"),
    {
      experiments: updated,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getRecentDailyEntries(days: number = 21): Promise<DailyProgressEntry[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  const fromISO = from.toISOString().slice(0, 10);

  const snaps = await Promise.all(
    Array.from({ length: days }, (_, i) => {
      const d = new Date(fromISO + "T00:00:00");
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      return getDoc(doc(db, "users", uid, "entries", iso));
    }),
  );

  const entries: DailyProgressEntry[] = [];
  snaps.forEach((s) => {
    if (s.exists()) {
      entries.push(s.data() as DailyProgressEntry);
    }
  });
  return entries;
}

async function getCompletedDatesForHabit(uid: string, habitId: number): Promise<string[]> {
  const { db } = userRoot(uid);
  const snap = await getDocs(collection(db, "users", uid, "entries"));
  const dates = new Set<string>();
  for (const d of snap.docs) {
    const data = d.data() as any;
    const date = data.date || d.id;
    if (typeof date !== "string") continue;
    if (Array.isArray(data.habits)) {
      if (data.habits.some((h: any) => h.id === habitId && h.completed)) {
        dates.add(date);
      }
    } else if (data.habitId === habitId && data.completed) {
      dates.add(date);
    }
  }
  return Array.from(dates);
}

export async function getHabitCompletionRate(habitId: number): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDocs(collection(db, "users", uid, "entries"));
  let totalDays = 0;
  let completedDays = 0;
  for (const d of snap.docs) {
    const data = d.data() as any;
    if (Array.isArray(data.habits)) {
      totalDays++;
      if (data.habits.some((h: any) => h.id === habitId && h.completed)) {
        completedDays++;
      }
    } else if (data.habitId === habitId) {
      totalDays++;
      if (data.completed) completedDays++;
    }
  }
  if (totalDays === 0) return 0;
  return Math.round((completedDays / totalDays) * 100);
}

export async function getStreak(habitId: number): Promise<number> {
  const uid = await requireUid();
  const rows = await getCompletedDatesForHabit(uid, habitId);
  const dateSet = new Set(rows);

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!dateSet.has(iso)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function getLongestStreak(habitId: number): Promise<number> {
  const uid = await requireUid();
  const rows = (await getCompletedDatesForHabit(uid, habitId)).sort();
  if (rows.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1] + "T00:00:00");
    const cur = new Date(rows[i] + "T00:00:00");
    const diff = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
    if (diff === 1) {
      current++;
      longest = Math.max(longest, current);
    } else if (diff > 1) {
      current = 1;
    }
  }
  return longest;
}

/**
 * Overall streak: consecutive strong days (≥50% habits completed across all routines).
 * If today has not yet reached 50%, preserves the active unbroken streak carried over from yesterday.
 */
export async function getOverallStreak(uid?: string): Promise<number> {
  const resolvedUid = uid ?? (await requireUid());
  const { db } = userRoot(resolvedUid);

  if (
    !uid &&
    habitCache.overallStreak !== null &&
    Date.now() - habitCache.lastFetchedAt < 60000
  ) {
    return habitCache.overallStreak;
  }

  const entriesSnap = await getDocs(collection(db, "users", resolvedUid, "entries"));
  const entriesMap = new Map<string, any>();
  for (const d of entriesSnap.docs) {
    entriesMap.set(d.id, d.data());
  }

  const today = todayISO();

  const isDaySuccess = (dayKey: string): boolean => {
    let data: any = entriesMap.get(dayKey);
    if (dayKey === today && habitCache.todayEntry && habitCache.todayEntry.date === today) {
      data = habitCache.todayEntry;
    }
    if (!data) return false;

    if (typeof data.completionPercentage === "number") {
      return data.completionPercentage >= 50;
    }
    const total = Number(data.totalHabits ?? 0);
    const checked = Number(data.checkedHabits ?? data.completedCount ?? 0);
    if (total > 0) {
      return (checked / total) >= 0.5;
    }
    if (data.isDetoxDay && checked >= 1) {
      return true;
    }
    return false;
  };

  const todaySuccess = isDaySuccess(today);
  let streak = 0;

  if (todaySuccess) {
    streak = 1;
    let checkDate = addCalendarDays(today, -1);
    while (isDaySuccess(checkDate)) {
      streak += 1;
      checkDate = addCalendarDays(checkDate, -1);
    }
  } else {
    // Today is in-progress: count backwards from yesterday to preserve active streak
    let checkDate = addCalendarDays(today, -1);
    while (isDaySuccess(checkDate)) {
      streak += 1;
      checkDate = addCalendarDays(checkDate, -1);
    }
  }

  if (!uid) {
    habitCache.overallStreak = streak;
  }
  return streak;
}

// Mode streak: how many strong days of the active unbroken streak were spent in this mode.
export async function getModeStreak(mode: Mode): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);

  if (habitCache.modeStreaks.has(mode) && Date.now() - habitCache.lastFetchedAt < 60000) {
    return habitCache.modeStreaks.get(mode)!;
  }

  const habitsSnap = await getDocs(
    query(collection(db, "users", uid, "habits"), where("mode", "==", mode)),
  );
  const modeHabits = habitsSnap.docs
    .map((d) => d.data() as any)
    .filter((h) => h?.deleted !== true && !h?.archived);
  const modeHabitIds = new Set(modeHabits.map((h) => Number(h.id)));

  // Query entries subcollection
  const entriesSnap = await getDocs(collection(db, "users", uid, "entries"));
  const entriesMap = new Map<string, any>();
  for (const d of entriesSnap.docs) {
    entriesMap.set(d.id, d.data());
  }

  const today = todayISO();

  const isDayOverallSuccess = (dayKey: string): boolean => {
    let data: any = entriesMap.get(dayKey);
    if (dayKey === today && habitCache.todayEntry && habitCache.todayEntry.date === today) {
      data = habitCache.todayEntry;
    }
    if (!data) return false;

    if (typeof data.completionPercentage === "number") {
      return data.completionPercentage >= 50;
    }
    const total = Number(data.totalHabits ?? 0);
    const checked = Number(data.checkedHabits ?? data.completedCount ?? 0);
    if (total > 0) {
      return (checked / total) >= 0.5;
    }
    if (data.isDetoxDay && checked >= 1) {
      return true;
    }
    return false;
  };

  // Find all consecutive dates belonging to the current active unbroken streak
  const streakDates: string[] = [];
  const todaySuccess = isDayOverallSuccess(today);

  if (todaySuccess) {
    streakDates.push(today);
    let checkDate = addCalendarDays(today, -1);
    while (isDayOverallSuccess(checkDate)) {
      streakDates.push(checkDate);
      checkDate = addCalendarDays(checkDate, -1);
    }
  } else {
    // Today in progress: check if active streak carried over from yesterday
    let checkDate = addCalendarDays(today, -1);
    while (isDayOverallSuccess(checkDate)) {
      streakDates.push(checkDate);
      checkDate = addCalendarDays(checkDate, -1);
    }
  }

  if (streakDates.length === 0) {
    habitCache.modeStreaks.set(mode, 0);
    return 0;
  }

  const isModeSuccess = (dayKey: string): boolean => {
    let data: any = entriesMap.get(dayKey);
    if (dayKey === today && habitCache.todayEntry && habitCache.todayEntry.date === today) {
      data = habitCache.todayEntry;
    }
    if (!data) return false;

    // Check if mode recorded on the entry matches target mode
    const entryMode: Mode = (data.mode as Mode) ?? "home";
    const pct = typeof data.completionPercentage === "number" ? data.completionPercentage : null;
    const checked = Number(data.checkedHabits ?? data.completedCount ?? 0);
    const total = Number(data.totalHabits ?? 0);
    const dayPass = pct !== null ? pct >= 50 : total > 0 ? (checked / total) >= 0.5 : (data.isDetoxDay ? checked >= 1 : false);

    if (entryMode === mode && dayPass) {
      return true;
    }

    // Also check if habits array had >= 50% completed for this mode's habits
    if (Array.isArray(data.habits) && data.habits.length > 0 && modeHabits.length > 0) {
      const done = data.habits.filter((h: any) => modeHabitIds.has(Number(h.id)) && h.completed).length;
      if (done > 0 && (done / modeHabits.length) >= 0.5) {
        return true;
      }
    }

    return false;
  };

  let modeCount = 0;
  for (const d of streakDates) {
    if (isModeSuccess(d)) {
      modeCount++;
    }
  }

  habitCache.modeStreaks.set(mode, modeCount);
  return modeCount;
}

// ─── Analytics for streaks/insights screens ────────────────────

export interface PeriodStats {
  label: string;
  total: number;
  done: number;
  rate: number;
}

export type ModeComparison = {
  mode: Mode;
  total: number;
  done: number;
  rate: number;
};

export type ScreenTimeDiscipline = {
  date: string;
  screenTime: number;
  completionRate: number;
};

export interface InsightSignals {
  metricsDaysWithData: number;
  avgScreenOnRelapseDays: number | null;
  avgScreenOnCleanDays: number | null;
  relapseDaysHighScreen: number;
  totalRelapseDays: number;
  homeRate: number;
  hostelRate: number;
  homeTotal: number;
  hostelTotal: number;
  heatmapLast7Avg: number;
  heatmapPrior7Avg: number;
  currentStreak: number;
  longestStreak: number;
  todayDone: number;
  todayTotal: number;
}

export async function getGlobalStreak(): Promise<number> {
  return getHardModeStreak();
}

export async function getGlobalLongestStreak(): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDocs(collection(db, "users", uid, "entries"));
  const qualifyingDates: string[] = [];
  for (const d of snap.docs) {
    const data = d.data() as any;
    const date = data.date || d.id;
    if (typeof date !== "string") continue;
    const rate = typeof data.completionPercentage === "number"
      ? data.completionPercentage / 100
      : ((data.completedCount ?? 0) / Math.max(1, data.totalHabits ?? 1));
    if (rate >= 0.5) {
      qualifyingDates.push(date);
    }
  }
  qualifyingDates.sort();
  if (qualifyingDates.length === 0) return 0;

  let longest = 1;
  let current = 1;
  for (let i = 1; i < qualifyingDates.length; i++) {
    const prev = new Date(qualifyingDates[i - 1] + "T00:00:00");
    const cur = new Date(qualifyingDates[i] + "T00:00:00");
    const diff = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
    if (diff === 1) {
      current++;
      longest = Math.max(longest, current);
    } else if (diff > 1) {
      current = 1;
    }
  }
  return longest;
}

export async function getHeatmapData(days: number = 49, onlyDetox?: boolean): Promise<{ date: string; rate: number }[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const to = todayISO();
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  const fromISO = from.toISOString().slice(0, 10);

  const snap = await getDocs(collection(db, "users", uid, "entries"));
  const rateByDate = new Map<string, number>();
  for (const d of snap.docs) {
    const data = d.data() as any;
    const date = data.date || d.id;
    if (typeof date === "string" && date >= fromISO && date <= to) {
      if (onlyDetox && !data.isDetoxDay) {
        continue;
      }
      const rate = typeof data.completionPercentage === "number"
        ? Math.min(1, Math.max(0, data.completionPercentage / 100))
        : 0;
      rateByDate.set(date, rate);
    }
  }

  const result: { date: string; rate: number }[] = [];
  let cursor = new Date(fromISO + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    result.push({ date: iso, rate: rateByDate.get(iso) ?? 0 });
    cursor = new Date(cursor.getTime() + 86_400_000);
  }
  return result;
}


export async function getWeeklyStats(weeks: number = 4): Promise<PeriodStats[]> {
  const heat = await getHeatmapData(weeks * 7);
  const out: PeriodStats[] = [];
  for (let w = 0; w < weeks; w++) {
    const slice = heat.slice(-(w + 1) * 7, -w * 7 || undefined);
    const done = slice.reduce((s, x) => s + x.rate, 0);
    const avg = slice.length ? done / slice.length : 0;
    const label = w === 0 ? "This Week" : w === 1 ? "Last Week" : `${w}w ago`;
    out.push({ label, total: slice.length, done: Math.round(avg * slice.length), rate: Math.round(avg * 100) });
  }
  return out;
}

export async function getMonthlyStats(months: number = 6): Promise<PeriodStats[]> {
  // Approx: use heatmap of last 31*months days and bucket by month label.
  const heat = await getHeatmapData(months * 31);
  const bucket = new Map<string, { total: number; sum: number }>();
  for (const d of heat) {
    const m = d.date.slice(0, 7); // YYYY-MM
    const b = bucket.get(m) ?? { total: 0, sum: 0 };
    b.total += 1;
    b.sum += d.rate;
    bucket.set(m, b);
  }
  const keys = Array.from(bucket.keys()).sort().slice(-months);
  return keys
    .reverse()
    .map((k) => {
      const b = bucket.get(k)!;
      const avg = b.total ? b.sum / b.total : 0;
      return { label: k, total: b.total, done: Math.round(avg * b.total), rate: Math.round(avg * 100) };
    });
}

export async function getYearlyStats(): Promise<PeriodStats[]> {
  const heat = await getHeatmapData(366);
  const bucket = new Map<string, { total: number; sum: number }>();
  for (const d of heat) {
    const y = d.date.slice(0, 4);
    const b = bucket.get(y) ?? { total: 0, sum: 0 };
    b.total += 1;
    b.sum += d.rate;
    bucket.set(y, b);
  }
  const keys = Array.from(bucket.keys()).sort().slice(-3).reverse();
  return keys.map((y) => {
    const b = bucket.get(y)!;
    const avg = b.total ? b.sum / b.total : 0;
    return { label: y, total: b.total, done: Math.round(avg * b.total), rate: Math.round(avg * 100) };
  });
}

export async function getModeComparisonStats(): Promise<ModeComparison[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const habitsSnap = await getDocs(query(collection(db, "users", uid, "habits")));
  const habits = habitsSnap.docs
    .map((d) => d.data() as Habit)
    .filter((h) => (h as any)?.deleted !== true);
  const homeHabits = habits.filter((h) => h.mode === "home");
  const hostelHabits = habits.filter((h) => h.mode === "hostel");
  const day = todayISO();

  const dayDoc = await getDoc(doc(db, "users", uid, "entries", day));
  const dayData = dayDoc.exists() ? (dayDoc.data() as any) : null;
  const habitsArray = Array.isArray(dayData?.habits) ? dayData.habits : [];
  const completedIdSet = new Set(
    habitsArray.filter((h: any) => h.completed).map((h: any) => h.id),
  );

  const homeDone = homeHabits.filter((h) => completedIdSet.has(h.id)).length;
  const hostelDone = hostelHabits.filter((h) => completedIdSet.has(h.id)).length;
  const homeTotal = homeHabits.length;
  const hostelTotal = hostelHabits.length;

  return [
    { mode: "home", total: homeTotal, done: homeDone, rate: homeTotal ? Math.round((homeDone / homeTotal) * 100) : 0 },
    { mode: "hostel", total: hostelTotal, done: hostelDone, rate: hostelTotal ? Math.round((hostelDone / hostelTotal) * 100) : 0 },
  ];
}

export async function getScreenTimeVsDiscipline(_days: number = 14): Promise<ScreenTimeDiscipline[]> {
  // Screen time tracking is currently disabled in UI; return empty series.
  return [];
}

/** Aggregates `metrics_daily` for relapse vs screen-time insights. */
async function loadRelapseMetricsSlice(uid: string): Promise<{
  metricsDaysWithData: number;
  avgScreenOnRelapseDays: number | null;
  avgScreenOnCleanDays: number | null;
  relapseDaysHighScreen: number;
  totalRelapseDays: number;
}> {
  const { db } = userRoot(uid);
  const snap = await getDocs(query(collection(db, "users", uid, "metrics_daily"), limit(2500)));
  let metricsDaysWithData = 0;
  const relapseScreens: number[] = [];
  const cleanScreens: number[] = [];
  let relapseDaysHighScreen = 0;
  let totalRelapseDays = 0;
  for (const d of snap.docs) {
    const m = d.data() as Record<string, unknown>;
    const st = Number(m.screenTime ?? 0);
    const rel = Boolean(m.relapse);
    const hasAny =
      st > 0 ||
      Number(m.sleepMinutes ?? 0) > 0 ||
      Number(m.steps ?? 0) > 0 ||
      rel;
    if (hasAny) metricsDaysWithData++;
    if (rel) {
      totalRelapseDays++;
      if (st > 0) relapseScreens.push(st);
      if (st >= 200) relapseDaysHighScreen++;
    } else if (st > 0) {
      cleanScreens.push(st);
    }
  }
  const avg = (arr: number[]): number | null =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  return {
    metricsDaysWithData,
    avgScreenOnRelapseDays: avg(relapseScreens),
    avgScreenOnCleanDays: avg(cleanScreens),
    relapseDaysHighScreen,
    totalRelapseDays,
  };
}

export async function getInsightSignals(): Promise<InsightSignals> {
  const uid = await requireUid();
  const [modeComp, streak, longest, heatmap, todayHabits, relSlice] = await Promise.all([
    getModeComparisonStats(),
    getGlobalStreak(),
    getGlobalLongestStreak(),
    getHeatmapData(14),
    getTodayHabits(),
    loadRelapseMetricsSlice(uid),
  ]);

  const home = modeComp.find((m) => m.mode === "home");
  const hostel = modeComp.find((m) => m.mode === "hostel");
  const last7 = heatmap.slice(-7);
  const prior7 = heatmap.slice(-14, -7);
  const avg7 = (a: { rate: number }[]) => (a.length ? a.reduce((s, x) => s + x.rate, 0) / a.length : 0);

  const todayDone = todayHabits.filter((h) => h.completed).length;
  const todayTotal = todayHabits.length;

  return {
    ...relSlice,
    homeRate: home?.rate ?? 0,
    hostelRate: hostel?.rate ?? 0,
    homeTotal: home?.total ?? 0,
    hostelTotal: hostel?.total ?? 0,
    heatmapLast7Avg: avg7(last7),
    heatmapPrior7Avg: avg7(prior7),
    currentStreak: streak,
    longestStreak: longest,
    todayDone,
    todayTotal,
  };
}

// ─── Daily AI Coach Chat (`users/{uid}/coach_daily_chats/{date}`) ─────────────

export async function getDailyCoachChat(date: string = todayISO()): Promise<DailyCoachChatDoc | null> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDoc(doc(db, "users", uid, "coach_daily_chats", date));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    date: String(d.date ?? date),
    createdAt: Number(d.createdAt ?? Date.now()),
    exchanges: Array.isArray(d.exchanges) ? (d.exchanges as CoachExchange[]) : [],
  };
}

export async function saveCoachExchange(
  exchange: CoachExchange,
  date: string = todayISO(),
): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const docRef = doc(db, "users", uid, "coach_daily_chats", date);
  const snap = await getDoc(docRef);

  if (!snap.exists()) {
    await setDoc(docRef, {
      date,
      createdAt: Date.now(),
      updatedAt: serverTimestamp(),
      exchanges: [exchange],
    });
  } else {
    const existing = (snap.data()?.exchanges ?? []) as CoachExchange[];
    const idx = existing.findIndex((e) => e.id === exchange.id);
    let updatedExchanges: CoachExchange[];
    if (idx >= 0) {
      updatedExchanges = [...existing];
      updatedExchanges[idx] = exchange;
    } else {
      updatedExchanges = [...existing, exchange];
    }
    await setDoc(
      docRef,
      {
        date,
        updatedAt: serverTimestamp(),
        exchanges: updatedExchanges,
      },
      { merge: true },
    );
  }
}

export async function getAllCoachDailyChats(): Promise<DailyCoachChatDoc[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDocs(
    query(collection(db, "users", uid, "coach_daily_chats"), limit(400)),
  );
  const list: DailyCoachChatDoc[] = [];
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    list.push({
      date: String(data.date ?? d.id),
      createdAt: Number(data.createdAt ?? 0),
      exchanges: Array.isArray(data.exchanges) ? (data.exchanges as CoachExchange[]) : [],
    });
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getCoachChatsOlderThan(daysOld: number = 30): Promise<DailyCoachChatDoc[]> {
  const cutoffDate = addCalendarDays(todayISO(), -daysOld);
  const all = await getAllCoachDailyChats();
  return all.filter((doc) => doc.date < cutoffDate);
}

export async function deleteCoachChatDays(dates: string[]): Promise<void> {
  if (!dates || dates.length === 0) return;
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const batch = writeBatch(db);
  for (const d of dates) {
    batch.delete(doc(db, "users", uid, "coach_daily_chats", d));
  }
  await batch.commit();
}


// ─── Interventions (single daily document per date) ─────────────

export async function getDailyIntervention(date?: string): Promise<DailyInterventionDoc | null> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const day = date ?? todayISO();
  const snap = await getDoc(doc(db, "users", uid, "interventions", day));
  if (!snap.exists()) return null;
  return snap.data() as DailyInterventionDoc;
}

export async function recordDailyInterventionAction(
  actionLabel: string,
  totalPlanActions = 5,
  targetDate?: string,
): Promise<DailyInterventionDoc> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const day = targetDate ?? todayISO();
  const docRef = doc(db, "users", uid, "interventions", day);
  const nowIso = new Date().toISOString();

  // Read existing document for this date
  const snap = await getDoc(docRef);
  const existingData = snap.exists() ? (snap.data() as any) : null;
  const existingActions: RecoveryActionEntry[] = Array.isArray(existingData?.actions)
    ? existingData.actions
    : [];

  const existingIndex = existingActions.findIndex(
    (a) => a.action === actionLabel || a.actionName === actionLabel,
  );
  let updatedActions: RecoveryActionEntry[];

  if (existingIndex >= 0) {
    updatedActions = existingActions.map((a, i) =>
      i === existingIndex
        ? {
          ...a,
          action: actionLabel,
          actionName: actionLabel,
          completed: true,
          timestamp: nowIso,
        }
        : a,
    );
  } else {
    updatedActions = [
      ...existingActions,
      {
        action: actionLabel,
        actionName: actionLabel,
        completed: true,
        timestamp: nowIso,
      },
    ];
  }

  const completedActions = updatedActions.filter((a) => a.completed).length;
  const totalActions = totalPlanActions;
  const leftActions = Math.max(0, totalActions - completedActions);

  const docData: DailyInterventionDoc = {
    date: day,
    totalActions,
    completedActions,
    leftActions,
    actions: updatedActions,
  };

  await setDoc(
    docRef,
    {
      ...docData,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return docData;
}

export async function addIntervention(action: string): Promise<number> {
  await recordDailyInterventionAction(action);
  return Date.now();
}

export async function completeIntervention(_id: number): Promise<void> {
  // Marked completed inside recordDailyInterventionAction
}

// ─── Achievements unlocked (consolidated in users/{uid}/achievements/state) ───

export async function getUnlockedAchievementIds(): Promise<{ achievementId: string; unlockedAt: string }[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const ref = doc(db, "users", uid, "achievements", "state");
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const data = snap.data() as any;
  const list = Array.isArray(data?.unlockedAchievements) ? data.unlockedAchievements : [];
  return list
    .map((a: any) => ({
      achievementId: String(a.id ?? ""),
      unlockedAt: String(a.unlockedAt ?? ""),
    }))
    .filter((r: any) => r.achievementId);
}

export async function unlockAchievement(
  id: string,
  meta?: {
    title?: string;
    description?: string;
    icon?: { ios: string; android: string; web: string };
    type?: string;
  },
): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const ref = doc(db, "users", uid, "achievements", "state");
  const snap = await getDoc(ref);
  const data = (snap.data() as any) ?? {};
  const currentList: UnlockedAchievementItem[] = Array.isArray(data.unlockedAchievements)
    ? data.unlockedAchievements
    : [];
  if (currentList.some((item) => item.id === id)) return;
  const newItem: UnlockedAchievementItem = {
    id,
    title: meta?.title ?? id,
    unlockedAt: new Date().toISOString(),
  };
  await setDoc(
    ref,
    {
      unlockedAchievements: [...currentList, newItem],
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Achievement catalog from static master catalog (instant reads, no separate subcollection). */
export async function getAchievementDefinitions(): Promise<AchievementDefinition[]> {
  return MASTER_ACHIEVEMENTS.map((a) => ({
    id: a.id,
    type: a.type,
    title: a.title,
    description: a.description,
    icon: a.icon,
  }));
}

export async function getEntriesCompletionSummary(): Promise<{ total: number; done: number; rate: number }> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDocs(query(collection(db, "users", uid, "entries"), limit(10000)));
  const total = snap.size;
  const done = snap.docs.filter((d) => (d.data() as any)?.completed === true).length;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, rate };
}

export async function getTotalHabitsCount(): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDocs(query(collection(db, "users", uid, "habits")));
  return snap.docs.filter((d) => (d.data() as any)?.deleted !== true).length;
}

export async function getTotalChallengesCompleted(): Promise<number> {
  const uid = await requireUid();
  const state = await getChallengesState(uid);
  return state.completedChallenges.length;
}

export async function hasCompletedRecoveryPlanOnce(): Promise<boolean> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  // Check if any daily intervention document has completed actions >= 5
  const interventionsSnap = await getDocs(
    query(collection(db, "users", uid, "interventions"), limit(100)),
  );
  for (const d of interventionsSnap.docs) {
    const data = d.data() as any;
    if (typeof data?.completedActions === "number" && data.completedActions >= 5) {
      return true;
    }
    if (Array.isArray(data?.actions) && data.actions.filter((a: any) => a.completed).length >= 5) {
      return true;
    }
  }
  return false;
}

// Urge session helpers (kept for backwards compatibility)
export async function startUrgeToolSession(_sessionId?: number): Promise<number> {
  return Date.now();
}

export async function endUrgeToolSession(_sessionId: number): Promise<void> { }

export async function recordUrgeToolActionCompletion(_sessionId: number, _actionLabel: string): Promise<void> { }

// Essential habits: simple name allowlist (shared with existing)
const ESSENTIAL = new Set([
  "No Explicit Content",
  "No phone usage",
  "Namaz",
  "Quran",
  "Quran Reading",
  "Surah Mulk",
  "Fajr",
  "Zuhr",
  "Asr",
  "Maghrib",
  "Isha",
]);

export async function getEssentialHabitsToday(mode?: Mode) {
  const all = await getTodayHabits(mode);
  return all.filter((h) => ESSENTIAL.has(h.name));
}

// ─── Challenges (consolidated in users/{uid}/challenges/state) ─────────

function dateDiffInDays(d1: string, d2: string): number {
  const t1 = new Date(d1 + "T00:00:00").getTime();
  const t2 = new Date(d2 + "T00:00:00").getTime();
  return Math.round((t2 - t1) / 86400000);
}

async function addXpToUser(uid: string, xpAmount: number): Promise<void> {
  const { db } = userRoot(uid);
  const stateRef = doc(db, "users", uid, "meta", "state");
  try {
    const snap = await getDoc(stateRef);
    const cur = (snap.data() as any)?.user_level?.xp ?? 0;
    const xp = Math.max(0, cur + xpAmount);
    const rank =
      xp >= 2000
        ? "pro"
        : xp >= 900
          ? "advanced"
          : xp >= 250
            ? "intermediate"
            : "beginner";
    await setDoc(stateRef, { user_level: { xp, rank, updatedAt: serverTimestamp() } }, { merge: true });
  } catch (e) {
    console.warn("Failed to add XP to user:", e);
  }
}

export async function getChallengesState(uid?: string): Promise<ChallengesStateDoc> {
  const resolvedUid = uid ?? (await requireUid());
  const { db } = userRoot(resolvedUid);
  const ref = doc(db, "users", resolvedUid, "challenges", "state");
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data() as any;
    return {
      activeChallengeId: typeof data.activeChallengeId === "number" ? data.activeChallengeId : 1,
      currentProgress: typeof data.currentProgress === "number" ? data.currentProgress : 0,
      lastCompletedDate: typeof data.lastCompletedDate === "string" ? data.lastCompletedDate : null,
      completedChallenges: Array.isArray(data.completedChallenges) ? data.completedChallenges : [],
    };
  }
  const defaultState: ChallengesStateDoc = {
    activeChallengeId: 1,
    currentProgress: 0,
    lastCompletedDate: null,
    completedChallenges: [],
  };
  await setDoc(ref, { ...defaultState, updatedAt: serverTimestamp() }, { merge: true });
  return defaultState;
}

export async function syncAutoChallengeProgress(
  uid?: string,
  entry?: DailyProgressEntry | null,
): Promise<{ completedChallenge?: CompletedChallengeItem; nextChallengeId?: number } | null> {
  const resolvedUid = uid ?? (await requireUid());
  const { db } = userRoot(resolvedUid);
  const today = todayISO();

  // If entry not passed, retrieve today's entry
  let targetEntry = entry;
  if (!targetEntry) {
    if (habitCache.todayEntry && habitCache.todayEntry.date === today) {
      targetEntry = habitCache.todayEntry;
    } else {
      const entrySnap = await getDoc(doc(db, "users", resolvedUid, "entries", today));
      if (entrySnap.exists()) {
        targetEntry = entrySnap.data() as DailyProgressEntry;
      }
    }
  }

  const state = await getChallengesState(resolvedUid);
  let stateChanged = false;

  // Real unbroken overall streak based on historical entries
  const realStreak = await getOverallStreak(resolvedUid);

  // 1. Check if user missed a day before today:
  // If lastCompletedDate exists and diff > 1 (missed day) and realStreak is 0, reset currentProgress to 0!
  if (state.lastCompletedDate && state.lastCompletedDate !== today) {
    const diff = dateDiffInDays(state.lastCompletedDate, today);
    if (diff > 1 && realStreak === 0 && state.currentProgress > 0) {
      state.currentProgress = 0;
      stateChanged = true;
    }
  }

  // 2. Self-healing / alignment:
  // If the user's real unbroken streak is higher than currentProgress (e.g. from the previous bug that wiped progress to 0),
  // immediately restore currentProgress to the true streak!
  if (realStreak > state.currentProgress) {
    state.currentProgress = realStreak;
    stateChanged = true;
  }

  // Check if today qualifies as a success day (≥50%)
  const isSuccessDay = (targetEntry?.completionPercentage ?? 0) >= 50;
  if (isSuccessDay && state.lastCompletedDate !== today) {
    state.lastCompletedDate = today;
    if (state.currentProgress < realStreak) {
      state.currentProgress = realStreak;
    } else if (state.currentProgress === 0 && realStreak > 0) {
      state.currentProgress = realStreak;
    }
    stateChanged = true;
  }

  let completedItem: CompletedChallengeItem | undefined;

  // 3. Milestone progression:
  // Evaluate active challenge. Because challenges are streak milestones (1d, 3d, 5d, 7d...),
  // when a milestone is completed, advance to next challenge BUT DO NOT wipe currentProgress to 0!
  // The user carries their unbroken streak onward (e.g. 3 days carries into 5-day challenge, so Day 3/5).
  let activeDef =
    MASTER_CHALLENGES.find((c) => c.id === state.activeChallengeId) ??
    MASTER_CHALLENGES[0];

  while (
    activeDef &&
    state.currentProgress >= activeDef.duration &&
    state.activeChallengeId <= MASTER_CHALLENGES.length
  ) {
    const alreadyCompleted = state.completedChallenges.some((c) => c.id === activeDef.id);
    if (!alreadyCompleted) {
      completedItem = {
        id: activeDef.id,
        defId: activeDef.defId,
        name: activeDef.name,
        duration: activeDef.duration,
        xp: activeDef.xp,
        completedAt: new Date().toISOString(),
      };
      state.completedChallenges.push(completedItem);

      await unlockAchievement(activeDef.defId, {
        title: activeDef.name,
        description: activeDef.description,
      });

      await addXpToUser(resolvedUid, activeDef.xp);
      stateChanged = true;

      // Best-effort push notification
      if (Platform.OS !== "web") {
        try {
          const Notifications = await import("expo-notifications");
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "🏆 Challenge Completed!",
              body: `You completed "${completedItem.name}". Next challenge unlocked!`,
              sound: true,
            },
            trigger: null,
          });
        } catch { }
      }
    }

    if (state.activeChallengeId < MASTER_CHALLENGES.length) {
      state.activeChallengeId += 1;
      stateChanged = true;
      activeDef =
        MASTER_CHALLENGES.find((c) => c.id === state.activeChallengeId) ??
        MASTER_CHALLENGES[MASTER_CHALLENGES.length - 1];
    } else {
      break;
    }
  }

  if (stateChanged) {
    await setDoc(
      doc(db, "users", resolvedUid, "challenges", "state"),
      {
        activeChallengeId: state.activeChallengeId,
        currentProgress: state.currentProgress,
        lastCompletedDate: state.lastCompletedDate,
        completedChallenges: state.completedChallenges,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  return completedItem
    ? { completedChallenge: completedItem, nextChallengeId: state.activeChallengeId }
    : null;
}

export async function getChallenges(): Promise<Challenge[]> {
  const uid = await requireUid();
  await syncAutoChallengeProgress(uid).catch((err) => {
    console.warn("syncAutoChallengeProgress in getChallenges error:", err);
  });
  const state = await getChallengesState(uid);

  // Check if streak was broken since lastCompletedDate
  const today = todayISO();
  if (state.lastCompletedDate && state.currentProgress > 0) {
    const diff = dateDiffInDays(state.lastCompletedDate, today);
    if (diff > 1) {
      const realStreak = await getOverallStreak(uid);
      if (realStreak === 0) {
        state.currentProgress = 0;
        const { db } = userRoot(uid);
        await setDoc(
          doc(db, "users", uid, "challenges", "state"),
          { currentProgress: 0, updatedAt: serverTimestamp() },
          { merge: true },
        );
      } else {
        state.currentProgress = realStreak;
      }
    }
  }

  const completedMap = new Map<number, CompletedChallengeItem>();
  for (const c of state.completedChallenges) {
    completedMap.set(c.id, c);
  }

  return MASTER_CHALLENGES.map((mc) => {
    const completed = completedMap.get(mc.id);
    const isCompleted = !!completed;
    const isActive = mc.id === state.activeChallengeId && !isCompleted;

    let status: ChallengeStatus = "locked";
    let progress = 0;
    let startedAt: string | null = null;
    let completedAt: string | null = null;

    if (isCompleted) {
      status = "completed";
      progress = mc.duration;
      completedAt = completed.completedAt;
      startedAt = completed.completedAt;
    } else if (isActive) {
      status = "active";
      progress = state.currentProgress;
      startedAt = state.lastCompletedDate ?? new Date().toISOString();
      completedAt = null;
    } else {
      status = "locked";
      progress = 0;
      startedAt = null;
      completedAt = null;
    }

    return {
      id: mc.id,
      defId: mc.defId,
      name: mc.name,
      description: mc.description,
      duration: mc.duration,
      progress,
      startedAt,
      completedAt,
      category: mc.category as ChallengeCategory,
      rules: mc.rules,
      difficulty: mc.difficulty,
      xp: mc.xp,
      status,
    };
  });
}

export async function startChallenge(id: number): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const realStreak = await getOverallStreak(uid);
  await setDoc(
    doc(db, "users", uid, "challenges", "state"),
    { activeChallengeId: id, currentProgress: realStreak, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function incrementChallengeProgress(id: number): Promise<boolean> {
  const uid = await requireUid();
  const state = await getChallengesState(uid);
  if (state.activeChallengeId !== id) return false;
  const activeDef = MASTER_CHALLENGES.find((c) => c.id === id) ?? MASTER_CHALLENGES[0];
  const next = state.currentProgress + 1;
  const finished = next >= activeDef.duration;
  state.currentProgress = next;
  if (finished) {
    state.completedChallenges.push({
      id: activeDef.id,
      defId: activeDef.defId,
      name: activeDef.name,
      duration: activeDef.duration,
      xp: activeDef.xp,
      completedAt: new Date().toISOString(),
    });
    if (state.activeChallengeId < MASTER_CHALLENGES.length) {
      state.activeChallengeId += 1;
    }
  }
  const { db } = userRoot(uid);
  await setDoc(
    doc(db, "users", uid, "challenges", "state"),
    {
      activeChallengeId: state.activeChallengeId,
      currentProgress: state.currentProgress,
      completedChallenges: state.completedChallenges,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return finished;
}

export async function resetChallenge(id: number): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await setDoc(
    doc(db, "users", uid, "challenges", "state"),
    { currentProgress: 0, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function getChallengeStats(): Promise<ChallengeStats> {
  const uid = await requireUid();
  const state = await getChallengesState(uid);
  const totalCompleted = state.completedChallenges.length;
  const totalDaysCompleted =
    state.completedChallenges.reduce((s, r) => s + (r.duration ?? 0), 0) +
    state.currentProgress;
  return { totalCompleted, totalDaysCompleted };
}

export async function getChallengeCompletionHistory(limitN = 50): Promise<ChallengeCompletionRecord[]> {
  const uid = await requireUid();
  const state = await getChallengesState(uid);
  return state.completedChallenges
    .slice(-limitN)
    .reverse()
    .map((c) => ({
      id: c.id,
      sourceChallengeId: c.id,
      name: c.name,
      duration: c.duration,
      completedAt: c.completedAt,
    }));
}

// ─── Metrics (daily vitals / screen time) — Firestore `metrics_daily` ─────

export async function saveMetrics(
  data: Partial<Omit<Metrics, "date">> & { date?: string },
): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const day = data.date ?? todayISO();
  const ref = doc(db, "users", uid, "metrics_daily", day);
  const snap = await getDoc(ref);
  const existing = snap.data() as Record<string, unknown> | undefined;
  const screenTime = data.screenTime ?? Number(existing?.screenTime ?? 0);
  const riskScore = data.riskScore ?? Number(existing?.riskScore ?? 0);
  const relapse =
    data.relapse !== undefined ? (data.relapse ? 1 : 0) : Number(existing?.relapse ? 1 : 0);
  const sleepMinutes = data.sleepMinutes ?? Number(existing?.sleepMinutes ?? 0);
  const steps = data.steps ?? Number(existing?.steps ?? 0);
  const waterGlasses =
    data.waterGlasses !== undefined
      ? Number(data.waterGlasses)
      : existing?.waterGlasses !== undefined
        ? Number(existing.waterGlasses)
        : undefined;
  const heightCm =
    data.heightCm !== undefined
      ? Number(data.heightCm)
      : existing?.heightCm !== undefined
        ? Number(existing.heightCm)
        : undefined;
  const weightKg =
    data.weightKg !== undefined
      ? Number(data.weightKg)
      : existing?.weightKg !== undefined
        ? Number(existing.weightKg)
        : undefined;
  const bedTime =
    data.bedTime !== undefined
      ? data.bedTime
      : (existing?.bedTime as string | undefined);
  const wakeTime =
    data.wakeTime !== undefined
      ? data.wakeTime
      : (existing?.wakeTime as string | undefined);
  const energyRating =
    data.energyRating !== undefined
      ? data.energyRating
      : (existing?.energyRating as EnergyLevel | undefined);
  const moodRating =
    data.moodRating !== undefined
      ? data.moodRating
      : (existing?.moodRating as MoodState | undefined);
  const outdoorMinutes =
    data.outdoorMinutes !== undefined
      ? Number(data.outdoorMinutes)
      : existing?.outdoorMinutes !== undefined
        ? Number(existing.outdoorMinutes)
        : undefined;
  const stretchingMinutes =
    data.stretchingMinutes !== undefined
      ? Number(data.stretchingMinutes)
      : existing?.stretchingMinutes !== undefined
        ? Number(existing.stretchingMinutes)
        : undefined;
  const workoutMinutes =
    data.workoutMinutes !== undefined
      ? Number(data.workoutMinutes)
      : existing?.workoutMinutes !== undefined
        ? Number(existing.workoutMinutes)
        : undefined;
  const walkMinutes =
    data.walkMinutes !== undefined
      ? Number(data.walkMinutes)
      : existing?.walkMinutes !== undefined
        ? Number(existing.walkMinutes)
        : undefined;
  const deepWorkMinutes =
    data.deepWorkMinutes !== undefined
      ? Number(data.deepWorkMinutes)
      : existing?.deepWorkMinutes !== undefined
        ? Number(existing.deepWorkMinutes)
        : undefined;

  const payload: any = {
    date: day,
    screenTime,
    riskScore,
    relapse,
    sleepMinutes,
    steps,
    updatedAt: serverTimestamp(),
  };
  if (waterGlasses !== undefined) payload.waterGlasses = waterGlasses;
  if (heightCm !== undefined) payload.heightCm = heightCm;
  if (weightKg !== undefined) payload.weightKg = weightKg;
  if (bedTime !== undefined) payload.bedTime = bedTime;
  if (wakeTime !== undefined) payload.wakeTime = wakeTime;
  if (energyRating !== undefined) payload.energyRating = energyRating;
  if (moodRating !== undefined) payload.moodRating = moodRating;
  if (outdoorMinutes !== undefined) payload.outdoorMinutes = outdoorMinutes;
  if (stretchingMinutes !== undefined) payload.stretchingMinutes = stretchingMinutes;
  if (workoutMinutes !== undefined) payload.workoutMinutes = workoutMinutes;
  if (walkMinutes !== undefined) payload.walkMinutes = walkMinutes;
  if (deepWorkMinutes !== undefined) payload.deepWorkMinutes = deepWorkMinutes;

  await setDoc(ref, payload, { merge: true });
}

export async function getMetrics(date?: string): Promise<Metrics | null> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const day = date ?? todayISO();
  const snap = await getDoc(doc(db, "users", uid, "metrics_daily", day));
  if (!snap.exists()) return null;
  const m = snap.data() as Record<string, unknown>;
  return {
    date: day,
    screenTime: Number(m.screenTime ?? 0),
    riskScore: Number(m.riskScore ?? 0),
    relapse: Number(m.relapse ? 1 : 0),
    sleepMinutes: Number(m.sleepMinutes ?? 0),
    steps: Number(m.steps ?? 0),
    waterGlasses: m.waterGlasses !== undefined ? Number(m.waterGlasses) : undefined,
    heightCm: m.heightCm !== undefined ? Number(m.heightCm) : undefined,
    weightKg: m.weightKg !== undefined ? Number(m.weightKg) : undefined,
    bedTime: m.bedTime as string | undefined,
    wakeTime: m.wakeTime as string | undefined,
    energyRating: m.energyRating as EnergyLevel | undefined,
    moodRating: m.moodRating as MoodState | undefined,
    outdoorMinutes: m.outdoorMinutes !== undefined ? Number(m.outdoorMinutes) : undefined,
    stretchingMinutes: m.stretchingMinutes !== undefined ? Number(m.stretchingMinutes) : undefined,
    workoutMinutes: m.workoutMinutes !== undefined ? Number(m.workoutMinutes) : undefined,
    walkMinutes: m.walkMinutes !== undefined ? Number(m.walkMinutes) : undefined,
    deepWorkMinutes: m.deepWorkMinutes !== undefined ? Number(m.deepWorkMinutes) : undefined,
  };
}

export async function getMetricsRange(from: string, to: string): Promise<Metrics[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDocs(query(collection(db, "users", uid, "metrics_daily"), limit(4000)));
  const rows: Metrics[] = [];
  for (const d of snap.docs) {
    const day = String(d.id);
    if (day < from || day > to) continue;
    const m = d.data() as Record<string, unknown>;
    rows.push({
      date: day,
      screenTime: Number(m.screenTime ?? 0),
      riskScore: Number(m.riskScore ?? 0),
      relapse: Number(m.relapse ? 1 : 0),
      sleepMinutes: Number(m.sleepMinutes ?? 0),
      steps: Number(m.steps ?? 0),
      waterGlasses: m.waterGlasses !== undefined ? Number(m.waterGlasses) : undefined,
      heightCm: m.heightCm !== undefined ? Number(m.heightCm) : undefined,
      weightKg: m.weightKg !== undefined ? Number(m.weightKg) : undefined,
      bedTime: m.bedTime as string | undefined,
      wakeTime: m.wakeTime as string | undefined,
      energyRating: m.energyRating as EnergyLevel | undefined,
      moodRating: m.moodRating as MoodState | undefined,
      outdoorMinutes: m.outdoorMinutes !== undefined ? Number(m.outdoorMinutes) : undefined,
      stretchingMinutes: m.stretchingMinutes !== undefined ? Number(m.stretchingMinutes) : undefined,
      workoutMinutes: m.workoutMinutes !== undefined ? Number(m.workoutMinutes) : undefined,
      walkMinutes: m.walkMinutes !== undefined ? Number(m.walkMinutes) : undefined,
      deepWorkMinutes: m.deepWorkMinutes !== undefined ? Number(m.deepWorkMinutes) : undefined,
    });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Relapse logging & stats ───────────────────────────────────

export async function logRelapseEvent(opts: { triggerTag: string; note?: string }): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const now = new Date();
  const day = todayISO();
  const hour = now.getHours();
  const evRef = doc(collection(db, "users", uid, "relapse_events"));
  const mRef = doc(db, "users", uid, "metrics_daily", day);
  await runTransaction(db, async (tx) => {
    // 1. Reads before writes
    const mSnap = await tx.get(mRef);
    const prev = mSnap.data() as Record<string, unknown> | undefined;

    // 2. Writes
    tx.set(evRef, {
      occurredAt: serverTimestamp(),
      date: day,
      triggerTag: opts.triggerTag,
      note: opts.note ?? "",
      hourOfDay: hour,
      createdAt: serverTimestamp(),
    });
    tx.set(
      doc(db, "users", uid, "relapse_days", day),
      { date: day, updatedAt: serverTimestamp() },
      { merge: true },
    );
    tx.set(
      mRef,
      {
        date: day,
        screenTime: Number(prev?.screenTime ?? 0),
        riskScore: Number(prev?.riskScore ?? 0),
        relapse: 1,
        sleepMinutes: Number(prev?.sleepMinutes ?? 0),
        steps: Number(prev?.steps ?? 0),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  });
}

function timestampToIso(v: unknown): string {
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof v === "string") return v;
  return "";
}

export async function getRelapseEvents(max = 50): Promise<RelapseEvent[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDocs(query(collection(db, "users", uid, "relapse_events"), limit(200)));
  const rows = snap.docs
    .map((d) => {
      const x = d.data() as Record<string, unknown>;
      const at = timestampToIso(x.occurredAt ?? x.createdAt);
      return {
        atMs: at ? Date.parse(at) : 0,
        row: {
          id: 0,
          occurredAt: at,
          triggerTag: String(x.triggerTag ?? ""),
          note: String(x.note ?? ""),
          hourOfDay: Number(x.hourOfDay ?? 0),
        } as RelapseEvent,
      };
    })
    .sort((a, b) => b.atMs - a.atMs)
    .slice(0, max);
  return rows.map((r, i) => ({ ...r.row, id: i }));
}

export async function getRelapseCount(): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDocs(collection(db, "users", uid, "relapse_days"));
  return snap.size;
}

export async function getRelapseCountsLastTwoWindows(): Promise<{
  last30: number;
  prev30: number;
}> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const end = todayISO();
  const lastStart = addCalendarDays(end, -29);
  const prevEnd = addCalendarDays(end, -30);
  const prevStart = addCalendarDays(end, -59);
  const [lastSnap, prevSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, "users", uid, "relapse_days"),
        where(documentId(), ">=", lastStart),
        where(documentId(), "<=", end),
      ),
    ),
    getDocs(
      query(
        collection(db, "users", uid, "relapse_days"),
        where(documentId(), ">=", prevStart),
        where(documentId(), "<=", prevEnd),
      ),
    ),
  ]);
  return { last30: lastSnap.size, prev30: prevSnap.size };
}

export async function getTopRelapseTrigger(): Promise<{ tag: string; count: number } | null> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDocs(query(collection(db, "users", uid, "relapse_events"), limit(400)));
  const counts = new Map<string, number>();
  for (const d of snap.docs) {
    const tag = String((d.data() as any).triggerTag ?? "");
    if (!tag) continue;
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  let best: { tag: string; count: number } | null = null;
  for (const [tag, count] of counts) {
    if (!best || count > best.count) best = { tag, count };
  }
  return best;
}

export async function getRiskiestRelapseHour(): Promise<{ hour: number; count: number } | null> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDocs(query(collection(db, "users", uid, "relapse_events"), limit(400)));
  const counts = new Map<number, number>();
  for (const d of snap.docs) {
    const h = Number((d.data() as any).hourOfDay ?? 0);
    counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  let best: { hour: number; count: number } | null = null;
  for (const [hour, count] of counts) {
    if (!best || count > best.count) best = { hour, count };
  }
  return best;
}

export type LifeAreaBalanceRow = {
  lifeArea: LifeArea;
  total: number;
  done: number;
};

export async function getLifeAreaBalance(days = 7): Promise<LifeAreaBalanceRow[]> {
  const uid = await requireUid();
  await ensureSeeded(uid);
  const { db } = userRoot(uid);
  const to = todayISO();
  const from = addCalendarDays(to, -days + 1);
  const habitsSnap = await getDocs(query(collection(db, "users", uid, "habits"), orderBy("sortOrder", "asc")));
  const habits = habitsSnap.docs
    .map((d) => d.data() as Habit)
    .filter((h) => (h as any)?.deleted !== true);
  const byHabit = new Map<number, { total: number; done: number }>();
  await forEachDocInBatches(
    query(collection(db, "users", uid, "entries"), orderBy(documentId())),
    async (docs) => {
      for (const d of docs) {
        const e = d.data() as any;
        const date = e.date || d.id;
        if (!date || date < from || date > to) continue;
        if (Array.isArray(e.habits)) {
          for (const h of e.habits) {
            if (typeof h?.id !== "number") continue;
            const row = byHabit.get(h.id) ?? { total: 0, done: 0 };
            row.total += 1;
            if (h.completed) row.done += 1;
            byHabit.set(h.id, row);
          }
        } else if (typeof e.habitId === "number") {
          const row = byHabit.get(e.habitId) ?? { total: 0, done: 0 };
          row.total += 1;
          if (e.completed) row.done += 1;
          byHabit.set(e.habitId, row);
        }
      }
    },
  );
  const areas: LifeArea[] = ["spiritual", "physical", "mental", "work"];
  const agg = new Map<LifeArea, { total: number; done: number }>();
  for (const a of areas) agg.set(a, { total: 0, done: 0 });
  for (const h of habits) {
    const b = byHabit.get(h.id) ?? { total: 0, done: 0 };
    const area: LifeArea =
      h.lifeArea && agg.has(h.lifeArea as LifeArea)
        ? (h.lifeArea as LifeArea)
        : "mental";
    const cur = agg.get(area) ?? { total: 0, done: 0 };
    cur.total += b.total;
    cur.done += b.done;
    agg.set(area, cur);
  }
  return areas.map((lifeArea) => {
    const r = agg.get(lifeArea)!;
    return { lifeArea, total: r.total, done: r.done };
  });
}

export type WeekdayWeekendStats = {
  weekdayRate: number;
  weekendRate: number;
  weekdayTotal: number;
  weekendTotal: number;
};

export async function getWeekdayWeekendCompletion(): Promise<WeekdayWeekendStats> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  let weekdayTotal = 0;
  let weekdayDone = 0;
  let weekendTotal = 0;
  let weekendDone = 0;
  await forEachDocInBatches(
    query(collection(db, "users", uid, "entries"), orderBy(documentId())),
    async (docs) => {
      for (const d of docs) {
        const e = d.data() as any;
        const date = e.date || d.id;
        if (!date) continue;
        const w = new Date(date + "T12:00:00").getDay();
        const weekend = w === 0 || w === 6;
        if (Array.isArray(e.habits)) {
          const total = e.habits.length;
          const done = e.habits.filter((h: any) => h.completed).length;
          if (weekend) {
            weekendTotal += total;
            weekendDone += done;
          } else {
            weekdayTotal += total;
            weekdayDone += done;
          }
        } else if (e.date) {
          if (weekend) {
            weekendTotal += 1;
            if (e.completed) weekendDone += 1;
          } else {
            weekdayTotal += 1;
            if (e.completed) weekdayDone += 1;
          }
        }
      }
    },
  );
  return {
    weekdayRate: weekdayTotal > 0 ? Math.round((weekdayDone / weekdayTotal) * 100) : 0,
    weekendRate: weekendTotal > 0 ? Math.round((weekendDone / weekendTotal) * 100) : 0,
    weekdayTotal,
    weekendTotal,
  };
}

export async function getMostMissedHabit(): Promise<{ name: string; missed: number } | null> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const habitsSnap = await getDocs(collection(db, "users", uid, "habits"));
  const habitNames = new Map<number, string>();
  for (const d of habitsSnap.docs) {
    const h = d.data() as Habit & { deleted?: boolean };
    if (h.deleted) continue;
    habitNames.set(h.id, h.name);
  }
  const snap = await getDocs(
    query(collection(db, "users", uid, "entries"), limit(8000)),
  );
  const missedBy = new Map<number, number>();
  for (const d of snap.docs) {
    const e = d.data() as any;
    if (Array.isArray(e.habits)) {
      for (const h of e.habits) {
        if (!h.completed) {
          missedBy.set(h.id, (missedBy.get(h.id) ?? 0) + 1);
        }
      }
    } else if (typeof e.habitId === "number" && !e.completed) {
      missedBy.set(e.habitId, (missedBy.get(e.habitId) ?? 0) + 1);
    }
  }
  let best: { id: number; n: number } | null = null;
  for (const [hid, n] of missedBy) {
    if (!best || n > best.n) best = { id: hid, n };
  }
  if (!best) return null;
  const name = habitNames.get(best.id);
  if (!name) return null;
  return { name, missed: best.n };
}

export async function getMemberSinceYear(): Promise<number | null> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDocs(collection(db, "users", uid, "habits"));
  let minIso: string | null = null;
  for (const d of snap.docs) {
    const h = d.data() as { createdAt?: string; deleted?: boolean };
    if (h.deleted) continue;
    const c = h.createdAt;
    if (typeof c === "string" && (!minIso || c < minIso)) minIso = c;
  }
  if (!minIso) return null;
  const y = new Date(minIso + "T12:00:00").getFullYear();
  return Number.isFinite(y) ? y : null;
}


/** Persists latest insight signals + rolling daily map under `meta/insights`. */
async function persistInsightsMeta(uid: string): Promise<void> {
  const { db } = userRoot(uid);
  const day = todayISO();
  const sig = await getInsightSignals();
  await migrateMetaDocsToState(uid);
  const stateRef = doc(db, "users", uid, "meta", "state");
  const prevSnap = await getDoc(stateRef);
  const prev = prevSnap.data() as { insights?: { daily?: Record<string, Record<string, number>> } } | undefined;
  const daily = { ...(prev?.insights?.daily ?? {}) };
  daily[day] = {
    homeRate: sig.homeRate,
    hostelRate: sig.hostelRate,
    heatmapLast7Avg: sig.heatmapLast7Avg,
    heatmapPrior7Avg: sig.heatmapPrior7Avg,
    currentStreak: sig.currentStreak,
    todayDone: sig.todayDone,
    todayTotal: sig.todayTotal,
    totalRelapseDays: sig.totalRelapseDays,
  };
  const keys = Object.keys(daily).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - 120))) {
    delete daily[k];
  }
  await setDoc(
    stateRef,
    {
      updatedAt: serverTimestamp(),
      insights: {
        updatedAt: serverTimestamp(),
        lastComputedDay: day,
        latest: {
          metricsDaysWithData: sig.metricsDaysWithData,
          avgScreenOnRelapseDays: sig.avgScreenOnRelapseDays,
          avgScreenOnCleanDays: sig.avgScreenOnCleanDays,
          relapseDaysHighScreen: sig.relapseDaysHighScreen,
          totalRelapseDays: sig.totalRelapseDays,
          homeRate: sig.homeRate,
          hostelRate: sig.hostelRate,
          homeTotal: sig.homeTotal,
          hostelTotal: sig.hostelTotal,
          heatmapLast7Avg: sig.heatmapLast7Avg,
          heatmapPrior7Avg: sig.heatmapPrior7Avg,
          currentStreak: sig.currentStreak,
          longestStreak: sig.longestStreak,
          todayDone: sig.todayDone,
          todayTotal: sig.todayTotal,
        },
        daily,
      },
    },
    { merge: true },
  );
}

// ─── Deep Work & Focus — Firestore `deep_work_tasks` & `deep_work_sessions` ─────

const DEFAULT_DEEP_WORK_TASKS: Array<{
  title: string;
  category: DeepWorkCategory;
  type: DeepWorkTaskType;
  eventTime?: string;
  targetMinutes: number;
}> = [
    { title: "Design Sprint: Wireframing UX", category: "work", type: "event", eventTime: "10:30 am", targetMinutes: 50 },
    { title: "Fix Auth State Crash in Deep Work", category: "programming", type: "todo", targetMinutes: 25 },
    { title: "Review React Native Reanimated v3", category: "learning", type: "todo", targetMinutes: 25 },
    { title: "Deep Work Book - Chapter 4 Notes", category: "reading", type: "todo", targetMinutes: 25 },
  ];

export async function getDeepWorkTasks(date: string = todayISO()): Promise<DeepWorkTask[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const tasksRef = collection(db, "users", uid, "deep_work_tasks");

  try {
    const q = query(tasksRef, where("date", "==", date));
    const snap = await getDocs(q);

    // If no tasks exist for today, check if this user ever seeded tasks
    if (snap.empty && date === todayISO()) {
      const anyTasksSnap = await getDocs(query(tasksRef, limit(1)));
      if (anyTasksSnap.empty) {
        // Seed initial default tasks for today
        const createdList: DeepWorkTask[] = [];
        const batch = writeBatch(db);
        for (const t of DEFAULT_DEEP_WORK_TASKS) {
          const docRef = doc(tasksRef);
          const item: DeepWorkTask = {
            id: docRef.id,
            title: t.title,
            category: t.category,
            type: t.type,
            eventTime: t.eventTime ?? null,
            date: date,
            completed: 0,
            targetMinutes: t.targetMinutes,
            completedMinutes: 0,
            createdAt: new Date().toISOString(),
          };
          batch.set(docRef, {
            ...item,
            updatedAt: serverTimestamp(),
          });
          createdList.push(item);
        }
        await batch.commit();
        return createdList;
      }
    }

    const tasks: DeepWorkTask[] = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        title: String(data.title ?? ""),
        category: (data.category as DeepWorkCategory) ?? "other",
        type: (data.type as DeepWorkTaskType) ?? "todo",
        eventTime: data.eventTime ? String(data.eventTime) : null,
        date: String(data.date ?? date),
        completed: Number(data.completed ?? 0),
        targetMinutes: Number(data.targetMinutes ?? 25),
        completedMinutes: Number(data.completedMinutes ?? 0),
        createdAt: String(data.createdAt ?? ""),
      };
    });

    // Sort: events first, then by createdAt
    return tasks.sort((a, b) => {
      if (a.type !== b.type) return a.type === "event" ? -1 : 1;
      return (a.createdAt || "").localeCompare(b.createdAt || "");
    });
  } catch (e) {
    console.warn("getDeepWorkTasks failed in Firestore:", e);
    return [];
  }
}

export async function addDeepWorkTask(
  task: Omit<DeepWorkTask, "id" | "createdAt" | "completedMinutes" | "completed"> & {
    id?: string | number;
    completedMinutes?: number;
    completed?: number;
  },
): Promise<string> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const tasksRef = collection(db, "users", uid, "deep_work_tasks");
  const docRef = doc(tasksRef);
  const now = new Date().toISOString();

  await setDoc(docRef, {
    title: task.title,
    category: task.category,
    type: task.type,
    eventTime: task.eventTime ?? null,
    date: task.date,
    completed: task.completed ?? 0,
    targetMinutes: task.targetMinutes,
    completedMinutes: task.completedMinutes ?? 0,
    createdAt: now,
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function toggleDeepWorkTask(
  id: string | number,
  completed: boolean,
): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const ref = doc(db, "users", uid, "deep_work_tasks", String(id));
  await updateDoc(ref, {
    completed: completed ? 1 : 0,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDeepWorkTask(id: string | number): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const ref = doc(db, "users", uid, "deep_work_tasks", String(id));
  await deleteDoc(ref);
}

export async function updateDeepWorkTaskMinutes(
  id: string | number,
  addedMinutes: number,
): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const ref = doc(db, "users", uid, "deep_work_tasks", String(id));
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    const current = Number(data.completedMinutes ?? 0);
    await updateDoc(ref, {
      completedMinutes: current + addedMinutes,
      updatedAt: serverTimestamp(),
    });
  }
}

export async function saveDeepWorkSession(
  session: Omit<DeepWorkSession, "id">,
): Promise<string> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const sessionsRef = collection(db, "users", uid, "deep_work_sessions");
  const docRef = doc(sessionsRef);

  await setDoc(docRef, {
    taskId: session.taskId != null ? String(session.taskId) : null,
    taskTitle: session.taskTitle,
    category: session.category,
    scheduledMinutes: session.scheduledMinutes,
    actualMinutes: session.actualMinutes,
    status: session.status,
    abandonReason: session.abandonReason ?? null,
    interruptionCount: session.interruptionCount,
    date: session.date,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    createdAt: serverTimestamp(),
  });

  if (session.taskId && session.actualMinutes > 0) {
    try {
      await updateDeepWorkTaskMinutes(session.taskId, session.actualMinutes);
    } catch (e) {
      console.warn("Failed updating task minutes in Firestore:", e);
    }
  }

  // Update daily metrics with focus minutes
  try {
    const currentMetrics = await getMetrics(session.date);
    const existingMins = Number(currentMetrics?.deepWorkMinutes ?? 0);
    await saveMetrics({
      date: session.date,
      deepWorkMinutes: existingMins + session.actualMinutes,
    });
  } catch (e) {
    console.warn("Failed updating daily metrics with deep work minutes:", e);
  }

  return docRef.id;
}

export async function getDeepWorkSessions(
  date?: string,
): Promise<DeepWorkSession[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const sessionsRef = collection(db, "users", uid, "deep_work_sessions");

  try {
    const q = date
      ? query(sessionsRef, where("date", "==", date), limit(200))
      : query(sessionsRef, limit(200));

    const snap = await getDocs(q);
    const list: DeepWorkSession[] = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        taskId: data.taskId != null ? String(data.taskId) : null,
        taskTitle: String(data.taskTitle ?? "Focus Session"),
        category: (data.category as DeepWorkCategory) ?? "other",
        scheduledMinutes: Number(data.scheduledMinutes ?? 25),
        actualMinutes: Number(data.actualMinutes ?? 0),
        status: (data.status as DeepWorkSession["status"]) ?? "completed",
        abandonReason: data.abandonReason ? String(data.abandonReason) : null,
        interruptionCount: Number(data.interruptionCount ?? 0),
        date: String(data.date ?? todayISO()),
        startedAt: String(data.startedAt ?? ""),
        endedAt: String(data.endedAt ?? ""),
      };
    });

    // Sort by startedAt or endedAt descending
    return list.sort((a, b) => (b.startedAt || b.endedAt || "").localeCompare(a.startedAt || a.endedAt || ""));
  } catch (e) {
    console.warn("getDeepWorkSessions failed in Firestore:", e);
    return [];
  }
}

export async function getLastDeepWorkSession(): Promise<DeepWorkSession | null> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const sessionsRef = collection(db, "users", uid, "deep_work_sessions");

  try {
    const q = query(sessionsRef, limit(50));
    const snap = await getDocs(q);
    if (snap.empty) return null;

    const list: DeepWorkSession[] = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        taskId: data.taskId != null ? String(data.taskId) : null,
        taskTitle: String(data.taskTitle ?? "Focus Session"),
        category: (data.category as DeepWorkCategory) ?? "other",
        scheduledMinutes: Number(data.scheduledMinutes ?? 25),
        actualMinutes: Number(data.actualMinutes ?? 0),
        status: (data.status as DeepWorkSession["status"]) ?? "completed",
        abandonReason: data.abandonReason ? String(data.abandonReason) : null,
        interruptionCount: Number(data.interruptionCount ?? 0),
        date: String(data.date ?? todayISO()),
        startedAt: String(data.startedAt ?? ""),
        endedAt: String(data.endedAt ?? ""),
      };
    });

    list.sort((a, b) => (b.endedAt || b.startedAt || "").localeCompare(a.endedAt || a.startedAt || ""));
    return list[0] ?? null;
  } catch (e) {
    console.warn("getLastDeepWorkSession failed in Firestore:", e);
    return null;
  }
}

export async function getDeepWorkWeeklySummary(
  endDate: string = todayISO(),
): Promise<{ date: string; minutes: number }[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const sessionsRef = collection(db, "users", uid, "deep_work_sessions");

  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    dates.push(addCalendarDays(endDate, -i));
  }

  const out: Record<string, number> = {};
  for (const d of dates) {
    out[d] = 0;
  }

  try {
    const q = query(sessionsRef, limit(300));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>;
      const sDate = String(data.date ?? "");
      if (out[sDate] !== undefined) {
        out[sDate] += Number(data.actualMinutes ?? 0);
      }
    }
  } catch (e) {
    console.warn("getDeepWorkWeeklySummary failed in Firestore:", e);
  }

  return dates.map((d) => ({ date: d, minutes: out[d] ?? 0 }));
}

export async function getDeepWorkDailyTargetMinutes(): Promise<number> {
  try {
    const uid = await requireUid();
    const { db } = userRoot(uid);
    const stateRef = doc(db, "users", uid, "meta", "state");
    const snap = await getDoc(stateRef);
    if (!snap.exists()) return 120;
    const data = snap.data() as Record<string, unknown>;
    const val = Number(data.deep_work_daily_target_minutes);
    return !isNaN(val) && val > 0 ? val : 120;
  } catch (e) {
    console.warn("getDeepWorkDailyTargetMinutes failed in Firestore:", e);
    return 120;
  }
}

export async function setDeepWorkDailyTargetMinutes(min: number): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const stateRef = doc(db, "users", uid, "meta", "state");
  await setDoc(
    stateRef,
    {
      deep_work_daily_target_minutes: min,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// ─── Spiritual challenges (Firestore) ─────────────────────────

function mondayOfISOWeek(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function spiritualDailyStreakFromDates(dates: string[]): number {
  if (dates.length === 0) return 0;
  const dateSet = new Set(dates);
  const sortedDesc = [...dates].sort((a, b) => b.localeCompare(a));
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const firstDate = new Date(sortedDesc[0] + "T00:00:00");
  if (cursor.getTime() - firstDate.getTime() > 86_400_000) {
    return 0;
  }
  let streak = 0;
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!dateSet.has(iso)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function spiritualWeekDaysInCurrentWeek(dates: string[], todayIso: string): number {
  const dateSet = new Set(dates);
  const mon = mondayOfISOWeek(todayIso);
  let n = 0;
  for (let i = 0; i < 7; i++) {
    if (dateSet.has(addCalendarDays(mon, i))) n++;
  }
  return n;
}

function spiritualWeeklyStreakFromDates(dates: string[]): number {
  if (dates.length === 0) return 0;
  const byWeek = new Map<string, Set<string>>();
  for (const dt of dates) {
    const m = mondayOfISOWeek(dt);
    if (!byWeek.has(m)) byWeek.set(m, new Set());
    byWeek.get(m)!.add(dt);
  }
  const fullWeekMondays: string[] = [];
  for (const [mon, days] of byWeek) {
    if (days.size >= 7) fullWeekMondays.push(mon);
  }
  fullWeekMondays.sort((a, b) => a.localeCompare(b));
  if (fullWeekMondays.length === 0) return 0;
  let streak = 1;
  for (let i = fullWeekMondays.length - 1; i > 0; i--) {
    const latest = fullWeekMondays[i];
    const before = fullWeekMondays[i - 1];
    if (addCalendarDays(before, 7) === latest) streak++;
    else break;
  }
  return streak;
}

const DEFAULT_SPIRITUAL_CHALLENGES: Array<{
  id: number;
  slug: string;
  title: string;
  description: string;
  cadence: SpiritualCadence;
  sortOrder: number;
}> = [
  {
    id: 1,
    slug: "quran_5_ruku",
    title: "Quran (5 rukū)",
    description: "Read at least five rukū today.",
    cadence: "daily",
    sortOrder: 10,
  },
  {
    id: 2,
    slug: "surah_yaseen",
    title: "Surah Yaseen (morning)",
    description: "Recite Surah Yaseen in the morning.",
    cadence: "daily",
    sortOrder: 20,
  },
  {
    id: 3,
    slug: "surah_mulk",
    title: "Surah Mulk (night)",
    description: "Recite Surah Mulk at night.",
    cadence: "daily",
    sortOrder: 30,
  },
  {
    id: 4,
    slug: "azkar",
    title: "Azkar",
    description: "Morning and evening adhkar.",
    cadence: "daily",
    sortOrder: 40,
  },
  {
    id: 5,
    slug: "quran_consistency_week",
    title: "Quran consistency challenge",
    description:
      "Stay consistent with Quran all week — log each day. Streak counts full Mon–Sun weeks.",
    cadence: "weekly",
    sortOrder: 50,
  },
  {
    id: 6,
    slug: "namaz_completion_week",
    title: "Namaz completion challenge",
    description:
      "Complete all five prayers every day. Streak counts full weeks with 7/7 days logged.",
    cadence: "weekly",
    sortOrder: 60,
  },
];

export async function getSpiritualChallengesDashboard(
  date: string = todayISO(),
): Promise<SpiritualChallengeDashboard[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const ref = doc(db, "users", uid, "spiritual", "state");
  const snap = await getDoc(ref);
  const data = (snap.data() as { completions?: Record<string, string[]> }) ?? {};
  const completions = data.completions ?? {};

  return DEFAULT_SPIRITUAL_CHALLENGES.map((def) => {
    const ds = completions[String(def.id)] ?? [];
    const completedToday = ds.includes(date);
    const streak =
      def.cadence === "weekly"
        ? spiritualWeeklyStreakFromDates(ds)
        : spiritualDailyStreakFromDates(ds);
    const weekDaysComplete =
      def.cadence === "weekly"
        ? spiritualWeekDaysInCurrentWeek(ds, date)
        : 0;

    return {
      ...def,
      completedToday,
      streak,
      weekDaysComplete,
    };
  });
}

export async function toggleSpiritualChallengeDay(
  challengeId: number,
  date?: string,
): Promise<boolean> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const day = date ?? todayISO();
  const ref = doc(db, "users", uid, "spiritual", "state");

  return await runTransaction(db, async (txn) => {
    const snap = await txn.get(ref);
    const data = (snap.data() as { completions?: Record<string, string[]> }) ?? {};
    const completions = { ...(data.completions ?? {}) };
    const key = String(challengeId);
    const currentList = Array.isArray(completions[key]) ? [...completions[key]] : [];

    const idx = currentList.indexOf(day);
    let isCompletedNow = false;
    if (idx >= 0) {
      currentList.splice(idx, 1);
      isCompletedNow = false;
    } else {
      currentList.push(day);
      isCompletedNow = true;
    }
    completions[key] = currentList;
    txn.set(ref, { completions, updatedAt: serverTimestamp() }, { merge: true });
    return isCompletedNow;
  });
}

// ─── Time blocks (Firestore) ───────────────────────────────────

export async function getTimeBlocks(activeOnly = false): Promise<TimeBlock[]> {
  try {
    const uid = await requireUid();
    const { db } = userRoot(uid);
    const col = collection(db, "users", uid, "time_blocks");
    const snap = await getDocs(col);
    const blocks: TimeBlock[] = [];
    for (const d of snap.docs) {
      const data = d.data() as any;
      const b: TimeBlock = {
        id: Number(data.id ?? d.id),
        category: data.category,
        label: data.label ?? "",
        startTime: data.startTime ?? "",
        endTime: data.endTime ?? "",
        sortOrder: Number(data.sortOrder ?? 0),
        active: Number(data.active ?? 1),
      };
      if (!activeOnly || b.active === 1) {
        blocks.push(b);
      }
    }
    blocks.sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.id - b.id;
    });
    return blocks;
  } catch (e) {
    console.warn("getTimeBlocks failed in Firestore:", e);
    return [];
  }
}

export async function addTimeBlock(
  b: Omit<TimeBlock, "id" | "active"> & { active?: number },
): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const id = Date.now();
  const ref = doc(db, "users", uid, "time_blocks", String(id));
  await setDoc(ref, {
    id,
    category: b.category,
    label: b.label,
    startTime: b.startTime,
    endTime: b.endTime,
    sortOrder: b.sortOrder ?? 0,
    active: b.active ?? 1,
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function updateTimeBlock(
  id: number,
  updates: Partial<
    Pick<
      TimeBlock,
      "label" | "startTime" | "endTime" | "sortOrder" | "active" | "category"
    >
  >,
): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const ref = doc(db, "users", uid, "time_blocks", String(id));
  await updateDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTimeBlock(id: number): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await deleteDoc(doc(db, "users", uid, "time_blocks", String(id)));
}

export async function getTimeBlockLog(
  blockId: number,
  date: string,
): Promise<boolean> {
  try {
    const uid = await requireUid();
    const { db } = userRoot(uid);
    const ref = doc(db, "users", uid, "time_block_logs", `${blockId}_${date}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data() as any;
    return Number(data.completed ?? 0) === 1;
  } catch {
    return false;
  }
}

export async function setTimeBlockLog(
  blockId: number,
  date: string,
  completed: boolean,
): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const ref = doc(db, "users", uid, "time_block_logs", `${blockId}_${date}`);
  await setDoc(
    ref,
    {
      blockId,
      date,
      completed: completed ? 1 : 0,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// ─── Body Weight & Goal (Firestore) ───────────────────────────

export async function logBodyWeight(date: string, kg: number): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const ref = doc(db, "users", uid, "body_weights", date);
  await setDoc(ref, { date, kg, updatedAt: serverTimestamp() }, { merge: true });
  // Also keep metrics_daily synced
  await saveMetrics({ weightKg: kg, date }).catch(() => {});
}

export async function getBodyWeights(
  from: string,
  to: string,
): Promise<BodyWeightEntry[]> {
  try {
    const uid = await requireUid();
    const { db } = userRoot(uid);
    const col = collection(db, "users", uid, "body_weights");
    const snap = await getDocs(query(col, limit(500)));
    const list: BodyWeightEntry[] = [];
    for (const d of snap.docs) {
      const data = d.data() as any;
      const dt = String(data.date ?? d.id);
      if (dt >= from && dt <= to) {
        list.push({ date: dt, kg: Number(data.kg ?? 0) });
      }
    }
    list.sort((a, b) => a.date.localeCompare(b.date));
    return list;
  } catch (e) {
    console.warn("getBodyWeights failed in Firestore:", e);
    return [];
  }
}

export async function getGoalWeightKg(): Promise<number | null> {
  try {
    const uid = await requireUid();
    const { db } = userRoot(uid);
    const snap = await getDoc(doc(db, "users", uid, "meta", "state"));
    if (!snap.exists()) return null;
    const val = (snap.data() as any)?.body_goal_kg;
    const n = parseFloat(String(val));
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export async function setGoalWeightKg(kg: number | null): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await setDoc(
    doc(db, "users", uid, "meta", "state"),
    {
      body_goal_kg: kg !== null ? kg : null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// ─── Body Exercise (Firestore) ────────────────────────────────

export async function addExerciseEntry(
  date: string,
  type: string,
  durationMinutes: number,
): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const id = Date.now();
  const minutes = Math.max(0, Math.round(durationMinutes));
  const ref = doc(db, "users", uid, "body_exercise", String(id));
  await setDoc(ref, {
    id,
    date,
    type,
    durationMinutes: minutes,
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function getExerciseEntries(
  from: string,
  to: string,
): Promise<ExerciseEntry[]> {
  try {
    const uid = await requireUid();
    const { db } = userRoot(uid);
    const col = collection(db, "users", uid, "body_exercise");
    const snap = await getDocs(query(col, limit(500)));
    const list: ExerciseEntry[] = [];
    for (const d of snap.docs) {
      const data = d.data() as any;
      const dt = String(data.date ?? "");
      if (dt >= from && dt <= to) {
        list.push({
          id: Number(data.id ?? d.id),
          date: dt,
          type: String(data.type ?? ""),
          durationMinutes: Number(data.durationMinutes ?? 0),
        });
      }
    }
    list.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.id - a.id;
    });
    return list;
  } catch {
    return [];
  }
}

export async function getExerciseMinutesForDate(date: string): Promise<number> {
  try {
    const entries = await getExerciseEntries(date, date);
    return entries.reduce((acc, curr) => acc + curr.durationMinutes, 0);
  } catch {
    return 0;
  }
}

export async function getExerciseMinutesByDay(
  from: string,
  to: string,
): Promise<{ date: string; minutes: number }[]> {
  try {
    const entries = await getExerciseEntries(from, to);
    const map = new Map<string, number>();
    for (const e of entries) {
      map.set(e.date, (map.get(e.date) ?? 0) + e.durationMinutes);
    }
    const res: { date: string; minutes: number }[] = [];
    for (const [dt, min] of map.entries()) {
      res.push({ date: dt, minutes: min });
    }
    res.sort((a, b) => a.date.localeCompare(b.date));
    return res;
  } catch {
    return [];
  }
}

export async function deleteExerciseEntry(id: number): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await deleteDoc(doc(db, "users", uid, "body_exercise", String(id)));
}

// ─── Diet Meals & Rules (Firestore) ───────────────────────────

export async function addDietMeal(opts: {
  date: string;
  slot?: string;
  quality: MealQuality;
  overeating: boolean;
  hour: number;
}): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const id = Date.now();
  const ref = doc(db, "users", uid, "diet_meals", String(id));
  await setDoc(ref, {
    id,
    date: opts.date,
    slot: opts.slot ?? "meal",
    quality: opts.quality,
    overeating: opts.overeating ? 1 : 0,
    hour: Math.min(23, Math.max(0, Math.round(opts.hour))),
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function getDietMealsForDate(date: string): Promise<DietMeal[]> {
  try {
    const uid = await requireUid();
    const { db } = userRoot(uid);
    const col = collection(db, "users", uid, "diet_meals");
    const snap = await getDocs(query(col, limit(500)));
    const list: DietMeal[] = [];
    for (const d of snap.docs) {
      const data = d.data() as any;
      if (data.date === date) {
        list.push({
          id: Number(data.id ?? d.id),
          date: data.date,
          slot: data.slot ?? "meal",
          quality: data.quality,
          overeating: Number(data.overeating ?? 0),
          hour: Number(data.hour ?? 12),
        });
      }
    }
    list.sort((a, b) => {
      if (a.hour !== b.hour) return a.hour - b.hour;
      return a.id - b.id;
    });
    return list;
  } catch {
    return [];
  }
}

export async function getDietMealsRange(
  from: string,
  to: string,
): Promise<DietMeal[]> {
  try {
    const uid = await requireUid();
    const { db } = userRoot(uid);
    const col = collection(db, "users", uid, "diet_meals");
    const snap = await getDocs(query(col, limit(500)));
    const list: DietMeal[] = [];
    for (const d of snap.docs) {
      const data = d.data() as any;
      const dt = String(data.date ?? "");
      if (dt >= from && dt <= to) {
        list.push({
          id: Number(data.id ?? d.id),
          date: dt,
          slot: data.slot ?? "meal",
          quality: data.quality,
          overeating: Number(data.overeating ?? 0),
          hour: Number(data.hour ?? 12),
        });
      }
    }
    list.sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.hour - a.hour;
    });
    return list;
  } catch {
    return [];
  }
}

export async function deleteDietMeal(id: number): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await deleteDoc(doc(db, "users", uid, "diet_meals", String(id)));
}

const defaultDietRules: DietRules = {
  noLateEating: true,
  lateHour: 21,
  lightDinner: true,
  noJunkWeekdays: false,
};

export async function getDietRules(): Promise<DietRules> {
  try {
    const uid = await requireUid();
    const { db } = userRoot(uid);
    const snap = await getDoc(doc(db, "users", uid, "meta", "state"));
    if (!snap.exists()) return { ...defaultDietRules };
    const saved = (snap.data() as any)?.diet_rules as Partial<DietRules> | undefined;
    if (!saved) return { ...defaultDietRules };
    return {
      noLateEating: Boolean(saved.noLateEating ?? defaultDietRules.noLateEating),
      lateHour: typeof saved.lateHour === "number" ? saved.lateHour : defaultDietRules.lateHour,
      lightDinner: Boolean(saved.lightDinner ?? defaultDietRules.lightDinner),
      noJunkWeekdays: Boolean(saved.noJunkWeekdays ?? defaultDietRules.noJunkWeekdays),
    };
  } catch {
    return { ...defaultDietRules };
  }
}

export async function setDietRules(rules: DietRules): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await setDoc(
    doc(db, "users", uid, "meta", "state"),
    {
      diet_rules: rules,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// ─── Urge Logs (Firestore) ────────────────────────────────────

export async function logUrge(opts: {
  intensity: number;
  triggerTag?: string;
  note?: string;
  loggedAt?: string;
}): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const id = Date.now();
  const iso = opts.loggedAt ?? new Date().toISOString();
  const inten = Math.min(10, Math.max(1, Math.round(opts.intensity)));
  const ref = doc(db, "users", uid, "urge_logs", String(id));
  await setDoc(ref, {
    id,
    loggedAt: iso,
    intensity: inten,
    triggerTag: opts.triggerTag ?? "",
    note: opts.note ?? "",
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function getUrgeLogs(limitCount = 300): Promise<UrgeLog[]> {
  try {
    const uid = await requireUid();
    const { db } = userRoot(uid);
    const col = collection(db, "users", uid, "urge_logs");
    const snap = await getDocs(query(col, limit(limitCount)));
    const list: UrgeLog[] = [];
    for (const d of snap.docs) {
      const data = d.data() as any;
      list.push({
        id: Number(data.id ?? d.id),
        loggedAt: String(data.loggedAt ?? ""),
        intensity: Number(data.intensity ?? 5),
        triggerTag: String(data.triggerTag ?? ""),
        note: String(data.note ?? ""),
      });
    }
    list.sort((a, b) => b.id - a.id);
    return list.slice(0, limitCount);
  } catch {
    return [];
  }
}

export async function deleteUrgeLog(id: number): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await deleteDoc(doc(db, "users", uid, "urge_logs", String(id)));
}

// ─── Daily Reset Journal (Firestore) ──────────────────────────

export async function getDailyReset(date = todayISO()): Promise<DailyReset | null> {
  try {
    const uid = await requireUid();
    const { db } = userRoot(uid);
    const snap = await getDoc(doc(db, "users", uid, "daily_reset", date));
    if (!snap.exists()) return null;
    const data = snap.data() as any;
    return {
      date,
      morningPlan: String(data.morningPlan ?? ""),
      nightReflection: String(data.nightReflection ?? ""),
      morningSavedAt: data.morningSavedAt ?? null,
      nightSavedAt: data.nightSavedAt ?? null,
    };
  } catch {
    return null;
  }
}

export async function saveDailyMorning(
  date: string,
  plan: string,
): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const iso = new Date().toISOString();
  await setDoc(
    doc(db, "users", uid, "daily_reset", date),
    {
      date,
      morningPlan: plan,
      morningSavedAt: iso,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveDailyNight(
  date: string,
  reflection: string,
): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const iso = new Date().toISOString();
  await setDoc(
    doc(db, "users", uid, "daily_reset", date),
    {
      date,
      nightReflection: reflection,
      nightSavedAt: iso,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

// ─── Anti-Laziness Toggle (Firestore) ─────────────────────────

export async function getAntiLazinessEnabled(): Promise<boolean> {
  try {
    const uid = await requireUid();
    const { db } = userRoot(uid);
    const snap = await getDoc(doc(db, "users", uid, "meta", "state"));
    if (!snap.exists()) return false;
    return Boolean((snap.data() as any)?.anti_laziness_enabled);
  } catch {
    return false;
  }
}

export async function setAntiLazinessEnabled(enabled: boolean): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await setDoc(
    doc(db, "users", uid, "meta", "state"),
    {
      anti_laziness_enabled: enabled,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getHabitCompletionForDate(
  date: string,
): Promise<{ total: number; done: number }> {
  try {
    const entry = await getDailyEntry(date);
    if (!entry || !entry.habits) {
      return { total: 0, done: 0 };
    }
    const total = entry.habits.length;
    const done = entry.habits.filter((h) => h.completed).length;
    return { total, done };
  } catch {
    return { total: 0, done: 0 };
  }
}



