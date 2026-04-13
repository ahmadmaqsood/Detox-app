import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { type DrawerNavigationProp } from '@react-navigation/drawer';
import { PlatformSymbol } from '@/components/PlatformSymbol';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useAppTheme } from '@/theme';
import { spacing, radius } from '@/theme/spacing';
import { Card } from '@/components/Card';
import { Heading, Body, Caption } from '@/components/Typography';
import {
  evaluateUserLevel,
  formatUserLevelLabel,
  getLevelBlurb,
  type RelapseTrend,
  type UserLevel,
  type UserLevelState,
} from '@/lib/userLevel';
import { useScrollToTopOnTabFocus } from '@/lib/useScrollToTopOnTabFocus';
import {
  getEntriesCompletionSummary,
  getGlobalLongestStreak,
  getGlobalStreak,
  getLifeAreaBalance,
  getMemberSinceYear,
  getModeComparisonStats,
  getMonthlyStats,
  getMostMissedHabit,
  getRelapseCount,
  getRelapseCountsLastTwoWindows,
  getRiskiestRelapseHour,
  getTopRelapseTrigger,
  getUnlockedAchievementIds,
  getWeeklyStats,
  getWeekdayWeekendCompletion,
  getYearlyStats,
  type LifeAreaBalanceRow,
  type ModeComparison,
} from '@/lib/firestoreDatabase';
import { syncFirestoreAchievements } from '@/lib/firestoreAchievements';
import { formatRelapseHourLabel, RELAPSE_TRIGGERS } from '@/lib/relapseTriggers';
import type { LifeArea } from '@/lib/types';

function levelAccentColor(level: UserLevel, t: ReturnType<typeof useAppTheme>): string {
  if (level === 'advanced') return t.accent;
  if (level === 'intermediate') return '#A78BFA';
  return t.warning;
}

function trendCopy(trend: RelapseTrend): string {
  switch (trend) {
    case 'improving':
      return 'Relapses (30d): fewer than prior 30d — helps level up.';
    case 'worsening':
      return 'Relapses (30d): up vs prior 30d — level may stay capped.';
    default:
      return 'Relapses (30d): similar to prior window.';
  }
}

function bestModeLabel(modes: ModeComparison[]): { title: string; detail: string } {
  if (modes.length === 0)
    return { title: '—', detail: 'No mode data yet' };
  const sorted = [...modes].sort((a, b) => b.rate - a.rate);
  const top = sorted[0];
  const second = sorted[1];
  if (second && Math.abs(top.rate - second.rate) < 5)
    return { title: 'Balanced', detail: 'Home and hostel are close' };
  const label = top.mode === 'home' ? 'Home' : 'Hostel';
  return { title: label, detail: `${top.rate}% completion in ${label.toLowerCase()} habits` };
}

function weakWindowInsight(
  w: Awaited<ReturnType<typeof getWeekdayWeekendCompletion>>,
): { title: string; detail: string } {
  const total = w.weekdayTotal + w.weekendTotal;
  if (total < 14)
    return {
      title: 'Building data',
      detail: 'We’ll flag weekends vs weekdays after more logs',
    };
  const diff = w.weekendRate - w.weekdayRate;
  if (Math.abs(diff) < 8)
    return {
      title: 'Balanced',
      detail: 'Weekends and weekdays look similar',
    };
  if (diff < 0)
    return {
      title: 'Weekends',
      detail: `${w.weekdayRate - w.weekendRate}% lower completion Sat–Sun`,
    };
  return {
    title: 'Weekdays',
    detail: `${w.weekendRate - w.weekdayRate}% lower completion Mon–Fri`,
  };
}

function weakDetailText(
  weak: { title: string; detail: string } | null,
): string {
  if (!weak) return 'Log habits to compare weekends vs weekdays.';
  if (weak.title === 'Building data') return weak.detail;
  return `${weak.detail} Evenings and nights are high-risk — structure them.`;
}

const LIFE_AREA_LABEL: Record<LifeArea, string> = {
  spiritual: 'Spiritual',
  physical: 'Physical',
  mental: 'Mental',
  work: 'Work',
};

const LIFE_AREA_CHART_COLOR: Record<LifeArea, string> = {
  spiritual: '#A78BFA',
  physical: '#34D399',
  mental: '#60A5FA',
  work: '#F59E0B',
};

function relapseTriggerLabel(tag: string): string {
  return RELAPSE_TRIGGERS.find((x) => x.id === tag)?.label ?? tag;
}

export default function ProfileScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const router = useRouter();
  const scrollRef = useScrollToTopOnTabFocus();

  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [relapses, setRelapses] = useState(0);
  const [weeklyPct, setWeeklyPct] = useState(0);
  const [monthlyPct, setMonthlyPct] = useState(0);
  const [yearlyPct, setYearlyPct] = useState(0);
  const [modeComp, setModeComp] = useState<ModeComparison[]>([]);
  const [weekendWeekday, setWeekendWeekday] = useState<Awaited<
    ReturnType<typeof getWeekdayWeekendCompletion>
  > | null>(null);
  const [mostMissed, setMostMissed] = useState<{ name: string; missed: number } | null>(null);
  const [entrySummary, setEntrySummary] = useState({ total: 0, done: 0, rate: 0 });
  const [memberYear, setMemberYear] = useState<number | null>(null);
  const [userLevelState, setUserLevelState] = useState<UserLevelState | null>(null);
  const [lifeBalance, setLifeBalance] = useState<LifeAreaBalanceRow[]>([]);
  const [topRelapseTrigger, setTopRelapseTrigger] = useState<{
    tag: string;
    count: number;
  } | null>(null);
  const [riskiestRelapse, setRiskiestRelapse] = useState<{
    hour: number;
    count: number;
  } | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<string>>(
    () => new Set(),
  );

  const load = useCallback(async () => {
    await syncFirestoreAchievements();
    const [
      streak,
      best,
      relapseN,
      weekly,
      monthly,
      yearly,
      modes,
      ww,
      missed,
      summary,
      sinceY,
      relWindows,
      balance,
      topTrig,
      riskyHour,
      achRows,
    ] = await Promise.all([
      getGlobalStreak(),
      getGlobalLongestStreak(),
      getRelapseCount(),
      getWeeklyStats(1),
      getMonthlyStats(1),
      getYearlyStats(),
      getModeComparisonStats(),
      getWeekdayWeekendCompletion(),
      getMostMissedHabit(),
      getEntriesCompletionSummary(),
      getMemberSinceYear(),
      getRelapseCountsLastTwoWindows(),
      getLifeAreaBalance(7),
      getTopRelapseTrigger(),
      getRiskiestRelapseHour(),
      getUnlockedAchievementIds(),
    ]);

    setCurrentStreak(streak);
    setLongestStreak(best);
    setRelapses(relapseN);
    setWeeklyPct(weekly[0]?.rate ?? 0);
    setMonthlyPct(monthly[0]?.rate ?? 0);
    setYearlyPct(yearly[0]?.rate ?? 0);
    setModeComp(modes);
    setWeekendWeekday(ww);
    setMostMissed(missed);
    setEntrySummary(summary);
    setMemberYear(sinceY);
    setUserLevelState(
      evaluateUserLevel({
        currentStreak: streak,
        longestStreak: best,
        consistencyPercent: summary.rate,
        relapsesLast30: relWindows.last30,
        relapsesPrev30: relWindows.prev30,
      }),
    );
    setLifeBalance(balance);
    setTopRelapseTrigger(topTrig);
    setRiskiestRelapse(riskyHour);
    setUnlockedAchievements(new Set(achRows.map((r) => r.achievementId)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const bestMode = useMemo(() => bestModeLabel(modeComp), [modeComp]);
  const weakWindow = useMemo(
    () => (weekendWeekday ? weakWindowInsight(weekendWeekday) : null),
    [weekendWeekday],
  );

  const levelForUi = userLevelState?.level ?? 'beginner';
  const levelMeta = useMemo(() => {
    const lv = userLevelState?.level ?? 'beginner';
    return {
      color: levelAccentColor(lv, t),
      blurb: getLevelBlurb(lv),
      label: formatUserLevelLabel(lv),
    };
  }, [userLevelState, t]);

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <View style={[styles.screenHeader, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.getParent<DrawerNavigationProp<any>>()?.openDrawer();
          }}
          hitSlop={12}
        >
          <PlatformSymbol ios="line.3.horizontal" material="menu" tintColor={t.textPrimary} size={22} />
        </Pressable>
        <Heading variant="title3">Profile</Heading>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/(drawer)/settings');
          }}
          hitSlop={12}
        >
          <PlatformSymbol ios="gearshape" material="settings" tintColor={t.textSecondary} size={22} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* User hero */}
        <Animated.View entering={FadeInDown.springify().damping(18)}>
          <Card animated style={styles.heroCard}>
            <View style={[styles.avatar, { backgroundColor: t.accent }]}>
              <Heading variant="title1" color={t.textInverse}>
                U
              </Heading>
            </View>
            <View style={styles.heroText}>
              <Heading variant="title2">Your journey</Heading>
              <Caption variant="footnote" color={t.textMuted}>
                {memberYear ? `Member since ${memberYear}` : 'Building your baseline'}
              </Caption>
            </View>
            <View style={[styles.levelPill, { borderColor: levelMeta.color + '55' }]}>
              <Caption variant="caption2" color={levelMeta.color} style={styles.levelPillText}>
                {userLevelState ? levelMeta.label : '…'}
              </Caption>
            </View>
          </Card>
        </Animated.View>

        {/* Tools */}
        <Animated.View entering={FadeInDown.delay(40).springify().damping(18)}>
          <SectionLabel t={t}>Tools</SectionLabel>
          <Card style={styles.sectionCard}>
            <ProfileLinkRow
              icon={{ ios: 'heart.text.square.fill', android: 'health_and_safety', web: 'health_and_safety' }}
              label="Log a relapse"
              detail="Capture trigger and note"
              onPress={() => router.push('/relapseLog')}
              t={t}
            />
            <ProfileLinkRow
              icon={{ ios: 'clock.badge.checkmark.fill', android: 'schedule', web: 'schedule' }}
              label="Time blocks"
              detail="Routines & work blocks"
              onPress={() => router.push('/(drawer)/timeBlocks')}
              t={t}
            />
            <ProfileLinkRow
              icon={{ ios: 'eye.slash.fill', android: 'visibility_off', web: 'visibility_off' }}
              label="Focus mode"
              detail="Opens, reminders, usage"
              onPress={() => router.push('/(drawer)/focusMode')}
              t={t}
              last
            />
          </Card>
        </Animated.View>

        {/* 1. User summary */}
        <Animated.View entering={FadeInDown.delay(60).springify().damping(18)}>
          <SectionLabel t={t}>User summary</SectionLabel>
          <Card style={styles.sectionCard}>
            <View style={styles.summaryRow}>
              <SummaryStat
                icon={{ ios: 'flame.fill', android: 'whatshot', web: 'whatshot' }}
                label="Current streak"
                value={String(currentStreak)}
                suffix="days"
                color={t.accent}
                t={t}
              />
              <View style={[styles.vSep, { backgroundColor: t.border }]} />
              <SummaryStat
                icon={{ ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' }}
                label="Longest streak"
                value={String(longestStreak)}
                suffix="days"
                color="#F59E0B"
                t={t}
              />
              <View style={[styles.vSep, { backgroundColor: t.border }]} />
              <SummaryStat
                icon={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }}
                label="Relapses"
                value={String(relapses)}
                suffix="logged"
                color={t.danger}
                t={t}
              />
            </View>
          </Card>
        </Animated.View>

        {/* 2. Performance */}
        <Animated.View entering={FadeInDown.delay(100).springify().damping(18)}>
          <SectionLabel t={t}>Performance</SectionLabel>
          <Card style={styles.sectionCard}>
            <PerfRow label="This week" pct={weeklyPct} t={t} />
            <PerfRow label="This month" pct={monthlyPct} t={t} />
            <PerfRow label="This year" pct={yearlyPct} t={t} last             />
          </Card>
        </Animated.View>

        {/* Relapse analytics */}
        <Animated.View entering={FadeInDown.delay(120).springify().damping(18)}>
          <SectionLabel t={t}>Relapse analytics</SectionLabel>
          <Card style={styles.sectionCard}>
            <InsightRow
              icon={{ ios: 'tag.fill', android: 'label', web: 'label' }}
              label="Most common trigger"
              value={topRelapseTrigger ? relapseTriggerLabel(topRelapseTrigger.tag) : '—'}
              detail={
                topRelapseTrigger
                  ? `${topRelapseTrigger.count} logged · tap Tools to log honestly`
                  : 'No triggers logged yet'
              }
              t={t}
            />
            <InsightRow
              icon={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }}
              label="Riskiest time"
              value={
                riskiestRelapse
                  ? formatRelapseHourLabel(riskiestRelapse.hour)
                  : '—'
              }
              detail={
                riskiestRelapse
                  ? `${riskiestRelapse.count} relapse${riskiestRelapse.count === 1 ? '' : 's'} in this window`
                  : 'Patterns appear after you log a few relapses'
              }
              t={t}
              last
            />
          </Card>
        </Animated.View>

        {/* Life balance */}
        <Animated.View entering={FadeInDown.delay(130).springify().damping(18)}>
          <SectionLabel t={t}>Life balance (7 days)</SectionLabel>
          <LifeBalanceCard rows={lifeBalance} t={t} />
        </Animated.View>

        {/* 3. Behavior insights */}
        <Animated.View entering={FadeInDown.delay(140).springify().damping(18)}>
          <SectionLabel t={t}>Behavior insights</SectionLabel>
          <Card style={styles.sectionCard}>
            <InsightRow
              icon={{ ios: 'house.fill', android: 'home', web: 'home' }}
              label="Best mode"
              value={bestMode.title}
              detail={bestMode.detail}
              t={t}
            />
            <InsightRow
              icon={{ ios: 'moon.stars.fill' as any, android: 'nights_stay', web: 'nights_stay' }}
              label="Weak window"
              value={weakWindow?.title ?? '—'}
              detail={weakDetailText(weakWindow)}
              t={t}
            />
            <InsightRow
              icon={{ ios: 'chart.line.downtrend.xyaxis', android: 'trending_down', web: 'trending_down' }}
              label="Most missed"
              value={mostMissed?.name ?? '—'}
              detail={
                mostMissed
                  ? `${mostMissed.missed} miss${mostMissed.missed === 1 ? '' : 'es'} logged`
                  : 'No misses logged yet'
              }
              t={t}
              last
            />
          </Card>
        </Animated.View>

        {/* Achievements + Progress level moved to Drawer → Achievements */}
      </ScrollView>
    </View>
  );
}

function ProfileLinkRow({
  icon,
  label,
  detail,
  onPress,
  t,
  last,
}: {
  icon: { ios: string; android: string; web: string };
  label: string;
  detail: string;
  onPress: () => void;
  t: ReturnType<typeof useAppTheme>;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[
        styles.linkRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
      ]}
    >
      <View style={[styles.linkIconWrap, { backgroundColor: t.cardElevated }]}>
        <PlatformSymbol ios={icon.ios} material={icon.android} tintColor={t.accent} size={18} />
      </View>
      <View style={styles.linkBody}>
        <Body variant="headline">{label}</Body>
        <Caption variant="footnote" color={t.textSecondary}>
          {detail}
        </Caption>
      </View>
      <PlatformSymbol ios="chevron.right" material="chevron_right" tintColor={t.textMuted} size={16} />
    </Pressable>
  );
}

function LifeBalanceCard({
  rows,
  t,
}: {
  rows: LifeAreaBalanceRow[];
  t: ReturnType<typeof useAppTheme>;
}) {
  return (
    <Card style={styles.sectionCard}>
      {rows.map((row, i) => {
        const pct = row.total === 0 ? 0 : Math.round((row.done / row.total) * 100);
        const color = LIFE_AREA_CHART_COLOR[row.lifeArea];
        const last = i === rows.length - 1;
        return (
          <View
            key={row.lifeArea}
            style={[
              styles.balanceRow,
              !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
            ]}
          >
            <View style={styles.balanceTop}>
              <Body variant="subhead">{LIFE_AREA_LABEL[row.lifeArea]}</Body>
              <Caption variant="caption1" color={color} style={{ fontWeight: '700' }}>
                {row.total === 0 ? '—' : `${pct}%`}
              </Caption>
            </View>
            <View style={[styles.balanceTrack, { backgroundColor: t.border }]}>
              <View
                style={[
                  styles.balanceFill,
                  {
                    width: `${pct}%`,
                    backgroundColor: color,
                  },
                ]}
              />
            </View>
            <Caption variant="caption2" color={t.textMuted}>
              {row.done} done · {row.total} logs · last 7 days
            </Caption>
          </View>
        );
      })}
    </Card>
  );
}

// Achievements UI moved to Drawer → Achievements.

function SectionLabel({ children, t }: { children: string; t: ReturnType<typeof useAppTheme> }) {
  return (
    <Caption variant="caption1" color={t.textMuted} style={styles.sectionLabel}>
      {children.toUpperCase()}
    </Caption>
  );
}

function SummaryStat({
  icon,
  label,
  value,
  suffix,
  color,
  t,
}: {
  icon: { ios: string; android: string; web: string };
  label: string;
  value: string;
  suffix: string;
  color: string;
  t: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View style={styles.summaryCell}>
      <PlatformSymbol ios={icon.ios} material={icon.android} tintColor={color} size={16} />
      <Heading variant="title3" style={{ color }}>
        {value}
      </Heading>
      <Caption variant="caption2" color={t.textMuted} style={{ textAlign: 'center' }}>
        {label}
      </Caption>
      <Caption variant="caption2" color={t.textMuted} style={{ opacity: 0.8 }}>
        {suffix}
      </Caption>
    </View>
  );
}

function PerfRow({
  label,
  pct,
  t,
  last,
}: {
  label: string;
  pct: number;
  t: ReturnType<typeof useAppTheme>;
  last?: boolean;
}) {
  return (
    <View style={[styles.perfRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}>
      <Body variant="bodyMedium">{label}</Body>
      <View style={styles.perfRight}>
        <Caption variant="caption1" color={t.accent} style={styles.perfPct}>
          {pct}%
        </Caption>
        <View style={[styles.perfTrack, { backgroundColor: t.border }]}>
          <View
            style={[
              styles.perfFill,
              {
                width: `${Math.min(100, pct)}%`,
                backgroundColor: t.accent,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

function InsightRow({
  icon,
  label,
  value,
  detail,
  t,
  last,
}: {
  icon: { ios: string; android: string; web: string };
  label: string;
  value: string;
  detail: string;
  t: ReturnType<typeof useAppTheme>;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.insightRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border },
      ]}
    >
      <View style={[styles.insightIcon, { backgroundColor: t.cardElevated }]}>
        <PlatformSymbol ios={icon.ios} material={icon.android} tintColor={t.textSecondary} size={18} />
      </View>
      <View style={styles.insightBody}>
        <Caption variant="caption2" color={t.textMuted}>
          {label}
        </Caption>
        <Body variant="headline">{value}</Body>
        <Caption variant="footnote" color={t.textSecondary}>
          {detail}
        </Caption>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing['5xl'],
    gap: spacing.md,
  },
  sectionLabel: {
    marginLeft: spacing.xs,
    marginBottom: spacing.xs,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    gap: spacing.xxs,
  },
  levelPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  levelPillText: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionCard: {
    paddingVertical: spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  linkIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBody: {
    flex: 1,
    gap: spacing.xxs,
  },
  balanceRow: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  balanceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  balanceFill: {
    height: '100%',
    borderRadius: 3,
  },
  achGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  achCell: {
    width: '48%',
    flexGrow: 1,
    minWidth: 140,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
  },
  vSep: {
    width: StyleSheet.hairlineWidth,
    marginVertical: spacing.sm,
  },
  perfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  perfRight: {
    flex: 1,
    maxWidth: 140,
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  perfPct: {
    fontWeight: '700',
  },
  perfTrack: {
    height: 6,
    width: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },
  perfFill: {
    height: '100%',
    borderRadius: 3,
  },
  insightRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightBody: {
    flex: 1,
    gap: spacing.xxs,
  },
  levelCard: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    gap: spacing.sm,
  },
  levelIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  levelBlurb: {
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 22,
  },
  levelStats: {
    marginTop: spacing.sm,
  },
});
