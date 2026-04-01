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
import { Caption, Heading } from "@/components/Typography";
import { coachStyles as styles } from "@/components/coach/styles";
import { spacing } from "@/theme/spacing";
import { useAppTheme } from "@/theme";

export function CoachHeader() {
  const t = useAppTheme();
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1500 }),
        withTiming(1, { duration: 1500 }),
      ),
      -1,
      true,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      style={styles.chatHeader}
    >
      <Animated.View style={pulseStyle}>
        <View
          style={[styles.coachAvatarOuter, { borderColor: t.accent + "25" }]}
        >
          <View style={[styles.coachAvatar, { backgroundColor: t.accent + "18" }]}>
            <PlatformSymbol
              ios="brain.head.profile.fill"
              material="psychology"
              tintColor={t.accent}
              size={28}
            />
          </View>
        </View>
      </Animated.View>

      <Heading variant="title3">AI Coach</Heading>

      <View style={[styles.onlineBadge, { backgroundColor: t.accent + "20" }]}>
        <View style={[styles.onlineDot, { backgroundColor: t.accent }]} />
        <Caption
          variant="caption2"
          color={t.accent}
          style={{ fontWeight: "600" }}
        >
          Online
        </Caption>
      </View>

      <Caption
        variant="footnote"
        color={t.textMuted}
        style={{ textAlign: "center", maxWidth: 260 }}
      >
        Direct. No excuses. Action only.
      </Caption>

      <View
        style={[
          styles.headerDivider,
          { backgroundColor: t.border, marginBottom: spacing.xs },
        ]}
      />
    </Animated.View>
  );
}

