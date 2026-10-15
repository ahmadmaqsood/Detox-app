import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Caption } from "@/components/Typography";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import type { AnalyticsTimeRange } from "@/lib/progressAnalyticsService";

interface TimeRangeFilterProps {
  selectedRange: AnalyticsTimeRange;
  onSelect: (range: AnalyticsTimeRange) => void;
}

const RANGES: { id: AnalyticsTimeRange; label: string }[] = [
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "3M" },
  { id: "180d", label: "6M" },
  { id: "365d", label: "1Y" },
];

export function TimeRangeFilter({ selectedRange, onSelect }: TimeRangeFilterProps) {
  const t = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: "#111726", borderColor: "#1E293B" }]}>
      {RANGES.map((r) => {
        const isSelected = selectedRange === r.id;
        return (
          <Pressable
            key={r.id}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(r.id);
            }}
            style={[
              styles.pill,
              isSelected && {
                backgroundColor: "#10B98125",
                borderColor: "#10B981",
              },
            ]}
          >
            <Caption
              variant="caption2"
              color={isSelected ? "#10B981" : t.textMuted}
              style={{ fontWeight: isSelected ? "700" : "500" }}
            >
              {r.label}
            </Caption>
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
    padding: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    gap: 4,
  },
  pill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
});
