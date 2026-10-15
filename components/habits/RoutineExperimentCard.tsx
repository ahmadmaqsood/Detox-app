import { Button } from "@/components/Button";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import {
  evaluateRoutineExperiment,
  getTodayExperimentVariant,
  type ExperimentEvaluation,
} from "@/lib/adaptiveHabitEngine";
import {
  cancelRoutineExperiment,
  completeRoutineExperiment,
  deleteRoutineExperiment,
  updateHabit,
} from "@/lib/firestoreDatabase";
import type { DailyProgressEntry, Habit, RoutineExperiment } from "@/lib/types";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

interface RoutineExperimentCardProps {
  experiment: RoutineExperiment;
  entries: DailyProgressEntry[];
  habit: Habit;
  onExperimentUpdated: () => void;
}

export function RoutineExperimentCard({
  experiment,
  entries,
  habit,
  onExperimentUpdated,
}: RoutineExperimentCardProps) {
  const t = useAppTheme();
  const [acting, setActing] = useState(false);

  const evaluation: ExperimentEvaluation = useMemo(() => {
    return evaluateRoutineExperiment(experiment, entries);
  }, [experiment, entries]);

  const todayVariant = useMemo(() => {
    return getTodayExperimentVariant(experiment);
  }, [experiment]);

  const neonLime = "#D4FE33";
  const skyBlue = "#60A5FA";
  const isActive = experiment.status === "active";

  const handleAdoptWinner = async (winner: "A" | "B") => {
    try {
      setActing(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const winningVariant = winner === "A" ? experiment.variantA : experiment.variantB;

      // Apply winning routine attribute to habit
      const updates: Partial<Habit> = {};
      if (winningVariant.timeSlot) {
        updates.timeSlot = winningVariant.timeSlot;
      }
      if (winningVariant.difficulty) {
        // adjust standard to winning tier if applicable
        if (habit.difficultyLevels) {
          const targetText =
            winningVariant.difficulty === "minimum"
              ? habit.difficultyLevels.minimum
              : habit.difficultyLevels.standard;
          if (targetText) {
            updates.difficultyLevels = {
              ...habit.difficultyLevels,
              standard: targetText,
            };
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await updateHabit(habit.id, updates);
      }

      await completeRoutineExperiment(
        experiment.id,
        winner,
        evaluation.recommendation,
        {
          completionRateA: evaluation.completionRateA,
          completionRateB: evaluation.completionRateB,
        },
      );

      Alert.alert(
        "🏆 Routine Adopted!",
        `Successfully configured "${winningVariant.label}" as the primary routine for "${habit.name}".`,
      );
      onExperimentUpdated();
    } catch {
      Alert.alert("Error", "Could not adopt routine winner.");
    } finally {
      setActing(false);
    }
  };

  const handleConcludeEarly = () => {
    const defaultWinner =
      evaluation.leadVariant === "A"
        ? "A"
        : evaluation.leadVariant === "B"
          ? "B"
          : "inconclusive";

    Alert.alert(
      "Conclude Experiment Early",
      `Are you ready to declare a winner based on current results?\n\n• Variant A: ${evaluation.completionRateA}%\n• Variant B: ${evaluation.completionRateB}%`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Adopt ${evaluation.leadVariant === "B" ? "Variant B" : "Variant A"}`,
          onPress: () => handleAdoptWinner(defaultWinner === "B" ? "B" : "A"),
        },
      ],
    );
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancel Experiment",
      "Are you sure you want to cancel this routine A/B test? The test will stop tracking.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Cancel Test",
          style: "destructive",
          onPress: async () => {
            try {
              setActing(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await cancelRoutineExperiment(experiment.id);
              onExperimentUpdated();
            } catch {
              Alert.alert("Error", "Could not cancel experiment.");
            } finally {
              setActing(false);
            }
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    Alert.alert("Delete Experiment", "Remove this experiment record permanently?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setActing(true);
            await deleteRoutineExperiment(experiment.id);
            onExperimentUpdated();
          } catch {
            Alert.alert("Error", "Could not delete experiment.");
          } finally {
            setActing(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.borderLight }]}>
      {/* ─── Header ───────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.headerKickerRow}>
            <Caption variant="caption2" color={t.textMuted} style={styles.kicker}>
              ROUTINE EXPERIMENT
            </Caption>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isActive
                    ? neonLime + "20"
                    : experiment.status === "completed"
                      ? "#34D39920"
                      : t.borderLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: isActive
                      ? neonLime
                      : experiment.status === "completed"
                        ? "#34D399"
                        : t.textMuted,
                  },
                ]}
              >
                {isActive
                  ? `DAY ${evaluation.daysElapsed}/${experiment.durationDays}`
                  : experiment.status.toUpperCase()}
              </Text>
            </View>
          </View>
          <Heading variant="title3">{experiment.name}</Heading>
        </View>
      </View>

      {/* ─── Today's Assignment (if active) ────────── */}
      {isActive && (
        <View style={[styles.todayCard, { backgroundColor: t.background, borderColor: neonLime + "40" }]}>
          <View style={styles.todayIconWrap}>
            <PlatformSymbol ios="sparkles" material="auto-awesome" tintColor={neonLime} size={16} />
          </View>
          <View style={{ flex: 1 }}>
            <Caption variant="caption2" color={neonLime} style={{ fontWeight: "700" }}>
              TODAY'S VARIANT ASSIGNMENT
            </Caption>
            <Body variant="subhead" style={{ fontWeight: "700", marginTop: 2 }}>
              Variant {todayVariant.variantLetter}: {todayVariant.variant.label}
            </Body>
            <Caption variant="caption2" color={t.textMuted}>
              Focus on this routine version today so the test remains balanced.
            </Caption>
          </View>
        </View>
      )}

      {/* ─── Head-to-Head Comparison ──────────────── */}
      <View style={styles.comparisonBox}>
        {/* Variant A */}
        <View style={styles.variantRow}>
          <View style={styles.variantMeta}>
            <View style={styles.variantLabelWrap}>
              <View style={[styles.letterPill, { backgroundColor: neonLime }]}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#000" }}>A</Text>
              </View>
              <Text style={[styles.variantLabel, { color: t.textPrimary }]} numberOfLines={1}>
                {experiment.variantA.label}
              </Text>
            </View>
            <Text style={[styles.variantPct, { color: neonLime }]}>
              {evaluation.completionRateA}%
            </Text>
          </View>
          <View style={[styles.barTrack, { backgroundColor: t.background }]}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.min(100, Math.max(4, evaluation.completionRateA))}%`, backgroundColor: neonLime },
              ]}
            />
          </View>
        </View>

        {/* Variant B */}
        <View style={styles.variantRow}>
          <View style={styles.variantMeta}>
            <View style={styles.variantLabelWrap}>
              <View style={[styles.letterPill, { backgroundColor: skyBlue }]}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#000" }}>B</Text>
              </View>
              <Text style={[styles.variantLabel, { color: t.textPrimary }]} numberOfLines={1}>
                {experiment.variantB.label}
              </Text>
            </View>
            <Text style={[styles.variantPct, { color: skyBlue }]}>
              {evaluation.completionRateB}%
            </Text>
          </View>
          <View style={[styles.barTrack, { backgroundColor: t.background }]}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.min(100, Math.max(4, evaluation.completionRateB))}%`, backgroundColor: skyBlue },
              ]}
            />
          </View>
        </View>
      </View>

      {/* ─── Lead & Recommendation ─────────────────── */}
      <View style={[styles.recBox, { backgroundColor: t.background, borderColor: t.borderLight }]}>
        <View style={styles.recHeader}>
          <PlatformSymbol
            ios={evaluation.leadVariant === "tied" ? "scale.3d" : "trophy.fill"}
            material={evaluation.leadVariant === "tied" ? "balance" : "emoji-events"}
            tintColor={neonLime}
            size={16}
          />
          <Caption variant="caption2" color={t.textSecondary} style={{ fontWeight: "700" }}>
            {evaluation.leadVariant === "tied"
              ? "TIED RESULTS SO FAR"
              : `VARIANT ${evaluation.leadVariant} IS LEADING (${Math.abs(evaluation.completionRateA - evaluation.completionRateB)}% MARGIN)`}
          </Caption>
        </View>
        <Caption variant="footnote" color={t.textPrimary} style={{ lineHeight: 18 }}>
          {evaluation.recommendation}
        </Caption>
      </View>

      {/* ─── Action Buttons ────────────────────────── */}
      {isActive ? (
        <View style={styles.actionRow}>
          {evaluation.readyToConclude || evaluation.daysElapsed >= 4 ? (
            <Button
              title="Adopt Winning Routine"
              onPress={() => handleAdoptWinner(evaluation.leadVariant === "B" ? "B" : "A")}
              disabled={acting}
              loading={acting}
            />
          ) : (
            <Button
              title="Conclude Early"
              variant="secondary"
              onPress={handleConcludeEarly}
              disabled={acting}
            />
          )}
          <Pressable onPress={handleCancel} style={styles.cancelLink} disabled={acting}>
            <Caption variant="caption2" color={t.danger} style={{ fontWeight: "600" }}>
              Cancel Experiment
            </Caption>
          </Pressable>
        </View>
      ) : (
        <View style={styles.completedRow}>
          <View style={{ flex: 1 }}>
            <Caption variant="caption2" color={t.textMuted}>
              WINNER: {experiment.winner ? `Variant ${experiment.winner}` : "Concluded"}
            </Caption>
          </View>
          <Pressable onPress={handleDelete} style={styles.deleteLink} disabled={acting}>
            <PlatformSymbol ios="trash" material="delete" tintColor={t.danger} size={14} />
            <Caption variant="caption2" color={t.danger}>
              Delete
            </Caption>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius["2xl"],
    padding: spacing.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  headerKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  kicker: {
    fontWeight: "700",
    letterSpacing: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.md,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
  },
  todayCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  todayIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D4FE3320",
  },
  comparisonBox: {
    gap: spacing.md,
  },
  variantRow: {
    gap: spacing.xs,
  },
  variantMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  variantLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    paddingRight: spacing.sm,
  },
  letterPill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  variantLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  variantPct: {
    fontSize: 14,
    fontWeight: "800",
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  recBox: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  recHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionRow: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelLink: {
    alignSelf: "center",
    paddingVertical: spacing.xs,
  },
  completedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: spacing.xs,
  },
  deleteLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.xs,
  },
});
