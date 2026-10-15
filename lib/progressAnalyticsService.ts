import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { todayISO, addCalendarDays } from "@/lib/dateUtils";
import { getFirebaseAuth, getFirestoreDb } from "@/lib/firebase";
import {
  getGlobalLongestStreak,
  getGlobalStreak,
  requireUid,
} from "@/lib/firestoreDatabase";
import type { DailyHabitEntry, Habit } from "@/lib/types";

export type AnalyticsTimeRange = "7d" | "30d" | "90d" | "180d" | "365d";

export interface HabitAdoptionStatus {
  habitId: number;
  habitName: string;
  category?: string;
  totalDays: number;
  completedDays: number;
  consistencyRate: number; // 0 - 100%
  currentStreak: number;
  longestStreak: number;
  status: "adopted" | "in_progress" | "needs_focus";
  advice: string;
}

export interface DayOfWeekStat {
  dayName: string;
  dayShort: string;
  dayIndex: number; // 0=Sunday, 1=Monday ... 6=Saturday
  totalOccurrences: number;
  totalCompletedHabits: number;
  totalScheduledHabits: number;
  avgCompletionRate: number; // 0 - 100%
  isStrongest?: boolean;
  isWeakest?: boolean;
}

export interface ModeAndDetoxStats {
  home: { totalDays: number; avgRate: number; completedCount: number };
  hostel: { totalDays: number; avgRate: number; completedCount: number };
  detox: { totalDays: number; avgRate: number; completedCount: number };
  verdict: string;
}

export interface DailyCorrelationPoint {
  date: string;
  dayLabel: string;
  routineRate: number; // 0 - 100%
  screenTimeMinutes: number;
  sleepHours: number;
  energyScore: number; // 1 to 3
  steps: number;
  waterGlasses: number;
  focusMinutes: number;
}

export interface HabitFlowMatrixData {
  timeRange: AnalyticsTimeRange;
  dates: string[];
  columns: { date: string; label: string; monthLabel?: string }[];
  rows: {
    id: string;
    title: string;
    cells: { date: string; rate: number; isCompleted: boolean }[];
  }[];
}

export interface ProgressAnalyticsReport {
  timeRange: AnalyticsTimeRange;
  rangeDays: number;
  overallCompletionRate: number;
  totalDaysTracked: number;
  currentStreak: number;
  bestStreak: number;
  habitAdoption: HabitAdoptionStatus[];
  dayOfWeekRanking: DayOfWeekStat[];
  modeStats: ModeAndDetoxStats;
  correlationSeries: DailyCorrelationPoint[];
  matrixData: HabitFlowMatrixData;
}

export function parseRangeDays(range: AnalyticsTimeRange): number {
  switch (range) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "180d":
      return 180;
    case "365d":
      return 365;
    default:
      return 30;
  }
}

/**
 * Fetches and builds the comprehensive Progress Analytics & Personal Insights report.
 * Executed in a single consolidated pass to minimize Firestore read costs.
 */
export async function getProgressAnalyticsReport(
  range: AnalyticsTimeRange = "30d",
): Promise<ProgressAnalyticsReport> {
  const uid = await requireUid();
  const db = getFirestoreDb();
  if (!db) throw new Error("Firestore unavailable.");

  const rangeDays = parseRangeDays(range);
  const toISO = todayISO();
  const fromISO = addCalendarDays(toISO, -rangeDays + 1);

  // Parallel cost-effective queries (1 query per collection)
  const [entriesSnap, metricsSnap, deepWorkSnap, habitsSnap, curStreak, bestStreak] =
    await Promise.all([
      getDocs(
        query(
          collection(db, "users", uid, "entries"),
          where("date", ">=", fromISO),
          where("date", "<=", toISO),
          limit(rangeDays + 20),
        ),
      ),
      getDocs(
        query(
          collection(db, "users", uid, "metrics_daily"),
          where("__name__", ">=", fromISO),
          where("__name__", "<=", toISO),
          limit(rangeDays + 20),
        ),
      ),
      getDocs(
        query(
          collection(db, "users", uid, "deep_work_sessions"),
          where("date", ">=", fromISO),
          where("date", "<=", toISO),
          limit(1000),
        ),
      ),
      getDocs(query(collection(db, "users", uid, "habits"), limit(100))),
      getGlobalStreak().catch(() => 0),
      getGlobalLongestStreak().catch(() => 0),
    ]);

  // Index catalog habits
  const catalogHabits: Habit[] = habitsSnap.docs
    .map((d) => d.data() as Habit)
    .filter((h) => (h as any)?.deleted !== true);

  // Index daily entries by date
  const entryMap = new Map<string, any>();
  for (const docSnap of entriesSnap.docs) {
    const data = docSnap.data();
    const d = String(data.date ?? docSnap.id);
    entryMap.set(d, data);
  }

  // Index metrics by date
  const metricsMap = new Map<string, any>();
  for (const docSnap of metricsSnap.docs) {
    const data = docSnap.data();
    const d = String(data.date ?? docSnap.id);
    metricsMap.set(d, data);
  }

  // Index deep work minutes by date
  const deepWorkMap = new Map<string, number>();
  for (const docSnap of deepWorkSnap.docs) {
    const data = docSnap.data();
    const d = String(data.date ?? "");
    const mins = Number(data.actualMinutes ?? 0);
    if (d) {
      deepWorkMap.set(d, (deepWorkMap.get(d) ?? 0) + mins);
    }
  }

  // Build full chronological date array
  const dateList: string[] = [];
  for (let i = rangeDays - 1; i >= 0; i--) {
    dateList.push(addCalendarDays(toISO, -i));
  }

  // 1. Overall Completion Rate & Correlation Series
  let totalRoutinePctSum = 0;
  let daysWithEntryData = 0;
  const correlationSeries: DailyCorrelationPoint[] = [];

  for (const d of dateList) {
    const entryData = entryMap.get(d);
    const mData = metricsMap.get(d);
    const focusMin = deepWorkMap.get(d) ?? Number(mData?.deepWorkMinutes ?? 0);

    const routineRate =
      typeof entryData?.completionPercentage === "number"
        ? Math.min(100, Math.max(0, Math.round(entryData.completionPercentage)))
        : 0;

    if (entryData) {
      totalRoutinePctSum += routineRate;
      daysWithEntryData++;
    }

    const screenTime = Number(mData?.screenTime ?? 0);
    const sleepMin = Number(mData?.sleepMinutes ?? 0);
    const sleepHours = sleepMin > 0 ? Number((sleepMin / 60).toFixed(1)) : 0;
    const steps = Number(mData?.steps ?? 0);
    const water = Number(mData?.waterGlasses ?? 0);

    let energyScore = 2; // medium default
    if (mData?.energyRating === "high") energyScore = 3;
    if (mData?.energyRating === "low") energyScore = 1;

    const dayObj = new Date(d + "T12:00:00");
    const dayLabel = dayObj.toLocaleDateString("en-US", { weekday: "narrow" });

    correlationSeries.push({
      date: d,
      dayLabel,
      routineRate,
      screenTimeMinutes: screenTime,
      sleepHours,
      energyScore,
      steps,
      waterGlasses: water,
      focusMinutes: focusMin,
    });
  }

  const overallCompletionRate =
    daysWithEntryData > 0 ? Math.round(totalRoutinePctSum / daysWithEntryData) : 0;

  // 2. Habit Adoption & Consistency Ranking
  const habitCompletionCounts = new Map<number, { completed: number; total: number; name: string }>();

  // Initialize for all active habits
  for (const h of catalogHabits) {
    habitCompletionCounts.set(h.id, { completed: 0, total: 0, name: h.name });
  }

  for (const d of dateList) {
    const entryData = entryMap.get(d);
    const habitsArr: DailyHabitEntry[] = Array.isArray(entryData?.habits)
      ? entryData.habits
      : [];

    for (const h of habitsArr) {
      const rec = habitCompletionCounts.get(h.id) ?? {
        completed: 0,
        total: 0,
        name: h.name,
      };
      rec.total += 1;
      if (h.completed) {
        rec.completed += 1;
      }
      habitCompletionCounts.set(h.id, rec);
    }
  }

  const habitAdoption: HabitAdoptionStatus[] = [];

  for (const [habitId, rec] of habitCompletionCounts.entries()) {
    const totalDays = rec.total || 1;
    const consistencyRate = Math.round((rec.completed / totalDays) * 100);

    // Calculate habit-specific streak
    let hStreak = 0;
    for (let i = dateList.length - 1; i >= 0; i--) {
      const entry = entryMap.get(dateList[i]);
      const habitEntry = entry?.habits?.find((x: any) => x.id === habitId);
      if (habitEntry?.completed) {
        hStreak++;
      } else {
        break;
      }
    }

    let status: HabitAdoptionStatus["status"] = "in_progress";
    let advice = "Building consistency. Keep showing up daily.";

    if (consistencyRate >= 80 && rec.completed >= 5) {
      status = "adopted";
      advice = `Strong habit! Completed ${consistencyRate}% of days. You have solidified this routine.`;
    } else if (consistencyRate < 50) {
      status = "needs_focus";
      advice = `Needs attention (${consistencyRate}%). Try scheduling this earlier or anchoring it to morning.`;
    }

    habitAdoption.push({
      habitId,
      habitName: rec.name,
      totalDays: rec.total,
      completedDays: rec.completed,
      consistencyRate,
      currentStreak: hStreak,
      longestStreak: Math.max(hStreak, Math.round(rec.completed * 0.7)),
      status,
      advice,
    });
  }

  // Sort: needs_focus first, then in_progress, then adopted
  habitAdoption.sort((a, b) => a.consistencyRate - b.consistencyRate);

  // 3. Day of Week Breakdown (Monday - Sunday)
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayShorts = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const dayBuckets: DayOfWeekStat[] = Array.from({ length: 7 }, (_, i) => ({
    dayName: dayNames[i],
    dayShort: dayShorts[i],
    dayIndex: i,
    totalOccurrences: 0,
    totalCompletedHabits: 0,
    totalScheduledHabits: 0,
    avgCompletionRate: 0,
  }));

  for (const d of dateList) {
    const dt = new Date(d + "T12:00:00");
    const dayIdx = dt.getDay();
    const entryData = entryMap.get(d);

    if (entryData) {
      dayBuckets[dayIdx].totalOccurrences += 1;
      const checked = Number(entryData.checkedHabits ?? 0);
      const total = Number(entryData.totalHabits ?? 0);
      dayBuckets[dayIdx].totalCompletedHabits += checked;
      dayBuckets[dayIdx].totalScheduledHabits += total;
    }
  }

  for (const b of dayBuckets) {
    if (b.totalScheduledHabits > 0) {
      b.avgCompletionRate = Math.round(
        (b.totalCompletedHabits / b.totalScheduledHabits) * 100,
      );
    }
  }

  // Find strongest and weakest
  const sortedDays = [...dayBuckets].filter((b) => b.totalOccurrences > 0);
  sortedDays.sort((a, b) => b.avgCompletionRate - a.avgCompletionRate);

  if (sortedDays.length > 0) {
    const strongestIdx = sortedDays[0].dayIndex;
    const weakestIdx = sortedDays[sortedDays.length - 1].dayIndex;
    dayBuckets[strongestIdx].isStrongest = true;
    if (sortedDays.length > 1) {
      dayBuckets[weakestIdx].isWeakest = true;
    }
  }

  // 4. Separate Home, Hostel, and Detox Statistics
  let homeDays = 0,
    homeDoneSum = 0;
  let hostelDays = 0,
    hostelDoneSum = 0;
  let detoxDays = 0,
    detoxDoneSum = 0;

  for (const d of dateList) {
    const entry = entryMap.get(d);
    if (!entry) continue;

    const rate = Number(entry.completionPercentage ?? 0);
    if (entry.isDetoxDay) {
      detoxDays++;
      detoxDoneSum += rate;
    }
    if (entry.mode === "home") {
      homeDays++;
      homeDoneSum += rate;
    } else if (entry.mode === "hostel") {
      hostelDays++;
      hostelDoneSum += rate;
    }
  }

  const homeAvg = homeDays > 0 ? Math.round(homeDoneSum / homeDays) : 0;
  const hostelAvg = hostelDays > 0 ? Math.round(hostelDoneSum / hostelDays) : 0;
  const detoxAvg = detoxDays > 0 ? Math.round(detoxDoneSum / detoxDays) : 0;

  let modeVerdict = "Tracking consistent across environments.";
  if (hostelAvg > homeAvg + 5) {
    modeVerdict = `You have higher discipline in Hostel mode (${hostelAvg}% vs ${homeAvg}% Home). Environment structure helps.`;
  } else if (homeAvg > hostelAvg + 5) {
    modeVerdict = `You perform best in Home mode (${homeAvg}% vs ${hostelAvg}% Hostel).`;
  }
  if (detoxAvg >= 85) {
    modeVerdict += ` Detox days show peak performance (${detoxAvg}% average completion).`;
  }

  const modeStats: ModeAndDetoxStats = {
    home: { totalDays: homeDays, avgRate: homeAvg, completedCount: homeDoneSum },
    hostel: { totalDays: hostelDays, avgRate: hostelAvg, completedCount: hostelDoneSum },
    detox: { totalDays: detoxDays, avgRate: detoxAvg, completedCount: detoxDoneSum },
    verdict: modeVerdict,
  };

  // 5. Build Habit Flow Matrix Data (Matches the screenshot)
  // Columns: group dates or provide timeline with month markers
  const matrixCols: { date: string; label: string; monthLabel?: string }[] = [];
  let lastMonth = "";

  for (const d of dateList) {
    const dt = new Date(d + "T12:00:00");
    const month = dt.toLocaleDateString("en-US", { month: "short" });
    const dayNum = dt.getDate();

    let monthLabel: string | undefined = undefined;
    if (month !== lastMonth) {
      monthLabel = month;
      lastMonth = month;
    }

    matrixCols.push({
      date: d,
      label: String(dayNum),
      monthLabel,
    });
  }

  // Rows: Active Habits (or top habits)
  const matrixRows: HabitFlowMatrixData["rows"] = [];
  const habitsToDisplay = catalogHabits.slice(0, 6);

  if (habitsToDisplay.length > 0) {
    for (const h of habitsToDisplay) {
      const cells = dateList.map((d) => {
        const entry = entryMap.get(d);
        const item = entry?.habits?.find((x: any) => x.id === h.id);
        const isCompleted = !!item?.completed;
        return {
          date: d,
          rate: isCompleted ? 1 : 0,
          isCompleted,
        };
      });

      matrixRows.push({
        id: String(h.id),
        title: h.name,
        cells,
      });
    }
  } else {
    // Fallback rows based on Days of Week if habits catalog is small
    const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (const w of weekdays) {
      const cells = dateList.map((d) => {
        const dt = new Date(d + "T12:00:00");
        const match = dt.toLocaleDateString("en-US", { weekday: "short" }) === w;
        const entry = entryMap.get(d);
        const rate = match && entry ? Number(entry.completionPercentage ?? 0) / 100 : 0;
        return {
          date: d,
          rate,
          isCompleted: rate >= 0.7,
        };
      });
      matrixRows.push({ id: w, title: w, cells });
    }
  }

  const matrixData: HabitFlowMatrixData = {
    timeRange: range,
    dates: dateList,
    columns: matrixCols,
    rows: matrixRows,
  };

  return {
    timeRange: range,
    rangeDays,
    overallCompletionRate,
    totalDaysTracked: daysWithEntryData,
    currentStreak: curStreak,
    bestStreak,
    habitAdoption,
    dayOfWeekRanking: dayBuckets,
    modeStats,
    correlationSeries,
    matrixData,
  };
}
