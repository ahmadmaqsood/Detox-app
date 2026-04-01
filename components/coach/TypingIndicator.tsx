import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { PlatformSymbol } from "@/components/PlatformSymbol";
import { coachStyles as styles } from "@/components/coach/styles";
import { useAppTheme } from "@/theme";

function TypingDot({ delay, color }: { delay: number; color: string }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      translateY.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 300 }),
          withTiming(0, { duration: 300 }),
        ),
        -1,
        false,
      );
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />
  );
}

export function TypingIndicator() {
  const t = useAppTheme();
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      style={[styles.bubbleRow, styles.bubbleRowCoach]}
    >
      <View style={[styles.bubbleAvatar, { backgroundColor: t.accent + "15" }]}>
        <PlatformSymbol
          ios="brain.head.profile.fill"
          material="psychology"
          tintColor={t.accent}
          size={14}
        />
      </View>
      <View
        style={[
          styles.bubble,
          styles.bubbleCoach,
          { backgroundColor: t.cardElevated },
        ]}
      >
        <View style={styles.typingDots}>
          <TypingDot delay={0} color={t.textMuted} />
          <TypingDot delay={150} color={t.textMuted} />
          <TypingDot delay={300} color={t.textMuted} />
        </View>
      </View>
    </Animated.View>
  );
}
