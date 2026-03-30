export const RELAPSE_TRIGGERS = [
  { id: 'stress', label: 'Stress' },
  { id: 'boredom', label: 'Boredom' },
  { id: 'loneliness', label: 'Loneliness' },
  { id: 'tired', label: 'Tired / low energy' },
  { id: 'anger', label: 'Anger / frustration' },
  { id: 'late_night', label: 'Late night' },
  { id: 'social_media', label: 'Saw triggering content' },
  { id: 'other', label: 'Other' },
] as const;

export type RelapseTriggerId = (typeof RELAPSE_TRIGGERS)[number]['id'];

export function formatRelapseHourLabel(hour: number): string {
  const h = hour % 24;
  if (h >= 5 && h < 12) return 'Morning';
  if (h >= 12 && h < 17) return 'Afternoon';
  if (h >= 17 && h < 21) return 'Evening';
  return 'Night';
}
