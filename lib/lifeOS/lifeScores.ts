import { computeEnergyScore } from "../energyScore";
import {
  getEntriesCompletionSummary,
  getExerciseMinutesForDate,
  getGlobalStreak,
  getHardMode,
  getHardModeStreak,
  getLifeAreaBalance,
  getMetrics,
  getWeeklyStats,
} from "../database";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export interface LifeScores {
  discipline: number;
  health: number;
  spiritual: number;
}

/**
 * Single “startup dashboard” score triad from existing storage (no new inputs).
 */
export async function computeLifeScores(): Promise<LifeScores> {
  const day = todayISO();
  const [
    completion,
    streak,
    balance,
    metrics,
    hard,
    hardStreak,
    weekly,
    exerciseMin,
  ] = await Promise.all([
    getEntriesCompletionSummary(),
    getGlobalStreak(),
    getLifeAreaBalance(14),
    getMetrics(),
    getHardMode(),
    getHardModeStreak(),
    getWeeklyStats(1),
    getExerciseMinutesForDate(day),
  ]);

  const rate = completion.rate / 100;
  let discipline = rate * 55 + Math.min(streak, 30) * 1.2 + (weekly[0]?.rate ?? 0) * 0.25;
  if (hard) discipline += 8 + Math.min(hardStreak, 14) * 0.8;

  const spiritualRow = balance.find((b) => b.lifeArea === "spiritual");
  const spiritualRate =
    spiritualRow && spiritualRow.total > 0
      ? spiritualRow.done / spiritualRow.total
      : 0;
  const spiritual = spiritualRate * 70 + rate * 20 + Math.min(streak, 21);

  const m = metrics;
  const energy = computeEnergyScore({
    steps: m?.steps ?? 0,
    exerciseMinutes: exerciseMin,
    sleepMinutes: m?.sleepMinutes ?? 0,
    screenTimeMinutes: m?.screenTime ?? 0,
  });
  let health = energy.score * 0.75 + rate * 15;
  if ((m?.sleepMinutes ?? 0) >= 360) health += 5;

  return {
    discipline: clamp(discipline),
    health: clamp(health),
    spiritual: clamp(spiritual),
  };
}
