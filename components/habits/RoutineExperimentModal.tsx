import { Button } from "@/components/Button";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import { saveRoutineExperiment } from "@/lib/firestoreDatabase";
import type { Habit, HabitDifficultyTier, RoutineExperiment, TimeSlot } from "@/lib/types";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface RoutineExperimentModalProps {
  visible: boolean;
  onClose: () => void;
  habit: Habit;
  onExperimentStarted: () => void;
}

interface PresetOption {
  id: string;
  title: string;
  description: string;
  variantA: { label: string; timeSlot?: TimeSlot; difficulty?: HabitDifficultyTier };
  variantB: { label: string; timeSlot?: TimeSlot; difficulty?: HabitDifficultyTier };
  defaultDuration: number;
}

const PRESETS: PresetOption[] = [
  {
    id: "time_test",
    title: "🌅 Morning vs 🌙 Evening Timing",
    description: "Alternate days between morning and evening execution for 14 days to see when you are most consistent.",
    variantA: { label: "Morning Session", timeSlot: "morning" },
    variantB: { label: "Evening Session", timeSlot: "evening" },
    defaultDuration: 14,
  },
  {
    id: "elastic_test",
    title: "⚡ Micro vs 🎯 Standard Target",
    description: "Test if an easy minimum elastic target produces higher consistency than attempting standard each day.",
    variantA: { label: "Minimum Target (5-10m)", difficulty: "minimum" },
    variantB: { label: "Standard Target (20-30m)", difficulty: "standard" },
    defaultDuration: 14,
  },
  {
    id: "early_vs_late",
    title: "☀️ Afternoon vs ✨ Night Ritual",
    description: "Compare performing this habit during midday slump versus before sleeping.",
    variantA: { label: "Afternoon Boost", timeSlot: "afternoon" },
    variantB: { label: "Night Wind-Down", timeSlot: "night" },
    defaultDuration: 7,
  },
];

export function RoutineExperimentModal({
  visible,
  onClose,
  habit,
  onExperimentStarted,
}: RoutineExperimentModalProps) {
  const t = useAppTheme();
  const [selectedPreset, setSelectedPreset] = useState<string>("time_test");
  const [customName, setCustomName] = useState("");
  const [labelA, setLabelA] = useState("");
  const [labelB, setLabelB] = useState("");
  const [duration, setDuration] = useState<number>(14);
  const [saving, setSaving] = useState(false);

  const neonLime = "#D4FE33";

  const handleStart = async () => {
    try {
      setSaving(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      let name = `A/B Routine Test: ${habit.name}`;
      let variantA: { label: string; timeSlot?: TimeSlot; difficulty?: HabitDifficultyTier } = { label: "Variant A" };
      let variantB: { label: string; timeSlot?: TimeSlot; difficulty?: HabitDifficultyTier } = { label: "Variant B" };

      const activePreset = PRESETS.find((p) => p.id === selectedPreset);
      if (activePreset) {
        name = activePreset.title;
        variantA = activePreset.variantA;
        variantB = activePreset.variantB;
      } else {
        name = customName.trim() || `Experiment: ${habit.name}`;
        variantA = { label: labelA.trim() || "Morning Routine", timeSlot: "morning", difficulty: undefined };
        variantB = { label: labelB.trim() || "Evening Routine", timeSlot: "evening", difficulty: undefined };
      }

      const today = new Date().toISOString().slice(0, 10);
      const newExp: RoutineExperiment = {
        id: `exp_${habit.id}_${Date.now()}`,
        name,
        habitId: habit.id,
        variantA,
        variantB,
        startDate: today,
        durationDays: duration,
        status: "active",
      };

      await saveRoutineExperiment(newExp);
      onExperimentStarted();
      onClose();
      Alert.alert(
        "🧪 Experiment Started!",
        `You're now running "${name}" for ${duration} days. Today is assigned to Variant A (${variantA.label}). Alternate days will be tracked automatically!`,
      );
    } catch (e) {
      console.error("Failed to save experiment:", e);
      Alert.alert("Error", "Could not start experiment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: t.card }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Caption variant="caption2" color={t.textMuted} style={styles.kicker}>
                ROUTINE A/B EXPERIMENTS
              </Caption>
              <Heading variant="title2">Test & Optimize Routine</Heading>
              <Caption variant="footnote" color={t.textSecondary} style={{ marginTop: 2 }}>
                For "{habit.name}"
              </Caption>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <PlatformSymbol ios="xmark" material="close" tintColor={t.textMuted} size={20} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Presets Section */}
            <View style={styles.section}>
              <Body variant="headline" style={{ marginBottom: spacing.xs }}>
                Select an Experiment Type
              </Body>
              <Caption variant="caption2" color={t.textMuted} style={{ marginBottom: spacing.md }}>
                Compare two variations on alternating days to find your peak consistency.
              </Caption>

              <View style={styles.presetsList}>
                {PRESETS.map((preset) => {
                  const active = selectedPreset === preset.id;
                  return (
                    <Pressable
                      key={preset.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedPreset(preset.id);
                        setDuration(preset.defaultDuration);
                      }}
                      style={[
                        styles.presetCard,
                        {
                          backgroundColor: active ? neonLime + "15" : t.background,
                          borderColor: active ? neonLime : t.borderLight,
                        },
                      ]}
                    >
                      <View style={styles.presetTop}>
                        <Body
                          variant="subhead"
                          style={{ fontWeight: "700", color: active ? neonLime : t.textPrimary, flex: 1 }}
                        >
                          {preset.title}
                        </Body>
                        {active && (
                          <View style={[styles.activeDot, { backgroundColor: neonLime }]} />
                        )}
                      </View>
                      <Caption variant="caption2" color={t.textSecondary} style={{ marginTop: 4 }}>
                        {preset.description}
                      </Caption>
                      <View style={styles.splitBadges}>
                        <View style={[styles.variantPill, { backgroundColor: t.card }]}>
                          <Text style={[styles.variantPillText, { color: active ? neonLime : t.textSecondary }]}>
                            🅰️ {preset.variantA.label}
                          </Text>
                        </View>
                        <Text style={{ color: t.textMuted, fontSize: 11 }}>vs</Text>
                        <View style={[styles.variantPill, { backgroundColor: t.card }]}>
                          <Text style={[styles.variantPillText, { color: active ? "#60A5FA" : t.textSecondary }]}>
                            🅱️ {preset.variantB.label}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}

                {/* Custom Preset Option */}
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedPreset("custom");
                  }}
                  style={[
                    styles.presetCard,
                    {
                      backgroundColor: selectedPreset === "custom" ? neonLime + "15" : t.background,
                      borderColor: selectedPreset === "custom" ? neonLime : t.borderLight,
                    },
                  ]}
                >
                  <View style={styles.presetTop}>
                    <Body
                      variant="subhead"
                      style={{ fontWeight: "700", color: selectedPreset === "custom" ? neonLime : t.textPrimary }}
                    >
                      🛠️ Custom Routine Test
                    </Body>
                    {selectedPreset === "custom" && (
                      <View style={[styles.activeDot, { backgroundColor: neonLime }]} />
                    )}
                  </View>
                  <Caption variant="caption2" color={t.textSecondary} style={{ marginTop: 4 }}>
                    Define your own custom labels for Variant A and Variant B.
                  </Caption>

                  {selectedPreset === "custom" && (
                    <View style={styles.customInputs}>
                      <TextInput
                        style={[styles.input, { backgroundColor: t.card, color: t.textPrimary, borderColor: t.borderLight }]}
                        placeholder="Experiment Title (e.g. Before vs After Work)"
                        placeholderTextColor={t.textMuted}
                        value={customName}
                        onChangeText={setCustomName}
                      />
                      <TextInput
                        style={[styles.input, { backgroundColor: t.card, color: t.textPrimary, borderColor: t.borderLight }]}
                        placeholder="Variant A Label (e.g. Morning 7:00 AM)"
                        placeholderTextColor={t.textMuted}
                        value={labelA}
                        onChangeText={setLabelA}
                      />
                      <TextInput
                        style={[styles.input, { backgroundColor: t.card, color: t.textPrimary, borderColor: t.borderLight }]}
                        placeholder="Variant B Label (e.g. Evening 6:00 PM)"
                        placeholderTextColor={t.textMuted}
                        value={labelB}
                        onChangeText={setLabelB}
                      />
                    </View>
                  )}
                </Pressable>
              </View>
            </View>

            {/* Duration Selector */}
            <View style={styles.section}>
              <Body variant="headline" style={{ marginBottom: spacing.xs }}>
                Experiment Duration
              </Body>
              <Caption variant="caption2" color={t.textMuted} style={{ marginBottom: spacing.sm }}>
                We recommend 14 days for statistically meaningful routine results.
              </Caption>
              <View style={styles.durationRow}>
                {[7, 14, 21].map((days) => {
                  const active = duration === days;
                  return (
                    <Pressable
                      key={days}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setDuration(days);
                      }}
                      style={[
                        styles.durationBtn,
                        {
                          backgroundColor: active ? neonLime : t.background,
                          borderColor: active ? neonLime : t.borderLight,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.durationNum,
                          { color: active ? "#000000" : t.textPrimary, fontWeight: "800" },
                        ]}
                      >
                        {days}
                      </Text>
                      <Text
                        style={[
                          styles.durationDays,
                          { color: active ? "#000000" : t.textMuted },
                        ]}
                      >
                        Days
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={[styles.footer, { borderTopColor: t.borderLight }]}>
            <Button
              title={saving ? "Starting..." : "Launch A/B Experiment"}
              onPress={handleStart}
              disabled={saving}
              loading={saving}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    maxHeight: "88%",
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: spacing.xl,
    paddingBottom: spacing.md,
  },
  kicker: {
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  closeBtn: {
    padding: spacing.xs,
    borderRadius: radius.full,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.xs,
  },
  presetsList: {
    gap: spacing.sm,
  },
  presetCard: {
    borderWidth: 1.5,
    borderRadius: radius.xl,
    padding: spacing.md,
    gap: spacing.xs,
  },
  presetTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  splitBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: spacing.xs,
  },
  variantPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.md,
  },
  variantPillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  customInputs: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
  },
  durationRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  durationBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  durationNum: {
    fontSize: 20,
  },
  durationDays: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  footer: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
