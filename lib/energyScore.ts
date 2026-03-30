/**
 * Composite 0–100 score from movement (steps + exercise), sleep, and screen time.
 * Screen time is inverted: less scrolling → higher score.
 */
export function computeEnergyScore(input: {
  steps: number;
  exerciseMinutes: number;
  sleepMinutes: number;
  screenTimeMinutes: number;
}): {
  score: number;
  movement: number;
  sleep: number;
  screen: number;
} {
  const stepPart = Math.min(55, (Math.max(0, input.steps) / 10_000) * 55);
  const exPart = Math.min(45, (Math.max(0, input.exerciseMinutes) / 45) * 45);
  const movement = Math.round(Math.min(100, stepPart + exPart));

  const sleep = Math.round(
    Math.min(100, (Math.max(0, input.sleepMinutes) / (8 * 60)) * 100),
  );

  const st = Math.max(0, input.screenTimeMinutes);
  const screen = Math.round(Math.max(0, 100 - Math.min(100, (st / 240) * 100)));

  const score = Math.round(movement * 0.35 + sleep * 0.35 + screen * 0.3);
  return { score, movement, sleep, screen };
}
