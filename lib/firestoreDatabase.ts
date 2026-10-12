import { Platform } from "react-native";
import { getFirebaseAuth, getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import { defaultHabits } from "@/lib/seed";
import { MASTER_ACHIEVEMENTS, MASTER_CHALLENGES } from "@/lib/seed/masterCatalog";
import type {
  AchievementDefinition,
  AchievementsStateDoc,
  Challenge,
  ChallengeCategory,
  ChallengeCompletionRecord,
  ChallengesStateDoc,
  ChallengeStats,
  ChallengeStatus,
  ChatMessage,
  CompletedChallengeItem,
  DailyHabitEntry,
  DailyInterventionDoc,
  DailyProgressEntry,
  Habit,
  HabitIcon,
  LifeArea,
  Metrics,
  Mode,
  RecoveryActionEntry,
  RelapseEvent,
  UnlockedAchievementItem,
} from "@/lib/types";
import {
  collection,
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

async function requireUid(): Promise<string> {
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
    coachChat: collection(db, "users", uid, "coachChat"),
    interventions: collection(db, "users", uid, "interventions"),
    appOpens: collection(db, "users", uid, "app_open_events"),
    challenges: collection(db, "users", uid, "challenges"),
    challengeHistory: collection(db, "users", uid, "challenge_completion_history"),
    challengeLogs: collection(db, "users", uid, "challenge_logs"),
    insightSnapshots: collection(db, "users", uid, "insight_snapshots"),
    achievements: collection(db, "users", uid, "achievements"),
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
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const habitsSnap = await getDocs(query(collection(db, "users", uid, "habits")));
  const habitCount = habitsSnap.docs.filter((d) => (d.data() as any)?.deleted !== true).length;
  if (habitCount === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (true) {
    const day = cursor.toISOString().slice(0, 10);
    const dayDoc = await getDoc(doc(db, "users", uid, "entries", day));
    if (!dayDoc.exists()) break;
    const data = dayDoc.data() as any;
    const rate = typeof data.completionPercentage === "number"
      ? data.completionPercentage / 100
      : (data.completedCount ?? 0) / habitCount;
    if (rate < 0.5) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ───────────────────────────────────────────────────────────────
// In-Memory Habit & Progress Cache (Instant reads & 0ms screen switches)
// ───────────────────────────────────────────────────────────────

interface HabitCacheState {
  allHabits: Habit[] | null;
  todayHabits: Map<string, (Habit & { completed: number })[]>;
  todayEntry: DailyProgressEntry | null;
  modeStreaks: Map<Mode, number>;
  lastFetchedAt: number;
}

const habitCache: HabitCacheState = {
  allHabits: null,
  todayHabits: new Map(),
  todayEntry: null,
  modeStreaks: new Map(),
  lastFetchedAt: 0,
};

export function invalidateHabitsCache(): void {
  habitCache.allHabits = null;
  habitCache.todayHabits.clear();
  habitCache.todayEntry = null;
  habitCache.modeStreaks.clear();
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

  await setDoc(doc(db, "users", uid, "habits", String(id)), {
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
  });
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

export async function getAllHabits(mode?: Mode, forceRefresh = false): Promise<Habit[]> {
  const uid = await requireUid();
  const now = Date.now();
  if (!forceRefresh && habitCache.allHabits && now - habitCache.lastFetchedAt < 60000) {
    if (mode) {
      return habitCache.allHabits.filter((h) => h.mode === mode);
    }
    return habitCache.allHabits;
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
    .filter((h) => h?.deleted !== true) as Habit[];

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

export async function updateHabit(
  id: number,
  updates: Partial<
    Pick<Habit, "name" | "color" | "mode" | "targetPerDay" | "lifeArea" | "sortOrder" | "detoxOnly"> & {
      icon: string | HabitIcon;
    }
  >,
): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const patch: any = { ...updates, updatedAt: serverTimestamp() };
  if (updates.icon && typeof updates.icon === "object") {
    patch.icon = JSON.stringify(updates.icon);
  }
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
): Promise<(Habit & { completed: number })[]> {
  const uid = await requireUid();
  const cacheKey = `${mode ?? "all"}_detox_${isDetox ? "1" : "0"}`;
  const now = Date.now();

  if (!forceRefresh && habitCache.todayHabits.has(cacheKey) && now - habitCache.lastFetchedAt < 60000) {
    return habitCache.todayHabits.get(cacheKey)!;
  }

  await ensureSeeded(uid);
  const { db } = userRoot(uid);
  const day = todayISO();

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
    .filter((h) => h?.deleted !== true) as Habit[];

  // When Detox is OFF: hide detoxOnly tasks (they only activate during Detox).
  // When Detox is ON: show ALL mode habits PLUS any detoxOnly tasks!
  const habits = rawHabits.filter((h) => {
    if (h.detoxOnly) {
      return isDetox;
    }
    return true;
  });

  const dayData = dayDoc.exists() ? (dayDoc.data() as any) : null;
  if (dayData) {
    habitCache.todayEntry = dayData as DailyProgressEntry;
  }

  const dayHabitsMap = new Map<number, boolean>();
  if (Array.isArray(dayData?.habits)) {
    for (const h of dayData.habits) {
      if (h?.id != null) dayHabitsMap.set(Number(h.id), Boolean(h.completed));
    }
  }

  const entries = habits.map((h) => ({
    ...h,
    completed: dayHabitsMap.get(h.id) ? 1 : 0,
  }));

  habitCache.todayHabits.set(cacheKey, entries);
  habitCache.lastFetchedAt = Date.now();

  return entries;
}

export async function toggleHabit(habitId: number, targetDate?: string, activeMode?: Mode): Promise<boolean> {
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
  }>();
  for (const eh of existingHabitsList) {
    if (eh?.id != null) {
      existingMap.set(Number(eh.id), {
        completed: Boolean(eh.completed),
        time: eh.time ?? null,
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
      };
    }
    const existing = existingMap.get(hid);
    return {
      id: hid,
      name: h.name ?? `Habit #${hid}`,
      completed: existing?.completed ?? false,
      time: existing?.time ?? null,
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
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(stateRef);
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
    tx.set(stateRef, { user_level: { xp, rank, updatedAt: serverTimestamp() } }, { merge: true });
  });

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
): Promise<{ date: string; completed: number }[]> {
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
  const out: { date: string; completed: number }[] = [];
  for (let i = 0; i < snaps.length; i++) {
    const d = new Date(fromISO + "T00:00:00");
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dayData = snaps[i].exists() ? (snaps[i].data() as any) : null;
    let completed = 0;
    if (Array.isArray(dayData?.habits)) {
      const found = dayData.habits.find((h: any) => h.id === habitId);
      completed = found?.completed ? 1 : 0;
    } else {
      // Legacy doc fallback
      const legSnap = await getDoc(doc(db, "users", uid, "entries", `${habitId}_${iso}`));
      completed = (legSnap.data() as any)?.completed === true ? 1 : 0;
    }
    if (iso >= fromISO && iso <= to) out.push({ date: iso, completed });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
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

// Mode streak: consecutive days where ≥75% of that mode’s habits are completed.
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
    .filter((h) => h?.deleted !== true);
  if (modeHabits.length === 0) return 0;
  const modeHabitIds = new Set(modeHabits.map((h) => h.id as number));

  // Query entries subcollection
  const entriesSnap = await getDocs(collection(db, "users", uid, "entries"));
  const entriesMap = new Map<string, any>();
  for (const d of entriesSnap.docs) {
    entriesMap.set(d.id, d.data());
  }

  const checkDaySuccess = (dayKey: string): boolean => {
    const data = entriesMap.get(dayKey);
    if (!data) return false;
    let done = 0;
    if (Array.isArray(data.habits)) {
      done = data.habits.filter((h: any) => modeHabitIds.has(h.id) && h.completed).length;
    } else if (data.mode === mode && typeof data.checkedHabits === "number") {
      done = data.checkedHabits;
    }
    const rate = done / modeHabits.length;
    return rate >= 0.75;
  };

  const today = todayISO();
  let streak = 0;

  // 1. If today has already reached ≥75%, include today
  const todayCompleted = checkDaySuccess(today);
  if (todayCompleted) {
    streak += 1;
  }

  // 2. Count consecutive days backwards starting from yesterday
  let checkDate = addCalendarDays(today, -1);
  while (true) {
    if (checkDaySuccess(checkDate)) {
      streak += 1;
      checkDate = addCalendarDays(checkDate, -1);
    } else {
      break;
    }
  }

  habitCache.modeStreaks.set(mode, streak);
  return streak;
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

// Coach chat (AI + user)
export async function addCoachChatMessage(msg: ChatMessage): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await setDoc(doc(db, "users", uid, "coachChat", msg.id), msg, { merge: true });
}

export async function getCoachChatMessages(limitN = 100): Promise<ChatMessage[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const qy = query(collection(db, "users", uid, "coachChat"), orderBy("timestamp", "asc"), limit(limitN));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => d.data() as ChatMessage);
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

  // 1. Check if user missed a day before today:
  // If lastCompletedDate exists and diff > 1 (missed day), reset currentProgress to 0!
  if (state.lastCompletedDate && state.lastCompletedDate !== today) {
    const diff = dateDiffInDays(state.lastCompletedDate, today);
    if (diff > 1 && state.currentProgress > 0) {
      state.currentProgress = 0;
      stateChanged = true;
    }
  }

  if (!targetEntry || (targetEntry.totalHabits ?? 0) === 0) {
    if (stateChanged) {
      await setDoc(
        doc(db, "users", resolvedUid, "challenges", "state"),
        { currentProgress: state.currentProgress, updatedAt: serverTimestamp() },
        { merge: true },
      );
    }
    return null;
  }

  // Threshold of success: completionPercentage >= 50%
  const isSuccessDay = (targetEntry.completionPercentage ?? 0) >= 50;
  let completedItem: CompletedChallengeItem | undefined;

  if (isSuccessDay) {
    // If today is NOT yet credited for progress
    if (state.lastCompletedDate !== today) {
      // If previous completed day had a gap (> 1 day), reset progress
      if (state.lastCompletedDate) {
        const diff = dateDiffInDays(state.lastCompletedDate, today);
        if (diff > 1) {
          state.currentProgress = 0;
        }
      }

      state.currentProgress += 1;
      state.lastCompletedDate = today;
      stateChanged = true;

      // Check if active challenge is completed
      const activeDef =
        MASTER_CHALLENGES.find((c) => c.id === state.activeChallengeId) ??
        MASTER_CHALLENGES[0];

      if (state.currentProgress >= activeDef.duration) {
        // Active challenge complete!
        completedItem = {
          id: activeDef.id,
          defId: activeDef.defId,
          name: activeDef.name,
          duration: activeDef.duration,
          xp: activeDef.xp,
          completedAt: new Date().toISOString(),
        };
        state.completedChallenges.push(completedItem);

        // Unlock achievement for this challenge
        await unlockAchievement(activeDef.defId, {
          title: activeDef.name,
          description: activeDef.description,
        });

        // Add XP to user
        await addXpToUser(resolvedUid, activeDef.xp);

        // Advance to next challenge
        if (state.activeChallengeId < MASTER_CHALLENGES.length) {
          state.activeChallengeId += 1;
        }
        state.currentProgress = 0;

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
          } catch {}
        }
      }
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
      state.currentProgress = 0;
      const { db } = userRoot(uid);
      await setDoc(
        doc(db, "users", uid, "challenges", "state"),
        { currentProgress: 0, updatedAt: serverTimestamp() },
        { merge: true },
      );
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
  await setDoc(
    doc(db, "users", uid, "challenges", "state"),
    { activeChallengeId: id, currentProgress: 0, updatedAt: serverTimestamp() },
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
    state.currentProgress = 0;
  } else {
    state.currentProgress = next;
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
  const waterGlasses = data.waterGlasses !== undefined ? Number(data.waterGlasses) : existing?.waterGlasses !== undefined ? Number(existing.waterGlasses) : undefined;
  const heightCm = data.heightCm !== undefined ? Number(data.heightCm) : existing?.heightCm !== undefined ? Number(existing.heightCm) : undefined;
  const weightKg = data.weightKg !== undefined ? Number(data.weightKg) : existing?.weightKg !== undefined ? Number(existing.weightKg) : undefined;

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
    const cur = agg.get(h.lifeArea)!;
    cur.total += b.total;
    cur.done += b.done;
    agg.set(h.lifeArea, cur);
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

