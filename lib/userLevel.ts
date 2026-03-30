import {
  getEntriesCompletionSummary,
  getGlobalLongestStreak,
  getGlobalStreak,
  getRelapseCountsLastTwoWindows,
} from './database';

export type UserLevel = 'beginner' | 'intermediate' | 'advanced';

export type RelapseTrend = 'improving' | 'stable' | 'worsening' | 'unknown';

export interface UserLevelState {
  level: UserLevel;
  /** Risk score above this shows recovery / danger intervention on Today. */
  riskAlertThreshold: number;
  /** Coach auto-push when screen time exceeds (minutes). */
  screenTimeAutoMessageAt: number;
  /** Coach / context uses this for “high screen time” copy (minutes). */
  screenTimeSoftWarnAt: number;
  relapseTrend: RelapseTrend;
  relapsesLast30: number;
  relapsesPrev30: number;
}

function computeRelapseTrend(last30: number, prev30: number): RelapseTrend {
  if (prev30 === 0 && last30 === 0) return 'stable';
  if (last30 < prev30) return 'improving';
  if (last30 > prev30 + 1) return 'worsening';
  return 'stable';
}

const BEHAVIOR: Record<
  UserLevel,
  Pick<UserLevelState, 'riskAlertThreshold' | 'screenTimeAutoMessageAt' | 'screenTimeSoftWarnAt'>
> = {
  beginner: {
    riskAlertThreshold: 55,
    screenTimeAutoMessageAt: 150,
    screenTimeSoftWarnAt: 115,
  },
  intermediate: {
    riskAlertThreshold: 65,
    screenTimeAutoMessageAt: 175,
    screenTimeSoftWarnAt: 135,
  },
  advanced: {
    riskAlertThreshold: 78,
    screenTimeAutoMessageAt: 205,
    screenTimeSoftWarnAt: 160,
  },
};

/**
 * Upgrade rules (all three axes):
 * — Streak: current / longest gates
 * — Consistency: overall entry completion %
 * — Relapse reduction: last 30d vs prior 30d (improving or low count); worsening trend caps level
 */
export function evaluateUserLevel(input: {
  currentStreak: number;
  longestStreak: number;
  consistencyPercent: number;
  relapsesLast30: number;
  relapsesPrev30: number;
}): UserLevelState {
  const trend = computeRelapseTrend(input.relapsesLast30, input.relapsesPrev30);

  const streakAdvanced = input.currentStreak >= 12 || input.longestStreak >= 28;
  const consistencyAdvanced = input.consistencyPercent >= 52;
  const relapseAdvanced =
    input.relapsesLast30 <= input.relapsesPrev30 || input.relapsesLast30 <= 1;

  const streakInter = input.currentStreak >= 3 || input.longestStreak >= 7;
  const consistencyInter = input.consistencyPercent >= 28;

  let level: UserLevel = 'beginner';
  if (streakAdvanced && consistencyAdvanced && relapseAdvanced) {
    level = 'advanced';
  } else if (streakInter && consistencyInter) {
    level = 'intermediate';
  }

  if (trend === 'worsening' && input.relapsesPrev30 >= 1) {
    if (level === 'advanced') level = 'intermediate';
    else if (level === 'intermediate') level = 'beginner';
  }

  const b = BEHAVIOR[level];
  return {
    level,
    riskAlertThreshold: b.riskAlertThreshold,
    screenTimeAutoMessageAt: b.screenTimeAutoMessageAt,
    screenTimeSoftWarnAt: b.screenTimeSoftWarnAt,
    relapseTrend: trend,
    relapsesLast30: input.relapsesLast30,
    relapsesPrev30: input.relapsesPrev30,
  };
}

export async function loadUserLevelState(): Promise<UserLevelState> {
  const [streak, longest, summary, rel] = await Promise.all([
    getGlobalStreak(),
    getGlobalLongestStreak(),
    getEntriesCompletionSummary(),
    getRelapseCountsLastTwoWindows(),
  ]);
  return evaluateUserLevel({
    currentStreak: streak,
    longestStreak: longest,
    consistencyPercent: summary.rate,
    relapsesLast30: rel.last30,
    relapsesPrev30: rel.prev30,
  });
}

export function formatUserLevelLabel(level: UserLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function getLevelBlurb(level: UserLevel): string {
  switch (level) {
    case 'advanced':
      return 'Strong consistency. Alerts trigger later — you’ve earned slack.';
    case 'intermediate':
      return 'Building discipline. Balanced nudges when risk climbs.';
    default:
      return 'Early protection: we surface risk and screen warnings sooner.';
  }
}
