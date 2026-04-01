import { View, ViewProps, StyleSheet, Platform } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useAppTheme } from '@/theme';
import { spacing, radius } from '@/theme/spacing';

interface CardProps extends ViewProps {
  elevated?: boolean;
  animated?: boolean;
  pressable?: boolean;
  delay?: number;
}

function withAlpha(color: string, alpha: number): string {
  // Accepts '#RRGGBB' or 'rgba(...)'. If not hex, return as-is.
  if (!color.startsWith("#") || (color.length !== 7 && color.length !== 4)) return color;
  const hex =
    color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function Card({
  style,
  elevated,
  animated,
  pressable,
  delay = 0,
  children,
  ...props
}: CardProps) {
  const t = useAppTheme();
  const scale = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const cardStyle = [
    styles.base,
    {
      backgroundColor: elevated ? withAlpha(t.cardElevated, 0.82) : withAlpha(t.card, 0.72),
      borderColor: withAlpha("#FFFFFF", 0.10),
    },
    styles.glass,
    elevated && styles.elevated,
    style,
  ];

  if (animated || pressable) {
    return (
      <Animated.View
        entering={FadeInDown.delay(delay).springify().damping(20).stiffness(120)}
        style={[pressable && pressStyle, cardStyle]}
        onTouchStart={
          pressable
            ? () => { scale.value = withSpring(0.97, { damping: 15, stiffness: 300 }); }
            : undefined
        }
        onTouchEnd={
          pressable
            ? () => { scale.value = withSpring(1, { damping: 12, stiffness: 200 }); }
            : undefined
        }
        onTouchCancel={
          pressable
            ? () => { scale.value = withSpring(1, { damping: 12, stiffness: 200 }); }
            : undefined
        }
        {...props}
      >
        {children}
      </Animated.View>
    );
  }

  return (
    <View style={cardStyle} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
    }),
  },
  glass: {
    borderWidth: 1,
  },
  elevated: {
    ...Platform.select({
      ios: {
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
      android: {
        elevation: 8,
      },
      default: {
        shadowOpacity: 0.25,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
      },
    }),
  },
});
