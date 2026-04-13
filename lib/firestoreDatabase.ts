import { getFirebaseAuth, getFirestoreDb, isFirebaseConfigured } from "@/lib/firebase";
import { defaultHabits } from "@/lib/seed";
import type {
  AchievementDefinition,
  Challenge,
  ChallengeCompletionRecord,
  ChallengeStats,
  ChatMessage,
  Habit,
  HabitIcon,
  LifeArea,
  Metrics,
  Mode,
  RelapseEvent,
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
  startAfter,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentReference,
  Timestamp,
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
    urgeSessions: collection(db, "users", uid, "urge_tool_sessions"),
    urgeActionCompletions: collection(db, "users", uid, "urge_tool_action_completions"),
  };
}

async function allocId(uid: string, key: string): Promise<number> {
  const { db } = userRoot(uid);
  const counterRef = doc(db, "users", uid, "meta", "_counters");
  const field = `next_${key}`;
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const cur = (snap.exists() ? (snap.data() as any)[field] : null) as number | null;
    const next = typeof cur === "number" ? cur + 1 : 1;
    tx.set(counterRef, { [field]: next }, { merge: true });
    return next;
  });
}

async function ensureSeeded(uid: string): Promise<void> {
  const { db } = userRoot(uid);
  const seededRef = doc(db, "users", uid, "meta", "seeded");
  const seeded = await getDoc(seededRef);
  if (seeded.exists()) return;

  await runTransaction(db, async (tx) => {
    const again = await tx.get(seededRef);
    if (again.exists()) return;

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

    // Seed challenge templates (simple starter set)
    const challengeSeeds: Array<Pick<Challenge, "id" | "name" | "description" | "duration" | "category" | "rules">> = [
      {
        id: 1,
        name: "7 Day Reset",
        description: "Break the cycle. Stay clean for 7 straight days to reset your baseline.",
        duration: 7,
        category: "discipline",
        rules: "Complete your daily routine. Keep phone usage controlled.",
      },
      {
        id: 2,
        name: "30 Day Discipline",
        description: "Build unshakeable habits. Complete all daily habits for 30 consecutive days.",
        duration: 30,
        category: "discipline",
        rules: "Show up daily. No excuses.",
      },
      {
        id: 3,
        name: "90 Day Transformation",
        description: "Complete transformation. 90 days of consistent discipline and self-control.",
        duration: 90,
        category: "discipline",
        rules: "Consistency beats intensity.",
      },
    ];
    for (const c of challengeSeeds) {
      tx.set(doc(db, "users", uid, "challenges", String(c.id)), {
        ...c,
        progress: 0,
        startedAt: null,
        completedAt: null,
      });
    }

    tx.set(doc(db, "users", uid, "meta", "_counters"), {
      next_habit: defaultHabits.length,
      next_intervention: 0,
      next_urge_session: 0,
      next_challenge_history: 0,
    });
    tx.set(seededRef, { value: true, seededAt: serverTimestamp() });
    tx.set(doc(db, "users", uid, "meta", "mode"), { currentMode: "hostel" });
    tx.set(doc(db, "users", uid, "meta", "detox_enabled"), { value: false });
  });
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
    .catch(() => {});
}

export async function recordLastActiveNow(): Promise<void> {
  if (!getFirebaseAuth()?.currentUser) return;
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await setDoc(doc(db, "users", uid, "meta", "last_active"), { at: serverTimestamp() }, { merge: true });
}

export async function getFocusLockEnabled(): Promise<boolean> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDoc(doc(db, "users", uid, "meta", "focus_lock_enabled"));
  return Boolean((snap.data() as any)?.value);
}

export async function setFocusLockEnabled(enabled: boolean): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await setDoc(
    doc(db, "users", uid, "meta", "focus_lock_enabled"),
    { value: enabled, updatedAt: serverTimestamp() },
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
  const snap = await getDoc(doc(db, "users", user.uid, "meta", "onboarding_complete"));
  return Boolean((snap.data() as any)?.value);
}

/** Call after email/password sign-in if user finished onboarding before creating an account. */
export async function syncOnboardingFromLocalToFirestore(): Promise<void> {
  const { getLocalOnboardingComplete } = await import("@/lib/onboardingLocal");
  if (!(await getLocalOnboardingComplete())) return;
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await setDoc(
    doc(db, "users", uid, "meta", "onboarding_complete"),
    { value: true, at: serverTimestamp() },
    { merge: true },
  );
}

export async function setOnboardingComplete(): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await setDoc(doc(db, "users", uid, "meta", "onboarding_complete"), { value: true, at: serverTimestamp() });
}

export async function getMode(): Promise<Mode> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDoc(doc(db, "users", uid, "meta", "mode"));
  const m = (snap.data() as any)?.currentMode;
  return m === "home" || m === "hostel" ? m : "hostel";
}

export async function setMode(mode: Mode): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await setDoc(doc(db, "users", uid, "meta", "mode"), { currentMode: mode, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getDetoxEnabled(): Promise<boolean> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDoc(doc(db, "users", uid, "meta", "detox_enabled"));
  return Boolean((snap.data() as any)?.value);
}

export async function setDetoxEnabled(enabled: boolean): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await setDoc(doc(db, "users", uid, "meta", "detox_enabled"), { value: enabled, updatedAt: serverTimestamp() }, { merge: true });
  if (enabled) {
    await setDoc(doc(db, "users", uid, "meta", "detox_started_at"), { value: todayISO() }, { merge: true });
  }
}

export async function getDetoxStartDate(): Promise<string | null> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDoc(doc(db, "users", uid, "meta", "detox_started_at"));
  return (snap.data() as any)?.value ?? null;
}

export async function getDetoxStreak(): Promise<number> {
  const start = await getDetoxStartDate();
  if (!start) return 0;
  const startDate = new Date(start + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - startDate.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

export async function getHardMode(): Promise<boolean> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDoc(doc(db, "users", uid, "meta", "hard_mode"));
  return Boolean((snap.data() as any)?.value);
}

export async function setHardMode(enabled: boolean): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await setDoc(doc(db, "users", uid, "meta", "hard_mode"), { value: enabled, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getHardModeStreak(): Promise<number> {
  // Same as mode streak but across both modes (≥50% of all habits).
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const habitsSnap = await getDocs(query(collection(db, "users", uid, "habits")));
  const habitIds = habitsSnap.docs.map((d) => (d.data() as any).id as number);
  if (habitIds.length === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (true) {
    const day = cursor.toISOString().slice(0, 10);
    const docsSnap = await Promise.all(
      habitIds.map((hid) => getDoc(doc(db, "users", uid, "entries", `${hid}_${day}`))),
    );
    const done = docsSnap.filter((s) => (s.data() as any)?.completed === true).length;
    if (done / habitIds.length < 0.5) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function addHabit(
  habit: Pick<Habit, "name"> & {
    icon?: string | HabitIcon;
    color?: string;
    mode?: Mode;
    lifeArea?: Habit["lifeArea"];
    targetPerDay?: number;
    sortOrder?: number;
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
  await setDoc(doc(db, "users", uid, "habits", String(id)), {
    id,
    name: habit.name,
    icon: iconStr,
    color: habit.color ?? "#4ADE80",
    mode: habit.mode ?? "home",
    lifeArea: habit.lifeArea ?? "mental",
    targetPerDay: habit.targetPerDay ?? 1,
    sortOrder: habit.sortOrder ?? 0,
    createdAt: todayISO(),
  });
  return id;
}

export async function getAllHabits(): Promise<Habit[]> {
  const uid = await requireUid();
  await ensureSeeded(uid);
  const { db } = userRoot(uid);
  const snap = await getDocs(
    query(collection(db, "users", uid, "habits"), orderBy("mode", "asc"), orderBy("sortOrder", "asc"), orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => d.data() as Habit);
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
    Pick<Habit, "name" | "color" | "mode" | "targetPerDay" | "lifeArea" | "sortOrder"> & {
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
}

export async function deleteHabit(id: number): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  // Soft delete (keeps old entries coherent). UI will stop showing it.
  await setDoc(doc(db, "users", uid, "habits", String(id)), { deleted: true, deletedAt: serverTimestamp() }, { merge: true });
}

export async function getTodayHabits(mode?: Mode): Promise<(Habit & { completed: number })[]> {
  const uid = await requireUid();
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

  const habitsSnap = await getDocs(habitsQ);
  const habits = habitsSnap.docs
    .map((d) => d.data() as any)
    .filter((h) => h?.deleted !== true) as Habit[];

  const entries = await Promise.all(
    habits.map(async (h) => {
      const eId = `${h.id}_${day}`;
      const eSnap = await getDoc(doc(db, "users", uid, "entries", eId));
      const completed = (eSnap.data() as any)?.completed ? 1 : 0;
      return { ...h, completed };
    }),
  );

  return entries;
}

export async function toggleHabit(habitId: number): Promise<boolean> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const day = todayISO();
  const entryId = `${habitId}_${day}`;
  const ref = doc(db, "users", uid, "entries", entryId);
  const trackingId = `${habitId}_${day}`;
  const trackingRef = doc(db, "users", uid, "habit_daily_tracking_progress", trackingId);
  const toggledAt = new Date().toISOString();

  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const prev = (snap.data() as any)?.completed === true;
    const next = !prev;
    tx.set(
      ref,
      {
        habitId,
        date: day,
        completed: next,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );

    const trSnap = await tx.get(trackingRef);
    const prevHist = ((trSnap.data() as any)?.toggleHistory ?? []) as { at: string; completed: boolean }[];
    const toggleHistory = [...prevHist, { at: toggledAt, completed: next }].slice(-50);
    tx.set(
      trackingRef,
      {
        habitId,
        date: day,
        completed: next,
        updatedAt: serverTimestamp(),
        toggleHistory,
      },
      { merge: true },
    );
    return next;
  });
  // Update user progression + monthly achievements (best-effort).
  updateUserProgressAfterToggle(next).catch(() => {});
  return next;
}

async function updateUserProgressAfterToggle(completedNow: boolean): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const levelRef = doc(db, "users", uid, "meta", "user_level");
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(levelRef);
    const cur = (snap.data() as any)?.xp ?? 0;
    const xp = Math.max(0, cur + (completedNow ? 8 : 0));
    const rank =
      xp >= 2000
        ? "pro"
        : xp >= 900
          ? "advanced"
          : xp >= 250
            ? "intermediate"
            : "beginner";
    tx.set(levelRef, { xp, rank, updatedAt: serverTimestamp() }, { merge: true });
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
    const achRef = doc(db, "users", uid, "achievements", m.id);
    const existing = await getDoc(achRef);
    if (existing.exists()) continue;
    await setDoc(achRef, {
      id: m.id,
      name: m.name,
      unlockedAt: serverTimestamp(),
      streakDays: m.days,
    });
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

  // Pull all entries for this habit in range (both completed and not).
  const snaps = await Promise.all(
    Array.from({ length: days }, (_, i) => {
      const d = new Date(fromISO + "T00:00:00");
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      return getDoc(doc(db, "users", uid, "entries", `${habitId}_${iso}`));
    }),
  );
  const out: { date: string; completed: number }[] = [];
  for (let i = 0; i < snaps.length; i++) {
    const d = new Date(fromISO + "T00:00:00");
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const completed = (snaps[i].data() as any)?.completed === true ? 1 : 0;
    if (iso >= fromISO && iso <= to) out.push({ date: iso, completed });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getHabitCompletionRate(habitId: number): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const qy = query(collection(db, "users", uid, "entries"), where("habitId", "==", habitId));
  const snap = await getDocs(qy);
  if (snap.size === 0) return 0;
  const done = snap.docs.filter((d) => (d.data() as any)?.completed === true).length;
  return Math.round((done / snap.size) * 100);
}

export async function getStreak(habitId: number): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const qy = query(
    collection(db, "users", uid, "entries"),
    where("habitId", "==", habitId),
    where("completed", "==", true),
    orderBy("date", "desc"),
    limit(400),
  );
  const snap = await getDocs(qy);
  if (snap.size === 0) return 0;
  const rows = snap.docs.map((d) => (d.data() as any).date as string);
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
  const { db } = userRoot(uid);
  const qy = query(
    collection(db, "users", uid, "entries"),
    where("habitId", "==", habitId),
    where("completed", "==", true),
    orderBy("date", "asc"),
    limit(8000),
  );
  const snap = await getDocs(qy);
  const rows = snap.docs.map((d) => (d.data() as any).date as string);
  if (rows.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1] + "T00:00:00");
    const cur = new Date(rows[i] + "T00:00:00");
    const diff = (cur.getTime() - prev.getTime()) / 86_400_000;
    if (diff === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

// Mode streak: consecutive days where ≥50% of that mode’s habits are completed.
export async function getModeStreak(mode: Mode): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);

  // Current habits in this mode (used as denominator for now).
  const habitsSnap = await getDocs(
    query(collection(db, "users", uid, "habits"), where("mode", "==", mode)),
  );
  const habitIds = habitsSnap.docs.map((d) => (d.data() as any).id as number);
  if (habitIds.length === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const day = cursor.toISOString().slice(0, 10);
    const docsSnap = await Promise.all(
      habitIds.map((hid) => getDoc(doc(db, "users", uid, "entries", `${hid}_${day}`))),
    );
    const done = docsSnap.filter((s) => (s.data() as any)?.completed === true).length;
    if (done / habitIds.length < 0.5) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

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
  const habitsSnap = await getDocs(query(collection(db, "users", uid, "habits")));
  const totalHabits = habitsSnap.size;
  if (totalHabits === 0) return 0;

  // Pull completed entries for recent history and compute day-level completion rates.
  const completedQ = query(
    collection(db, "users", uid, "entries"),
    where("completed", "==", true),
    orderBy("date", "asc"),
    limit(8000),
  );
  const snap = await getDocs(completedQ);
  const doneByDate = new Map<string, number>();
  for (const d of snap.docs) {
    const date = (d.data() as any).date as string;
    doneByDate.set(date, (doneByDate.get(date) ?? 0) + 1);
  }

  const dates = Array.from(doneByDate.keys()).sort();
  if (dates.length === 0) return 0;

  let longest = 0;
  let current = 0;
  let prev: Date | null = null;
  for (const iso of dates) {
    const done = doneByDate.get(iso) ?? 0;
    const rate = done / totalHabits;
    const d = new Date(iso + "T00:00:00");
    const consecutive = prev ? (d.getTime() - prev.getTime()) / 86_400_000 === 1 : true;
    if (rate >= 0.5 && consecutive) {
      current++;
      longest = Math.max(longest, current);
    } else if (rate >= 0.5) {
      current = 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
    prev = d;
  }
  return longest;
}

export async function getHeatmapData(days: number = 49): Promise<{ date: string; rate: number }[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const habitsSnap = await getDocs(query(collection(db, "users", uid, "habits")));
  const totalHabits = habitsSnap.size;
  const to = todayISO();
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  const fromISO = from.toISOString().slice(0, 10);

  const completedQ = query(
    collection(db, "users", uid, "entries"),
    where("completed", "==", true),
    where("date", ">=", fromISO),
    where("date", "<=", to),
  );
  const snap = await getDocs(completedQ);
  const doneByDate = new Map<string, number>();
  for (const d of snap.docs) {
    const date = (d.data() as any).date as string;
    doneByDate.set(date, (doneByDate.get(date) ?? 0) + 1);
  }

  const result: { date: string; rate: number }[] = [];
  const cursor = new Date(fromISO + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    const done = doneByDate.get(iso) ?? 0;
    const rate = totalHabits > 0 ? done / totalHabits : 0;
    result.push({ date: iso, rate });
    cursor.setDate(cursor.getDate() + 1);
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
  const habits = habitsSnap.docs.map((d) => d.data() as Habit);
  const homeIds = habits.filter((h) => h.mode === "home").map((h) => h.id);
  const hostelIds = habits.filter((h) => h.mode === "hostel").map((h) => h.id);
  const day = todayISO();

  const doneCount = async (ids: number[]) => {
    const snaps = await Promise.all(ids.map((hid) => getDoc(doc(db, "users", uid, "entries", `${hid}_${day}`))));
    return snaps.filter((s) => (s.data() as any)?.completed === true).length;
  };

  const [homeDone, hostelDone] = await Promise.all([doneCount(homeIds), doneCount(hostelIds)]);
  const homeTotal = homeIds.length;
  const hostelTotal = hostelIds.length;
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

// Interventions (used by urge tool)
export async function addIntervention(action: string): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const id = await allocId(uid, "intervention");
  await setDoc(doc(db, "users", uid, "interventions", String(id)), {
    id,
    date: todayISO(),
    action,
    completed: 0,
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function completeIntervention(id: number): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await updateDoc(doc(db, "users", uid, "interventions", String(id)), { completed: 1, completedAt: serverTimestamp() });
}

// ─── Achievements unlocked (rows) ──────────────────────────────

export async function getUnlockedAchievementIds(): Promise<{ achievementId: string; unlockedAt: string }[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDocs(query(collection(db, "users", uid, "achievements"), orderBy("unlockedAt", "asc"), limit(2000)));
  return snap.docs
    .map((d) => ({ achievementId: d.id, unlockedAt: String((d.data() as any)?.unlockedAt ?? "") }))
    .filter((r) => r.achievementId);
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
  const ref = doc(db, "users", uid, "achievements", id);
  const existing = await getDoc(ref);
  if (existing.exists()) return;
  await setDoc(ref, { id, ...meta, unlockedAt: serverTimestamp() }, { merge: true });
}

/** Achievement catalog from Firestore (`users/{uid}/achievement_defs`). */
export async function getAchievementDefinitions(): Promise<AchievementDefinition[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const col = collection(db, "users", uid, "achievement_defs");
  let snap;
  try {
    snap = await getDocs(query(col, orderBy("sortOrder", "asc")));
  } catch {
    snap = await getDocs(col);
  }

  const parsed: { sortOrder: number; def: AchievementDefinition }[] = [];
  for (const d of snap.docs) {
    const x = d.data() as Record<string, unknown>;
    let icon: HabitIcon | undefined;
    const rawIcon = x.icon;
    if (typeof rawIcon === "string") {
      try {
        icon = JSON.parse(rawIcon) as HabitIcon;
      } catch {
        icon = { ios: "star.fill", android: "star", web: "star" };
      }
    } else if (rawIcon && typeof rawIcon === "object") {
      icon = rawIcon as HabitIcon;
    }
    if (!icon?.ios) {
      icon = { ios: "star.fill", android: "star", web: "star" };
    }
    const id = String(x.id ?? d.id);
    const tp = (x.type as AchievementDefinition["type"]) ?? "special";
    const sortOrder = typeof x.sortOrder === "number" ? x.sortOrder : 9999;
    parsed.push({
      sortOrder,
      def: {
        id,
        type: tp,
        title: String(x.title ?? ""),
        description: String(x.description ?? ""),
        icon,
      },
    });
  }
  parsed.sort((a, b) => a.sortOrder - b.sortOrder || a.def.id.localeCompare(b.def.id));
  return parsed.map((p) => p.def);
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
  const { db } = userRoot(uid);
  const snap = await getDocs(query(collection(db, "users", uid, "challenge_completion_history"), limit(2000)));
  return snap.size;
}

export async function hasCompletedRecoveryPlanOnce(): Promise<boolean> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  // If any session has >= 5 action completions, consider it a full plan.
  const actionsSnap = await getDocs(query(collection(db, "users", uid, "urge_tool_action_completions"), limit(5000)));
  const counts = new Map<number, number>();
  for (const d of actionsSnap.docs) {
    const sid = (d.data() as any)?.sessionId as number | undefined;
    if (typeof sid !== "number") continue;
    counts.set(sid, (counts.get(sid) ?? 0) + 1);
  }
  for (const n of counts.values()) {
    if (n >= 5) return true;
  }
  return false;
}

// Urge sessions
export async function startUrgeToolSession(): Promise<number> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const id = await allocId(uid, "urge_session");
  await setDoc(doc(db, "users", uid, "urge_tool_sessions", String(id)), {
    id,
    startedAt: serverTimestamp(),
    endedAt: null,
  });
  return id;
}

export async function endUrgeToolSession(sessionId: number): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await updateDoc(doc(db, "users", uid, "urge_tool_sessions", String(sessionId)), { endedAt: serverTimestamp() });
}

export async function recordUrgeToolActionCompletion(sessionId: number, actionLabel: string): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const ref = doc(collection(db, "users", uid, "urge_tool_action_completions")) as DocumentReference;
  await setDoc(ref, { sessionId, actionLabel, completedAt: serverTimestamp() });
}

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

// ─── Challenges ────────────────────────────────────────────────

export async function getChallenges(): Promise<Challenge[]> {
  const uid = await requireUid();
  await ensureSeeded(uid);
  const { db } = userRoot(uid);
  const challCol = collection(db, "users", uid, "challenges");
  let snap;
  try {
    snap = await getDocs(query(challCol, orderBy("id", "asc")));
  } catch {
    snap = await getDocs(challCol);
  }
  let rows = snap.docs.map((d) => d.data() as Challenge);
  rows.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  const defCol = collection(db, "users", uid, "challenge_defs");
  let defSnap;
  try {
    defSnap = await getDocs(query(defCol, orderBy("sortOrder", "asc")));
  } catch {
    defSnap = await getDocs(defCol);
  }
  const defById = new Map<number, Record<string, unknown>>();
  for (const d of defSnap.docs) {
    const data = d.data() as Record<string, unknown>;
    const id = typeof data.id === "number" ? data.id : Number(data.id ?? d.id);
    if (Number.isFinite(id)) defById.set(id, data);
  }

  return rows.map((row) => {
    const def = defById.get(row.id);
    if (!def) return row;
    const duration = typeof def.duration === "number" ? def.duration : row.duration;
    return {
      ...row,
      defId: typeof def.defId === "string" ? def.defId : row.defId,
      name: typeof def.name === "string" ? def.name : row.name,
      description: typeof def.description === "string" ? def.description : row.description,
      duration,
      category: (def.category as Challenge["category"]) ?? row.category,
      rules: typeof def.rules === "string" ? def.rules : row.rules,
      difficulty: (def.difficulty as Challenge["difficulty"]) ?? row.difficulty,
      xp: typeof def.xp === "number" ? def.xp : row.xp,
    };
  });
}

export async function startChallenge(id: number): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await updateDoc(doc(db, "users", uid, "challenges", String(id)), {
    startedAt: serverTimestamp(),
    completedAt: null,
    progress: 0,
  });
}

export async function incrementChallengeProgress(id: number): Promise<boolean> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const ref = doc(db, "users", uid, "challenges", String(id));
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return false;
    const c = snap.data() as any;
    const today = todayISO();

    // Auto-start on first log
    const startedAt = c.startedAt ?? null;
    const lastLoggedDate = (c.lastLoggedDate ?? null) as string | null;

    // One log per day
    if (lastLoggedDate === today) return false;

    // If missed a day, reset the challenge (streak-style challenges)
    if (lastLoggedDate) {
      const prev = new Date(lastLoggedDate + "T00:00:00");
      const cur = new Date(today + "T00:00:00");
      const diff = (cur.getTime() - prev.getTime()) / 86_400_000;
      if (diff > 1) {
        tx.update(ref, {
          startedAt: null,
          completedAt: null,
          progress: 0,
          lastLoggedDate: null,
          resetAt: serverTimestamp(),
        });
        return false;
      }
    }

    const next = (c.progress ?? 0) + 1;
    const duration = c.duration ?? 7;
    const finished = next >= duration;
    tx.update(ref, {
      progress: next,
      lastLoggedDate: today,
      ...(startedAt ? {} : { startedAt: serverTimestamp() }),
      ...(finished ? { completedAt: serverTimestamp() } : {}),
    });

    // Log activity row (for challenge detail screen)
    const logRef = doc(collection(db, "users", uid, "challenge_logs"));
    tx.set(logRef, {
      challengeId: id,
      date: today,
      createdAt: serverTimestamp(),
    });

    if (finished) {
      const histId = String(Date.now());
      const histRef = doc(db, "users", uid, "challenge_completion_history", histId);
      tx.set(histRef, {
        id: Date.now(),
        sourceChallengeId: id,
        name: c.name ?? "",
        duration,
        completedAt: serverTimestamp(),
      });
    }

    return finished;
  });
}

export async function resetChallenge(id: number): Promise<void> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  await updateDoc(doc(db, "users", uid, "challenges", String(id)), {
    startedAt: null,
    completedAt: null,
    progress: 0,
  });
}

export async function getChallengeStats(): Promise<ChallengeStats> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDocs(query(collection(db, "users", uid, "challenge_completion_history"), orderBy("completedAt", "desc"), limit(500)));
  const rows = snap.docs.map((d) => d.data() as ChallengeCompletionRecord);
  const totalCompleted = rows.length;
  const totalDaysCompleted = rows.reduce((s, r) => s + (r.duration ?? 0), 0);
  return { totalCompleted, totalDaysCompleted };
}

export async function getChallengeCompletionHistory(limitN = 50): Promise<ChallengeCompletionRecord[]> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDocs(
    query(collection(db, "users", uid, "challenge_completion_history"), orderBy("completedAt", "desc"), limit(limitN)),
  );
  return snap.docs.map((d) => d.data() as ChallengeCompletionRecord);
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
  await setDoc(
    ref,
    {
      date: day,
      screenTime,
      riskScore,
      relapse,
      sleepMinutes,
      steps,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
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
  await runTransaction(db, async (tx) => {
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
    const mRef = doc(db, "users", uid, "metrics_daily", day);
    const mSnap = await tx.get(mRef);
    const prev = mSnap.data() as Record<string, unknown> | undefined;
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
        const e = d.data() as { habitId?: number; completed?: boolean; date?: string };
        if (typeof e.habitId !== "number" || !e.date || e.date < from || e.date > to) continue;
        const row = byHabit.get(e.habitId) ?? { total: 0, done: 0 };
        row.total += 1;
        if (e.completed) row.done += 1;
        byHabit.set(e.habitId, row);
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
        const e = d.data() as { date?: string; completed?: boolean };
        if (!e.date) continue;
        const w = new Date(e.date + "T12:00:00").getDay();
        const weekend = w === 0 || w === 6;
        if (weekend) {
          weekendTotal += 1;
          if (e.completed) weekendDone += 1;
        } else {
          weekdayTotal += 1;
          if (e.completed) weekdayDone += 1;
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
    query(collection(db, "users", uid, "entries"), where("completed", "==", false), limit(8000)),
  );
  const missedBy = new Map<number, number>();
  for (const d of snap.docs) {
    const e = d.data() as { habitId?: number };
    if (typeof e.habitId !== "number") continue;
    missedBy.set(e.habitId, (missedBy.get(e.habitId) ?? 0) + 1);
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

/** Per-habit per-day toggle timeline (see `toggleHabit`). */
export async function getHabitDailyTrackingProgress(
  habitId: number,
  date: string,
): Promise<{ toggleHistory?: { at: string; completed: boolean }[]; completed?: boolean } | null> {
  const uid = await requireUid();
  const { db } = userRoot(uid);
  const snap = await getDoc(
    doc(db, "users", uid, "habit_daily_tracking_progress", `${habitId}_${date}`),
  );
  if (!snap.exists()) return null;
  return snap.data() as { toggleHistory?: { at: string; completed: boolean }[]; completed?: boolean };
}

/** Persists latest insight signals + rolling daily map under `meta/insights`. */
async function persistInsightsMeta(uid: string): Promise<void> {
  const { db } = userRoot(uid);
  const day = todayISO();
  const sig = await getInsightSignals();
  const metaRef = doc(db, "users", uid, "meta", "insights");
  const prevSnap = await getDoc(metaRef);
  const prev = prevSnap.data() as { daily?: Record<string, Record<string, number>> } | undefined;
  const daily = { ...(prev?.daily ?? {}) };
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
    metaRef,
    {
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
    { merge: true },
  );
}

