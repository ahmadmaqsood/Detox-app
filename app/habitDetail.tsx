import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { HabitIconView } from '@/components/HabitIconView';
import { PlatformSymbol } from '@/components/PlatformSymbol';
import * as Haptics from 'expo-haptics';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '@/theme';
import { spacing, radius } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Body, Caption, Heading } from '@/components/Typography';
import {
  deleteHabit,
  getHabitById,
  getHabitCompletionRate,
  getHabitHistory,
  getStreak,
  getLongestStreak,
  updateHabit,
} from '@/lib/database';
import { parseHabitIcon } from '@/lib/types';
import type { Habit, HabitIcon, LifeArea, Mode } from '@/lib/types';

// ─── Icon & color catalogs (shared with addHabit) ──────────────

const ICON_OPTIONS: { icon: HabitIcon; label: string }[] = [
  { icon: { ios: 'shield.checkmark.fill', android: 'shield', web: 'shield' }, label: 'Shield' },
  { icon: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }, label: 'Walk' },
  { icon: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' }, label: 'Gym' },
  { icon: { ios: 'moon.stars.fill', android: 'self_improvement', web: 'self_improvement' }, label: 'Pray' },
  { icon: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' }, label: 'Read' },
  { icon: { ios: 'bed.double.fill', android: 'hotel', web: 'hotel' }, label: 'Sleep' },
  { icon: { ios: 'sunrise.fill', android: 'wb_twilight', web: 'wb_twilight' }, label: 'Morning' },
  { icon: { ios: 'moon.fill', android: 'nightlight', web: 'nightlight' }, label: 'Night' },
  { icon: { ios: 'brain.head.profile.fill', android: 'psychology', web: 'psychology' }, label: 'Focus' },
  { icon: { ios: 'clock.badge.checkmark.fill', android: 'schedule', web: 'schedule' }, label: 'Timer' },
  { icon: { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }, label: 'Water' },
  { icon: { ios: 'heart.fill', android: 'favorite', web: 'favorite' }, label: 'Heart' },
  { icon: { ios: 'leaf.fill', android: 'eco', web: 'eco' }, label: 'Nature' },
  { icon: { ios: 'xmark.app.fill', android: 'block', web: 'block' }, label: 'Block' },
  { icon: { ios: 'play.slash.fill', android: 'videocam_off', web: 'videocam_off' }, label: 'No Video' },
  { icon: { ios: 'iphone.slash', android: 'phonelink_off', web: 'phonelink_off' }, label: 'No Phone' },
  { icon: { ios: 'pencil.line', android: 'edit', web: 'edit' }, label: 'Journal' },
  { icon: { ios: 'star.fill', android: 'star', web: 'star' }, label: 'Star' },
];

const COLOR_OPTIONS = [
  '#4ADE80', '#34D399', '#22D3EE', '#60A5FA',
  '#818CF8', '#A78BFA', '#C084FC', '#F472B6',
  '#F87171', '#EF4444', '#F59E0B', '#FBBF24',
];

const MODE_OPTIONS: { label: string; value: Mode }[] = [
  { label: '🏠 Home', value: 'home' },
  { label: '🏢 Hostel', value: 'hostel' },
];

const LIFE_AREA_OPTIONS: { label: string; value: LifeArea }[] = [
  { label: 'Spiritual', value: 'spiritual' },
  { label: 'Physical', value: 'physical' },
  { label: 'Mental', value: 'mental' },
  { label: 'Work', value: 'work' },
];

function lifeAreaLabel(area: LifeArea): string {
  return LIFE_AREA_OPTIONS.find((o) => o.value === area)?.label ?? area;
}

// ─── Helpers ───────────────────────────────────────────────────

function iconIndex(icon: HabitIcon): number {
  const idx = ICON_OPTIONS.findIndex(
    (o) => o.icon.ios === icon.ios && o.icon.android === icon.android
  );
  return idx >= 0 ? idx : 17; // default Star
}

function colorIndex(color: string): number {
  const idx = COLOR_OPTIONS.indexOf(color);
  return idx >= 0 ? idx : 0;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function dayLabel(iso: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (iso === today) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === yesterday.toISOString().slice(0, 10)) return 'Yesterday';
  return formatDate(iso);
}

// ────────────────────────────────────────────────────────────────

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useAppTheme();

  const [habit, setHabit] = useState<Habit | null>(null);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [completion, setCompletion] = useState(0);
  const [history, setHistory] = useState<{ date: string; completed: number }[]>([]);
  const [editing, setEditing] = useState(false);

  // Edit state
  const [editName, setEditName] = useState('');
  const [editIconIdx, setEditIconIdx] = useState(0);
  const [editColorIdx, setEditColorIdx] = useState(0);
  const [editMode, setEditMode] = useState<Mode>('hostel');
  const [editLifeArea, setEditLifeArea] = useState<LifeArea>('mental');
  const [editTarget, setEditTarget] = useState(1);

  const habitId = id ? Number(id) : null;

  const loadData = useCallback(async () => {
    if (!habitId) return;
    const [h, s, ls, pct, hist] = await Promise.all([
      getHabitById(habitId),
      getStreak(habitId),
      getLongestStreak(habitId),
      getHabitCompletionRate(habitId),
      getHabitHistory(habitId, 30),
    ]);
    if (h) {
      setHabit(h);
      setStreak(s);
      setLongestStreak(ls);
      setCompletion(pct);
      setHistory(hist);

      const parsedIcon = parseHabitIcon(h.icon);
      setEditName(h.name);
      setEditIconIdx(iconIndex(parsedIcon));
      setEditColorIdx(colorIndex(h.color));
      setEditMode(h.mode);
      setEditLifeArea(h.lifeArea ?? 'mental');
      setEditTarget(h.targetPerDay);
    }
  }, [habitId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!habitId || !editName.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await updateHabit(habitId, {
      name: editName.trim(),
      icon: ICON_OPTIONS[editIconIdx].icon,
      color: COLOR_OPTIONS[editColorIdx],
      mode: editMode,
      lifeArea: editLifeArea,
      targetPerDay: editTarget,
    });
    setEditing(false);
    loadData();
  };

  const handleDelete = () => {
    if (!habitId) return;
    Alert.alert('Delete Habit', 'This will permanently remove this habit and all its history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await deleteHabit(habitId);
          router.back();
        },
      },
    ]);
  };

  if (!habit) {
    return (
      <View style={[styles.centered, { backgroundColor: t.background }]}>
        <Body variant="body" color={t.textMuted}>Loading...</Body>
      </View>
    );
  }

  const parsedIcon = parseHabitIcon(habit.icon);
  const habitColor = habit.color;

  const activeIcon = editing ? ICON_OPTIONS[editIconIdx].icon : parsedIcon;
  const activeColor = editing ? COLOR_OPTIONS[editColorIdx] : habitColor;
  const activeName = editing ? editName || 'Habit Name' : habit.name;

  // Build 30-day grid
  const dayGrid = buildDayGrid(history);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── Hero Card ───────────────────────────── */}
      <Animated.View entering={FadeIn.duration(300)}>
        <View style={[styles.hero, { backgroundColor: t.card }]}>
          <View style={[styles.heroIconWrap, { backgroundColor: activeColor + '22' }]}>
            <HabitIconView icon={activeIcon} color={activeColor} size={32} />
          </View>
          <Heading variant="title1" style={styles.heroName}>
            {activeName}
          </Heading>
          <Caption variant="footnote" color={t.textMuted}>
            {lifeAreaLabel(editing ? editLifeArea : habit.lifeArea ?? 'mental')} ·{' '}
            {(editing ? editMode : habit.mode)} · {editing ? editTarget : habit.targetPerDay}x daily · since{' '}
            {formatDate(habit.createdAt)}
          </Caption>
        </View>
      </Animated.View>

      {/* ─── Stats Row ───────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.statsRow}>
        <StatCard label="Current Streak" value={`${streak}d`} color={t.accent} t={t} />
        <StatCard label="Best Streak" value={`${longestStreak}d`} color="#60A5FA" t={t} />
        <StatCard label="Completion" value={`${completion}%`} color="#A78BFA" t={t} />
      </Animated.View>

      {/* ─── Completion Ring ─────────────────────── */}
      <Animated.View entering={FadeInDown.delay(150).duration(300)}>
        <CompletionBar percentage={completion} color={activeColor} t={t} />
      </Animated.View>

      {/* ─── 30-Day Grid ─────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(200).duration(300)}>
        <Card>
          <Body variant="headline" style={styles.sectionTitle}>
            Last 30 Days
          </Body>
          <View style={styles.dayGrid}>
            {dayGrid.map((day) => (
              <View
                key={day.date}
                style={[
                  styles.dayCell,
                  {
                    backgroundColor: day.completed
                      ? activeColor
                      : day.isToday
                        ? t.border
                        : t.background,
                    opacity: day.completed ? 1 : day.isToday ? 0.8 : 0.35,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.gridLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: activeColor }]} />
              <Caption variant="caption2" color={t.textMuted}>Done</Caption>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: t.border }]} />
              <Caption variant="caption2" color={t.textMuted}>Missed</Caption>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* ─── History Log ─────────────────────────── */}
      <Animated.View entering={FadeInDown.delay(250).duration(300)}>
        <Card>
          <Body variant="headline" style={styles.sectionTitle}>
            Daily Log
          </Body>
          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <Caption color={t.textMuted}>
                No history yet. Complete this habit to see your logs here.
              </Caption>
            </View>
          ) : (
            <View style={styles.logList}>
              {history.slice(0, 14).map((entry) => (
                <View key={entry.date} style={[styles.logRow, { borderBottomColor: t.border }]}>
                  <View style={styles.logLeft}>
                    <View
                      style={[
                        styles.logDot,
                        { backgroundColor: entry.completed ? activeColor : t.danger },
                      ]}
                    />
                    <Body variant="subhead">{dayLabel(entry.date)}</Body>
                  </View>
                  <View
                    style={[
                      styles.logBadge,
                      {
                        backgroundColor: entry.completed
                          ? activeColor + '18'
                          : t.dangerMuted,
                      },
                    ]}
                  >
                    <Caption
                      variant="caption2"
                      color={entry.completed ? activeColor : t.danger}
                      style={{ fontWeight: '600' }}
                    >
                      {entry.completed ? 'Done' : 'Missed'}
                    </Caption>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>
      </Animated.View>

      {/* ─── Edit Section ────────────────────────── */}
      {editing ? (
        <Animated.View entering={FadeInUp.duration(300)}>
          <Card>
            <Body variant="headline" style={styles.sectionTitle}>
              Edit Habit
            </Body>

            {/* Name */}
            <View style={styles.editField}>
              <Caption variant="footnote" color={t.textSecondary} style={styles.editLabel}>
                NAME
              </Caption>
              <TextInput
                style={[styles.editInput, { backgroundColor: t.background, color: t.textPrimary, borderColor: t.border }]}
                value={editName}
                onChangeText={setEditName}
                placeholderTextColor={t.textMuted}
                selectionColor={t.accent}
              />
            </View>

            {/* Icon picker */}
            <View style={styles.editField}>
              <Caption variant="footnote" color={t.textSecondary} style={styles.editLabel}>
                ICON
              </Caption>
              <View style={styles.iconGrid}>
                {ICON_OPTIONS.map((opt, i) => {
                  const active = i === editIconIdx;
                  return (
                    <Pressable
                      key={i}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setEditIconIdx(i);
                      }}
                      style={[
                        styles.iconCell,
                        { backgroundColor: active ? COLOR_OPTIONS[editColorIdx] + '22' : t.background },
                        active && { borderColor: COLOR_OPTIONS[editColorIdx], borderWidth: 1.5 },
                      ]}
                    >
                      <HabitIconView
                        icon={opt.icon}
                        color={active ? COLOR_OPTIONS[editColorIdx] : t.textMuted}
                        size={18}
                      />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Color picker */}
            <View style={styles.editField}>
              <Caption variant="footnote" color={t.textSecondary} style={styles.editLabel}>
                COLOR
              </Caption>
              <View style={styles.colorRow}>
                {COLOR_OPTIONS.map((c, i) => {
                  const active = i === editColorIdx;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setEditColorIdx(i);
                      }}
                      style={[
                        styles.colorDot,
                        { backgroundColor: c },
                        active && styles.colorDotActive,
                      ]}
                    >
                      {active && (
                        <PlatformSymbol ios="checkmark" material="check" tintColor="#fff" size={12} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Mode */}
            <View style={styles.editField}>
              <Caption variant="footnote" color={t.textSecondary} style={styles.editLabel}>
                MODE
              </Caption>
              <View style={styles.modeRow}>
                {MODE_OPTIONS.map((opt) => {
                  const active = opt.value === editMode;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setEditMode(opt.value);
                      }}
                      style={[
                        styles.modeChip,
                        { backgroundColor: active ? t.accent + '18' : t.background },
                        active && { borderColor: t.accent, borderWidth: 1.5 },
                      ]}
                    >
                      <Body
                        variant="subhead"
                        color={active ? t.accent : t.textSecondary}
                        style={{ fontWeight: active ? '600' : '400' }}
                      >
                        {opt.label}
                      </Body>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Life area */}
            <View style={styles.editField}>
              <Caption variant="footnote" color={t.textSecondary} style={styles.editLabel}>
                LIFE AREA
              </Caption>
              <View style={styles.modeRow}>
                {LIFE_AREA_OPTIONS.map((opt) => {
                  const active = opt.value === editLifeArea;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setEditLifeArea(opt.value);
                      }}
                      style={[
                        styles.modeChip,
                        { backgroundColor: active ? t.accent + '18' : t.background },
                        active && { borderColor: t.accent, borderWidth: 1.5 },
                      ]}
                    >
                      <Body
                        variant="subhead"
                        color={active ? t.accent : t.textSecondary}
                        style={{ fontWeight: active ? '600' : '400' }}
                      >
                        {opt.label}
                      </Body>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Target stepper */}
            <View style={styles.editField}>
              <Caption variant="footnote" color={t.textSecondary} style={styles.editLabel}>
                TARGET PER DAY
              </Caption>
              <View style={[styles.stepperRow, { backgroundColor: t.background }]}>
                <Pressable
                  onPress={() => {
                    if (editTarget > 1) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setEditTarget((v) => v - 1);
                    }
                  }}
                  style={[styles.stepperBtn, { opacity: editTarget <= 1 ? 0.3 : 1 }]}
                >
                  <PlatformSymbol ios="minus" material="remove" tintColor={t.textPrimary} size={16} />
                </Pressable>
                <View style={styles.stepperValue}>
                  <Heading variant="title3">{editTarget}</Heading>
                </View>
                <Pressable
                  onPress={() => {
                    if (editTarget < 20) {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setEditTarget((v) => v + 1);
                    }
                  }}
                  style={[styles.stepperBtn, { opacity: editTarget >= 20 ? 0.3 : 1 }]}
                >
                  <PlatformSymbol ios="plus" material="add" tintColor={t.textPrimary} size={16} />
                </Pressable>
              </View>
            </View>

            <View style={styles.editActions}>
              <Button title="Save Changes" onPress={handleSave} disabled={!editName.trim()} />
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => {
                  if (habit) {
                    const parsedIcon = parseHabitIcon(habit.icon);
                    setEditName(habit.name);
                    setEditIconIdx(iconIndex(parsedIcon));
                    setEditColorIdx(colorIndex(habit.color));
                    setEditMode(habit.mode);
                    setEditLifeArea(habit.lifeArea ?? 'mental');
                    setEditTarget(habit.targetPerDay);
                  }
                  setEditing(false);
                }}
              />
            </View>
          </Card>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.delay(300).duration(300)} style={styles.actionButtons}>
          <Button
            title="Edit Habit"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setEditing(true);
            }}
          />
          <Pressable onPress={handleDelete} style={styles.deleteBtn}>
            <PlatformSymbol ios="trash.fill" material="delete" tintColor={t.danger} size={16} />
            <Body variant="subhead" color={t.danger}>
              Delete Habit
            </Body>
          </Pressable>
        </Animated.View>
      )}
    </ScrollView>
  );
}

// ─── Sub-components ────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  t,
}: {
  label: string;
  value: string;
  color: string;
  t: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: t.card }]}>
      <Heading variant="title2" color={color}>
        {value}
      </Heading>
      <Caption variant="caption2" color={t.textMuted}>
        {label}
      </Caption>
    </View>
  );
}

function CompletionBar({
  percentage,
  color,
  t,
}: {
  percentage: number;
  color: string;
  t: ReturnType<typeof useAppTheme>;
}) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withSpring(percentage / 100, { damping: 20, stiffness: 100 });
  }, [percentage]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(width.value * 100, 100)}%`,
  }));

  return (
    <Card>
      <View style={styles.completionHeader}>
        <Body variant="headline">Overall Progress</Body>
        <Body variant="headline" color={color}>
          {percentage}%
        </Body>
      </View>
      <View style={[styles.completionTrack, { backgroundColor: t.background }]}>
        <Animated.View style={[styles.completionFill, { backgroundColor: color }, fillStyle]} />
      </View>
    </Card>
  );
}

// ─── 30-day grid builder ───────────────────────────────────────

function buildDayGrid(
  history: { date: string; completed: number }[]
): { date: string; completed: boolean; isToday: boolean }[] {
  const completedSet = new Set(
    history.filter((h) => h.completed === 1).map((h) => h.date)
  );
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const grid: { date: string; completed: boolean; isToday: boolean }[] = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    grid.push({
      date: iso,
      completed: completedSet.has(iso),
      isToday: iso === todayISO,
    });
  }
  return grid;
}

// ─── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing['5xl'],
    gap: spacing.lg,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.xl,
    borderRadius: radius['2xl'],
    gap: spacing.sm,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  heroName: {
    textAlign: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    gap: spacing.xs,
  },

  // Completion bar
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  completionTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  completionFill: {
    height: '100%',
    borderRadius: 4,
  },

  // Day grid
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  dayCell: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  gridLegend: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },

  // Section title
  sectionTitle: {
    marginBottom: spacing.sm,
  },

  // Empty
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },

  // Log
  logList: {
    gap: 0,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  logLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  logDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  logBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },

  // Edit
  editField: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  editLabel: {
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  editInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...typography.body,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  iconCell: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    flex: 1,
    alignItems: 'center',
  },
  editActions: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },

  // Action buttons
  actionButtons: {
    gap: spacing.lg,
    alignItems: 'center',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
});
