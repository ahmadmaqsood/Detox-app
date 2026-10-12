import type { HabitIcon } from '@/lib/types';

export type IconCategory =
  | 'all'
  | 'prayer'
  | 'learning'
  | 'food'
  | 'fitness'
  | 'location'
  | 'rest'
  | 'detox'
  | 'entertainment';

export interface IconCategoryDef {
  id: IconCategory;
  label: string;
}

export const ICON_CATEGORIES: IconCategoryDef[] = [
  { id: 'all', label: 'All' },
  { id: 'prayer', label: '🕌 Prayer & Quran' },
  { id: 'learning', label: '📖 Study & Skills' },
  { id: 'food', label: '🍽️ Food & Meals' },
  { id: 'fitness', label: '🏃 Gym & Walk' },
  { id: 'location', label: '📍 Location' },
  { id: 'rest', label: '⏰ Rest & Wakeup' },
  { id: 'detox', label: '📵 Phone Detox' },
  { id: 'entertainment', label: '🎮 Fun & TV' },
];

export interface HabitIconOption {
  icon: HabitIcon;
  label: string;
  category: IconCategory;
}

export const HABIT_ICON_OPTIONS: HabitIconOption[] = [
  // ─── 1. Prayer & Holy Quran (Spiritual / 5 Times Daily) ───
  {
    icon: { ios: 'moon.stars.fill', android: 'mosque', web: 'mosque', library: 'MaterialCommunityIcons' },
    label: 'Mosque',
    category: 'prayer',
  },
  {
    icon: { ios: 'hands.sparkles.fill', android: 'hands-pray', web: 'hands-pray', library: 'MaterialCommunityIcons' },
    label: 'Namaz / Prayer',
    category: 'prayer',
  },
  {
    icon: { ios: 'moon.fill', android: 'star-crescent', web: 'star-crescent', library: 'MaterialCommunityIcons' },
    label: 'Islamic Crescent',
    category: 'prayer',
  },
  {
    icon: { ios: 'sunrise.fill', android: 'weather-sunset-up', web: 'weather-sunset-up', library: 'MaterialCommunityIcons' },
    label: 'Fajr (Dawn Prayer)',
    category: 'prayer',
  },
  {
    icon: { ios: 'sun.max.fill', android: 'weather-sunny', web: 'weather-sunny', library: 'MaterialCommunityIcons' },
    label: 'Dhuhr (Noon Prayer)',
    category: 'prayer',
  },
  {
    icon: { ios: 'cloud.sun.fill', android: 'weather-partly-cloudy', web: 'weather-partly-cloudy', library: 'MaterialCommunityIcons' },
    label: 'Asr (Afternoon Prayer)',
    category: 'prayer',
  },
  {
    icon: { ios: 'sunset.fill', android: 'weather-sunset-down', web: 'weather-sunset-down', library: 'MaterialCommunityIcons' },
    label: 'Maghrib (Sunset Prayer)',
    category: 'prayer',
  },
  {
    icon: { ios: 'moon.stars.fill', android: 'weather-night', web: 'weather-night', library: 'MaterialCommunityIcons' },
    label: 'Isha (Night Prayer)',
    category: 'prayer',
  },
  {
    icon: { ios: 'book.closed.fill', android: 'book-open-page-variant', web: 'book-open-page-variant', library: 'MaterialCommunityIcons' },
    label: 'Holy Quran',
    category: 'prayer',
  },

  // ─── 2. Reading & Learning Skills ───
  {
    icon: { ios: 'book.fill', android: 'book', web: 'book', library: 'AntDesign' },
    label: 'Read Book',
    category: 'learning',
  },
  {
    icon: { ios: 'books.vertical.fill', android: 'book-open-variant', web: 'book-open-variant', library: 'MaterialCommunityIcons' },
    label: 'Productive Book',
    category: 'learning',
  },
  {
    icon: { ios: 'bookmark.fill', android: 'bookmark-check', web: 'bookmark-check', library: 'MaterialCommunityIcons' },
    label: 'Bookmark',
    category: 'learning',
  },
  {
    icon: { ios: 'laptopcomputer', android: 'laptop', web: 'laptop', library: 'AntDesign' },
    label: 'Laptop / Tech',
    category: 'learning',
  },
  {
    icon: { ios: 'chevron.left.forwardslash.chevron.right', android: 'code-tags', web: 'code-tags', library: 'MaterialCommunityIcons' },
    label: 'Coding / Skills',
    category: 'learning',
  },
  {
    icon: { ios: 'graduationcap.fill', android: 'school', web: 'school', library: 'MaterialCommunityIcons' },
    label: 'Learning / Course',
    category: 'learning',
  },
  {
    icon: { ios: 'lightbulb.fill', android: 'lightbulb-on', web: 'lightbulb-on', library: 'MaterialCommunityIcons' },
    label: 'Idea / Skill',
    category: 'learning',
  },
  {
    icon: { ios: 'brain.head.profile.fill', android: 'brain', web: 'brain', library: 'MaterialCommunityIcons' },
    label: 'Mindset & Focus',
    category: 'learning',
  },
  {
    icon: { ios: 'pencil.and.outline', android: 'notebook-edit', web: 'notebook-edit', library: 'MaterialCommunityIcons' },
    label: 'Journal / Writing',
    category: 'learning',
  },

  // ─── 3. Food & Meals (Breakfast, Lunch, Dinner, Nutrition) ───
  {
    icon: { ios: 'cup.and.saucer.fill', android: 'coffee', web: 'coffee', library: 'MaterialCommunityIcons' },
    label: 'Breakfast / Coffee',
    category: 'food',
  },
  {
    icon: { ios: 'fork.knife', android: 'bread-slice', web: 'bread-slice', library: 'MaterialCommunityIcons' },
    label: 'Morning Bread / Meal',
    category: 'food',
  },
  {
    icon: { ios: 'fork.knife.circle.fill', android: 'silverware-fork-knife', web: 'silverware-fork-knife', library: 'MaterialCommunityIcons' },
    label: 'Lunch / Dinner',
    category: 'food',
  },
  {
    icon: { ios: 'applelogo', android: 'apple', web: 'apple', library: 'AntDesign' },
    label: 'Healthy Nutrition',
    category: 'food',
  },
  {
    icon: { ios: 'drop.fill', android: 'cup-water', web: 'cup-water', library: 'MaterialCommunityIcons' },
    label: 'Water / Hydration',
    category: 'food',
  },

  // ─── 4. Gym, Walk & Fitness ───
  {
    icon: { ios: 'dumbbell.fill', android: 'dumbbell', web: 'dumbbell', library: 'MaterialCommunityIcons' },
    label: 'Gym & Workout',
    category: 'fitness',
  },
  {
    icon: { ios: 'figure.walk', android: 'walk', web: 'walk', library: 'MaterialCommunityIcons' },
    label: 'Walk & Steps',
    category: 'fitness',
  },
  {
    icon: { ios: 'figure.run', android: 'run', web: 'run', library: 'MaterialCommunityIcons' },
    label: 'Run & Cardio',
    category: 'fitness',
  },
  {
    icon: { ios: 'heart.fill', android: 'heart-pulse', web: 'heart-pulse', library: 'MaterialCommunityIcons' },
    label: 'Cardio / Heart Health',
    category: 'fitness',
  },

  // ─── 5. Location & Places ───
  {
    icon: { ios: 'location.fill', android: 'environment', web: 'environment', library: 'AntDesign' },
    label: 'Location Pin',
    category: 'location',
  },
  {
    icon: { ios: 'safari.fill', android: 'compass', web: 'compass', library: 'MaterialCommunityIcons' },
    label: 'Compass / Qibla',
    category: 'location',
  },
  {
    icon: { ios: 'house.fill', android: 'home', web: 'home', library: 'MaterialCommunityIcons' },
    label: 'Home',
    category: 'location',
  },
  {
    icon: { ios: 'building.2.fill', android: 'office-building', web: 'office-building', library: 'MaterialCommunityIcons' },
    label: 'Office / Workplace',
    category: 'location',
  },

  // ─── 6. Morning Wakeup, Rest & Sleep ───
  {
    icon: { ios: 'alarm.fill', android: 'alarm', web: 'alarm', library: 'MaterialCommunityIcons' },
    label: 'Morning Alarm Wakeup',
    category: 'rest',
  },
  {
    icon: { ios: 'bed.double.fill', android: 'bed', web: 'bed', library: 'MaterialCommunityIcons' },
    label: 'Sleep & Bedtime',
    category: 'rest',
  },
  {
    icon: { ios: 'figure.mind.and.body', android: 'meditation', web: 'meditation', library: 'MaterialCommunityIcons' },
    label: 'Rest & Calm',
    category: 'rest',
  },

  // ─── 7. Restricted Phone Usage & Detox ───
  {
    icon: { ios: 'iphone.slash', android: 'cellphone-off', web: 'cellphone-off', library: 'MaterialCommunityIcons' },
    label: 'No Phone / Restricted',
    category: 'detox',
  },
  {
    icon: { ios: 'lock.iphone', android: 'cellphone-lock', web: 'cellphone-lock', library: 'MaterialCommunityIcons' },
    label: 'Phone Lock / Focus',
    category: 'detox',
  },
  {
    icon: { ios: 'shield.checkmark.fill', android: 'shield-check', web: 'shield-check', library: 'MaterialCommunityIcons' },
    label: 'Discipline Shield',
    category: 'detox',
  },

  // ─── 8. TV, Gaming & Entertainment ───
  {
    icon: { ios: 'tv.fill', android: 'television', web: 'television', library: 'MaterialCommunityIcons' },
    label: 'TV & Watching',
    category: 'entertainment',
  },
  {
    icon: { ios: 'play.rectangle.fill', android: 'movie-open', web: 'movie-open', library: 'MaterialCommunityIcons' },
    label: 'Video & Scholar Talk',
    category: 'entertainment',
  },
  {
    icon: { ios: 'gamecontroller.fill', android: 'gamepad-variant', web: 'gamepad-variant', library: 'MaterialCommunityIcons' },
    label: 'Gameplay & Gaming',
    category: 'entertainment',
  },
  {
    icon: { ios: 'sportscourt.fill', android: 'table-tennis', web: 'table-tennis', library: 'MaterialCommunityIcons' },
    label: 'Table Tennis / Sports',
    category: 'entertainment',
  },
  {
    icon: { ios: 'trophy.fill', android: 'trophy', web: 'trophy', library: 'AntDesign' },
    label: 'Trophy / Win',
    category: 'entertainment',
  },
  {
    icon: { ios: 'star.fill', android: 'star', web: 'star', library: 'AntDesign' },
    label: 'Star Habit',
    category: 'entertainment',
  },
  {
    icon: { ios: 'heart.fill', android: 'heart', web: 'heart', library: 'AntDesign' },
    label: 'Self-Care & Health',
    category: 'entertainment',
  },
];
