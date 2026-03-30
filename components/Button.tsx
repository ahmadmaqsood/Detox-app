import {
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  ActivityIndicator,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAppTheme } from '@/theme';
import { typography } from '@/theme/typography';
import { spacing, radius } from '@/theme/spacing';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonVariant = 'primary' | 'secondary';
type ButtonSize = 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  title,
  variant = 'primary',
  size = 'lg',
  loading = false,
  fullWidth = true,
  disabled,
  onPress,
  ...props
}: ButtonProps) {
  const t = useAppTheme();
  const scale = useSharedValue(1);
  const shadowOpacity = useSharedValue(0.15);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: shadowOpacity.value,
  }));

  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  const bgColor = isDisabled
    ? t.border
    : isPrimary
      ? t.accent
      : 'transparent';

  const textColor = isDisabled
    ? t.textMuted
    : isPrimary
      ? t.textInverse
      : t.accent;

  const borderColor = isPrimary ? 'transparent' : t.accent;

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 12, stiffness: 350 });
    shadowOpacity.value = withSpring(0.3, { damping: 15, stiffness: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10, stiffness: 200 });
    shadowOpacity.value = withSpring(0.15, { damping: 15, stiffness: 200 });
  };

  const handlePress = (e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(e);
  };

  return (
    <AnimatedPressable
      style={[
        animatedStyle,
        styles.base,
        size === 'md' ? styles.sizeMd : styles.sizeLg,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: bgColor,
          borderColor,
          borderWidth: isPrimary ? 0 : 1.5,
        },
        isPrimary && !isDisabled && [styles.glow, { shadowColor: t.accent }, glowStyle],
      ]}
      disabled={isDisabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text
          style={[
            typography.headline,
            { color: textColor, fontWeight: '700' },
          ]}
        >
          {title}
        </Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  sizeMd: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  sizeLg: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing['2xl'],
  },
  fullWidth: {
    width: '100%',
  },
  glow: {
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
});
