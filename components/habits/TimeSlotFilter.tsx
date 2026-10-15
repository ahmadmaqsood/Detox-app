import type { TimeSlot } from "@/lib/types";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type TimeSlotSelection = TimeSlot | "all";

interface TimeSlotFilterProps {
  selected: TimeSlotSelection;
  onChange: (slot: TimeSlotSelection) => void;
  counts?: Partial<Record<TimeSlotSelection, number>>;
}

const SLOTS: { label: string; value: TimeSlotSelection; icon: string }[] = [
  { label: "All", value: "all", icon: "sparkles" },
  { label: "Morning", value: "morning", icon: "sunny-outline" },
  { label: "Afternoon", value: "afternoon", icon: "partly-sunny-outline" },
  { label: "Evening", value: "evening", icon: "moon-outline" },
];

export function TimeSlotFilter({ selected, onChange, counts }: TimeSlotFilterProps) {
  const t = useAppTheme();
  const neonLime = "#D4FE33";

  return (
    <View style={styles.container}>
      {SLOTS.map((slot) => {
        const isSelected = selected === slot.value;
        const count = counts?.[slot.value];
        return (
          <Pressable
            key={slot.value}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(slot.value);
            }}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: isSelected ? neonLime + "18" : t.card,
                borderColor: isSelected ? neonLime : t.borderLight,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: isSelected ? neonLime : t.textSecondary },
                isSelected && { fontWeight: "700" },
              ]}
            >
              {slot.label}
              {count != null && count > 0 ? ` (${count})` : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    marginVertical: spacing.sm,
  },
  pill: {
    flex: 1,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
});
