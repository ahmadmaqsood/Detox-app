import { Caption, Heading } from "@/components/Typography";
import {
  computeHabitEffectivenessScore,
  evaluateAdaptiveRecommendations,
  type AdaptiveRecommendation,
  type HabitScoreBreakdown,
} from "@/lib/adaptiveHabitEngine";
import { updateHabit } from "@/lib/firestoreDatabase";
import type { Habit, HabitDifficultyTier } from "@/lib/types";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

interface HabitEffectivenessCardProps {
  habit: Habit;
  completionRate: number; // 0-100
  history: { completed: number; completedTier?: HabitDifficultyTier }[];
  onHabitUpdated?: () => void;
}

export function HabitEffectivenessCard({
  habit,
  completionRate,
  history,
  onHabitUpdated,
}: HabitEffectivenessCardProps) {
  const t = useAppTheme();
  const [rating, setRating] = useState(habit.usefulnessRating ?? 4);
  const [applyingRec, setApplyingRec] = useState(false);

  // Compute breakdown
  const breakdown: HabitScoreBreakdown = useMemo(() => {
    return computeHabitEffectivenessScore(
      { ...habit, usefulnessRating: rating },
      completionRate,
      history,
    );
  }, [habit, completionRate, history, rating]);

  // Compute recommendation
  const rec: AdaptiveRecommendation | null = useMemo(() => {
    return evaluateAdaptiveRecommendations(habit, completionRate, history as any);
  }, [habit, completionRate, history]);

  const neonLime = "#D4FE33";
  const gradeColor =
    breakdown.grade === "S" || breakdown.grade === "A"
      ? neonLime
      : breakdown.grade === "B"
        ? "#60A5FA"
        : breakdown.grade === "C"
          ? "#FBBF24"
          : "#F87171";

  const handleRate = async (star: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRating(star);
    try {
      await updateHabit(habit.id, { usefulnessRating: star });
      onHabitUpdated?.();
    } catch (e) {
      console.warn("Failed to save rating:", e);
    }
  };

  const handleApplyRec = async () => {
    if (!rec) return;
    try {
      setApplyingRec(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (rec.type === "scale_down" && rec.suggestedStandard) {
        await updateHabit(habit.id, {
          difficultyLevels: {
            ...habit.difficultyLevels,
            standard: rec.suggestedStandard,
            minimum: rec.suggestedMinimum,
          },
        });
        Alert.alert("Target Adapted", `Adjusted standard target to "${rec.suggestedStandard}" for the next 2 weeks.`);
        onHabitUpdated?.();
      }
    } catch {
      Alert.alert("Error", "Could not apply recommendation.");
    } finally {
      setApplyingRec(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.borderLight }]}>
      {/* ─── Header: Score & Grade ─────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Caption variant="caption2" color={t.textMuted} style={styles.headerKicker}>
            ADAPTIVE INTELLIGENCE
          </Caption>
          <Heading variant="title3">Effectiveness Score</Heading>
        </View>
        <View style={[styles.scoreBadge, { backgroundColor: gradeColor + "20", borderColor: gradeColor }]}>
          <Text style={[styles.scoreNum, { color: gradeColor }]}>{breakdown.totalScore}</Text>
          <Text style={[styles.gradeText, { color: gradeColor }]}>/ 100 · {breakdown.grade}</Text>
        </View>
      </View>

      {/* ─── Breakdown Bars ───────────────────────────── */}
      <View style={styles.breakdownGrid}>
        <MetricBar
          label="Consistency (40%)"
          val={breakdown.consistencyScore}
          max={40}
          color="#34D399"
          t={t}
        />
        <MetricBar
          label="Difficulty Feasibility (25%)"
          val={breakdown.difficultyScore}
          max={25}
          color="#60A5FA"
          t={t}
        />
        <MetricBar
          label="Perceived Usefulness (20%)"
          val={breakdown.usefulnessScore}
          max={20}
          color={neonLime}
          t={t}
        />
        <MetricBar
          label="Goal Alignment (15%)"
          val={breakdown.alignmentScore}
          max={15}
          color="#A78BFA"
          t={t}
        />
      </View>

      {/* ─── Usefulness Star Rating ───────────────────── */}
      <View style={styles.ratingRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ratingLabel, { color: t.textPrimary }]}>How useful is this habit?</Text>
          <Caption variant="caption2" color={t.textMuted}>
            Tap to adjust your perceived value
          </Caption>
        </View>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Pressable key={star} onPress={() => handleRate(star)} hitSlop={6}>
              <Ionicons
                name={star <= rating ? "star" : "star-outline"}
                size={20}
                color={star <= rating ? "#FBBF24" : t.textMuted}
              />
            </Pressable>
          ))}
        </View>
      </View>

      {/* ─── Adaptive Recommendation Box ─────────────── */}
      {rec && (
        <View style={[styles.recBox, { backgroundColor: "#1D2319", borderColor: neonLime + "40" }]}>
          <View style={styles.recHeader}>
            <Ionicons name="bulb" size={16} color={neonLime} />
            <Text style={[styles.recHeadline, { color: t.textPrimary }]}>{rec.headline}</Text>
          </View>
          <Text style={[styles.recReasoning, { color: t.textSecondary }]}>{rec.reasoning}</Text>
          <Text style={[styles.recAction, { color: neonLime }]}>💡 {rec.proposedAction}</Text>

          {rec.type === "scale_down" && (
            <Pressable
              onPress={handleApplyRec}
              disabled={applyingRec}
              style={({ pressed }) => [
                styles.recBtn,
                { backgroundColor: neonLime },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="checkmark-done" size={15} color="#0F140A" />
              <Text style={styles.recBtnText}>Test Smaller Target for 2 Weeks</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function MetricBar({
  label,
  val,
  max,
  color,
  t,
}: {
  label: string;
  val: number;
  max: number;
  color: string;
  t: ReturnType<typeof useAppTheme>;
}) {
  const pct = Math.min(100, Math.round((val / max) * 100));
  return (
    <View style={styles.barItem}>
      <View style={styles.barLabelRow}>
        <Text style={[styles.barLabel, { color: t.textMuted }]}>{label}</Text>
        <Text style={[styles.barVal, { color: t.textPrimary }]}>
          {val}/{max}
        </Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: t.borderLight }]}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerKicker: {
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  scoreBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  scoreNum: {
    fontSize: 20,
    fontWeight: "800",
  },
  gradeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  breakdownGrid: {
    gap: spacing.sm,
  },
  barItem: {
    gap: 4,
  },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  barLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  barVal: {
    fontSize: 11,
    fontWeight: "700",
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  stars: {
    flexDirection: "row",
    gap: 4,
  },
  recBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: 6,
  },
  recHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recHeadline: {
    fontSize: 13,
    fontWeight: "700",
  },
  recReasoning: {
    fontSize: 11,
    lineHeight: 16,
  },
  recAction: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  recBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: radius.md,
    marginTop: 6,
  },
  recBtnText: {
    color: "#0F140A",
    fontSize: 12,
    fontWeight: "700",
  },
});
