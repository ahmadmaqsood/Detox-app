import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type DrawerNavigationProp } from "@react-navigation/drawer";
import { useNavigation } from "expo-router";

import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Caption, Heading } from "@/components/Typography";
import { CoachHeader } from "@/components/coach/CoachHeader";
import { MessageBubble } from "@/components/coach/MessageBubble";
import { QuickActionGrid } from "@/components/coach/QuickActionGrid";
import { SendButton } from "@/components/coach/SendButton";
import { TypingIndicator } from "@/components/coach/TypingIndicator";
import { coachStyles as styles } from "@/components/coach/styles";
import { generateResponse, getAutoMessage } from "@/lib/aiEngine";
import { COACH_QUICK_ACTIONS } from "@/lib/coachQuickActions";
import { getUserContext, type UserContext } from "@/lib/contextBuilder";
import type { ChatMessage } from "@/lib/types";
import { addCoachChatMessage, getCoachChatMessages } from "@/lib/firestoreDatabase";
import { useAppTheme } from "@/theme";
import { spacing } from "@/theme/spacing";

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

      // Load persisted chat history (Firestore)
      try {
        const saved = await getCoachChatMessages(200);
        if (saved.length > 0) {
          setMessages([WELCOME, ...saved.filter((m) => m.id !== WELCOME.id)]);
          scrollToEnd();
        }
      } catch {
        // Ignore load errors; fallback to in-memory only
      }

      if (autoTriggeredRef.current) return;
      autoTriggeredRef.current = true;

      const auto = getAutoMessage(context);
      if (auto) {
        setTimeout(() => {
          const autoMsg = makeMsg("ai", auto);
          setMessages((prev) => [...prev, autoMsg]);
          addCoachChatMessage(autoMsg).catch(() => {});
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
      addCoachChatMessage(userMsg).catch(() => {});
      setInput("");
      setIsTyping(true);
      scrollToEnd();

      // Fetch fresh context for every response
      const freshCtx = await getUserContext();
      setCtx(freshCtx);

      const delay = 400 + Math.random() * 300;
      setTimeout(() => {
        const reply = generateResponse(text, freshCtx);
        const aiMsg = makeMsg("ai", reply);
        setMessages((prev) => [...prev, aiMsg]);
        addCoachChatMessage(aiMsg).catch(() => {});
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
    (action: (typeof COACH_QUICK_ACTIONS)[number]) => {
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
      <View
        style={[styles.screenHeader, { paddingTop: insets.top + spacing.md }]}
      >
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
        ListHeaderComponent={<CoachHeader />}
        renderItem={({ item, index }) => (
          <MessageBubble message={item} index={index} />
        )}
        ListFooterComponent={
          <>
            {isTyping && <TypingIndicator />}
            {showQuickActions && (
              <QuickActionGrid
                actions={COACH_QUICK_ACTIONS}
                onPress={handleQuickAction}
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
            {COACH_QUICK_ACTIONS.map((action) => (
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
            paddingBottom: insets.bottom + spacing.lg,
            marginBottom: spacing["2xl"],
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
            multiline={false}
            numberOfLines={1}
            scrollEnabled
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            editable={!isTyping}
          />
          <SendButton
            onPress={handleSend}
            enabled={!!input.trim() && !isTyping}
          />
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
