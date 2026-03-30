import type { Habit, Mode } from './types';

// ─── Types ───────────────────────────────────────────────────

export type RiskLevel = 'safe' | 'warning' | 'danger';

export interface RiskResult {
  score: number;
  level: RiskLevel;
  factors: string[];
}

export interface RiskInput {
  screenTime: number;
  completedHabits: (Habit & { completed: number })[];
  totalHabits: (Habit & { completed: number })[];
  mode: Mode;
  streak: number;
  /** Stricter scoring and thresholds when enabled. */
  hardMode?: boolean;
}

// ─── Pattern matchers ────────────────────────────────────────

const MOVEMENT_PATTERNS = [
  'exercise', 'walk', 'workout', 'run', 'gym', 'movement',
];

const SPIRITUAL_PATTERNS = [
  'namaz', 'quran', 'surah', 'prayer', 'salah',
];

function nameMatches(name: string, patterns: string[]): boolean {
  const lower = name.toLowerCase();
  return patterns.some((p) => lower.includes(p));
}

// ─── Core engine ─────────────────────────────────────────────

export function calculateRisk(input: RiskInput): RiskResult {
  const { screenTime, completedHabits, totalHabits, mode, streak, hardMode } =
    input;
  let score = 0;
  const factors: string[] = [];

  // Rule 1: High screen time  → +30 (tighter in Hard Mode)
  const screenDanger = hardMode ? 120 : 150;
  const screenWarn = hardMode ? 60 : 90;
  if (screenTime > screenDanger) {
    score += hardMode ? 40 : 30;
    factors.push(
      hardMode
        ? 'Hard Mode: screen time above 2h'
        : 'Screen time above 2.5 hours',
    );
  } else if (screenTime > screenWarn) {
    score += hardMode ? 22 : 15;
    factors.push(
      hardMode
        ? 'Hard Mode: screen above 1h'
        : 'Screen time above 1.5 hours',
    );
  }

  // Rule 2: No movement habit completed  → +20
  const movementHabits = totalHabits.filter((h) =>
    nameMatches(h.name, MOVEMENT_PATTERNS)
  );
  const movementDone = movementHabits.some(
    (h) => completedHabits.find((c) => c.id === h.id)?.completed
  );
  if (movementHabits.length > 0 && !movementDone) {
    score += hardMode ? 28 : 20;
    factors.push(
      hardMode
        ? 'Hard Mode: no movement habit logged'
        : 'No physical activity today',
    );
  }

  // Rule 3: No namaz / quran completed  → +25
  const spiritualHabits = totalHabits.filter((h) =>
    nameMatches(h.name, SPIRITUAL_PATTERNS)
  );
  const spiritualDone = spiritualHabits.some(
    (h) => completedHabits.find((c) => c.id === h.id)?.completed
  );
  if (spiritualHabits.length > 0 && !spiritualDone) {
    score += hardMode ? 32 : 25;
    factors.push(
      hardMode
        ? 'Hard Mode: spiritual habits open'
        : 'No spiritual practice today',
    );
  }

  // Rule 4: Home mode is riskier  → +15
  if (mode === 'home') {
    score += hardMode ? 20 : 15;
    factors.push('Home mode — less structure');
  }

  // Rule 5: Broken streak  → +40
  if (streak === 0) {
    score += hardMode ? 48 : 40;
    factors.push(
      hardMode ? 'Hard Mode: streak at zero' : 'Streak broken — stay vigilant',
    );
  } else if (streak <= 2) {
    score += hardMode ? 22 : 15;
    factors.push('Streak is fragile — keep going');
  }

  // Bonus: good completion rate reduces score
  const total = totalHabits.length;
  const done = completedHabits.filter((h) => h.completed).length;
  if (total > 0) {
    const rate = done / total;
    if (rate >= 0.8) {
      score -= hardMode ? 15 : 20;
      factors.push('Great completion rate today');
    } else if (rate >= 0.5) {
      score -= hardMode ? 6 : 10;
    }
    if (hardMode && rate < 0.5 && total > 0) {
      score += 12;
      factors.push('Hard Mode: finish more habits today');
    }
  }

  if (hardMode) {
    score = Math.round(score * 1.08);
    factors.push('Hard Mode active — penalties amplified');
  }

  score = Math.max(0, Math.min(100, score));

  const level: RiskLevel = hardMode
    ? score <= 25
      ? 'safe'
      : score <= 52
        ? 'warning'
        : 'danger'
    : score <= 30
      ? 'safe'
      : score <= 60
        ? 'warning'
        : 'danger';

  return { score, level, factors };
}

// ─── Intervention messages ───────────────────────────────────

interface InterventionMessage {
  title: string;
  body: string;
  action: string;
}

const SAFE_MESSAGES: InterventionMessage[] = [
  {
    title: "You're doing great",
    body: 'Your discipline is showing. Keep this energy going — every clean day compounds.',
    action: 'Keep it up',
  },
  {
    title: 'Solid foundation',
    body: "You're building something real. Stay on this path and the urges will weaken over time.",
    action: 'Stay focused',
  },
  {
    title: 'Momentum is yours',
    body: 'Your habits are on track and your streak is growing. This is what recovery looks like.',
    action: 'Continue',
  },
];

const WARNING_MESSAGES: InterventionMessage[] = [
  {
    title: 'Stay alert',
    body: 'Your risk level is climbing. Step away from screens, do wudu, or go for a short walk.',
    action: 'Take a break',
  },
  {
    title: "You've been here before",
    body: 'This is the moment that matters. Put the phone down. Go pray, stretch, or call someone.',
    action: 'Step away',
  },
  {
    title: 'Pause and breathe',
    body: 'Close your eyes for 30 seconds. Remember why you started this journey.',
    action: 'Reset now',
  },
];

const DANGER_MESSAGES: InterventionMessage[] = [
  {
    title: 'Critical moment',
    body: "Leave the room right now. Go outside, make wudu, or call a trusted friend. Don't be alone with your phone.",
    action: 'Emergency exit',
  },
  {
    title: 'You are stronger than this',
    body: 'Every time you resist, your brain rewires a little more. Go pray two rakat right now.',
    action: 'Pray now',
  },
  {
    title: "Don't throw it away",
    body: "Think about your streak and all the effort. One moment of weakness isn't worth it. Put the phone in another room.",
    action: 'Lock phone away',
  },
];

export function getInterventionMessage(
  level: RiskLevel,
  options?: { hardMode?: boolean },
): InterventionMessage {
  const pool =
    level === 'safe'
      ? SAFE_MESSAGES
      : level === 'warning'
        ? WARNING_MESSAGES
        : DANGER_MESSAGES;

  const msg = pool[Math.floor(Math.random() * pool.length)];
  if (options?.hardMode && level !== 'safe') {
    return {
      ...msg,
      title: `⚔️ Hard Mode — ${msg.title}`,
      body: `${msg.body}\n\nNo skipping. Execute one tiny win in the next 2 minutes.`,
    };
  }
  return msg;
}

export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case 'safe':
      return '#4ADE80';
    case 'warning':
      return '#F59E0B';
    case 'danger':
      return '#EF4444';
  }
}

export function getRiskLabel(level: RiskLevel): string {
  switch (level) {
    case 'safe':
      return 'Low Risk';
    case 'warning':
      return 'Moderate Risk';
    case 'danger':
      return 'High Risk';
  }
}
