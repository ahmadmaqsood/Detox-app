import { PlatformSymbol } from "@/components/PlatformSymbol";
import { type DrawerNavigationProp } from "@react-navigation/drawer";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Card } from "@/components/Card";
import { Body, Caption, Heading } from "@/components/Typography";
import {
  getGlobalLongestStreak,
  getGlobalStreak,
  getHeatmapData,
  getInsightSignals,
  getModeComparisonStats,
  getMonthlyStats,
  getScreenTimeVsDiscipline,
  getWeeklyStats,
  getYearlyStats,
  type ModeComparison,
  type PeriodStats,
  type ScreenTimeDiscipline,
} from "@/lib/firestoreDatabase";
import {
  buildDeepInsights,
  type DeepInsight,
} from "@/lib/insightsEngine";
import { useScrollToTopOnTabFocus } from "@/lib/useScrollToTopOnTabFocus";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ────────────────────────────────────────────────────────────────

export default function StreaksScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const scrollRef = useScrollToTopOnTabFocus();

  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [heatmap, setHeatmap] = useState<{ date: string; rate: number }[]>([]);
  const [weekly, setWeekly] = useState<PeriodStats[]>([]);
  const [monthly, setMonthly] = useState<PeriodStats[]>([]);
  const [yearly, setYearly] = useState<PeriodStats[]>([]);
  const [modeComp, setModeComp] = useState<ModeComparison[]>([]);
  const [screenVsDiscipline, setScreenVsDiscipline] = useState<
    ScreenTimeDiscipline[]
  >([]);
  const [deepInsights, setDeepInsights] = useState<DeepInsight[]>([]);

  const loadData = useCallback(async () => {
    const [s, bs, hm, ws, ms, ys, mc, sd, sig] = await Promise.all([
      getGlobalStreak(),
      getGlobalLongestStreak(),
      getHeatmapData(49),
      getWeeklyStats(4),
      getMonthlyStats(6),
      getYearlyStats(),
      getModeComparisonStats(),
      getScreenTimeVsDiscipline(14),
      getInsightSignals(),
    ]);
    setStreak(s);
    setBestStreak(bs);
    setHeatmap(hm);
    setWeekly(ws);
    setMonthly(ms);
    setYearly(ys);
    setModeComp(mc);
    setScreenVsDiscipline(sd);
    setDeepInsights(buildDeepInsights(sig));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* ─── Header ────────────────────────────── */}
      <View
        style={[styles.screenHeader, { paddingTop: insets.top + spacing.md }]}
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.getParent<DrawerNavigationProp<any>>()?.openDrawer();
          }}
          hitSlop={12}
        >
          <PlatformSymbol
            ios="line.3.horizontal"
            material="menu"
            tintColor={t.textPrimary}
            size={22}
          />
        </Pressable>
        <Heading variant="title3">Insights</Heading>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Big Streak Counter ─────────────────── */}
        <Animated.View entering={FadeIn.duration(400)}>
          <View style={[styles.heroCard, { backgroundColor: t.card }]}>
            <View
              style={[styles.fireGlow, { backgroundColor: t.accent + "15" }]}
            >
              <PlatformSymbol
                ios="flame.fill"
                material="whatshot"
                tintColor={t.accent}
                size={36}
              />
            </View>
            <AnimatedCounter value={streak} color={t.accent} />
            <Body variant="bodyMedium" color={t.textSecondary}>
              Day Streak
            </Body>
            <View style={styles.heroSubRow}>
              <View style={styles.heroSub}>
                <PlatformSymbol
                  ios="trophy.fill"
                  material="emoji_events"
                  tintColor="#F59E0B"
                  size={14}
                />
                <Caption variant="caption1" color={t.textMuted}>
                  Best: {bestStreak}d
                </Caption>
              </View>
              <View
                style={[styles.heroDivider, { backgroundColor: t.border }]}
              />
              <View style={styles.heroSub}>
                <PlatformSymbol
                  ios="target"
                  material="track_changes"
                  tintColor="#60A5FA"
                  size={14}
                />
                <Caption variant="caption1" color={t.textMuted}>
                  Goal: 180d
                </Caption>
              </View>
            </View>
            <StreakProgressBar
              current={streak}
              goal={180}
              color={t.accent}
              track={t.background}
            />
          </View>
        </Animated.View>

        {/* ─── Deep insights (engine) ────────────── */}
        {deepInsights.length > 0 && (
          <Animated.View entering={FadeInDown.delay(55).duration(300)}>
            <Card>
              <View style={styles.sectionHeader}>
                <Body variant="headline">Deep insights</Body>
                <Caption variant="caption2" color={t.textMuted}>
                  From your data
                </Caption>
              </View>
              <View style={{ gap: spacing.md }}>
                {deepInsights.map((ins) => (
                  <View
                    key={ins.id}
                    style={[
                      styles.insightBlock,
                      {
                        borderLeftColor:
                          ins.tone === "warning"
                            ? t.warning
                            : ins.tone === "positive"
                              ? t.accent
                              : t.border,
                      },
                    ]}
                  >
                    <Caption
                      variant="caption1"
                      color={
                        ins.tone === "warning"
                          ? t.warning
                          : ins.tone === "positive"
                            ? t.accent
                            : t.textMuted
                      }
                      style={{ fontWeight: "700", marginBottom: spacing.xs }}
                    >
                      {ins.title}
                    </Caption>
                    <Body variant="callout" color={t.textSecondary}>
                      {ins.body}
                    </Body>
                  </View>
                ))}
              </View>
            </Card>
          </Animated.View>
        )}

        {/* ─── 7-Week Heatmap ────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <Card>
            <View style={styles.sectionHeader}>
              <Body variant="headline">Activity Heatmap</Body>
              <Caption variant="caption2" color={t.textMuted}>
                Last 7 weeks
              </Caption>
            </View>
            <View style={styles.heatmapDayLabels}>
              {dayLabels.map((d, i) => (
                <Caption
                  key={i}
                  variant="caption2"
                  color={t.textMuted}
                  style={styles.heatmapDayLabel}
                >
                  {i % 2 === 0 ? d : ""}
                </Caption>
              ))}
            </View>
            <View style={styles.heatmapGrid}>
              {buildHeatmapColumns(heatmap, t.accent, t.border).map(
                (col, ci) => (
                  <View key={ci} style={styles.heatmapCol}>
                    {col.map((cell, ri) => (
                      <View
                        key={ri}
                        style={[
                          styles.heatmapCell,
                          { backgroundColor: cell.color },
                        ]}
                      />
                    ))}
                  </View>
                ),
              )}
            </View>
            <View style={styles.heatmapLegend}>
              <Caption variant="caption2" color={t.textMuted}>
                Less
              </Caption>
              {[0, 0.25, 0.5, 0.75, 1].map((lvl) => (
                <View
                  key={lvl}
                  style={[
                    styles.legendSquare,
                    {
                      backgroundColor: lvl === 0 ? t.border : t.accent,
                      opacity: Math.max(lvl, 0.15),
                    },
                  ]}
                />
              ))}
              <Caption variant="caption2" color={t.textMuted}>
                More
              </Caption>
            </View>
          </Card>
        </Animated.View>

        {/* ─── Weekly Stats ──────────────────────── */}
        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
          <Card>
            <View style={styles.sectionHeader}>
              <Body variant="headline">Weekly</Body>
              <PlatformSymbol
                ios="calendar"
                material="date_range"
                tintColor={t.textMuted}
                size={16}
              />
            </View>
            {weekly.length === 0 ? (
              <EmptyHint t={t} />
            ) : (
              <View style={styles.periodList}>
                {weekly.map((w, i) => (
                  <PeriodRow
                    key={i}
                    stat={w}
                    color={getPeriodColor(i)}
                    t={t}
                    isFirst={i === 0}
                  />
                ))}
              </View>
            )}
          </Card>
        </Animated.View>

        {/* ─── Monthly Stats ─────────────────────── */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <Card>
            <View style={styles.sectionHeader}>
              <Body variant="headline">Monthly</Body>
              <PlatformSymbol
                ios="chart.bar.fill"
                material="bar_chart"
                tintColor={t.textMuted}
                size={16}
              />
            </View>
            {monthly.length === 0 ? (
              <EmptyHint t={t} />
            ) : (
              <View style={styles.barChart}>
                {monthly
                  .slice()
                  .reverse()
                  .map((m, i) => (
                    <BarColumn
                      key={i}
                      stat={m}
                      maxRate={100}
                      accent={t.accent}
                      t={t}
                    />
                  ))}
              </View>
            )}
          </Card>
        </Animated.View>

        {/* ─── Yearly Stats ──────────────────────── */}
        <Animated.View entering={FadeInDown.delay(250).duration(300)}>
          <Card>
            <View style={styles.sectionHeader}>
              <Body variant="headline">Yearly</Body>
              <PlatformSymbol
                ios="chart.line.uptrend.xyaxis"
                material="show_chart"
                tintColor={t.textMuted}
                size={16}
              />
            </View>
            {yearly.length === 0 ? (
              <EmptyHint t={t} />
            ) : (
              <View style={styles.periodList}>
                {yearly.map((y, i) => (
                  <PeriodRow
                    key={i}
                    stat={y}
                    color="#A78BFA"
                    t={t}
                    isFirst={i === 0}
                  />
                ))}
              </View>
            )}
          </Card>
        </Animated.View>

        {/* ─── Insight: Screen Time vs Discipline ── */}
        <Animated.View entering={FadeInDown.delay(300).duration(300)}>
          <Card>
            <View style={styles.sectionHeader}>
              <Body variant="headline">Screen Time vs Discipline</Body>
              <PlatformSymbol
                ios="waveform.path.ecg"
                material="timeline"
                tintColor={t.textMuted}
                size={16}
              />
            </View>
            {screenVsDiscipline.length === 0 ? (
              <View style={styles.emptyInsight}>
                <PlatformSymbol
                  ios="chart.xyaxis.line"
                  material="insights"
                  tintColor={t.textMuted}
                  size={32}
                />
                <Caption
                  variant="footnote"
                  color={t.textMuted}
                  style={{ textAlign: "center", marginTop: spacing.sm }}
                >
                  Log screen time in your daily metrics to see how it correlates
                  with your discipline.
                </Caption>
              </View>
            ) : (
              <>
                <View style={styles.insightChart}>
                  {screenVsDiscipline.map((d, i) => {
                    const maxST = Math.max(
                      ...screenVsDiscipline.map((x) => x.screenTime),
                      1,
                    );
                    const stH = (d.screenTime / maxST) * 100;
                    const dcH = d.completionRate;
                    return (
                      <View key={i} style={styles.insightBarGroup}>
                        <View style={styles.insightBars}>
                          <View
                            style={[
                              styles.insightBar,
                              {
                                height: `${stH}%`,
                                backgroundColor: t.danger + "80",
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.insightBar,
                              {
                                height: `${dcH}%`,
                                backgroundColor: t.accent + "80",
                              },
                            ]}
                          />
                        </View>
                        <Caption
                          variant="caption2"
                          color={t.textMuted}
                          style={{ fontSize: 8 }}
                        >
                          {d.date.slice(8)}
                        </Caption>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.insightLegend}>
                  <View style={styles.insightLegendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: t.danger }]}
                    />
                    <Caption variant="caption2" color={t.textMuted}>
                      Screen Time
                    </Caption>
                  </View>
                  <View style={styles.insightLegendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: t.accent }]}
                    />
                    <Caption variant="caption2" color={t.textMuted}>
                      Discipline %
                    </Caption>
                  </View>
                </View>
                <InsightSummary data={screenVsDiscipline} t={t} />
              </>
            )}
          </Card>
        </Animated.View>

        {/* ─── Insight: Mode Comparison ────────── */}
        <Animated.View entering={FadeInDown.delay(350).duration(300)}>
          <Card>
            <View style={styles.sectionHeader}>
              <Body variant="headline">Mode Comparison</Body>
              <PlatformSymbol
                ios="arrow.left.arrow.right"
                material="compare_arrows"
                tintColor={t.textMuted}
                size={16}
              />
            </View>
            {modeComp.length === 0 ? (
              <View style={styles.emptyInsight}>
                <PlatformSymbol
                  ios="arrow.triangle.swap"
                  material="swap_horiz"
                  tintColor={t.textMuted}
                  size={32}
                />
                <Caption
                  variant="footnote"
                  color={t.textMuted}
                  style={{ textAlign: "center", marginTop: spacing.sm }}
                >
                  Use both Home and Hostel modes to see how your discipline
                  compares.
                </Caption>
              </View>
            ) : (
              <View style={styles.modeCompContainer}>
                {modeComp.map((mc) => {
                  const isHome = mc.mode === "home";
                  const modeColor = isHome ? "#F59E0B" : "#60A5FA";
                  return (
                    <View
                      key={mc.mode}
                      style={[
                        styles.modeCard,
                        { backgroundColor: t.background },
                      ]}
                    >
                      <View
                        style={[
                          styles.modeIconWrap,
                          { backgroundColor: modeColor + "18" },
                        ]}
                      >
                        <PlatformSymbol
                          ios={isHome ? "house.fill" : "building.2.fill"}
                          material={isHome ? "home" : "apartment"}
                          tintColor={modeColor}
                          size={20}
                        />
                      </View>
                      <Heading variant="title3" color={modeColor}>
                        {mc.rate}%
                      </Heading>
                      <Caption variant="caption2" color={t.textMuted}>
                        {isHome ? "Home" : "Hostel"}
                      </Caption>
                      <Caption variant="caption2" color={t.textMuted}>
                        {mc.done}/{mc.total}
                      </Caption>
                    </View>
                  );
                })}
                {modeComp.length === 2 && (
                  <ModeVerdictBadge
                    home={modeComp.find((m) => m.mode === "home")}
                    hostel={modeComp.find((m) => m.mode === "hostel")}
                    t={t}
                  />
                )}
              </View>
            )}
          </Card>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── Animated Counter ──────────────────────────────────────────

function AnimatedCounter({ value, color }: { value: number; color: string }) {
  const display = useSharedValue(0);

  useEffect(() => {
    display.value = withTiming(value, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [value]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + Math.sin(display.value * 0.1) * 0.02 }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Heading variant="largeTitle" color={color} style={styles.streakNumber}>
        {value}
      </Heading>
    </Animated.View>
  );
}

// ─── Streak Progress Bar ───────────────────────────────────────

function StreakProgressBar({
  current,
  goal,
  color,
  track,
}: {
  current: number;
  goal: number;
  color: string;
  track: string;
}) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withSpring(Math.min(current / goal, 1), {
      damping: 20,
      stiffness: 100,
    });
  }, [current, goal]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <View style={[styles.streakBar, { backgroundColor: track }]}>
      <Animated.View
        style={[styles.streakFill, { backgroundColor: color }, fillStyle]}
      />
    </View>
  );
}

// ─── Period Row ────────────────────────────────────────────────

function PeriodRow({
  stat,
  color,
  t,
  isFirst,
}: {
  stat: PeriodStats;
  color: string;
  t: ReturnType<typeof useAppTheme>;
  isFirst: boolean;
}) {
  return (
    <View
      style={[
        styles.periodRow,
        !isFirst && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: t.border,
        },
      ]}
    >
      <View style={styles.periodLeft}>
        <Body
          variant="bodyMedium"
          style={isFirst ? { fontWeight: "700" } : undefined}
        >
          {stat.label}
        </Body>
        <Caption variant="caption2" color={t.textMuted}>
          {stat.done}/{stat.total} done
        </Caption>
      </View>
      <View style={styles.periodRight}>
        <Heading variant="title3" color={color}>
          {stat.rate}%
        </Heading>
        <View style={[styles.miniBar, { backgroundColor: t.background }]}>
          <View
            style={[
              styles.miniFill,
              { backgroundColor: color, width: `${stat.rate}%` },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Bar Column (monthly chart) ────────────────────────────────

function BarColumn({
  stat,
  maxRate,
  accent,
  t,
}: {
  stat: PeriodStats;
  maxRate: number;
  accent: string;
  t: ReturnType<typeof useAppTheme>;
}) {
  const h = maxRate > 0 ? (stat.rate / maxRate) * 100 : 0;
  return (
    <View style={styles.barColWrap}>
      <View style={styles.barColTrack}>
        <View
          style={[
            styles.barColFill,
            {
              height: `${Math.max(h, 2)}%`,
              backgroundColor: accent,
              opacity: h > 0 ? 0.3 + (h / 100) * 0.7 : 0.15,
            },
          ]}
        />
      </View>
      <Caption
        variant="caption2"
        color={t.textMuted}
        style={{ marginTop: spacing.xs }}
      >
        {stat.label}
      </Caption>
      <Caption variant="caption2" color={accent} style={{ fontWeight: "700" }}>
        {stat.rate}%
      </Caption>
    </View>
  );
}

// ─── Insight Summary ───────────────────────────────────────────

function InsightSummary({
  data,
  t,
}: {
  data: ScreenTimeDiscipline[];
  t: ReturnType<typeof useAppTheme>;
}) {
  if (data.length < 2) return null;

  const avgST = Math.round(
    data.reduce((s, d) => s + d.screenTime, 0) / data.length,
  );
  const avgDC = Math.round(
    data.reduce((s, d) => s + d.completionRate, 0) / data.length,
  );

  let correlation = "neutral";
  const highST = data.filter((d) => d.screenTime > avgST);
  const lowST = data.filter((d) => d.screenTime <= avgST);
  const highSTAvgDC =
    highST.length > 0
      ? highST.reduce((s, d) => s + d.completionRate, 0) / highST.length
      : 0;
  const lowSTAvgDC =
    lowST.length > 0
      ? lowST.reduce((s, d) => s + d.completionRate, 0) / lowST.length
      : 0;

  if (lowSTAvgDC - highSTAvgDC > 10) correlation = "negative";
  else if (highSTAvgDC - lowSTAvgDC > 10) correlation = "positive";

  const message =
    correlation === "negative"
      ? "Higher screen time correlates with lower discipline. Cut screen time to improve."
      : correlation === "positive"
        ? "Surprisingly, higher screen time days show better discipline. Keep monitoring."
        : "No strong correlation yet. Keep logging data for clearer insights.";

  const icon =
    correlation === "negative"
      ? {
          ios: "exclamationmark.triangle.fill" as const,
          android: "warning" as const,
          web: "warning" as const,
        }
      : {
          ios: "info.circle.fill" as const,
          android: "info" as const,
          web: "info" as const,
        };

  const iconColor = correlation === "negative" ? t.warning : "#60A5FA";

  return (
    <View
      style={[styles.insightSummary, { backgroundColor: iconColor + "12" }]}
    >
      <PlatformSymbol
        ios={icon.ios}
        material={icon.android}
        tintColor={iconColor}
        size={16}
      />
      <Caption variant="footnote" color={t.textSecondary} style={{ flex: 1 }}>
        {message}
      </Caption>
    </View>
  );
}

// ─── Mode Verdict ──────────────────────────────────────────────

function ModeVerdictBadge({
  home,
  hostel,
  t,
}: {
  home?: ModeComparison;
  hostel?: ModeComparison;
  t: ReturnType<typeof useAppTheme>;
}) {
  if (!home || !hostel) return null;
  const diff = home.rate - hostel.rate;
  const better = diff > 0 ? "Home" : diff < 0 ? "Hostel" : null;
  const absDiff = Math.abs(diff);

  if (!better || absDiff < 3) {
    return (
      <View style={[styles.verdictBadge, { backgroundColor: t.accentMuted }]}>
        <Caption
          variant="caption1"
          color={t.accent}
          style={{ fontWeight: "600" }}
        >
          Both modes are roughly equal
        </Caption>
      </View>
    );
  }

  const color = better === "Home" ? "#F59E0B" : "#60A5FA";
  return (
    <View style={[styles.verdictBadge, { backgroundColor: color + "15" }]}>
      <Caption variant="caption1" color={color} style={{ fontWeight: "600" }}>
        {better} mode is {absDiff}% more disciplined
      </Caption>
    </View>
  );
}

// ─── Empty state ───────────────────────────────────────────────

function EmptyHint({ t }: { t: ReturnType<typeof useAppTheme> }) {
  return (
    <View style={styles.emptyState}>
      <Caption color={t.textMuted}>Complete habits to see stats here</Caption>
    </View>
  );
}

// ─── Heatmap Builder ───────────────────────────────────────────

function buildHeatmapColumns(
  data: { date: string; rate: number }[],
  accent: string,
  empty: string,
): { color: string }[][] {
  const padded = [...data];
  if (padded.length > 0) {
    const firstDow = new Date(padded[0].date + "T00:00:00").getDay();
    const mondayOffset = firstDow === 0 ? 6 : firstDow - 1;
    for (let i = 0; i < mondayOffset; i++) {
      padded.unshift({ date: "", rate: -1 });
    }
  }

  const columns: { color: string }[][] = [];
  let col: { color: string }[] = [];

  for (const cell of padded) {
    if (col.length === 7) {
      columns.push(col);
      col = [];
    }
    if (cell.rate < 0) {
      col.push({ color: "transparent" });
    } else if (cell.rate === 0) {
      col.push({ color: empty });
    } else {
      const alpha = Math.max(0.2, cell.rate);
      col.push({
        color:
          accent +
          Math.round(alpha * 255)
            .toString(16)
            .padStart(2, "0"),
      });
    }
  }
  if (col.length > 0) {
    while (col.length < 7) col.push({ color: "transparent" });
    columns.push(col);
  }

  return columns;
}

function getPeriodColor(index: number): string {
  const palette = ["#4ADE80", "#34D399", "#60A5FA", "#818CF8"];
  return palette[index % palette.length];
}

// ─── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing["5xl"],
    gap: spacing.lg,
  },
  insightBlock: {
    paddingLeft: spacing.md,
    borderLeftWidth: 3,
    paddingVertical: spacing.xs,
  },

  // Hero
  heroCard: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    paddingHorizontal: spacing.xl,
    borderRadius: radius["2xl"],
    gap: spacing.sm,
  },
  fireGlow: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  streakNumber: {
    fontSize: 72,
    lineHeight: 80,
  },
  heroSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  heroSub: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  heroDivider: {
    width: 1,
    height: 14,
  },
  streakBar: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    marginTop: spacing.md,
    overflow: "hidden",
  },
  streakFill: {
    height: "100%",
    borderRadius: 3,
  },

  // Section header
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },

  // Heatmap
  heatmapDayLabels: {
    flexDirection: "column",
    position: "absolute",
    left: spacing.lg,
    top: 56,
    gap: 2,
    zIndex: 1,
  },
  heatmapDayLabel: {
    height: 16,
    lineHeight: 16,
  },
  heatmapGrid: {
    flexDirection: "row",
    gap: 3,
    paddingLeft: 20,
  },
  heatmapCol: {
    gap: 3,
  },
  heatmapCell: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  heatmapLegend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  legendSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },

  // Period list
  periodList: {
    gap: 0,
  },
  periodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  periodLeft: {
    flex: 1,
    gap: spacing.xxs,
  },
  periodRight: {
    alignItems: "flex-end",
    gap: spacing.xs,
    width: 80,
  },
  miniBar: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  miniFill: {
    height: "100%",
    borderRadius: 2,
  },

  // Bar chart (monthly)
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    height: 140,
  },
  barColWrap: {
    flex: 1,
    alignItems: "center",
  },
  barColTrack: {
    width: "100%",
    height: 100,
    justifyContent: "flex-end",
    borderRadius: radius.sm,
    overflow: "hidden",
  },
  barColFill: {
    width: "100%",
    borderRadius: radius.sm,
  },

  // Insights
  emptyInsight: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
  },
  insightChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 100,
    gap: spacing.xs,
  },
  insightBarGroup: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xxs,
  },
  insightBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 80,
    gap: 2,
  },
  insightBar: {
    width: 8,
    borderRadius: 2,
    minHeight: 2,
  },
  insightLegend: {
    flexDirection: "row",
    gap: spacing.xl,
    justifyContent: "center",
    marginTop: spacing.md,
  },
  insightLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  insightSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },

  // Mode comparison
  modeCompContainer: {
    gap: spacing.md,
  },
  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  modeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  verdictBadge: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
  },

  // Empty
  emptyState: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
});
