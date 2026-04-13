import type { InsightSignals } from "@/lib/firestoreDatabase";

export type DeepInsight = {
  id: string;
  title: string;
  body: string;
  tone: "positive" | "warning" | "neutral";
};

/**
 * Turns aggregated DB signals into short, actionable insight strings
 * (screen time vs habits, mode vs performance, streak trends).
 */
export function buildDeepInsights(s: InsightSignals): DeepInsight[] {
  const out: DeepInsight[] = [];

  if (s.metricsDaysWithData >= 5 && s.totalRelapseDays > 0) {
    if (
      s.avgScreenOnRelapseDays != null &&
      s.avgScreenOnCleanDays != null &&
      s.avgScreenOnRelapseDays > s.avgScreenOnCleanDays + 15
    ) {
      out.push({
        id: "screen-relapse",
        title: "Screen time & slips",
        body: `On slip days, average screen time was about ${Math.round(s.avgScreenOnRelapseDays)} min vs ${Math.round(s.avgScreenOnCleanDays)} min on other days — heavier use aligns with risk for you.`,
        tone: "warning",
      });
    }

    if (s.relapseDaysHighScreen > 0) {
      const pct =
        s.totalRelapseDays > 0
          ? Math.round((s.relapseDaysHighScreen / s.totalRelapseDays) * 100)
          : 0;
      if (s.relapseDaysHighScreen >= 2 || pct >= 35) {
        out.push({
          id: "high-screen-relapse",
          title: "200+ minute pattern",
          body: `${s.relapseDaysHighScreen} of ${s.totalRelapseDays} slip day(s) had 200+ minutes logged. Consider a firmer screen limit before you hit that zone.`,
          tone: "warning",
        });
      }
    }
  }

  if (s.homeTotal >= 8 && s.hostelTotal >= 8) {
    if (s.hostelRate > s.homeRate + 3) {
      out.push({
        id: "mode-hostel",
        title: "Mode performance",
        body: `You complete habits more often in Hostel mode (${s.hostelRate}% vs ${s.homeRate}% in Home). Structure helps — try to mirror that routine at home.`,
        tone: "positive",
      });
    } else if (s.homeRate > s.hostelRate + 3) {
      out.push({
        id: "mode-home",
        title: "Mode performance",
        body: `You're stronger in Home mode (${s.homeRate}% vs ${s.hostelRate}% in Hostel). Double down on what works where you are.`,
        tone: "positive",
      });
    }
  }

  const hasHeatmap = s.heatmapPrior7Avg > 0 || s.heatmapLast7Avg > 0;
  if (hasHeatmap) {
    const delta = s.heatmapLast7Avg - s.heatmapPrior7Avg;
    if (delta > 0.08) {
      out.push({
        id: "trend-up",
        title: "Discipline trend",
        body: `Daily completion improved in the last 7 days vs the week before. Keep the momentum.`,
        tone: "positive",
      });
    } else if (delta < -0.08) {
      out.push({
        id: "trend-down",
        title: "Discipline trend",
        body: `Completion dipped vs the prior week. One completed habit today still moves the trend.`,
        tone: "warning",
      });
    }
  }

  if (
    s.longestStreak > 0 &&
    s.currentStreak > 0 &&
    s.currentStreak >= Math.floor(s.longestStreak * 0.85)
  ) {
    out.push({
      id: "near-record",
      title: "Near your best",
      body: `Current streak: ${s.currentStreak} days — your best is ${s.longestStreak}d. Stay consistent.`,
      tone: "positive",
    });
  }

  if (out.length === 0 && s.metricsDaysWithData >= 3) {
    out.push({
      id: "keep-logging",
      title: "Keep logging",
      body: `Log screen time and mark habits daily — more data unlocks sharper insights about time, mode, and streaks.`,
      tone: "neutral",
    });
  }

  return out.slice(0, 8);
}
