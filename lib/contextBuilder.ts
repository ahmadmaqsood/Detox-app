import type { Mode } from './types';
import type { RiskLevel } from './riskEngine';
import { calculateRisk } from './riskEngine';
import {
  getMode,
  getMetrics,
  getTodayHabits,
  getGlobalStreak,
  getGlobalLongestStreak,
  getEntriesCompletionSummary,
  getRelapseCountsLastTwoWindows,
} from './firestoreDatabase';
import { evaluateUserLevel, type UserLevelState } from './userLevel';

export type UserContext = UserLevelState & {
  currentMode: Mode;
  streak: number;
  screenTime: number;
  riskLevel: RiskLevel;
  riskScore: number;
  completedHabits: string[];
  missedHabits: string[];
  totalHabits: number;
  completionRate: number;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
};

function getTimeOfDay(): UserContext['timeOfDay'] {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'night';
}

export async function getUserContext(): Promise<UserContext> {
  const [mode, metrics, habits, streak, longest, summary, relWin] = await Promise.all([
    getMode(),
    getMetrics(),
    getTodayHabits(),
    getGlobalStreak(),
    getGlobalLongestStreak(),
    getEntriesCompletionSummary(),
    getRelapseCountsLastTwoWindows(),
  ]);

  const screenTime = metrics?.screenTime ?? 0;
  const completed = habits.filter((h) => h.completed === 1);
  const missed = habits.filter((h) => h.completed === 0);

  const risk = calculateRisk({
    screenTime,
    completedHabits: completed,
    totalHabits: habits,
    mode,
    streak,
  });

  const levelState = evaluateUserLevel({
    currentStreak: streak,
    longestStreak: longest,
    consistencyPercent: summary.rate,
    relapsesLast30: relWin.last30,
    relapsesPrev30: relWin.prev30,
  });

  return {
    ...levelState,
    currentMode: mode,
    streak,
    screenTime,
    riskLevel: risk.level,
    riskScore: risk.score,
    completedHabits: completed.map((h) => h.name),
    missedHabits: missed.map((h) => h.name),
    totalHabits: habits.length,
    completionRate: habits.length > 0 ? Math.round((completed.length / habits.length) * 100) : 0,
    timeOfDay: getTimeOfDay(),
  };
}
