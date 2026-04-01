import { Platform, Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { PlatformSymbol } from "@/components/PlatformSymbol";
import { coachStyles as styles } from "@/components/coach/styles";
import { useAppTheme } from "@/theme";
import { spacing } from "@/theme/spacing";

export function SendButton({
  onPress,
  enabled,
}: {
  onPress: () => void;
  enabled: boolean;
}) {
  const t = useAppTheme();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        animStyle,
        { marginBottom: Platform.OS === "ios" ? spacing.xxs : 0 },
      ]}
    >
      <Pressable
        onPress={() => {
          scale.value = withSpring(0.8, { damping: 8, stiffness: 400 }, () => {
            scale.value = withSpring(1, { damping: 10, stiffness: 200 });
          });
          onPress();
        }}
        disabled={!enabled}
        style={[
          styles.sendBtn,
          { backgroundColor: enabled ? t.accent : t.border },
        ]}
      >
        <PlatformSymbol
          ios="arrow.up"
          material="arrow-upward"
          tintColor={enabled ? t.textInverse : t.textMuted}
          size={18}
        />
      </Pressable>
    </Animated.View>
  );
}
