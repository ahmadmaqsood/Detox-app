import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";

export function HabitCardSkeleton({
  showProgress = true,
  minimal = false,
}: {
  showProgress?: boolean;
  minimal?: boolean;
}) {
  const t = useAppTheme();
  const pulse = useSharedValue(0.35);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 750, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const boneColor = t.border;

  return (
    <View style={[styles.card, { backgroundColor: t.card }]}>
      <View style={styles.row}>
        {/* Icon box bone */}
        <Animated.View
          style={[
            styles.iconBox,
            { backgroundColor: boneColor },
            pulseStyle,
          ]}
        />

        {/* Text lines bone */}
        <View style={styles.titleCol}>
          <Animated.View
            style={[
              styles.titleLine,
              { backgroundColor: boneColor },
              pulseStyle,
            ]}
          />
          {!minimal && (
            <Animated.View
              style={[
                styles.subtitleLine,
                { backgroundColor: boneColor },
                pulseStyle,
              ]}
            />
          )}
        </View>

        {/* Checkbox bone */}
        <Animated.View
          style={[
            styles.checkbox,
            { backgroundColor: boneColor },
            pulseStyle,
          ]}
        />
      </View>

      {/* Progress bar bone */}
      {showProgress && (
        <View style={styles.progressBlock}>
          <Animated.View
            style={[
              styles.progressBar,
              { backgroundColor: boneColor },
              pulseStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.captionLine,
              { backgroundColor: boneColor },
              pulseStyle,
            ]}
          />
        </View>
      )}
    </View>
  );
}

export function HabitsLoadingSkeleton({
  count = 4,
  showProgress = true,
  minimal = false,
}: {
  count?: number;
  showProgress?: boolean;
  minimal?: boolean;
}) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <Animated.View entering={FadeIn.duration(200)} style={styles.list}>
      {items.map((key) => (
        <HabitCardSkeleton
          key={key}
          showProgress={showProgress}
          minimal={minimal}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
  },
  titleCol: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: "center",
  },
  titleLine: {
    height: 16,
    borderRadius: radius.sm,
    width: "70%",
  },
  subtitleLine: {
    height: 12,
    borderRadius: radius.sm,
    width: "42%",
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  progressBlock: {
    gap: spacing.xs,
    marginTop: 2,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    width: "100%",
  },
  captionLine: {
    height: 10,
    borderRadius: radius.sm,
    width: 50,
  },
});
