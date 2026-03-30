import {
  getEntriesCompletionSummary,
  getGlobalLongestStreak,
  getGlobalStreak,
  getDetoxStreak,
  getUnlockedAchievementIds,
  unlockAchievement,
} from './database';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: { ios: string; android: string; web: string };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'streak_3',
    title: 'Spark',
    description: 'Hit a 3-day discipline streak',
    icon: { ios: 'flame', android: 'local_fire_department', web: 'local_fire_department' },
  },
  {
    id: 'streak_7',
    title: 'Week locked',
    description: '7-day streak — one full week',
    icon: { ios: 'flame.fill', android: 'whatshot', web: 'whatshot' },
  },
  {
    id: 'streak_30',
    title: 'Iron month',
    description: '30-day longest streak',
    icon: { ios: 'star.circle.fill', android: 'military_tech', web: 'military_tech' },
  },
  {
    id: 'consistency_50',
    description: '50%+ completion over 20+ logs',
    title: 'Halfway there',
    icon: { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up', web: 'trending_up' },
  },
  {
    id: 'consistency_70',
    title: 'Disciplined',
    description: '70%+ completion over 40+ logs',
    icon: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' },
  },
  {
    id: 'detox_3',
    title: 'Detox starter',
    description: '3 days in Detox mode',
    icon: { ios: 'shield.checkmark.fill', android: 'shield', web: 'shield' },
  },
  {
    id: 'detox_7',
    title: 'Detox week',
    description: '7 days in Detox mode',
    icon: { ios: 'shield.fill', android: 'health_and_safety', web: 'health_and_safety' },
  },
];

type Stats = {
  current: number;
  longest: number;
  rate: number;
  total: number;
  detoxDays: number;
};

async function loadStats(): Promise<Stats> {
  const [current, longest, summary, detoxDays] = await Promise.all([
    getGlobalStreak(),
    getGlobalLongestStreak(),
    getEntriesCompletionSummary(),
    getDetoxStreak(),
  ]);
  return {
    current,
    longest,
    rate: summary.rate,
    total: summary.total,
    detoxDays,
  };
}

const RULES: Record<string, (s: Stats) => boolean> = {
  streak_3: (s) => s.longest >= 3 || s.current >= 3,
  streak_7: (s) => s.longest >= 7,
  streak_30: (s) => s.longest >= 30,
  consistency_50: (s) => s.total >= 20 && s.rate >= 50,
  consistency_70: (s) => s.total >= 40 && s.rate >= 70,
  detox_3: (s) => s.detoxDays >= 3,
  detox_7: (s) => s.detoxDays >= 7,
};

/** Unlock any newly earned achievements. Returns IDs just unlocked. */
export async function syncAchievements(): Promise<string[]> {
  const stats = await loadStats();
  const unlocked = new Set((await getUnlockedAchievementIds()).map((r) => r.achievementId));
  const newly: string[] = [];

  for (const def of ACHIEVEMENTS) {
    if (unlocked.has(def.id)) continue;
    const rule = RULES[def.id];
    if (rule?.(stats)) {
      await unlockAchievement(def.id);
      newly.push(def.id);
    }
  }
  return newly;
}

export function getAchievementDef(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
