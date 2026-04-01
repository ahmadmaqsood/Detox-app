import type { LifeArea, Mode } from './types';

export interface SeedHabit {
  name: string;
  icon: { ios: string; android: string; web: string };
  color: string;
  mode: Mode;
  targetPerDay: number;
  lifeArea: LifeArea;
}

export const defaultHabits: SeedHabit[] = [
  // ── Home Mode ────────────────────────────────────────────

  {
    name: 'No Explicit Content',
    icon: { ios: 'shield.checkmark.fill', android: 'shield', web: 'shield' },
    color: '#EF4444',
    mode: 'home',
    targetPerDay: 1,
    lifeArea: 'mental',
  },
  {
    name: 'Limited Phone Usage',
    icon: { ios: 'iphone.slash', android: 'phonelink_off', web: 'phonelink_off' },
    color: '#F59E0B',
    mode: 'home',
    targetPerDay: 1,
    lifeArea: 'mental',
  },
  {
    name: 'No Social Apps',
    icon: { ios: 'xmark.app.fill', android: 'block', web: 'block' },
    color: '#F97316',
    mode: 'home',
    targetPerDay: 1,
    lifeArea: 'mental',
  },
  {
    name: 'No Reels',
    icon: { ios: 'play.slash.fill', android: 'videocam_off', web: 'videocam_off' },
    color: '#EC4899',
    mode: 'home',
    targetPerDay: 1,
    lifeArea: 'mental',
  },
  {
    name: 'Avoid Screens Weekend',
    icon: { ios: 'desktopcomputer.trianglebadge.exclamationmark', android: 'desktop_access_disabled', web: 'desktop_access_disabled' },
    color: '#8B5CF6',
    mode: 'home',
    targetPerDay: 1,
    lifeArea: 'mental',
  },
  {
    name: 'Namaz',
    icon: { ios: 'moon.stars.fill', android: 'self_improvement', web: 'self_improvement' },
    color: '#4ADE80',
    mode: 'home',
    targetPerDay: 5,
    lifeArea: 'spiritual',
  },
  {
    name: 'Quran Reading',
    icon: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' },
    color: '#2DD4BF',
    mode: 'home',
    targetPerDay: 1,
    lifeArea: 'spiritual',
  },
  {
    name: 'Morning Surah Yaseen',
    icon: { ios: 'sunrise.fill', android: 'wb_twilight', web: 'wb_twilight' },
    color: '#FBBF24',
    mode: 'home',
    targetPerDay: 1,
    lifeArea: 'spiritual',
  },
  {
    name: 'Night Surah Mulk',
    icon: { ios: 'moon.fill', android: 'nightlight', web: 'nightlight' },
    color: '#818CF8',
    mode: 'home',
    targetPerDay: 1,
    lifeArea: 'spiritual',
  },
  {
    name: 'Sleep Before 12',
    icon: { ios: 'bed.double.fill', android: 'hotel', web: 'hotel' },
    color: '#6366F1',
    mode: 'home',
    targetPerDay: 1,
    lifeArea: 'physical',
  },
  {
    name: 'Light Exercise',
    icon: { ios: 'figure.walk', android: 'fitness_center', web: 'fitness_center' },
    color: '#22D3EE',
    mode: 'home',
    targetPerDay: 1,
    lifeArea: 'physical',
  },

  // ── Hostel Mode ──────────────────────────────────────────

  {
    name: 'No Explicit Content',
    icon: { ios: 'shield.checkmark.fill', android: 'shield', web: 'shield' },
    color: '#EF4444',
    mode: 'hostel',
    targetPerDay: 1,
    lifeArea: 'mental',
  },
  {
    name: 'Deep Work',
    icon: { ios: 'brain.head.profile.fill', android: 'psychology', web: 'psychology' },
    color: '#A78BFA',
    mode: 'hostel',
    targetPerDay: 1,
    lifeArea: 'work',
  },
  {
    name: 'No Social Apps',
    icon: { ios: 'xmark.app.fill', android: 'block', web: 'block' },
    color: '#F97316',
    mode: 'hostel',
    targetPerDay: 1,
    lifeArea: 'mental',
  },
  {
    name: 'Limited Phone',
    icon: { ios: 'iphone.slash', android: 'phonelink_off', web: 'phonelink_off' },
    color: '#F59E0B',
    mode: 'hostel',
    targetPerDay: 1,
    lifeArea: 'mental',
  },
  {
    name: 'Namaz',
    icon: { ios: 'moon.stars.fill', android: 'self_improvement', web: 'self_improvement' },
    color: '#4ADE80',
    mode: 'hostel',
    targetPerDay: 5,
    lifeArea: 'spiritual',
  },
  {
    name: 'Quran',
    icon: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' },
    color: '#2DD4BF',
    mode: 'hostel',
    targetPerDay: 1,
    lifeArea: 'spiritual',
  },
  {
    name: 'Exercise',
    icon: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' },
    color: '#22D3EE',
    mode: 'hostel',
    targetPerDay: 1,
    lifeArea: 'physical',
  },
  {
    name: 'Walk',
    icon: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' },
    color: '#34D399',
    mode: 'hostel',
    targetPerDay: 1,
    lifeArea: 'physical',
  },
  {
    name: 'Study Blocks',
    icon: { ios: 'clock.badge.checkmark.fill', android: 'schedule', web: 'schedule' },
    color: '#60A5FA',
    mode: 'hostel',
    targetPerDay: 3,
    lifeArea: 'work',
  },
];
