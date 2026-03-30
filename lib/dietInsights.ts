import type { DietMeal, DietRules } from "./types";

function avgKg(weights: { kg: number }[]): number | null {
  if (weights.length === 0) return null;
  return weights.reduce((s, w) => s + w.kg, 0) / weights.length;
}

function weekdayFromIso(date: string): number {
  return new Date(date + "T12:00:00").getDay();
}

/**
 * Heuristic copy linking diet, weight, and movement — kept simple on purpose.
 */
export function buildDietInsights(
  rules: DietRules,
  weights: { date: string; kg: number }[],
  meals: DietMeal[],
  exerciseMinutesLast7: number,
): string[] {
  const out: string[] = [];

  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length >= 8) {
    const last7 = sorted.slice(-7);
    const prev7 = sorted.slice(-14, -7);
    const a = avgKg(last7);
    const b = avgKg(prev7);
    if (a !== null && b !== null && a > b + 0.15) {
      out.push(
        "Your weight ticked up this week vs last. Pair diet rules with sleep and movement.",
      );
    }
  }

  const lateMeals = meals.filter((m) => m.hour >= rules.lateHour);
  if (rules.noLateEating && lateMeals.length >= 3) {
    out.push(
      `Late eating (${rules.lateHour}:00+) shows up often — it often tracks with weight and sleep quality.`,
    );
  }

  if (rules.noJunkWeekdays) {
    const junkWd = meals.filter(
      (m) =>
        m.quality === "junk" && weekdayFromIso(m.date) >= 1 && weekdayFromIso(m.date) <= 5,
    );
    if (junkWd.length >= 2) {
      out.push(
        "Junk meals on weekdays break your “no junk weekdays” rule — tighten one meal at a time.",
      );
    }
  }

  const over = meals.filter((m) => m.overeating).length;
  if (over >= 4) {
    out.push(
      "Overeating flags are frequent — try smaller plates or a fixed dinner time.",
    );
  }

  if (exerciseMinutesLast7 < 60 && sorted.length >= 2) {
    out.push(
      "Low movement this week — pairing walks with meals helps weight and urges.",
    );
  }

  if (out.length === 0) {
    out.push(
      "Keep logging meals and weight. Patterns become obvious after 2–3 weeks.",
    );
  }

  return out.slice(0, 5);
}
