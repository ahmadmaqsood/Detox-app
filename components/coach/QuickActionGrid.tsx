import { Pressable, View } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";

import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Caption } from "@/components/Typography";
import type { QuickAction } from "@/lib/coachQuickActions";
import { coachStyles as styles } from "@/components/coach/styles";
import { useAppTheme } from "@/theme";

export function QuickActionGrid({
  actions,
  onPress,
  disabled,
}: {
  actions: QuickAction[];
  onPress: (a: QuickAction) => void;
  disabled: boolean;
}) {
  const t = useAppTheme();

  return (
    <View style={styles.quickGrid}>
      <Caption variant="footnote" color={t.textMuted} style={styles.quickLabel}>
        Quick actions
      </Caption>
      <View style={styles.quickRow}>
        {actions.map((action, i) => (
          <Animated.View
            key={action.label}
            entering={FadeInRight.delay(200 + i * 80).springify().damping(16)}
            style={{ width: "48%" }}
          >
            <Pressable
              onPress={() => onPress(action)}
              disabled={disabled}
              style={({ pressed }) => [
                styles.quickCard,
                {
                  backgroundColor: t.card,
                  borderColor: action.color + "30",
                  opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.quickIconWrap,
                  { backgroundColor: action.color + "18" },
                ]}
              >
                <PlatformSymbol
                  ios={action.icon.ios}
                  material={action.icon.android}
                  tintColor={action.color}
                  size={18}
                />
              </View>
              <Caption
                variant="caption2"
                color={t.textPrimary}
                style={{ fontWeight: "600", textAlign: "center" }}
              >
                {action.label}
              </Caption>
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

