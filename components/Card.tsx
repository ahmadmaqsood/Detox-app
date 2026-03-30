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
    { backgroundColor: elevated ? t.cardElevated : t.card },
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
