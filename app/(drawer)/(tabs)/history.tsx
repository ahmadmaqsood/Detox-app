import { type DrawerNavigationProp } from "@react-navigation/drawer";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlatformSymbol } from "@/components/PlatformSymbol";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Body, Caption, Heading } from "@/components/Typography";
import {
  getChallengeCompletionHistory,
  getDetoxDaysHistory,
  type DetoxDayRecord,
} from "@/lib/firestoreDatabase";
import { useScrollToTopOnTabFocus } from "@/lib/useScrollToTopOnTabFocus";
import type { ChallengeCompletionRecord } from "@/lib/types";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";

type HistoryTab = "challenges" | "detox";

const HISTORY_TABS: { label: string; value: HistoryTab }[] = [
  { label: "🏆 Challenges", value: "challenges" },
  { label: "🛡️ Detox Days", value: "detox" },
];

function formatCompletedDate(iso: string): string {
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString(undefined, {
      dateStyle: "medium",
    });
  } catch {
    return iso;
  }
}

function formatDetoxDate(iso: string): string {
  try {
    const d = new Date(iso + "T12:00:00");
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function HistoryScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const [tab, setTab] = useState<HistoryTab>("challenges");
  const [completedChallenges, setCompletedChallenges] = useState<
    ChallengeCompletionRecord[]
  >([]);
  const [detoxDays, setDetoxDays] = useState<DetoxDayRecord[]>([]);
  const scrollRef = useScrollToTopOnTabFocus();

  const load = useCallback(async () => {
    const [rows, dDays] = await Promise.all([
      getChallengeCompletionHistory().catch(() => []),
      getDetoxDaysHistory().catch(() => []),
    ]);
    setCompletedChallenges(rows);
    setDetoxDays(dDays);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const strongDetoxCount = detoxDays.filter((d) => d.successful).length;

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
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
        <Heading variant="title3">History</Heading>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.segmentWrap}>
        <SegmentedControl
          segments={HISTORY_TABS}
          selected={tab}
          onChange={(newTab) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setTab(newTab);
          }}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {tab === "challenges" ? (
          <>
            <Animated.View entering={FadeIn.duration(400)}>
              <Body variant="body" color={t.textSecondary} style={styles.intro}>
                Completed challenges stay here forever — even if you reset an
                active run on the Challenges tab.
              </Body>
            </Animated.View>

            {completedChallenges.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: t.card }]}>
                <PlatformSymbol
                  ios="trophy"
                  material="trophy-outline"
                  tintColor={t.textMuted}
                  size={40}
                />
                <Body variant="body" color={t.textSecondary} style={styles.emptyText}>
                  No completed challenges yet. Finish a challenge to see it here.
                </Body>
              </View>
            ) : (
              <View style={styles.list}>
                {completedChallenges.map((item, i) => (
                  <Animated.View
                    key={item.id}
                    entering={FadeInDown.delay(i * 60).duration(280)}
                  >
                    <View style={[styles.row, { backgroundColor: t.card }]}>
                      <View style={styles.rowMain}>
                        <Heading variant="title3" numberOfLines={2}>
                          {item.name}
                        </Heading>
                        <Caption variant="caption2" color={t.textMuted}>
                          {item.duration} {item.duration === 1 ? "day" : "days"}
                        </Caption>
                      </View>
                      <View style={styles.rowMeta}>
                        <Caption
                          variant="caption2"
                          color={t.textSecondary}
                          style={styles.dateLabel}
                        >
                          Completed
                        </Caption>
                        <Body variant="bodyMedium" color={t.textPrimary}>
                          {formatCompletedDate(item.completedAt)}
                        </Body>
                      </View>
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <Animated.View entering={FadeIn.duration(400)}>
              <Body variant="body" color={t.textSecondary} style={styles.intro}>
                Record of all days completed under Detox Protocol. A day is classified as a Strong Day when completion is ≥75%.
              </Body>
            </Animated.View>

            {/* Summary Strip */}
            <Animated.View entering={FadeIn.duration(300)}>
              <View style={styles.detoxSummaryRow}>
                <View style={[styles.detoxSummaryCard, { backgroundColor: t.card }]}>
                  <Caption variant="caption2" color={t.textMuted}>
                    TOTAL DETOX DAYS
                  </Caption>
                  <Heading variant="title1" color={t.textPrimary}>
                    {detoxDays.length}
                  </Heading>
                  <Caption variant="caption2" color={t.textSecondary}>
                    Logged with Detox Mode
                  </Caption>
                </View>

                <View style={[styles.detoxSummaryCard, { backgroundColor: t.card }]}>
                  <Caption variant="caption2" color={t.textMuted}>
                    STRONG DAYS (≥75%)
                  </Caption>
                  <Heading variant="title1" color="#10B981">
                    {strongDetoxCount}
                  </Heading>
                  <Caption variant="caption2" color="#10B981">
                    {detoxDays.length > 0 ? `${Math.round((strongDetoxCount / detoxDays.length) * 100)}% success rate` : "Goal standard"}
                  </Caption>
                </View>
              </View>
            </Animated.View>

            {detoxDays.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: t.card }]}>
                <PlatformSymbol
                  ios="shield.slash"
                  material="shield-off-outline"
                  tintColor={t.textMuted}
                  size={40}
                />
                <Body variant="body" color={t.textSecondary} style={styles.emptyText}>
                  No Detox Mode days recorded yet. Switch on Detox Mode from the Control Center to log dedicated detox days.
                </Body>
              </View>
            ) : (
              <View style={styles.list}>
                {detoxDays.map((item, i) => (
                  <Animated.View
                    key={item.date}
                    entering={FadeInDown.delay(i * 50).duration(260)}
                  >
                    <View
                      style={[
                        styles.detoxCard,
                        {
                          backgroundColor: t.card,
                          borderColor: item.successful ? "#10B98135" : t.border,
                        },
                      ]}
                    >
                      <View style={styles.detoxCardTop}>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Heading variant="title3">
                            {formatDetoxDate(item.date)}
                          </Heading>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 4 }}>
                            <View
                              style={[
                                styles.modeBadge,
                                {
                                  backgroundColor:
                                    item.mode === "home" ? "#4ADE8018" : "#60A5FA18",
                                },
                              ]}
                            >
                              <Caption
                                variant="caption2"
                                color={item.mode === "home" ? "#4ADE80" : "#60A5FA"}
                                style={{ fontWeight: "700" }}
                              >
                                {item.mode === "home" ? "🏠 Home" : "🏢 Hostel"}
                              </Caption>
                            </View>
                            <Caption variant="caption2" color={t.textMuted}>
                              {item.checkedHabits} of {item.totalHabits} habits
                            </Caption>
                          </View>
                        </View>

                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: item.successful ? "#10B98118" : "#F59E0B18",
                              borderColor: item.successful ? "#10B98144" : "#F59E0B44",
                            },
                          ]}
                        >
                          <Caption
                            variant="caption2"
                            color={item.successful ? "#10B981" : "#F59E0B"}
                            style={{ fontWeight: "700" }}
                          >
                            {item.successful ? "🛡️ STRONG DAY" : "INCOMPLETE"}
                          </Caption>
                        </View>
                      </View>

                      {/* Progress bar */}
                      <View style={[styles.detoxProgressTrack, { backgroundColor: t.background }]}>
                        <View
                          style={[
                            styles.detoxProgressBar,
                            {
                              width: `${Math.min(100, Math.max(0, item.completionPercentage))}%`,
                              backgroundColor: item.successful ? "#10B981" : "#F59E0B",
                            },
                          ]}
                        />
                      </View>

                      <View style={styles.detoxCardFooter}>
                        <Caption variant="caption2" color={t.textMuted}>
                          {item.successful
                            ? "Completed ≥75% goal"
                            : "Below 75% target threshold"}
                        </Caption>
                        <Heading
                          variant="title3"
                          color={item.successful ? "#10B981" : t.textSecondary}
                        >
                          {item.completionPercentage}%
                        </Heading>
                      </View>
                    </View>
                  </Animated.View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  segmentWrap: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing["5xl"],
    gap: spacing.lg,
  },
  intro: {
    lineHeight: 22,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  rowMain: {
    flex: 1,
    gap: spacing.xs,
  },
  rowMeta: {
    alignItems: "flex-end",
    gap: spacing.xxs,
  },
  dateLabel: {
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  empty: {
    borderRadius: radius["2xl"],
    padding: spacing["2xl"],
    alignItems: "center",
    gap: spacing.md,
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 22,
  },

  // Detox Summary
  detoxSummaryRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  detoxSummaryCard: {
    flex: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xxs,
  },

  // Detox Card
  detoxCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  detoxCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  modeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  detoxProgressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    width: "100%",
  },
  detoxProgressBar: {
    height: "100%",
    borderRadius: 3,
  },
  detoxCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
