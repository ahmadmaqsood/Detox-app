import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Body, Caption, Heading } from "@/components/Typography";
import { CoachHeader } from "@/components/coach/CoachHeader";
import { MessageBubble } from "@/components/coach/MessageBubble";
import { QuickActionGrid } from "@/components/coach/QuickActionGrid";
import { SendButton } from "@/components/coach/SendButton";
import { TypingIndicator } from "@/components/coach/TypingIndicator";
import { coachStyles as styles } from "@/components/coach/styles";
import { generateResponse, getAutoMessage } from "@/lib/aiEngine";
import {
  exportAllCoachChatsToPdf,
  exportAndPurgeExpiredCoachChats,
} from "@/lib/coachPdfService";
import { COACH_QUICK_ACTIONS } from "@/lib/coachQuickActions";
import { getUserContext, type UserContext } from "@/lib/contextBuilder";
import { addCalendarDays, todayISO } from "@/lib/dateUtils";
import {
  getCoachChatsOlderThan,
  getDailyCoachChat,
  saveCoachExchange,
} from "@/lib/firestoreDatabase";
import type { ChatMessage, CoachExchange, DailyCoachChatDoc } from "@/lib/types";
import { useAppTheme } from "@/theme";
import { spacing } from "@/theme/spacing";

// ─── Helpers ──────────────────────────────────────────────────

let msgCounter = 0;
function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${++msgCounter}`;
}

function formatDateNav(dateIso: string): string {
  try {
    const today = todayISO();
    if (dateIso === today) return "Today";
    const yesterday = addCalendarDays(today, -1);
    if (dateIso === yesterday) return "Yesterday";
    const d = new Date(dateIso + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateIso;
  }
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

  // Daily Date State
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const isToday = selectedDate === todayISO();

  // Exchanges for the selected day
  const [exchanges, setExchanges] = useState<CoachExchange[]>([]);
  const [pendingUserMsg, setPendingUserMsg] = useState<ChatMessage | null>(null);

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [quickActionsUsed, setQuickActionsUsed] = useState(false);
  const [ctx, setCtx] = useState<UserContext | null>(null);
  const [expiredChats, setExpiredChats] = useState<DailyCoachChatDoc[]>([]);
  const [isArchiving, setIsArchiving] = useState(false);
  const autoTriggeredRef = useRef(false);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
  }, []);

  // Check on mount for chats older than 30 days
  const checkExpiredChats = useCallback(async () => {
    try {
      const expired = await getCoachChatsOlderThan(30);
      setExpiredChats(expired);
    } catch (err) {
      console.warn("Check expired coach chats failed:", err);
    }
  }, []);

  useEffect(() => {
    checkExpiredChats();
  }, [checkExpiredChats]);

  // Load daily chat for the selected date
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const dayDoc = await getDailyCoachChat(selectedDate);
        if (isMounted) {
          setExchanges(dayDoc?.exchanges ?? []);
          scrollToEnd();
        }
      } catch (err) {
        console.warn("Failed loading daily coach chat:", err);
        if (isMounted) setExchanges([]);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [selectedDate, scrollToEnd]);

  // Load context on mount + check for auto-messages on today's chat
  useEffect(() => {
    (async () => {
      const context = await getUserContext();
      setCtx(context);

      if (autoTriggeredRef.current) return;
      autoTriggeredRef.current = true;

      const auto = getAutoMessage(context);
      if (auto) {
        setTimeout(async () => {
          const autoExchange: CoachExchange = {
            id: makeId("auto"),
            userMessage: "",
            userTimestamp: Date.now(),
            assistantReply: auto,
            assistantTimestamp: Date.now(),
          };
          setExchanges((prev) => {
            if (prev.length === 0) {
              saveCoachExchange(autoExchange, todayISO()).catch(() => {});
              return [autoExchange];
            }
            return prev;
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          scrollToEnd();
        }, 800);
      }
    })();
  }, [scrollToEnd]);

  // Date switching
  const changeDate = useCallback((deltaDays: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDate((prev) => {
      const next = addCalendarDays(prev, deltaDays);
      const today = todayISO();
      if (next > today) return today;
      return next;
    });
  }, []);

  // Send message: pairs user message and AI reply into a single CoachExchange object
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isTyping) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const userText = text.trim();
      const userTimestamp = Date.now();
      const exchangeId = makeId("ex");

      const pendingMsg: ChatMessage = {
        id: `${exchangeId}-user`,
        sender: "user",
        text: userText,
        timestamp: userTimestamp,
      };

      setPendingUserMsg(pendingMsg);
      setInput("");
      setIsTyping(true);
      scrollToEnd();

      // Fetch fresh context for every response
      const freshCtx = await getUserContext();
      setCtx(freshCtx);

      const delay = 450 + Math.random() * 300;
      setTimeout(async () => {
        const reply = generateResponse(userText, freshCtx);
        const assistantTimestamp = Date.now();

        // Single object containing both user message and AI reply
        const newExchange: CoachExchange = {
          id: exchangeId,
          userMessage: userText,
          userTimestamp,
          assistantReply: reply,
          assistantTimestamp,
        };

        try {
          await saveCoachExchange(newExchange, selectedDate);
        } catch (err) {
          console.warn("Failed saving coach exchange:", err);
        }

        setExchanges((prev) => [...prev, newExchange]);
        setPendingUserMsg(null);
        setIsTyping(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        scrollToEnd();
      }, delay);
    },
    [isTyping, selectedDate, scrollToEnd],
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

  // 30-Day Lifecycle: PDF download FIRST, then Firestore deletion
  const handleArchiveAndPurge = useCallback(async () => {
    if (expiredChats.length === 0) {
      Alert.alert(
        "No Expired Chats",
        "All coach chats are currently within the 30-day retention period.",
      );
      return;
    }

    Alert.alert(
      "30-Day Chat Cycle Complete",
      `You have ${expiredChats.length} day(s) of chat older than 30 days.\n\nFollowing policy:\n1. Expired chats will be downloaded as a PDF first.\n2. Only after PDF export succeeds will expired docs be deleted from Firestore.\n\nProceed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Download PDF & Clean Up",
          style: "destructive",
          onPress: async () => {
            setIsArchiving(true);
            try {
              const res = await exportAndPurgeExpiredCoachChats(30);
              if (res.pdfGenerated) {
                await checkExpiredChats();
                Alert.alert(
                  "Archive Completed Successfully",
                  `Downloaded PDF archive for ${res.archivedCount} day(s) of chat, and purged expired documents from Firestore.`,
                );
              } else if (res.error) {
                Alert.alert(
                  "Export Aborted",
                  `${res.error}\n\nNo Firestore documents were deleted because PDF generation was not completed.`,
                );
              }
            } catch (err: any) {
              Alert.alert(
                "Export Error",
                err?.message || "Failed to complete 30-day archive.",
              );
            } finally {
              setIsArchiving(false);
            }
          },
        },
      ],
    );
  }, [expiredChats, checkExpiredChats]);

  // Export menu in header
  const handleExportMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "AI Coach History & PDF",
      "Manage your chat backups and 30-day lifecycle:",
      [
        {
          text: "Download All Chats (PDF)",
          onPress: async () => {
            setIsArchiving(true);
            try {
              const res = await exportAllCoachChatsToPdf();
              if (res.success) {
                Alert.alert(
                  "Success",
                  `Exported ${res.totalDays} day(s) of AI Coach chats to PDF.`,
                );
              } else {
                Alert.alert("Export Notice", res.error || "No chats to export.");
              }
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Failed to generate PDF.");
            } finally {
              setIsArchiving(false);
            }
          },
        },
        {
          text:
            expiredChats.length > 0
              ? `Purge Expired (>30 Days) (${expiredChats.length})`
              : "Check 30-Day Purge",
          onPress: handleArchiveAndPurge,
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  }, [expiredChats, handleArchiveAndPurge]);

  // Build display message list
  const displayMessages: ChatMessage[] = [];
  if (exchanges.length === 0 && !pendingUserMsg) {
    if (isToday) {
      displayMessages.push(WELCOME);
    }
  } else {
    for (const ex of exchanges) {
      if (ex.userMessage) {
        displayMessages.push({
          id: `${ex.id}-user`,
          text: ex.userMessage,
          sender: "user",
          timestamp: ex.userTimestamp,
        });
      }
      if (ex.assistantReply) {
        displayMessages.push({
          id: `${ex.id}-ai`,
          text: ex.assistantReply,
          sender: "ai",
          timestamp: ex.assistantTimestamp,
        });
      }
    }
  }
  if (pendingUserMsg) {
    displayMessages.push(pendingUserMsg);
  }

  const showQuickActions = exchanges.length === 0 && !quickActionsUsed && isToday;

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
          style={styles.headerIconBtn}
        >
          <PlatformSymbol
            ios="line.3.horizontal"
            material="menu"
            tintColor={t.textPrimary}
            size={22}
          />
        </Pressable>

        <Heading variant="title3">AI Coach</Heading>

        <Pressable
          onPress={handleExportMenu}
          hitSlop={12}
          disabled={isArchiving}
          style={[styles.headerIconBtn, { backgroundColor: t.card }]}
        >
          {isArchiving ? (
            <ActivityIndicator size="small" color={t.accent} />
          ) : (
            <PlatformSymbol
              ios="doc.text.fill"
              material="picture-as-pdf"
              tintColor={t.accent}
              size={20}
            />
          )}
        </Pressable>
      </View>

      {/* ─── Date Navigation Bar (Daily Chat Box) ─── */}
      <View
        style={[
          styles.dateNavContainer,
          { borderBottomColor: t.border, backgroundColor: t.card },
        ]}
      >
        <Pressable
          onPress={() => changeDate(-1)}
          hitSlop={8}
          style={[styles.dateNavArrow, { backgroundColor: t.background }]}
        >
          <PlatformSymbol
            ios="chevron.left"
            material="chevron-left"
            tintColor={t.textPrimary}
            size={18}
          />
        </Pressable>

        <View style={styles.dateNavCenter}>
          <PlatformSymbol
            ios="calendar"
            material="event"
            tintColor={t.accent}
            size={15}
          />
          <Body
            variant="subhead"
            style={{ fontWeight: "700" }}
            color={t.textPrimary}
          >
            {formatDateNav(selectedDate)}
          </Body>
          {isToday ? (
            <View style={[styles.dateBadge, { backgroundColor: t.accent + "18" }]}>
              <View style={[styles.onlineDot, { backgroundColor: t.accent }]} />
              <Caption
                variant="caption2"
                color={t.accent}
                style={{ fontWeight: "700" }}
              >
                Today's Box
              </Caption>
            </View>
          ) : (
            <View style={[styles.dateBadge, { backgroundColor: t.cardElevated }]}>
              <Caption
                variant="caption2"
                color={t.textMuted}
                style={{ fontWeight: "600" }}
              >
                Past Archive
              </Caption>
            </View>
          )}
        </View>

        <Pressable
          onPress={() => changeDate(1)}
          disabled={isToday}
          hitSlop={8}
          style={[
            styles.dateNavArrow,
            { backgroundColor: t.background, opacity: isToday ? 0.3 : 1 },
          ]}
        >
          <PlatformSymbol
            ios="chevron.right"
            material="chevron-right"
            tintColor={t.textPrimary}
            size={18}
          />
        </Pressable>
      </View>

      {/* Past Day Notice Banner */}
      {!isToday && (
        <View
          style={[
            styles.pastDayBanner,
            { backgroundColor: t.cardElevated, borderBottomColor: t.border },
          ]}
        >
          <Caption variant="caption2" color={t.textSecondary}>
            Viewing history from {selectedDate}
          </Caption>
          <Pressable
            onPress={() => setSelectedDate(todayISO())}
            style={[styles.jumpTodayBtn, { backgroundColor: t.accent }]}
          >
            <Caption variant="caption2" style={{ fontWeight: "700", color: "#fff" }}>
              Back to Today
            </Caption>
          </Pressable>
        </View>
      )}

      {/* ─── 30-Day Cycle Archive Banner (PDF First, Then Delete) ─── */}
      {expiredChats.length > 0 && (
        <Animated.View
          entering={FadeIn.duration(250)}
          style={[
            styles.archiveBanner,
            {
              backgroundColor: t.cardElevated,
              borderColor: t.warning + "45",
            },
          ]}
        >
          <View style={styles.archiveBannerContent}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <PlatformSymbol
                ios="archivebox.fill"
                material="archive"
                tintColor={t.warning}
                size={16}
              />
              <Body
                variant="subhead"
                style={{ fontWeight: "700" }}
                color={t.textPrimary}
              >
                30-Day Chat Cycle
              </Body>
            </View>
            <Caption variant="caption2" color={t.textSecondary}>
              {expiredChats.length} day(s) older than 30 days. PDF backup downloads first before cleaning Firestore.
            </Caption>
          </View>

          <Pressable
            onPress={handleArchiveAndPurge}
            disabled={isArchiving}
            style={[
              styles.archiveActionBtn,
              { backgroundColor: t.warning, opacity: isArchiving ? 0.6 : 1 },
            ]}
          >
            {isArchiving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <PlatformSymbol
                  ios="arrow.down.doc.fill"
                  material="file-download"
                  tintColor="#fff"
                  size={13}
                />
                <Caption
                  variant="caption2"
                  style={{ fontWeight: "700", color: "#fff" }}
                >
                  Download PDF
                </Caption>
              </>
            )}
          </Pressable>
        </Animated.View>
      )}

      {/* ─── Messages List ────────────────────────── */}
      <FlatList
        ref={flatListRef}
        data={displayMessages}
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
            {!isToday && exchanges.length === 0 && (
              <View style={styles.emptyDayContainer}>
                <PlatformSymbol
                  ios="bubble.left.and.bubble.right"
                  material="chat"
                  tintColor={t.textMuted}
                  size={36}
                />
                <Caption variant="footnote" color={t.textMuted}>
                  No coach messages recorded on this date.
                </Caption>
              </View>
            )}
          </>
        }
        onContentSizeChange={scrollToEnd}
      />

      {/* Quick Action Pills (persistent after first use on Today) */}
      {!showQuickActions && isToday && (
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

      {/* ─── Input Bar ────────────────────────────── */}
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
        {isToday ? (
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
        ) : (
          <Pressable
            onPress={() => setSelectedDate(todayISO())}
            style={[
              styles.inputRow,
              {
                justifyContent: "center",
                paddingVertical: spacing.sm,
                backgroundColor: t.background,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: t.border,
              },
            ]}
          >
            <PlatformSymbol
              ios="arrow.uturn.backward"
              material="replay"
              tintColor={t.accent}
              size={16}
            />
            <Body
              variant="callout"
              color={t.accent}
              style={{ fontWeight: "600", marginLeft: 6 }}
            >
              Switch to Today's Chat Box to send messages
            </Body>
          </Pressable>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
