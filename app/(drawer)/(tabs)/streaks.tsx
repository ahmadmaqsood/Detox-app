import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation } from "expo-router";
import { type DrawerNavigationProp } from "@react-navigation/drawer";

import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import { DayRankingCard } from "@/components/analytics/DayRankingCard";
import { GlowBarCard } from "@/components/analytics/GlowBarCard";
import { GlowWaveCard } from "@/components/analytics/GlowWaveCard";
import { HabitAdoptionCard } from "@/components/analytics/HabitAdoptionCard";
import { HabitFlowMatrix } from "@/components/analytics/HabitFlowMatrix";
import { ModeDetoxCard } from "@/components/analytics/ModeDetoxCard";
import { TimeRangeFilter } from "@/components/analytics/TimeRangeFilter";
import {
  type AnalyticsTimeRange,
  type ProgressAnalyticsReport,
  getProgressAnalyticsReport,
} from "@/lib/progressAnalyticsService";
import { useScrollToTopOnTabFocus } from "@/lib/useScrollToTopOnTabFocus";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";

export default function StreaksScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const scrollRef = useScrollToTopOnTabFocus();

  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>("30d");
  const [report, setReport] = useState<ProgressAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (range: AnalyticsTimeRange, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await getProgressAnalyticsReport(range);
      setReport(data);
    } catch (e) {
      console.warn("Failed loading progress analytics:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData(timeRange);
    }, [loadData, timeRange]),
  );

  const handleRangeChange = (newRange: AnalyticsTimeRange) => {
    setTimeRange(newRange);
    loadData(newRange);
  };

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    loadData(timeRange, true);
  };

  const openDrawer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    (navigation as any).openDrawer?.() ??
      navigation.getParent<DrawerNavigationProp<any>>()?.openDrawer();
  };

  // Prepare data for 4 glowing progress cards
  const series = report?.correlationSeries ?? [];

  // 1. Screen Control data
  const screenPoints = series.map((s) => Math.max(10, 100 - Math.min(100, s.screenTimeMinutes / 2.5)));
  const avgScreenTime =
    series.length > 0
      ? Math.round(series.reduce((sum, s) => sum + s.screenTimeMinutes, 0) / series.length)
      : 0;

  // 2. Sleep data
  const sleepPoints = series.map((s) => s.sleepHours * 10);
  const validSleep = series.filter((s) => s.sleepHours > 0);
  const avgSleep =
    validSleep.length > 0
      ? (validSleep.reduce((sum, s) => sum + s.sleepHours, 0) / validSleep.length).toFixed(1)
      : "0";

  // 3. Steps data
  const stepBars = series.map((s) => s.steps);
  const validSteps = series.filter((s) => s.steps > 0);
  const avgSteps =
    validSteps.length > 0
      ? Math.round(validSteps.reduce((sum, s) => sum + s.steps, 0) / validSteps.length)
      : 0;

  // 4. Deep Work Focus data
  const focusBars = series.map((s) => s.focusMinutes);
  const totalFocus = series.reduce((sum, s) => sum + s.focusMinutes, 0);

  const rangeLabelMap: Record<AnalyticsTimeRange, string> = {
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "90d": "Last 3 Months",
    "180d": "Last 6 Months",
    "365d": "Last 1 Year",
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0F1D" }}>
      {/* ─── Screen Header ────────────────────────────── */}
      <View style={[styles.screenHeader, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={openDrawer} hitSlop={12} style={styles.menuBtn}>
            <PlatformSymbol
              ios="line.3.horizontal"
              material="menu"
              tintColor="#F8FAFC"
              size={22}
            />
          </Pressable>
          <View>
            <Heading variant="title3" color="#F8FAFC" style={{ fontWeight: "800" }}>
              Habit Flow
            </Heading>
            <Caption variant="caption2" color="#64748B">
              Progress & Personal Insights
            </Caption>
          </View>
        </View>

        {/* Time Filter Pills */}
        <TimeRangeFilter selectedRange={timeRange} onSelect={handleRangeChange} />
      </View>

      {/* ─── Scroll Content ────────────────────────────── */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00F5A0" />
          <Caption variant="footnote" color="#64748B" style={{ marginTop: spacing.sm }}>
            Aggregating performance ground truth...
          </Caption>
        </View>
      ) : report ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing["5xl"] + 48 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#00F5A0"
              colors={["#00F5A0"]}
            />
          }
        >
          {/* 1. Hero Overview Metrics Banner */}
          <Animated.View entering={FadeIn.duration(350)}>
            <View style={[styles.heroCard, { backgroundColor: "#0F1626", borderColor: "#1E2A3F" }]}>
              <View style={styles.heroMetricItem}>
                <Caption variant="caption2" color="#64748B" style={styles.heroMetricLabel}>
                  Routine Rate
                </Caption>
                <Heading variant="title1" color="#00F5A0" style={styles.heroMetricVal}>
                  {report.overallCompletionRate}%
                </Heading>
                <Caption variant="caption2" color="#94A3B8">
                  {report.totalDaysTracked} tracked day(s)
                </Caption>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroMetricItem}>
                <Caption variant="caption2" color="#64748B" style={styles.heroMetricLabel}>
                  Active Streak
                </Caption>
                <Heading variant="title1" color="#F8FAFC" style={styles.heroMetricVal}>
                  {report.currentStreak}d
                </Heading>
                <Caption variant="caption2" color="#94A3B8">
                  Best: {report.bestStreak}d
                </Caption>
              </View>

              <View style={styles.heroDivider} />

              <View style={styles.heroMetricItem}>
                <Caption variant="caption2" color="#64748B" style={styles.heroMetricLabel}>
                  Discipline
                </Caption>
                <Heading
                  variant="title2"
                  color={report.overallCompletionRate >= 75 ? "#00F5A0" : "#F59E0B"}
                  style={[styles.heroMetricVal, { marginTop: 4 }]}
                >
                  {report.overallCompletionRate >= 80
                    ? "Master"
                    : report.overallCompletionRate >= 55
                      ? "Solid"
                      : "Building"}
                </Heading>
                <Caption variant="caption2" color="#94A3B8">
                  {timeRange.toUpperCase()} Window
                </Caption>
              </View>
            </View>
          </Animated.View>

          {/* 2. Main Matrix Card (From Screenshot) */}
          <Animated.View entering={FadeInDown.delay(100).duration(350)}>
            <HabitFlowMatrix
              matrixData={report.matrixData}
              timeRangeLabel={rangeLabelMap[timeRange]}
            />
          </Animated.View>

          {/* 3. Four Glowing Progress Cards Grid (From Screenshot) */}
          <Animated.View entering={FadeInDown.delay(180).duration(350)} style={styles.glowSection}>
            <View style={styles.glowCardsRow}>
              <GlowWaveCard
                title="Screen Control"
                badgeLabel="Progress"
                value={`${avgScreenTime}m avg`}
                subtitle="Daily digital limit"
                color="#00F5A0"
                secondaryColor="#06B6D4"
                dataPoints={screenPoints}
              />
              <GlowWaveCard
                title="Sleep Duration"
                badgeLabel="Progress"
                value={`${avgSleep}h avg`}
                subtitle="Rest & recovery"
                color="#8B5CF6"
                secondaryColor="#A855F7"
                dataPoints={sleepPoints}
              />
            </View>

            <View style={styles.glowCardsRow}>
              <GlowBarCard
                title="Daily Steps"
                badgeLabel="Progress"
                value={avgSteps > 0 ? `${avgSteps.toLocaleString()}` : "0"}
                subtitle="Movement & energy"
                color="#06B6D4"
                secondaryColor="#8B5CF6"
                bars={stepBars}
              />
              <GlowBarCard
                title="Deep Work"
                badgeLabel="Bar"
                value={`${totalFocus} mins`}
                subtitle="Focus time output"
                color="#8B5CF6"
                secondaryColor="#00F5A0"
                bars={focusBars}
                dense
              />
            </View>
          </Animated.View>

          {/* 4. Habit Adoption & Consistency Advisory */}
          <Animated.View entering={FadeInDown.delay(260).duration(350)}>
            <HabitAdoptionCard adoptionList={report.habitAdoption} />
          </Animated.View>

          {/* 5. Strongest & Weakest Days Pattern */}
          <Animated.View entering={FadeInDown.delay(320).duration(350)}>
            <DayRankingCard dayStats={report.dayOfWeekRanking} />
          </Animated.View>

          {/* 6. Mode & Detox Breakdown */}
          <Animated.View entering={FadeInDown.delay(380).duration(350)}>
            <ModeDetoxCard stats={report.modeStats} />
          </Animated.View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: "#0A0F1D",
    borderBottomWidth: 1,
    borderBottomColor: "#172033",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#111726",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing["3xl"],
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  heroMetricItem: {
    alignItems: "center",
    flex: 1,
  },
  heroMetricLabel: {
    textTransform: "uppercase",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  heroMetricVal: {
    fontWeight: "800",
    marginTop: 2,
    marginBottom: 2,
  },
  heroDivider: {
    width: 1,
    height: 36,
    backgroundColor: "#1E2A3F",
  },
  glowSection: {
    gap: spacing.sm,
  },
  glowCardsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
