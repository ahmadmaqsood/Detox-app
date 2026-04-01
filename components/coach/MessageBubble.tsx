import { View } from "react-native";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";

import { coachStyles as styles } from "@/components/coach/styles";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption } from "@/components/Typography";
import type { ChatMessage } from "@/lib/types";
import { useAppTheme } from "@/theme";

export function MessageBubble({
  message,
  index,
}: {
  message: ChatMessage;
  index: number;
}) {
  const t = useAppTheme();
  const isUser = message.sender === "user";
  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Animated.View
      entering={
        isUser
          ? FadeInRight.delay(index < 2 ? index * 100 : 0)
              .springify()
              .damping(16)
          : FadeInDown.delay(index < 2 ? index * 100 : 0)
              .springify()
              .damping(16)
      }
      style={[
        styles.bubbleRow,
        isUser ? styles.bubbleRowUser : styles.bubbleRowCoach,
      ]}
    >
      {!isUser && (
        <View
          style={[styles.bubbleAvatar, { backgroundColor: t.accent + "15" }]}
        >
          <PlatformSymbol
            ios="brain.head.profile.fill"
            material="psychology"
            tintColor={t.accent}
            size={14}
          />
        </View>
      )}

      <View
        style={[
          styles.bubble,
          isUser
            ? [styles.bubbleUser, { backgroundColor: t.accent }]
            : [styles.bubbleCoach, { backgroundColor: t.cardElevated }],
        ]}
      >
        <Body
          variant="callout"
          color={isUser ? t.textInverse : t.textPrimary}
          style={{ lineHeight: 22 }}
        >
          {message.text}
        </Body>
        <Caption
          variant="caption2"
          color={isUser ? t.textInverse + "88" : t.textMuted}
          style={styles.bubbleTime}
        >
          {time}
        </Caption>
      </View>
    </Animated.View>
  );
}
