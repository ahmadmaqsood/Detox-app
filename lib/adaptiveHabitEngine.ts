import type {
  DailyHabitEntry,
  DailyProgressEntry,
  Habit,
  HabitDifficultyTier,
  HabitLifecycleStage,
  RoutineExperiment,
  TimeSlot,
} from "./types";

// ─── 1. Habit Effectiveness Scoring ────────────────────────────

export interface HabitScoreBreakdown {
  totalScore: number; // 0 to 100
  consistencyScore: number; // 0 to 40
  difficultyScore: number; // 0 to 25
  usefulnessScore: number; // 0 to 20
  alignmentScore: number; // 0 to 15
  grade: "S" | "A" | "B" | "C" | "D";
}

/**
 * Calculates a multi-factor effectiveness score out of 100.
 * Avoids scoring solely on raw streaks — factors in consistency,
 * tier elasticity, perceived usefulness, and goal alignment.
 */
export function computeHabitEffectivenessScore(
  habit: Habit,
  completionRate30d: number, // 0 to 100
  history: { completed: number; completedTier?: HabitDifficultyTier }[] = [],
  energyScore: number = 75, // default baseline energy rating (0-100)
): HabitScoreBreakdown {
  // 1. Consistency (40 points max)
  const consistencyScore = Math.round((Math.min(100, Math.max(0, completionRate30d)) / 100) * 40);

  // 2. Difficulty Feasibility (25 points max)
  // Higher completion of Standard / Ambitious grants full points; Minimum protects against zero.
  let difficultyScore = 15;
  if (history.length > 0) {
    const completedDays = history.filter((h) => h.completed === 1);
    if (completedDays.length > 0) {
      let tierPoints = 0;
      for (const d of completedDays) {
        if (d.completedTier === "ambitious") tierPoints += 1.2;
        else if (d.completedTier === "minimum") tierPoints += 0.8;
        else tierPoints += 1.0; // standard
      }
      const avgTierRatio = tierPoints / completedDays.length;
      difficultyScore = Math.min(25, Math.round(avgTierRatio * 20));
    }
  }

  // 3. User Perceived Usefulness (20 points max, based on 1-5 rating)
  const userRating = habit.usefulnessRating ?? 4; // default 4/5 stars
  const usefulnessScore = Math.round((userRating / 5) * 20);

  // 4. Goal Alignment & Energy Correlation (15 points max)
  const alignmentScore = Math.round((Math.min(100, Math.max(0, energyScore)) / 100) * 15);

  const totalScore = Math.min(100, consistencyScore + difficultyScore + usefulnessScore + alignmentScore);

  let grade: "S" | "A" | "B" | "C" | "D" = "C";
  if (totalScore >= 90) grade = "S";
  else if (totalScore >= 78) grade = "A";
  else if (totalScore >= 62) grade = "B";
  else if (totalScore >= 45) grade = "C";
  else grade = "D";

  return {
    totalScore,
    consistencyScore,
    difficultyScore,
    usefulnessScore,
    alignmentScore,
    grade,
  };
}

// ─── 2. Consistency Recovery (Forgiving Streak Cushion) ───────

export interface RecoverySuggestion {
  needsRecovery: boolean;
  habitId: number;
  habitName: string;
  minimumGoal: string;
  motivationalPrompt: string;
}

/**
 * Checks if a habit missed yesterday and suggests an elastic "Minimum"
 * version today to preserve momentum instead of demoralizing streak resets.
 */
export function checkConsistencyRecovery(
  habit: Habit,
  yesterdayCompleted: boolean,
  todayCompleted: boolean,
): RecoverySuggestion | null {
  if (todayCompleted) return null;
  if (!yesterdayCompleted) {
    const minGoal = habit.difficultyLevels?.minimum ?? "a 5-minute version";
    return {
      needsRecovery: true,
      habitId: habit.id,
      habitName: habit.name,
      minimumGoal: minGoal,
      motivationalPrompt: `Keep momentum alive! Complete ${minGoal} today to protect your consistency streak.`,
    };
  }
  return null;
}

// ─── 3. Adaptive Recommendations (Scale down / Scale up) ─────

export interface AdaptiveRecommendation {
  id: string;
  habitId: number;
  habitName: string;
  type: "scale_down" | "scale_up" | "stack_suggestion" | "time_shift";
  headline: string;
  reasoning: string;
  proposedAction: string;
  suggestedMinimum?: string;
  suggestedStandard?: string;
  proposedTimeSlot?: TimeSlot;
}

/**
 * Evaluates performance patterns over 14–30 days and generates
 * actionable recommendations without automatically overriding user settings.
 */
export function evaluateAdaptiveRecommendations(
  habit: Habit,
  completionRate14d: number, // 0 to 100
  historyDays: { date: string; completed: number; completedTier?: HabitDifficultyTier }[] = [],
): AdaptiveRecommendation | null {
  // If habit completion is under 40% over the last 14 days, suggest scaling down target
  if (completionRate14d < 40 && historyDays.length >= 7) {
    const minText = habit.difficultyLevels?.minimum || "15 minutes";
    return {
      id: `rec_scale_down_${habit.id}`,
      habitId: habit.id,
      habitName: habit.name,
      type: "scale_down",
      headline: `Test a more sustainable target for "${habit.name}"`,
      reasoning: `You completed this ${completionRate14d}% of the time recently. High targets often cause resistance.`,
      proposedAction: `Test "${minText}" for 2 weeks to lock in steady consistency.`,
      suggestedStandard: minText,
      suggestedMinimum: "5 minutes",
    };
  }

  // If habit completion is over 92% consistently, suggest an ambitious milestone
  if (completionRate14d >= 92 && historyDays.length >= 14 && habit.difficultyLevels?.ambitious) {
    return {
      id: `rec_scale_up_${habit.id}`,
      habitId: habit.id,
      habitName: habit.name,
      type: "scale_up",
      headline: `Level up "${habit.name}"!`,
      reasoning: `You've conquered this at ${completionRate14d}% consistency! You are ready for the ambitious tier.`,
      proposedAction: `Try the Ambitious version (${habit.difficultyLevels.ambitious}) on high-energy days.`,
    };
  }

  // If habit is unanchored, suggest stacking it onto a staple daily anchor
  if (!habit.stackedAfterHabitId && !habit.stackAnchorName) {
    return {
      id: `rec_stack_${habit.id}`,
      habitId: habit.id,
      habitName: habit.name,
      type: "stack_suggestion",
      headline: `Anchor "${habit.name}" to an existing routine`,
      reasoning: `Habits linked to an existing trigger (e.g. after Fajr, after coffee) stick 2.4x better.`,
      proposedAction: `Select an anchor event to make this automatic.`,
    };
  }

  return null;
}

// ─── 4. Habit Lifecycle Progression ────────────────────────────

export interface LifecycleProgress {
  currentStage: HabitLifecycleStage;
  daysActive: number;
  stageTargetDays: number;
  progressPercentage: number;
  stageLabel: string;
  nextStage?: HabitLifecycleStage;
  canGraduate: boolean;
}

/**
 * Computes where a habit sits on the 66-day habit formation curve:
 * Trial (0-7 days) -> Building (8-21 days) -> Maintaining (22-66 days) -> Adopted (66+ days)
 */
export function computeLifecycleProgress(
  habit: Habit,
  totalCompletedDays: number,
): LifecycleProgress {
  const stage = habit.lifecycleStage ?? "building";
  if (stage === "archived") {
    return {
      currentStage: "archived",
      daysActive: totalCompletedDays,
      stageTargetDays: 0,
      progressPercentage: 100,
      stageLabel: "Archived",
      canGraduate: false,
    };
  }

  if (totalCompletedDays >= 66) {
    return {
      currentStage: "adopted",
      daysActive: totalCompletedDays,
      stageTargetDays: 66,
      progressPercentage: 100,
      stageLabel: "Adopted (Permanent Habit)",
      canGraduate: false,
    };
  }

  if (totalCompletedDays >= 22) {
    const progress = Math.min(100, Math.round(((totalCompletedDays - 21) / 45) * 100));
    return {
      currentStage: "maintaining",
      daysActive: totalCompletedDays,
      stageTargetDays: 66,
      progressPercentage: progress,
      stageLabel: "Maintaining (Solidifying)",
      nextStage: "adopted",
      canGraduate: totalCompletedDays >= 65,
    };
  }

  if (totalCompletedDays >= 8) {
    const progress = Math.min(100, Math.round(((totalCompletedDays - 7) / 14) * 100));
    return {
      currentStage: "building",
      daysActive: totalCompletedDays,
      stageTargetDays: 21,
      progressPercentage: progress,
      stageLabel: "Building (Neural Loop)",
      nextStage: "maintaining",
      canGraduate: totalCompletedDays >= 21,
    };
  }

  // 0 to 7 days = Trial
  const progress = Math.min(100, Math.round((totalCompletedDays / 7) * 100));
  return {
    currentStage: "trial",
    daysActive: totalCompletedDays,
    stageTargetDays: 7,
    progressPercentage: progress,
    stageLabel: "Trial (Testing Feasibility)",
    nextStage: "building",
    canGraduate: totalCompletedDays >= 7,
  };
}

// ─── 5. Routine Experiments (A/B Habit Testing) ────────────────

export interface ExperimentEvaluation {
  daysElapsed: number;
  completionRateA: number;
  completionRateB: number;
  leadVariant: "A" | "B" | "tied";
  readyToConclude: boolean;
  recommendation: string;
}

export function evaluateRoutineExperiment(
  experiment: RoutineExperiment,
  entries: DailyProgressEntry[],
): ExperimentEvaluation {
  const start = new Date(experiment.startDate + "T00:00:00");
  const now = new Date();
  const daysElapsed = Math.max(1, Math.min(experiment.durationDays, Math.round((now.getTime() - start.getTime()) / 86_400_000)));

  // Count completions in date window
  let completedA = 0;
  let totalA = 0;
  let completedB = 0;
  let totalB = 0;

  for (let i = 0; i < daysElapsed; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dayEntry = entries.find((e) => e.date === iso);
    const habitHit = dayEntry?.habits?.find((h) => h.id === experiment.habitId);

    // Alternate days between A and B
    if (i % 2 === 0) {
      totalA++;
      if (habitHit?.completed) completedA++;
    } else {
      totalB++;
      if (habitHit?.completed) completedB++;
    }
  }

  const rateA = totalA > 0 ? Math.round((completedA / totalA) * 100) : 0;
  const rateB = totalB > 0 ? Math.round((completedB / totalB) * 100) : 0;

  let leadVariant: "A" | "B" | "tied" = "tied";
  if (rateA > rateB) leadVariant = "A";
  else if (rateB > rateA) leadVariant = "B";

  const readyToConclude = daysElapsed >= experiment.durationDays;
  let recommendation = `Experiment in progress (${daysElapsed}/${experiment.durationDays} days).`;
  if (readyToConclude) {
    if (leadVariant === "A") {
      recommendation = `Variant A (${experiment.variantA.label}) won with ${rateA}% completion vs ${rateB}%. We recommend adopting Variant A!`;
    } else if (leadVariant === "B") {
      recommendation = `Variant B (${experiment.variantB.label}) won with ${rateB}% completion vs ${rateA}%. We recommend adopting Variant B!`;
    } else {
      recommendation = `Both variants tied at ${rateA}%. Choose whichever feels more natural for your day.`;
    }
  }

  return {
    daysElapsed,
    completionRateA: rateA,
    completionRateB: rateB,
    leadVariant,
    readyToConclude,
    recommendation,
  };
}

export function getTodayExperimentVariant(
  experiment: RoutineExperiment,
  targetDateISO?: string,
): { variantLetter: "A" | "B"; variant: RoutineExperiment["variantA"]; dayNumber: number } {
  const start = new Date(experiment.startDate + "T00:00:00");
  const now = targetDateISO ? new Date(targetDateISO + "T00:00:00") : new Date();
  const dayNumber = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1);
  const isA = (dayNumber - 1) % 2 === 0;
  return {
    variantLetter: isA ? "A" : "B",
    variant: isA ? experiment.variantA : experiment.variantB,
    dayNumber,
  };
}
