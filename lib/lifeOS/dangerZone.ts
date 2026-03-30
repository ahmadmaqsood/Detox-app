export type DangerLevel = "ok" | "elevated" | "critical";

export interface DangerZoneResult {
  level: DangerLevel;
  title: string;
  body: string;
  suggestions: string[];
}

/**
 * Combines screen time, habit slip, and movement into a single “danger zone” signal.
 */
export function evaluateDangerZone(input: {
  screenTimeMinutes: number;
  habitCompletionRate: number;
  /** 0–100 heuristic from steps + exercise minutes */
  movementScore: number;
}): DangerZoneResult {
  const suggestions = [
    "2-minute walk outside",
    "Stretch shoulders and hips",
    "Drink water, then one deep-work block",
    "Complete the smallest habit first — momentum beats zero",
  ];

  let hits = 0;
  if (input.screenTimeMinutes >= 120) hits++;
  if (input.habitCompletionRate < 0.45) hits++;
  if (input.movementScore < 35) hits++;

  if (hits >= 3) {
    return {
      level: "critical",
      title: "YOU ARE ENTERING THE DANGER ZONE",
      body: "High screen time, weak movement, and missed habits stack into relapse risk. Interrupt the pattern now — body first, then one habit.",
      suggestions,
    };
  }
  if (hits >= 2) {
    return {
      level: "elevated",
      title: "Risk climbing",
      body: "Two signals are off (screen, habits, or movement). Tighten the next hour before the stack gets worse.",
      suggestions: suggestions.slice(0, 3),
    };
  }
  return {
    level: "ok",
    title: "Stable",
    body: "No combined red flags right now. Keep logging honestly.",
    suggestions: [],
  };
}

export function movementHeuristic(input: {
  steps: number;
  exerciseMinutes: number;
}): number {
  const stepPart = Math.min(50, (input.steps / 8000) * 50);
  const exPart = Math.min(50, (input.exerciseMinutes / 30) * 50);
  return Math.round(Math.min(100, stepPart + exPart));
}
