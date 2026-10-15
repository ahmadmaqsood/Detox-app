import type { Mode } from "@/lib/types";
import { STANDARD_MODES } from "@/store/ModeContext";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface AdaptiveContextChipsProps {
  currentMode: Mode;
  onSelectMode: (mode: Mode) => void;
}

export function AdaptiveContextChips({ currentMode, onSelectMode }: AdaptiveContextChipsProps) {
  const t = useAppTheme();
  const neonLime = "#D4FE33";

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {STANDARD_MODES.map((item) => {
          const isSelected = currentMode === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelectMode(item.value);
              }}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: isSelected ? neonLime : t.card,
                  borderColor: isSelected ? neonLime : t.borderLight,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Ionicons
                name={item.icon as any}
                size={14}
                color={isSelected ? "#0F140A" : t.textSecondary}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? "#0F140A" : t.textPrimary },
                  isSelected && { fontWeight: "700" },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
  },
  scrollContent: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
