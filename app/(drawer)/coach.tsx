import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInRight,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNavigation } from "expo-router";
import { type DrawerNavigationProp } from "@react-navigation/drawer";

import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import { generateResponse, getAutoMessage } from "@/lib/aiEngine";
import { getUserContext, type UserContext } from "@/lib/contextBuilder";
import type { ChatMessage } from "@/lib/types";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

// ─── Quick Actions ─────────────────────────────────────────────

interface QuickAction {
  label: string;
  message: string;
  icon: { ios: string; android: string; web: string };
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "I feel urge",
    message: "I'm feeling a strong urge right now.",
    icon: {
      ios: "exclamationmark.triangle.fill",
      android: "warning",
      web: "warning",
    },
    color: "#EF4444",
  },
  {
    label: "I'm distracted",
    message: "I can't focus and keep getting distracted.",
    icon: {
      ios: "eyes.inverse",
      android: "visibility_off",
      web: "visibility_off",
    },
    color: "#F59E0B",
  },
  {
    label: "Motivate me",
    message: "I'm feeling low on motivation today.",
    icon: { ios: "bolt.fill", android: "bolt", web: "bolt" },
    color: "#4ADE80",
  },
  {
    label: "I relapsed",
    message: "I relapsed. What should I do now?",
    icon: { ios: "arrow.counterclockwise", android: "refresh", web: "refresh" },
    color: "#818CF8",
  },
];

// ─── Helpers ──────────────────────────────────────────────────

let msgCounter = 0;
function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${++msgCounter}`;
}

function makeMsg(sender: ChatMessage["sender"], text: string): ChatMessage {
  return { id: makeId(sender), text, sender, timestamp: Date.now() };
}

// ─── Welcome ──────────────────────────────────────────────────

const WELCOME: ChatMessage = {
  id: "welcome",
  sender: "ai",
  text: "I'm your coach. Direct. No excuses.\nTell me what's going on or tap a quick action.",
  timestamp: Date.now(),
};

// ────────────────────────────────────────────────────────────────

export default function CoachScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const drawerNav = useNavigation<DrawerNavigationProp<any>>();
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [quickActionsUsed, setQuickActionsUsed] = useState(false);
  const [ctx, setCtx] = useState<UserContext | null>(null);
  const autoTriggeredRef = useRef(false);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
  }, []);

  // Load context on mount + check for auto-messages
  useEffect(() => {
    (async () => {
      const context = await getUserContext();
      setCtx(context);

      if (autoTriggeredRef.current) return;
      autoTriggeredRef.current = true;

      const auto = getAutoMessage(context);
      if (auto) {
        setTimeout(() => {
          setMessages((prev) => [...prev, makeMsg("ai", auto)]);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          scrollToEnd();
        }, 800);
      }
    })();
  }, [scrollToEnd]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isTyping) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const userMsg = makeMsg("user", text.trim());
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);
      scrollToEnd();

      // Fetch fresh context for every response
      const freshCtx = await getUserContext();
      setCtx(freshCtx);

      const delay = 400 + Math.random() * 300;
      setTimeout(() => {
        const reply = generateResponse(text, freshCtx);
        setMessages((prev) => [...prev, makeMsg("ai", reply)]);
        setIsTyping(false);
        scrollToEnd();
      }, delay);
    },
    [isTyping, scrollToEnd],
  );

  const handleSend = useCallback(() => {
    sendMessage(input);
  }, [input, sendMessage]);

  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setQuickActionsUsed(true);
      sendMessage(action.message);
    },
    [sendMessage],
  );

  const showQuickActions = messages.length <= 2 && !quickActionsUsed;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* ─── Header bar ───────────────────────────── */}
      <View style={[styles.screenHeader, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            drawerNav.openDrawer();
          }}
          hitSlop={12}
        >
          <PlatformSymbol
            ios="line.3.horizontal"
            material="menu"
            tintColor={t.textPrimary}
            size={22}
          />
        </Pressable>
        <Heading variant="title3">AI Coach</Heading>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[styles.list, { paddingBottom: spacing.lg }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<CoachHeader t={t} />}
        renderItem={({ item, index }) => (
          <MessageBubble message={item} t={t} index={index} />
        )}
        ListFooterComponent={
          <>
            {isTyping && <TypingIndicator t={t} />}
            {showQuickActions && (
              <QuickActionGrid
                actions={QUICK_ACTIONS}
                onPress={handleQuickAction}
                t={t}
                disabled={isTyping}
              />
            )}
          </>
        }
        onContentSizeChange={scrollToEnd}
      />

      {/* Quick Action Pills (persistent after first use) */}
      {!showQuickActions && (
        <Animated.View entering={FadeIn.duration(200)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillRow}
            style={[styles.pillScroll, { borderTopColor: t.border }]}
          >
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.label}
                onPress={() => handleQuickAction(action)}
                disabled={isTyping}
                style={[
                  styles.pill,
                  { backgroundColor: t.card, opacity: isTyping ? 0.5 : 1 },
                ]}
              >
                <PlatformSymbol
                  ios={action.icon.ios}
                  material={action.icon.android}
                  tintColor={action.color}
                  size={12}
                />
                <Caption
                  variant="caption2"
                  color={t.textSecondary}
                  style={{ fontWeight: "600" }}
                >
                  {action.label}
                </Caption>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Input Bar */}
      <Animated.View
        entering={FadeInUp.duration(300)}
        style={[
          styles.inputBar,
          {
            backgroundColor: t.card,
            borderTopColor: t.border,
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
        ]}
      >
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={[
              styles.input,
              {
                backgroundColor: t.background,
                color: t.textPrimary,
                borderColor: t.border,
              },
            ]}
            value={input}
            onChangeText={setInput}
            placeholder="Talk to your coach..."
            placeholderTextColor={t.textMuted}
            selectionColor={t.accent}
            multiline
            maxLength={500}
            returnKeyType="default"
            editable={!isTyping}
          />
          <SendButton
            onPress={handleSend}
            enabled={!!input.trim() && !isTyping}
            t={t}
          />
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

// ─── Send Button ────────────────────────────────────────────────

function SendButton({
  onPress,
  enabled,
  t,
}: {
  onPress: () => void;
  enabled: boolean;
  t: ReturnType<typeof useAppTheme>;
}) {
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

// ─── Coach Header ──────────────────────────────────────────────

function CoachHeader({ t }: { t: ReturnType<typeof useAppTheme> }) {
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
          <View
            style={[styles.coachAvatar, { backgroundColor: t.accent + "18" }]}
          >
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
      <View style={[styles.headerDivider, { backgroundColor: t.border }]} />
    </Animated.View>
  );
}

// ─── Quick Action Grid ─────────────────────────────────────────

function QuickActionGrid({
  actions,
  onPress,
  t,
  disabled,
}: {
  actions: QuickAction[];
  onPress: (a: QuickAction) => void;
  t: ReturnType<typeof useAppTheme>;
  disabled: boolean;
}) {
  return (
    <View style={styles.quickGrid}>
      <Caption variant="footnote" color={t.textMuted} style={styles.quickLabel}>
        Quick actions
      </Caption>
      <View style={styles.quickRow}>
        {actions.map((action, i) => (
          <Animated.View
            key={action.label}
            entering={FadeInRight.delay(200 + i * 80)
              .springify()
              .damping(16)}
            style={{ flex: 1 }}
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

// ─── Message Bubble ────────────────────────────────────────────

function MessageBubble({
  message,
  t,
  index,
}: {
  message: ChatMessage;
  t: ReturnType<typeof useAppTheme>;
  index: number;
}) {
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

// ─── Typing Indicator ──────────────────────────────────────────

function TypingIndicator({ t }: { t: ReturnType<typeof useAppTheme> }) {
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

// ─── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },

  chatHeader: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    gap: spacing.sm,
  },
  coachAvatarOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  coachAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerDivider: {
    width: 40,
    height: 2,
    borderRadius: 1,
    marginTop: spacing.sm,
  },

  quickGrid: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  quickLabel: {
    textAlign: "center",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  quickRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  quickCard: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  quickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  pillScroll: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pillRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },

  bubbleRow: {
    flexDirection: "row",
    marginBottom: spacing.md,
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  bubbleRowUser: {
    justifyContent: "flex-end",
  },
  bubbleRowCoach: {
    justifyContent: "flex-start",
  },
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xxs,
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  bubbleUser: {
    borderRadius: radius.xl,
    borderBottomRightRadius: 6,
  },
  bubbleCoach: {
    borderRadius: radius.xl,
    borderBottomLeftRadius: 6,
  },
  bubbleTime: {
    alignSelf: "flex-end",
  },

  typingDots: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  inputBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === "ios" ? spacing.md : spacing.sm,
    maxHeight: 120,
    ...typography.callout,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
