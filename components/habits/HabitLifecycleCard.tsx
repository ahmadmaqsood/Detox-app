import { Caption, Heading } from "@/components/Typography";
import { computeLifecycleProgress, type LifecycleProgress } from "@/lib/adaptiveHabitEngine";
import { updateHabit } from "@/lib/firestoreDatabase";
import type { Habit } from "@/lib/types";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

interface HabitLifecycleCardProps {
  habit: Habit;
  streak: number;
  onHabitArchived?: () => void;
}

const STAGES = [
  { key: "trial", label: "Trial", days: "0–7d" },
  { key: "building", label: "Building", days: "8–21d" },
  { key: "maintaining", label: "Maintaining", days: "22–66d" },
  { key: "adopted", label: "Adopted", days: "66d+" },
];

export function HabitLifecycleCard({
  habit,
  streak,
  onHabitArchived,
}: HabitLifecycleCardProps) {
  const t = useAppTheme();
  const [archiving, setArchiving] = useState(false);

  const lifecycle: LifecycleProgress = useMemo(() => {
    return computeLifecycleProgress(habit, streak);
  }, [habit, streak]);

  const neonLime = "#D4FE33";

  const handleArchive = () => {
    Alert.alert(
      "Archive Habit",
      `Archive "${habit.name}"? It will be retired from your active checklists, but all historical streaks and completions will remain saved.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Archive",
          style: "destructive",
          onPress: async () => {
            try {
              setArchiving(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await updateHabit(habit.id, { archived: true });
              onHabitArchived?.();
            } catch {
              Alert.alert("Error", "Could not archive habit.");
            } finally {
              setArchiving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.borderLight }]}>
      {/* ─── Header ───────────────────────────────────── */}
      <View style={styles.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Caption variant="caption2" color={t.textMuted} style={styles.kicker}>
            HABIT LIFECYCLE
          </Caption>
          <Heading variant="title3">{lifecycle.stageLabel}</Heading>
        </View>
        <View style={[styles.daysPill, { backgroundColor: neonLime + "18" }]}>
          <Text style={[styles.daysNum, { color: neonLime }]}>{streak}d active</Text>
        </View>
      </View>

      {/* ─── 4-Stage Stepper ──────────────────────────── */}
      <View style={styles.stepperRow}>
        {STAGES.map((st, idx) => {
          const isPassed =
            (st.key === "trial" && streak >= 7) ||
            (st.key === "building" && streak >= 21) ||
            (st.key === "maintaining" && streak >= 66) ||
            st.key === lifecycle.currentStage;
          const isCurrent = st.key === lifecycle.currentStage;

          return (
            <View key={st.key} style={styles.stepItem}>
              <View
                style={[
                  styles.stepNode,
                  {
                    backgroundColor: isCurrent ? neonLime : isPassed ? "#34D399" : t.borderLight,
                    borderColor: isCurrent ? neonLime : "transparent",
                  },
                ]}
              >
                {isPassed && !isCurrent ? (
                  <Ionicons name="checkmark" size={10} color="#0F140A" />
                ) : (
                  <View
                    style={[
                      styles.nodeInnerDot,
                      { backgroundColor: isCurrent ? "#0F140A" : "transparent" },
                    ]}
                  />
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  { color: isCurrent ? neonLime : t.textMuted },
                  isCurrent && { fontWeight: "700" },
                ]}
              >
                {st.label}
              </Text>
              <Caption variant="caption2" color={t.textMuted} style={{ fontSize: 9 }}>
                {st.days}
              </Caption>
            </View>
          );
        })}
      </View>

      {/* ─── Stage Progress Bar ───────────────────────── */}
      <View style={styles.stageProgressBlock}>
        <View style={styles.stageProgressTrack}>
          <View
            style={[
              styles.stageProgressFill,
              { width: `${lifecycle.progressPercentage}%`, backgroundColor: neonLime },
            ]}
          />
        </View>
        <View style={styles.stageProgressFoot}>
          <Caption variant="caption2" color={t.textMuted}>
            {lifecycle.daysActive} / {lifecycle.stageTargetDays} days to next phase
          </Caption>
          <Caption variant="caption2" color={neonLime} style={{ fontWeight: "700" }}>
            {lifecycle.progressPercentage}%
          </Caption>
        </View>
      </View>

      {/* ─── Retire / Archive Button ──────────────────── */}
      <Pressable
        onPress={handleArchive}
        disabled={archiving}
        style={({ pressed }) => [
          styles.archiveBtn,
          { borderColor: t.borderLight },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Ionicons name="archive-outline" size={14} color={t.textMuted} />
        <Text style={[styles.archiveBtnText, { color: t.textMuted }]}>
          Retire / Archive Habit (Retain History)
        </Text>
      </Pressable>
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
  kicker: {
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  daysPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  daysNum: {
    fontSize: 12,
    fontWeight: "800",
  },
  stepperRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingTop: spacing.xs,
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
    gap: 3,
  },
  stepNode: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  nodeInnerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  stageProgressBlock: {
    gap: 6,
  },
  stageProgressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  stageProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  stageProgressFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  archiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: 4,
  },
  archiveBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
