import type { Habit, HabitDifficultyTier } from "@/lib/types";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

interface ConsistencyRecoveryBannerProps {
  habit: Habit;
  onRecover: (habitId: number, tier: HabitDifficultyTier) => void;
  onDismiss?: () => void;
}

export function ConsistencyRecoveryBanner({
  habit,
  onRecover,
  onDismiss,
}: ConsistencyRecoveryBannerProps) {
  const t = useAppTheme();
  const minText = habit.difficultyLevels?.minimum ?? "5-minute version";
  const neonLime = "#D4FE33";

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.wrapper}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: "#20251A",
            borderColor: neonLime + "40",
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={[styles.badge, { backgroundColor: neonLime + "20" }]}>
            <Ionicons name="shield-half" size={14} color={neonLime} />
            <Text style={[styles.badgeText, { color: neonLime }]}>STREAK RECOVERY</Text>
          </View>
          {onDismiss && (
            <Pressable onPress={onDismiss} hitSlop={8}>
              <Ionicons name="close" size={16} color={t.textMuted} />
            </Pressable>
          )}
        </View>

        <Text style={[styles.title, { color: t.textPrimary }]}>
          Protect momentum for &ldquo;{habit.name}&rdquo;
        </Text>
        <Text style={[styles.subtitle, { color: t.textSecondary }]}>
          Missed yesterday? You don&rsquo;t have to reset to 0. Complete the{" "}
          <Text style={{ color: neonLime, fontWeight: "700" }}>{minText}</Text> today to shield your consistency.
        </Text>

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onRecover(habit.id, "minimum");
            }}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: neonLime },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="checkmark-circle" size={16} color="#0F140A" />
            <Text style={styles.actionBtnText}>Complete Minimum ({minText})</Text>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: spacing.xs,
  },
  container: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: 4,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.md,
  },
  actionBtnText: {
    color: "#0F140A",
    fontSize: 12,
    fontWeight: "800",
  },
});
