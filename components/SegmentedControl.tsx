import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/theme';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';
import { useEffect } from 'react';

interface SegmentedControlProps<T extends string> {
  segments: { label: string; value: T }[];
  selected: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  segments,
  selected,
  onChange,
}: SegmentedControlProps<T>) {
  const t = useAppTheme();
  const selectedIndex = segments.findIndex((s) => s.value === selected);
  const translateX = useSharedValue(0);
  const segmentWidth = useSharedValue(0);
  const indicatorScale = useSharedValue(1);

  useEffect(() => {
    if (segmentWidth.value > 0) {
      indicatorScale.value = withSpring(0.95, { damping: 15, stiffness: 300 }, () => {
        indicatorScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      });
      translateX.value = withSpring(selectedIndex * segmentWidth.value, {
        damping: 16,
        stiffness: 200,
        mass: 0.8,
      });
    }
  }, [selectedIndex, segmentWidth.value]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scaleY: indicatorScale.value },
    ],
    width: segmentWidth.value,
  }));

  return (
    <View
      style={[styles.container, { backgroundColor: t.card }]}
      onLayout={(e) => {
        const w = (e.nativeEvent.layout.width - spacing.xs * 2) / segments.length;
        segmentWidth.value = w;
        translateX.value = selectedIndex * w;
      }}
    >
      <Animated.View
        style={[
          styles.indicator,
          { backgroundColor: t.accent },
          indicatorStyle,
        ]}
      />

      {segments.map((seg) => {
        const isActive = seg.value === selected;
        return (
          <Pressable
            key={seg.value}
            style={styles.segment}
            onPress={() => {
              if (seg.value !== selected) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onChange(seg.value);
              }
            }}
          >
            <Animated.Text
              style={[
                styles.label,
                { color: isActive ? t.textInverse : t.textSecondary },
              ]}
            >
              {seg.label}
            </Animated.Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: spacing.xs,
    position: 'relative',
  },
  indicator: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    bottom: spacing.xs,
    borderRadius: radius.sm,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    zIndex: 1,
  },
  label: {
    ...typography.subhead,
    fontWeight: '600',
  },
});
