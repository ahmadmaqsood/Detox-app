import type { UrgeLog } from "../types";

export interface UrgePatternSummary {
  total: number;
  peakHour: number | null;
  avgIntensity: number;
  topTriggers: { tag: string; count: number }[];
}

function hourFromIso(iso: string): number {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 12 : d.getHours();
}

export function summarizeUrgePatterns(logs: UrgeLog[]): UrgePatternSummary {
  if (logs.length === 0) {
    return {
      total: 0,
      peakHour: null,
      avgIntensity: 0,
      topTriggers: [],
    };
  }

  const byHour = new Map<number, number>();
  let intSum = 0;
  const tagCount = new Map<string, number>();

  for (const u of logs) {
    const h = hourFromIso(u.loggedAt);
    byHour.set(h, (byHour.get(h) ?? 0) + 1);
    intSum += u.intensity;
    const tag = (u.triggerTag ?? "").trim();
    if (tag) {
      tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
    }
  }

  let peakHour: number | null = null;
  let peakN = 0;
  for (const [h, n] of byHour) {
    if (n > peakN) {
      peakN = n;
      peakHour = h;
    }
  }

  const topTriggers = [...tagCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  return {
    total: logs.length,
    peakHour,
    avgIntensity: Math.round((intSum / logs.length) * 10) / 10,
    topTriggers,
  };
}
