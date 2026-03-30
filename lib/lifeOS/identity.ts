export interface IdentityCopy {
  headline: string;
  lines: string[];
  footnote: string;
}

const CORE_LINES = [
  "I am a disciplined person.",
  "I do not waste my life chasing cheap dopamine.",
  "My identity is built by what I repeat — not what I intend.",
];

function streakTier(streak: number): "low" | "mid" | "high" {
  if (streak >= 14) return "high";
  if (streak >= 3) return "mid";
  return "low";
}

/**
 * Daily identity reinforcement — tie copy to Hard Mode / global streak depth.
 */
export function buildIdentityMessage(params: {
  hardModeStreak: number;
  globalStreak: number;
}): IdentityCopy {
  const tier = streakTier(
    Math.max(params.hardModeStreak, params.globalStreak),
  );

  const headline =
    tier === "high"
      ? "This is who you are now."
      : tier === "mid"
        ? "You are becoming that person."
        : "Choose the identity before the urge.";

  const lines = [...CORE_LINES];
  if (tier === "high") {
    lines.push(
      "The proof is in the streak — keep stacking honest days.",
    );
  } else if (tier === "mid") {
    lines.push("Every logged day makes the new identity heavier — harder to abandon.");
  } else {
    lines.push("Say it out loud once. Then act as if it were already true for five minutes.");
  }

  const footnote =
    params.hardModeStreak > 0
      ? `Hard Mode streak: ${params.hardModeStreak} full day(s).`
      : params.globalStreak > 0
        ? `Discipline streak: ${params.globalStreak} day(s).`
        : "Turn on Hard Mode when you are ready to stop negotiating with yourself.";

  return { headline, lines, footnote };
}
