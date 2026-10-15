import { HabitIconView } from '@/components/HabitIconView';
import { PlatformSymbol } from '@/components/PlatformSymbol';
import * as Haptics from 'expo-haptics';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HabitEffectivenessCard } from '@/components/habits/HabitEffectivenessCard';
import { HabitLifecycleCard } from '@/components/habits/HabitLifecycleCard';
import { RoutineExperimentCard } from '@/components/habits/RoutineExperimentCard';
import { RoutineExperimentModal } from '@/components/habits/RoutineExperimentModal';
import { Body, Caption, Heading } from '@/components/Typography';
import {
  deleteHabit,
  getHabitById,
  getHabitCompletionRate,
  getHabitHistory,
  getLongestStreak,
  getRecentDailyEntries,
  getRoutineExperiments,
  getStreak,
} from "@/lib/firestoreDatabase";
import type {
  DailyProgressEntry,
  Habit,
  HabitDifficultyTier,
  LifeArea,
  RoutineExperiment,
  TimeSlot,
} from '@/lib/types';
import { parseHabitIcon } from '@/lib/types';
import { useAppTheme } from '@/theme';
import { radius, spacing } from '@/theme/spacing';

// ─── Catalogs ──────────────────────────────────────────────────

const TIME_SLOT_OPTIONS: { label: string; value: TimeSlot }[] = [
  { label: '🌅 Morning', value: 'morning' },
  { label: '☀️ Afternoon', value: 'afternoon' },
  { label: '🌙 Evening', value: 'evening' },
  { label: '✨ Night', value: 'night' },
  { label: '⚡ Anytime', value: 'anytime' },
];

const LIFE_AREA_OPTIONS: { label: string; value: LifeArea }[] = [
  { label: 'Spiritual', value: 'spiritual' },
  { label: 'Physical', value: 'physical' },
  { label: 'Mental', value: 'mental' },
  { label: 'Work', value: 'work' },
  { label: 'Walk', value: 'walk' },
  { label: 'Learning', value: 'learning' },
  { label: 'Cold Shower', value: 'cold_shower' },
  { label: 'Reading', value: 'reading' },
  { label: 'Meditation', value: 'meditation' },
  { label: 'Stretching', value: 'stretching' },
  { label: 'Food', value: 'food' },
];

function lifeAreaLabel(area: LifeArea): string {
  return LIFE_AREA_OPTIONS.find((o) => o.value === area)?.label ?? area;
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
  const [history, setHistory] = useState<{ date: string; completed: number; completedTier?: HabitDifficultyTier }[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Routine experiment state
  const [experiment, setExperiment] = useState<RoutineExperiment | null>(null);
  const [recentEntries, setRecentEntries] = useState<DailyProgressEntry[]>([]);
  const [showExperimentModal, setShowExperimentModal] = useState(false);

  const [deleting, setDeleting] = useState(false);

  const habitId = id ? Number(id) : null;

  const loadData = useCallback(async () => {
    if (!habitId) {
      setLoading(false);
      setLoadError("Invalid habit ID");
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [h, s, ls, pct, hist, exps, entries] = await Promise.all([
        getHabitById(habitId),
        getStreak(habitId).catch(() => 0),
        getLongestStreak(habitId).catch(() => 0),
        getHabitCompletionRate(habitId).catch(() => 0),
        getHabitHistory(habitId, 30).catch(() => []),
        getRoutineExperiments().catch(() => []),
        getRecentDailyEntries(30).catch(() => []),
      ]);
      if (h) {
        setHabit(h);
        setStreak(s);
        setLongestStreak(ls);
        setCompletion(pct);
        setHistory(hist);
        setRecentEntries(entries);

        const activeOrRecent =
          exps.find((e) => e.habitId === habitId && e.status === 'active') ??
          exps.find((e) => e.habitId === habitId);
        setExperiment(activeOrRecent ?? null);
      } else {
        setLoadError("Habit not found");
      }
    } catch (err) {
      console.error("Failed to load habit details:", err);
      setLoadError("Could not load habit details");
    } finally {
      setLoading(false);
    }
  }, [habitId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDelete = () => {
    if (!habitId || deleting) return;
    Alert.alert('Delete Habit', 'This will permanently remove this habit and all its history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setDeleting(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await deleteHabit(habitId);
            router.back();
          } catch (err) {
            console.error("Failed to delete habit:", err);
            Alert.alert("Error", "Could not delete habit. Please try again.");
            setDeleting(false);
          }
        },
      },
    ]);
  };

  if (loading && !habit) {
    return (
      <View style={[styles.centered, { backgroundColor: t.background }]}>
        <ActivityIndicator size="large" color={t.accent} />
        <Body variant="body" color={t.textMuted} style={{ marginTop: spacing.md }}>
          Loading...
        </Body>
      </View>
    );
  }

  if (!habit) {
    return (
      <View style={[styles.centered, { backgroundColor: t.background, padding: spacing.xl }]}>
        <Heading variant="title2" color={t.textPrimary} style={{ marginBottom: spacing.sm, textAlign: 'center' }}>
          Habit Not Found
        </Heading>
        <Body variant="body" color={t.textMuted} style={{ textAlign: 'center', marginBottom: spacing.xl }}>
          {loadError || 'This habit could not be loaded.'}
        </Body>
        <Button variant="primary" title="Go Back" onPress={() => router.back()} />
      </View>
    );
  }

  const parsedIcon = parseHabitIcon(habit.icon);
  const dayGrid = buildDayGrid(history);

  return (
    <>
      <Stack.Screen
        options={{
          title: habit.name,
          headerRight: () => (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/addHabit',
                  params: { editId: String(habitId) },
                });
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.headerEditBtn}
            >
              <PlatformSymbol ios="pencil" material="edit" tintColor={t.accent} size={18} />
              <Text style={[styles.headerEditText, { color: t.accent }]}>Edit</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: t.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Hero Card ───────────────────────────── */}
        <Animated.View entering={FadeIn.duration(300)}>
          <View style={[styles.hero, { backgroundColor: t.card }]}>
            <View style={[styles.heroIconWrap, { backgroundColor: habit.color + '22' }]}>
              <HabitIconView icon={parsedIcon} color={habit.color} size={32} />
            </View>
            <Heading variant="title1" style={styles.heroName}>
              {habit.name}
            </Heading>
            <Caption variant="footnote" color={t.textMuted}>
              {lifeAreaLabel(habit.lifeArea ?? 'mental')} · {habit.mode} · {habit.targetPerDay}x daily · since{' '}
              {formatDate(habit.createdAt)}
            </Caption>

            {/* Adaptive badges */}
            <View style={styles.heroBadgesRow}>
              {habit.timeSlot && (
                <View style={[styles.heroBadge, { backgroundColor: t.background }]}>
                  <Caption variant="caption2" color={t.textSecondary} style={{ fontWeight: '600' }}>
                    {TIME_SLOT_OPTIONS.find((s) => s.value === habit.timeSlot)?.label ?? 'Anytime'}
                  </Caption>
                </View>
              )}
              {habit.stackAnchorName ? (
                <View style={[styles.heroBadge, { backgroundColor: '#D4FE3315', borderColor: '#D4FE3350', borderWidth: 1 }]}>
                  <Caption variant="caption2" color="#D4FE33" style={{ fontWeight: '700' }}>
                    🔗 After {habit.stackAnchorName}
                  </Caption>
                </View>
              ) : null}
              {habit.detoxOnly ? (
                <View style={[styles.heroBadge, { backgroundColor: '#10B98120', borderColor: '#10B98160', borderWidth: 1 }]}>
                  <Caption variant="caption2" color="#10B981" style={{ fontWeight: '700' }}>
                    🛡️ Detox Protocol Task
                  </Caption>
                </View>
              ) : null}
            </View>

            {/* Elastic tiers overview */}
            {habit.difficultyLevels && (habit.difficultyLevels.minimum || habit.difficultyLevels.standard || habit.difficultyLevels.ambitious) && (
              <View style={[styles.heroElasticBox, { backgroundColor: t.background, borderColor: t.borderLight }]}>
                {habit.difficultyLevels.minimum && (
                  <View style={styles.heroElasticItem}>
                    <Text style={[styles.heroElasticTag, { color: '#D4FE33' }]}>MIN</Text>
                    <Text style={[styles.heroElasticVal, { color: t.textSecondary }]} numberOfLines={1}>{habit.difficultyLevels.minimum}</Text>
                  </View>
                )}
                {habit.difficultyLevels.standard && (
                  <View style={styles.heroElasticItem}>
                    <Text style={[styles.heroElasticTag, { color: t.accent }]}>STD</Text>
                    <Text style={[styles.heroElasticVal, { color: t.textSecondary }]} numberOfLines={1}>{habit.difficultyLevels.standard}</Text>
                  </View>
                )}
                {habit.difficultyLevels.ambitious && (
                  <View style={styles.heroElasticItem}>
                    <Text style={[styles.heroElasticTag, { color: '#FBBF24' }]}>AMB</Text>
                    <Text style={[styles.heroElasticVal, { color: t.textSecondary }]} numberOfLines={1}>{habit.difficultyLevels.ambitious}</Text>
                  </View>
                )}
              </View>
            )}
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
          <CompletionBar percentage={completion} color={habit.color} t={t} />
        </Animated.View>

        {/* ─── Habit Effectiveness Score & Intelligence ─── */}
        <Animated.View entering={FadeInDown.delay(175).duration(300)}>
          <HabitEffectivenessCard
            habit={habit}
            completionRate={completion}
            history={history}
            onHabitUpdated={loadData}
          />
        </Animated.View>

        {/* ─── Habit Lifecycle Progress ─── */}
        <Animated.View entering={FadeInDown.delay(190).duration(300)}>
          <HabitLifecycleCard
            habit={habit}
            streak={streak}
            onHabitArchived={() => router.back()}
          />
        </Animated.View>

        {/* ─── Routine Experiment (A/B Test) ─── */}
        <Animated.View entering={FadeInDown.delay(195).duration(300)}>
          {experiment ? (
            <RoutineExperimentCard
              experiment={experiment}
              entries={recentEntries}
              habit={habit}
              onExperimentUpdated={loadData}
            />
          ) : (
            <View style={[styles.experimentPromoCard, { backgroundColor: t.card, borderColor: t.borderLight }]}>
              <View style={styles.experimentPromoHeader}>
                <View style={styles.experimentIconWrap}>
                  <PlatformSymbol ios="flask.fill" material="science" tintColor="#D4FE33" size={18} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Caption variant="caption2" color={t.textMuted} style={styles.kicker}>
                    ROUTINE OPTIMIZATION
                  </Caption>
                  <Heading variant="title3">A/B Routine Experiment</Heading>
                </View>
              </View>
              <Caption variant="caption1" color={t.textSecondary}>
                Compare morning vs evening or micro vs standard targets for 14 days on alternating days to find what works best.
              </Caption>
              <Button
                title="Start Routine Experiment"
                variant="secondary"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setShowExperimentModal(true);
                }}
              />
            </View>
          )}
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
                        ? habit.color
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
                <View style={[styles.legendDot, { backgroundColor: habit.color }]} />
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
                          { backgroundColor: entry.completed ? habit.color : t.danger },
                        ]}
                      />
                      <Body variant="subhead">{dayLabel(entry.date)}</Body>
                    </View>
                    <View
                      style={[
                        styles.logBadge,
                        {
                          backgroundColor: entry.completed
                            ? habit.color + '18'
                            : t.dangerMuted,
                        },
                      ]}
                    >
                      <Caption
                        variant="caption2"
                        color={entry.completed ? habit.color : t.danger}
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

        {/* ─── Actions ─────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(300).duration(300)} style={styles.actionButtons}>
          <Pressable onPress={handleDelete} style={[styles.deleteBtn, deleting && { opacity: 0.5 }]} disabled={deleting}>
            <PlatformSymbol ios="trash.fill" material="delete" tintColor={t.danger} size={16} />
            <Body variant="subhead" color={t.danger}>
              {deleting ? 'Deleting...' : 'Delete Habit'}
            </Body>
          </Pressable>
        </Animated.View>
      </ScrollView>

      {habit && (
        <RoutineExperimentModal
          visible={showExperimentModal}
          onClose={() => setShowExperimentModal(false)}
          habit={habit}
          onExperimentStarted={loadData}
        />
      )}
    </>
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
  history: { date: string; completed: number; completedTier?: HabitDifficultyTier }[]
): { date: string; completed: boolean; completedTier?: HabitDifficultyTier; isToday: boolean }[] {
  const completedMap = new Map<string, { completed: boolean; completedTier?: HabitDifficultyTier }>();
  history.forEach((h) => {
    if (h.completed === 1) {
      completedMap.set(h.date, { completed: true, completedTier: h.completedTier });
    }
  });
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const grid: { date: string; completed: boolean; completedTier?: HabitDifficultyTier; isToday: boolean }[] = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const entry = completedMap.get(iso);
    grid.push({
      date: iso,
      completed: !!entry?.completed,
      completedTier: entry?.completedTier,
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

  // Header edit
  headerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerEditText: {
    fontSize: 16,
    fontWeight: '600',
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

  // Adaptive Hero Badges
  heroBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  heroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroElasticBox: {
    width: '100%',
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
  },
  heroElasticItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroElasticTag: {
    fontSize: 9,
    fontWeight: '800',
    width: 28,
  },
  heroElasticVal: {
    fontSize: 12,
    flex: 1,
  },

  // Experiment Promo Card
  experimentPromoCard: {
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  experimentPromoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  experimentIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4FE3320',
  },
  kicker: {
    fontWeight: '700',
    letterSpacing: 1,
  },
});
