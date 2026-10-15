import { Card } from "@/components/Card";
import { HabitIconView } from "@/components/HabitIconView";
import { HabitsLoadingSkeleton } from "@/components/HabitSkeleton";
import {
  PlatformSymbol,
  type MaterialIconName,
} from "@/components/PlatformSymbol";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Body, Caption, Heading } from "@/components/Typography";
import { getCurrentFirebaseUser } from "@/lib/firebase";
import {
  getChallenges,
  getDailyEntry,
  getDailyIntervention,
  getModeStreak,
  getMotivationalMessage,
  getOverallStreak,
  getRoutineExperiments,
  getTodayHabits,
  recordDailyInterventionAction,
  syncAutoChallengeProgress,
  toggleHabit
} from "@/lib/firestoreDatabase";
import { parseHabitIcon, type Challenge, type Habit, type HabitDifficultyTier, type Mode, type RoutineExperiment } from "@/lib/types";
import { getTodayExperimentVariant } from "@/lib/adaptiveHabitEngine";
import { AdaptiveDateCarousel } from "@/components/habits/AdaptiveDateCarousel";
import { TimeSlotFilter, type TimeSlotSelection } from "@/components/habits/TimeSlotFilter";
import { AdaptiveContextChips } from "@/components/habits/AdaptiveContextChips";
import { ConsistencyRecoveryBanner } from "@/components/habits/ConsistencyRecoveryBanner";
import { todayISO, addCalendarDays } from "@/lib/dateUtils";
import { useScrollToTopOnTabFocus } from "@/lib/useScrollToTopOnTabFocus";
import { useAppearance } from "@/store/AppearanceContext";
import { useDetox } from "@/store/DetoxContext";
import { useFocusLock } from "@/store/FocusContext";
import { useHardMode } from "@/store/HardModeContext";
import { useMode } from "@/store/ModeContext";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { type DrawerNavigationProp } from "@react-navigation/drawer";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  Layout,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type HabitRow = Habit & { completed: number; completedTier?: HabitDifficultyTier };

export default function TodayScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const insets = useSafeAreaInsets();
  const { mode, setMode } = useMode();
  const { detox, setDetox, streak: detoxStreak, refreshStreak } = useDetox();
  const { hardMode } = useHardMode();
  const { focusLock, frequentOpenWarning, dismissWarning } = useFocusLock();

  // Adaptive routines state
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlotSelection>("all");
  const [recoveryHabit, setRecoveryHabit] = useState<Habit | null>(null);
  const [experiments, setExperiments] = useState<RoutineExperiment[]>([]);

  const [habits, setHabits] = useState<HabitRow[]>([]);
  const [loadingHabits, setLoadingHabits] = useState(true);
  const [homeStreak, setHomeStreak] = useState(0);
  const [hostelStreak, setHostelStreak] = useState(0);
  const [dailyMessage, setDailyMessage] = useState<string>("");
  const [urgeToolsOn, setUrgeToolsOn] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const scrollRef = useScrollToTopOnTabFocus();

  const handleUrgeToolsChange = useCallback((next: boolean) => {
    setUrgeToolsOn(next);
  }, []);

  const habitsRef = useRef<HabitRow[]>([]);
  habitsRef.current = habits;

  const loadHabits = useCallback(async (silent = false, targetDate?: string) => {
    if (!getCurrentFirebaseUser()) {
      setHabits([]);
      setHomeStreak(0);
      setHostelStreak(0);
      setActiveChallenge(null);
      setLoadingHabits(false);
      return;
    }
    const day = targetDate ?? selectedDate ?? todayISO();
    try {
      if (!silent && habitsRef.current.length === 0) {
        setLoadingHabits(true);
      }
      const yestDate = addCalendarDays(day, -1);
      const [rows, dailyEntry, yestEntry, challengesList, exps] = await Promise.all([
        getTodayHabits(mode, detox, false, day),
        getDailyEntry(day).catch(() => null),
        getDailyEntry(yestDate).catch(() => null),
        getChallenges().catch(() => []),
        getRoutineExperiments().catch(() => []),
      ]);
      setHabits(rows);
      setExperiments(exps);

      // Consistency recovery check
      if (day === todayISO() && yestEntry?.habits) {
        const yestDoneIds = new Set(
          yestEntry.habits.filter((h) => h.completed).map((h) => h.id)
        );
        const candidate = rows.find(
          (h) => !h.completed && !yestDoneIds.has(h.id) && h.difficultyLevels?.minimum
        );
        setRecoveryHabit(candidate ?? null);
      } else {
        setRecoveryHabit(null);
      }

      const curChall = challengesList.find((c) => c.status === "active") ?? null;
      setActiveChallenge(curChall);

      const c = rows.filter((h) => h.completed).length;
      const p = rows.length - c;
      const pct = rows.length > 0 ? Math.round((c / rows.length) * 100) : 0;
      setDailyMessage(getMotivationalMessage(pct, p));

      const [hs, hos] = await Promise.all([
        getModeStreak("home"),
        getModeStreak(mode === "home" ? "hostel" : mode),
      ]);
      setHomeStreak(hs);
      setHostelStreak(hos);

      if (detox) {
        await refreshStreak();
      }
    } catch (e) {
      console.error("Failed to load habits", e);
    } finally {
      setLoadingHabits(false);
    }
  }, [mode, detox, refreshStreak, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      const hasExistingHabits = habitsRef.current.length > 0;
      loadHabits(hasExistingHabits, selectedDate);
    }, [loadHabits, selectedDate]),
  );

  const handleToggle = async (habitId: number, tier?: HabitDifficultyTier) => {
    const row = habits.find((h) => h.id === habitId);
    if (hardMode && row && row.completed) {
      Alert.alert(
        "Hard Mode",
        "Unchecking habits is disabled. Stay accountable — finish the day clean.",
      );
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // 1. Instant optimistic update in local state (0ms)
    setHabits((prev) =>
      prev.map((h) =>
        h.id === habitId
          ? {
              ...h,
              completed: h.completed ? 0 : 1,
              completedTier: h.completed ? undefined : (tier ?? "standard"),
            }
          : h
      )
    );

    if (recoveryHabit?.id === habitId) {
      setRecoveryHabit(null);
    }

    // 2. Persist to Firestore & sync cache + challenge progression
    try {
      await toggleHabit(habitId, selectedDate, mode, tier);
      const challProg = await syncAutoChallengeProgress();
      if (challProg?.completedChallenge) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          "🏆 Challenge Completed!",
          `Congratulations! You completed Challenge #${challProg.completedChallenge.id}: "${challProg.completedChallenge.name}" (+${challProg.completedChallenge.xp} XP)!\n\nNext challenge is now unlocked.`,
        );
      }
      await loadHabits(true, selectedDate);
    } catch (e) {
      console.error("Failed to toggle habit:", e);
      await loadHabits(true, selectedDate);
    }
  };

  const handleDetoxToggle = async (value: boolean) => {
    Haptics.notificationAsync(
      value
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning
    );
    await setDetox(value);
  };

  const completed = habits.filter((h) => h.completed).length;
  const pending = habits.length - completed;
  const progress = habits.length > 0 ? completed / habits.length : 0;

  const slotCounts = useMemo(() => {
    const counts: Partial<Record<TimeSlotSelection, number>> = { all: habits.length };
    for (const h of habits) {
      const slot = (h.timeSlot as TimeSlotSelection) ?? "morning";
      if (slot === "night") {
        counts.evening = (counts.evening ?? 0) + 1;
      } else {
        counts[slot] = (counts[slot] ?? 0) + 1;
      }
    }
    return counts;
  }, [habits]);

  const visibleHabits = useMemo(() => {
    if (selectedSlot === "all") return habits;
    if (selectedSlot === "evening") {
      return habits.filter((h) => h.timeSlot === "evening" || h.timeSlot === "night");
    }
    return habits.filter((h) => (h.timeSlot ?? "morning") === selectedSlot);
  }, [habits, selectedSlot]);

  const homeOrderActive = false;

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: insets.top + spacing.md,
          paddingBottom: spacing["5xl"] + 28 + insets.bottom,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── Header ─────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.getParent<DrawerNavigationProp<any>>()?.openDrawer();
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
          <View style={styles.headerTitleBlock}>
            <Caption variant="footnote" color={t.textMuted}>
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </Caption>
            <Heading variant="title1" style={[styles.headerTitle, { color: t.textPrimary }]} numberOfLines={2}>
              Control Center
            </Heading>
          </View>
        </View>
        <View style={styles.headerActionRow}>
          <DetoxToggle value={detox} onToggle={handleDetoxToggle} t={t} />
          <AppearanceToggleButton t={t} />
          <HeaderCoachButton t={t} onPress={() => router.push("/(drawer)/(tabs)/coach")} />
          <HeaderAddButton t={t} onPress={() => router.push("/addHabit")} />
        </View>
      </View>

      {detox && (
        <Animated.View entering={FadeIn.duration(350)}>
          <View style={[styles.detoxProtocolBanner, { backgroundColor: t.accent + "14", borderColor: t.accent + "50" }]}>
            <View style={styles.detoxBannerContent}>
              <View style={[styles.detoxBannerIconWrap, { backgroundColor: t.accent + "25" }]}>
                <PlatformSymbol
                  ios="shield.checkmark.fill"
                  material="shield-check"
                  tintColor={t.accent}
                  size={26}
                />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Heading variant="title3" color={t.accent}>
                    🛡️ Detox Protocol Active
                  </Heading>
                  <View style={[styles.detoxStreakBadge, { backgroundColor: t.accent + "25" }]}>
                    <Caption variant="caption2" color={t.accent} style={{ fontWeight: "700" }}>
                      {detoxStreak} {detoxStreak === 1 ? "day streak" : "days streak"}
                    </Caption>
                  </View>
                </View>
                <Caption variant="caption2" color={t.textSecondary}>
                  Strict discipline protocol engaged. Extra detox tasks are active in your {mode === "home" ? "Home" : "Hostel"} routine.
                </Caption>
              </View>
            </View>
          </View>
        </Animated.View>
      )}

      {focusLock && frequentOpenWarning && (
        <FocusLockBanner
          t={t}
          onDismiss={dismissWarning}
          onOpenFocus={() => router.push("/(drawer)/focusMode")}
        />
      )}

      {/* <DangerZoneStrip danger={dangerZone} t={t} router={router} /> */}

      {/* ─── Dribbble 5-Day Date Carousel ─────────────── */}
      <AdaptiveDateCarousel
        selectedDate={selectedDate}
        onSelectDate={(d) => {
          setSelectedDate(d);
          loadHabits(false, d);
        }}
      />

      {/* ─── Adaptive Context Planner (Home, Hostel, Office, Travel) ── */}
      <AdaptiveContextChips
        currentMode={mode}
        onSelectMode={(m) => setMode(m)}
      />

      {/* ─── Dribbble Time-of-Day Filter (Morning, Afternoon, Evening) ── */}
      <TimeSlotFilter
        selected={selectedSlot}
        onChange={setSelectedSlot}
        counts={slotCounts}
      />

      {/* ─── Consistency Recovery Banner ───────────────── */}
      {recoveryHabit && (
        <ConsistencyRecoveryBanner
          habit={recoveryHabit}
          onRecover={(id, tier) => handleToggle(id, tier)}
          onDismiss={() => setRecoveryHabit(null)}
        />
      )}

      <ModeDualStreakStrip
        home={homeStreak}
        hostel={hostelStreak}
        active={mode}
        t={t}
      />

      {activeChallenge && (
        <Pressable
          onPress={() => router.push("/(drawer)/(tabs)/challenges")}
          style={({ pressed }) => [
            styles.activeChallengeCard,
            {
              backgroundColor: t.card,
              borderColor: t.accent + "40",
            },
            pressed && { opacity: 0.9 },
          ]}
        >
          <View style={styles.activeChallengeHeader}>
            <View style={[styles.activeChallengeIconWrap, { backgroundColor: t.accent + "18" }]}>
              <PlatformSymbol
                ios="flame.fill"
                material="whatshot"
                tintColor={t.accent}
                size={16}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Caption variant="caption2" color={t.accent} style={{ fontWeight: "700", textTransform: "uppercase" }}>
                Current Challenge #{activeChallenge.id}
              </Caption>
              <Heading variant="title3">{activeChallenge.name}</Heading>
            </View>
            <View style={[styles.activeChallengePill, { backgroundColor: t.accent + "18" }]}>
              <Caption variant="caption2" color={t.accent} style={{ fontWeight: "700" }}>
                Day {activeChallenge.progress}/{activeChallenge.duration}
              </Caption>
            </View>
          </View>
          <View style={[styles.activeChallengeTrack, { backgroundColor: t.background }]}>
            <View
              style={[
                styles.activeChallengeBar,
                {
                  backgroundColor: t.accent,
                  width: `${activeChallenge.duration > 0 ? Math.min(100, Math.round((activeChallenge.progress / activeChallenge.duration) * 100)) : 0}%`,
                },
              ]}
            />
          </View>
          <View style={styles.activeChallengeFooter}>
            <Caption variant="caption2" color={t.textMuted} numberOfLines={1} style={{ flex: 1 }}>
              Complete ≥50% habits today to advance
            </Caption>
            <Caption variant="caption2" color={t.accent} style={{ fontWeight: "600" }}>
              View Challenges →
            </Caption>
          </View>
        </Pressable>
      )}

      <UrgeToolsBar
        value={urgeToolsOn}
        onValueChange={handleUrgeToolsChange}
        t={t}
      />
      <UrgeRecoveryPanel
        visible={urgeToolsOn}
        onLogged={() => loadHabits(true)}
        onAllComplete={() => handleUrgeToolsChange(false)}
        t={t}
      />

      {homeOrderActive && (
        <Pressable
          onPress={() =>
            Alert.alert(
              "Move at home",
              "More movement at home keeps you safer: it cuts idle scrolling and negative dopamine loops. Stretch, walk a room, or do light chores before you reach for the phone.",
            )
          }
          style={({ pressed }) => [
            styles.homeSafetyBanner,
            { backgroundColor: t.accent + "14", borderColor: t.accent + "44" },
            pressed && { opacity: 0.9 },
          ]}
        >
          <PlatformSymbol
            ios="figure.walk.motion"
            material="directions-walk"
            tintColor={t.accent}
            size={20}
          />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Body variant="bodyMedium" color={t.textPrimary}>
              At home: move more, scroll less
            </Body>
            <Caption variant="caption2" color={t.textMuted}>
              Tap for a reminder on dopamine and safety at home.
            </Caption>
          </View>
          <PlatformSymbol
            ios="chevron.right"
            material="chevron-right"
            tintColor={t.textMuted}
            size={16}
          />
        </Pressable>
      )}

      {/* ─── Screen Time + risk (hidden for now; keep components below) ─ */}
      {/* <ScreenTimeInput
        value={screenTime}
        onChange={setScreenTime}
        onSave={handleScreenTimeSave}
        t={t}
      /> */}

      {/* <RiskMeter
        score={risk.score}
        level={risk.level}
        color={riskColor}
        label={riskLabel}
      /> */}
      {/* {levelState && (
        <Caption variant="caption2" color={t.textMuted} style={styles.levelHint}>
          ...
        </Caption>
      )} */}

      {/* Risk-climb intervention (temporarily off)
      {showAlert && intervention && (
        <AlertCard intervention={intervention} onActionComplete={loadHabits} />
      )} */}

      {/* ─── Overall Progress ────────────────────────── */}
      <Card style={styles.progressCard}>
        <View style={styles.progressHeader}>
          <Body variant="headline">Daily Progress</Body>
          <Heading variant="title3" color={t.accent}>
            {Math.round(progress * 100)}%
          </Heading>
        </View>
        <ProgressBar
          progress={progress}
          color={t.accent}
          trackColor={t.border}
        />
        <View style={styles.statsRow}>
          <StatPill label="Total" value={habits.length} color={t.textPrimary} />
          <StatPill label="Done" value={completed} color={t.accent} />
          <StatPill label="Left" value={pending} color={t.warning} />
        </View>
        {dailyMessage ? (
          <View
            style={{
              marginTop: spacing.md,
              paddingTop: spacing.sm,
              borderTopWidth: 1,
              borderTopColor: t.borderLight,
            }}
          >
            <Caption variant="caption1" color={t.textSecondary} style={{ fontStyle: "italic", textAlign: "center" }}>
              💡 {dailyMessage}
            </Caption>
          </View>
        ) : null}
      </Card>

      {/* ─── Habits ──────────────────────────────────── */}
      {loadingHabits ? (
        <View style={styles.habitList}>
          <View style={styles.sectionHeader}>
            <Body variant="headline" color={t.textSecondary}>
              {homeOrderActive ? "Today's order" : "Habits"}
            </Body>
            <Caption variant="caption2" color={t.textMuted}>
              Loading habits...
            </Caption>
          </View>
          <HabitsLoadingSkeleton count={4} />
        </View>
      ) : habits.length === 0 ? (
        <Card animated style={styles.emptyCard}>
          <View style={[styles.emptyIcon, { backgroundColor: t.accentMuted }]}>
            <PlatformSymbol
              ios="leaf.fill"
              material="leaf"
              tintColor={t.accent}
              size={28}
            />
          </View>
          <Body
            variant="callout"
            color={t.textSecondary}
            style={styles.emptyText}
          >
            No habits for {mode} mode yet.{"\n"}Tap + to create one.
          </Body>
        </Card>
      ) : (
        <View style={styles.habitList}>
          <View style={styles.sectionHeader}>
            <Body variant="headline" color={t.textSecondary}>
              Habits
            </Body>
            <Caption variant="caption2" color={t.textMuted}>
              {completed}/{habits.length}
            </Caption>
          </View>

          {visibleHabits.map((habit, index) => {
            const activeExp = experiments.find((e) => e.habitId === habit.id && e.status === "active");
            return (
              <HabitCard
                key={habit.id}
                habit={habit}
                index={index}
                activeExperiment={activeExp}
                targetDate={selectedDate}
                onToggle={handleToggle}
                onPress={() =>
                  router.push({
                    pathname: "/habitDetail",
                    params: { id: String(habit.id) },
                  })
                }
              />
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Screen Time Input ────────────────────────────────────────

function ScreenTimeInput({
  value,
  onChange,
  onSave,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: (v: string) => void;
  t: ReturnType<typeof useAppTheme>;
}) {
  const mins = parseInt(value, 10) || 0;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  const label = mins > 0
    ? `${hours > 0 ? `${hours}h ` : ''}${remMins}m today`
    : 'Not logged yet';
  // Match your “high risk” tier (> 3 hours).
  const isHigh = mins > 180;

  return (
    <View style={[styles.stCard, { backgroundColor: t.card }]}>
      <View style={styles.stRow}>
        <View style={[styles.stIconWrap, { backgroundColor: (isHigh ? t.danger : t.accent) + '18' }]}>
          <PlatformSymbol
            ios="hourglass"
            material="timer-sand"
            tintColor={isHigh ? t.danger : t.accent}
            size={18}
          />
        </View>
        <View style={styles.stTextCol}>
          <Body variant="bodyMedium">Screen Time</Body>
          <Caption variant="caption2" color={isHigh ? t.danger : t.textMuted}>
            {label}
          </Caption>
        </View>
        <View style={styles.stInputWrap}>
          <TextInput
            style={[
              styles.stInput,
              {
                backgroundColor: t.background,
                color: t.textPrimary,
                borderColor: isHigh ? t.danger + '60' : t.border,
              },
            ]}
            value={value}
            onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ''))}
            onEndEditing={() => onSave(value)}
            onSubmitEditing={() => onSave(value)}
            placeholder="0"
            placeholderTextColor={t.textMuted}
            keyboardType="number-pad"
            returnKeyType="done"
            maxLength={4}
            selectionColor={t.accent}
          />
          <Caption variant="caption2" color={t.textMuted}>min</Caption>
        </View>
      </View>
    </View>
  );
}



function FocusLockBanner({
  t,
  onDismiss,
  onOpenFocus,
}: {
  t: ReturnType<typeof useAppTheme>;
  onDismiss: () => void;
  onOpenFocus: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(280)}>
      <View
        style={[
          styles.focusBanner,
          { backgroundColor: t.warning + "18", borderColor: t.warning + "55" },
        ]}
      >
        <PlatformSymbol
          ios="iphone.slash"
          material="phone-off"
          tintColor={t.warning}
          size={22}
        />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Body variant="headline" style={{ color: t.warning }}>
            Take a screen break
          </Body>
          <Caption variant="footnote" color={t.textSecondary}>
            You have opened the app often in the last stretch. Pause and put the phone down when you
            can.
          </Caption>
          <View style={styles.focusBannerActions}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onDismiss();
              }}
              style={[styles.focusBannerBtn, { backgroundColor: t.cardElevated }]}
            >
              <Caption variant="caption1" color={t.textSecondary} style={{ fontWeight: "600" }}>
                Dismiss
              </Caption>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onOpenFocus();
              }}
              style={[styles.focusBannerBtn, { backgroundColor: t.accent }]}
            >
              <Caption variant="caption1" color={t.textInverse} style={{ fontWeight: "600" }}>
                Focus settings
              </Caption>
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Header actions ────────────────────────────────────────────

function AppearanceToggleButton({ t }: { t: ReturnType<typeof useAppTheme> }) {
  const { scheme, toggleScheme } = useAppearance();
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        toggleScheme();
      }}
      style={[styles.headerIconBtn, { backgroundColor: t.cardElevated, borderColor: t.border }]}
      accessibilityRole="button"
      accessibilityLabel={scheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <MaterialCommunityIcons
        name={scheme === "dark" ? "weather-sunny" : "moon-waning-crescent"}
        size={20}
        color={t.accent}
      />
      <Caption variant="caption2" color={t.textSecondary} style={styles.headerBtnLabel}>
        {scheme === "dark" ? "Light" : "Dark"}
      </Caption>
    </Pressable>
  );
}

function HeaderCoachButton({
  t,
  onPress,
}: {
  t: ReturnType<typeof useAppTheme>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[styles.headerIconBtn, { backgroundColor: t.cardElevated, borderColor: t.border }]}
      accessibilityRole="button"
      accessibilityLabel="AI Coach"
    >
      <Ionicons name="chatbubbles" size={20} color={t.accent} />
      <Caption variant="caption2" color={t.textSecondary} style={styles.headerBtnLabel}>
        Coach
      </Caption>
    </Pressable>
  );
}

function HeaderAddButton({
  t,
  onPress,
}: {
  t: ReturnType<typeof useAppTheme>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[styles.headerIconBtn, { backgroundColor: t.accent, borderColor: t.accent }]}
      accessibilityRole="button"
      accessibilityLabel="Add habit"
    >
      <MaterialCommunityIcons name="plus" size={20} color={t.textInverse} />
      <Caption variant="caption2" style={[styles.headerBtnLabel, { color: t.textInverse }]}>
        Add
      </Caption>
    </Pressable>
  );
}

// ─── Detox Toggle ─────────────────────────────────────────────

function DetoxToggle({
  value,
  onToggle,
  t,
}: {
  value: boolean;
  onToggle: (v: boolean) => void;
  t: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View style={styles.detoxToggle}>
      <MaterialCommunityIcons
        name="shield-check"
        size={18}
        color={value ? t.accent : t.textMuted}
      />
      <Caption variant="caption2" color={t.textSecondary} style={styles.detoxLabel}>
        Detox
      </Caption>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: t.border, true: t.accent + "55" }}
        thumbColor={value ? t.accent : t.textMuted}
        style={{ transform: [{ scale: 0.92 }] }}
      />
    </View>
  );
}

// ─── Risk Meter ────────────────────────────────────────────────

// function RiskMeter({
//   score,
//   level,
//   color,
//   label,
// }: {
//   score: number;
//   level: string;
//   color: string;
//   label: string;
// }) {
//   const t = useAppTheme();
//   const animatedScore = useSharedValue(0);

//   useEffect(() => {
//     animatedScore.value = withTiming(score / 100, {
//       duration: 800,
//       easing: Easing.out(Easing.cubic),
//     });
//   }, [score]);

//   const fillStyle = useAnimatedStyle(() => ({
//     width: `${Math.min(animatedScore.value * 100, 100)}%`,
//   }));

//   const glowStyle = useAnimatedStyle(() => {
//     const bg = interpolateColor(
//       animatedScore.value,
//       [0, 0.3, 0.6, 1],
//       [
//         "rgba(74,222,128,0.08)",
//         "rgba(74,222,128,0.12)",
//         "rgba(245,158,11,0.12)",
//         "rgba(239,68,68,0.15)",
//       ],
//     );
//     return { backgroundColor: bg };
//   });

//   return (
//     <Animated.View
//       entering={FadeIn.duration(400)}
//       style={[styles.riskCard, glowStyle]}
//     >
//       <View style={styles.riskHeader}>
//         <View style={styles.riskLabelRow}>
//           <View style={[styles.riskDot, { backgroundColor: color }]} />
//           <Body variant="headline">{label}</Body>
//         </View>
//         <Heading variant="title2" color={color}>
//           {score}
//         </Heading>
//       </View>

//       <View style={[styles.riskTrack, { backgroundColor: t.border }]}>
//         <Animated.View
//           style={[styles.riskFill, { backgroundColor: color }, fillStyle]}
//         />
//       </View>

//       <View style={styles.riskScale}>
//         <Caption variant="caption2" color={t.accent}>
//           Safe
//         </Caption>
//         <Caption variant="caption2" color={t.warning}>
//           Moderate
//         </Caption>
//         <Caption variant="caption2" color={t.danger}>
//           High
//         </Caption>
//       </View>
//     </Animated.View>
//   );
// }

// ─── Recovery Actions ──────────────────────────────────────────

const RECOVERY_ACTIONS = [
  {
    label: 'Walk 10 minutes',
    icon: { ios: 'figure.walk', android: 'directions-walk', web: 'directions-walk' },
    material: 'directions-walk' as MaterialIconName,
    color: '#34D399',
  },
  {
    label: 'Do pushups',
    icon: { ios: 'figure.strengthtraining.traditional', android: 'fitness-center', web: 'fitness-center' },
    material: 'fitness-center',
    color: '#22D3EE',
  },
  {
    label: 'Cold shower',
    icon: { ios: 'drop.fill', android: 'water-drop', web: 'water-drop' },
    material: 'water-drop',
    color: '#60A5FA',
  },
  {
    label: 'Read Quran',
    icon: { ios: 'book.fill', android: 'menu-book', web: 'menu-book' },
    material: 'menu-book',
    color: '#4ADE80',
  },
  {
    label: 'Pray',
    icon: { ios: 'moon.stars.fill', android: 'self-improvement', web: 'self-improvement' },
    material: 'hands-pray',
    color: '#A78BFA',
  },
] as const;

// ─── Mode streaks (Home vs Hostel) ──────────────────────────────

function ModeDualStreakStrip({
  home,
  hostel,
  active,
  t,
}: {
  home: number;
  hostel: number;
  active: Mode;
  t: ReturnType<typeof useAppTheme>;
}) {
  const isHomeActive = active === "home";
  const isRightActive = active !== "home";
  const rightLabel =
    active === "office" ? "Office" : active === "travel" ? "Travel" : "Hostel";

  return (
    <View style={styles.modeStreakRow}>
      {/* ─── Home Card ─── */}
      <View
        style={[
          styles.modeStreakCard,
          {
            backgroundColor: t.card,
            borderColor: isHomeActive ? t.accent : t.border,
          },
          isHomeActive && styles.modeStreakCardActive,
        ]}
      >
        <Caption
          variant="caption2"
          color={isHomeActive ? t.accent : t.textMuted}
          style={{ fontWeight: "600" }}
        >
          Home
        </Caption>
        <Heading
          variant="largeTitle"
          color={isHomeActive ? t.accent : t.textPrimary}
          style={styles.modeStreakNum}
        >
          {home}
        </Heading>
        <Caption variant="caption2" color={t.textSecondary}>
          {home === 1 ? "strong day" : "strong days"} in a row
        </Caption>
      </View>

      {/* ─── Hostel / Active Mode Card ─── */}
      <View
        style={[
          styles.modeStreakCard,
          {
            backgroundColor: t.card,
            borderColor: isRightActive ? t.accent : t.border,
          },
          isRightActive && styles.modeStreakCardActive,
        ]}
      >
        <Caption
          variant="caption2"
          color={isRightActive ? t.accent : t.textMuted}
          style={{ fontWeight: "600" }}
        >
          {rightLabel}
        </Caption>
        <Heading
          variant="largeTitle"
          color={isRightActive ? t.accent : t.textPrimary}
          style={styles.modeStreakNum}
        >
          {hostel}
        </Heading>
        <Caption variant="caption2" color={t.textSecondary}>
          {hostel === 1 ? "strong day" : "strong days"} in a row
        </Caption>
      </View>
    </View>
  );
}

function UrgeToolsBar({
  value,
  onValueChange,
  t,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  t: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View
      style={[
        styles.urgeBar,
        { backgroundColor: t.card, borderColor: t.border },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Body variant="bodyMedium" color={t.textPrimary}>
          Urge
        </Body>
        <Caption variant="caption2" color={t.textMuted}>
          {value
            ? "Recovery plan active — completions are saved with date & time"
            : "Turn on to show recovery actions and log your urge session"}
        </Caption>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          Haptics.selectionAsync();
          onValueChange(v);
        }}
        trackColor={{ false: t.border, true: t.accent + "99" }}
        thumbColor={t.background}
      />
    </View>
  );
}

function UrgeRecoveryPanel({
  visible,
  onLogged,
  onAllComplete,
  t,
}: {
  visible: boolean;
  onLogged: () => void;
  onAllComplete: () => void;
  t: ReturnType<typeof useAppTheme>;
}) {
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());

  // Load today's already completed recovery actions from interventions/{YYYY-MM-DD}
  useEffect(() => {
    if (visible) {
      getDailyIntervention()
        .then((doc) => {
          if (doc && Array.isArray(doc.actions)) {
            const doneLabels = doc.actions
              .filter((a) => a.completed)
              .map((a) => a.action || a.actionName)
              .filter(Boolean) as string[];
            if (doneLabels.length > 0) {
              setCompletedActions(new Set(doneLabels));
            }
          }
        })
        .catch(() => { });
    }
  }, [visible]);

  if (!visible) return null;

  const handlePickAction = async (label: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Optimistically update UI immediately
    let nextSize = 0;
    setCompletedActions((prev) => {
      const next = new Set(prev).add(label);
      nextSize = next.size;
      return next;
    });

    onLogged();

    // Persist to interventions/{YYYY-MM-DD} single daily document
    try {
      await recordDailyInterventionAction(label, RECOVERY_ACTIONS.length);
    } catch (e) {
      console.warn("Failed to record recovery intervention:", e);
    }

    if (nextSize >= RECOVERY_ACTIONS.length) {
      Alert.alert(
        "Proud of you",
        "Congratulations — you completed the full recovery plan. That urge is done. Stay strong.",
        [{ text: "Alhamdulillah", onPress: onAllComplete }],
      );
    }
  };

  return (
    <Animated.View entering={FadeInDown.duration(280)} style={styles.urgePanel}>
      <Body variant="headline" color={t.textPrimary} style={{ marginBottom: spacing.sm }}>
        Pick a recovery action
      </Body>
      <View style={styles.actionList}>
        {RECOVERY_ACTIONS.map((action, i) => {
          const done = completedActions.has(action.label);
          return (
            <Animated.View
              key={action.label}
              entering={FadeInDown.delay(i * 40).springify().damping(18)}
            >
              <Pressable
                style={[
                  styles.actionRow,
                  { backgroundColor: done ? action.color + "18" : t.cardElevated },
                  done && { borderColor: action.color, borderWidth: 1 },
                ]}
                onPress={() => !done && handlePickAction(action.label)}
                disabled={done}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.color + "22" }]}>
                  <PlatformSymbol
                    ios={action.icon.ios}
                    material={action.material}
                    tintColor={action.color}
                    size={18}
                  />
                </View>
                <Body variant="bodyMedium" style={{ flex: 1, opacity: done ? 0.55 : 1 }}>
                  {action.label}
                </Body>
                {done ? (
                  <View style={[styles.actionCheck, { backgroundColor: action.color }]}>
                    <PlatformSymbol ios="checkmark" material="check" tintColor="#fff" size={12} />
                  </View>
                ) : (
                  <PlatformSymbol
                    ios="chevron.right"
                    material="chevron-right"
                    tintColor={t.textMuted}
                    size={14}
                  />
                )}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
}

// ─── Alert Card ────────────────────────────────────────────────

// function AlertCard({
//   intervention,
//   onActionComplete,
// }: {
//   intervention: { title: string; body: string; action: string };
//   onActionComplete: () => void;
// }) {
//   const t = useAppTheme();
//   const [expanded, setExpanded] = useState(false);
//   const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());
//   const pulseOpacity = useSharedValue(1);

//   useEffect(() => {
//     const pulse = () => {
//       pulseOpacity.value = withTiming(0.6, { duration: 1000 }, () => {
//         pulseOpacity.value = withTiming(1, { duration: 1000 });
//       });
//     };
//     pulse();
//     const interval = setInterval(pulse, 2000);
//     return () => clearInterval(interval);
//   }, []);

//   const pulseStyle = useAnimatedStyle(() => ({
//     opacity: pulseOpacity.value,
//   }));

//   const handleStartRecovery = () => {
//     Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
//     setExpanded(true);
//   };

//   const handlePickAction = async (label: string) => {
//     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

//     const id = await addIntervention(label);
//     await completeIntervention(id);

//     setCompletedActions((prev) => new Set(prev).add(label));
//     onActionComplete();
//   };

//   return (
//     <Animated.View
//       entering={FadeInUp.springify().damping(16)}
//       style={[styles.alertCard, { backgroundColor: t.dangerMuted }]}
//     >
//       <Animated.View style={[styles.alertIconCircle, pulseStyle]}>
//         <PlatformSymbol
//           ios="exclamationmark.triangle.fill"
//           material="alert"
//           tintColor={t.danger}
//           size={24}
//         />
//       </Animated.View>

//       <Heading variant="title3" color={t.danger}>
//         {expanded ? 'Pick a recovery action' : intervention.title}
//       </Heading>

//       {!expanded && (
//         <Body variant="callout" color={t.textSecondary} style={styles.alertBody}>
//           {intervention.body}
//         </Body>
//       )}

//       {expanded ? (
//         <View style={styles.actionList}>
//           {RECOVERY_ACTIONS.map((action, i) => {
//             const done = completedActions.has(action.label);
//             return (
//               <Animated.View
//                 key={action.label}
//                 entering={FadeInDown.delay(i * 60).springify().damping(18)}
//               >
//                 <Pressable
//                   style={[
//                     styles.actionRow,
//                     { backgroundColor: done ? action.color + '18' : t.card },
//                     done && { borderColor: action.color, borderWidth: 1 },
//                   ]}
//                   onPress={() => !done && handlePickAction(action.label)}
//                   disabled={done}
//                 >
//                   <View style={[styles.actionIcon, { backgroundColor: action.color + '22' }]}>
//                     <PlatformSymbol
//                       ios={action.icon.ios}
//                       material={action.material}
//                       tintColor={action.color}
//                       size={18}
//                     />
//                   </View>
//                   <Body variant="bodyMedium" style={{ flex: 1, opacity: done ? 0.5 : 1 }}>
//                     {action.label}
//                   </Body>
//                   {done ? (
//                     <View style={[styles.actionCheck, { backgroundColor: action.color }]}>
//                       <PlatformSymbol
//                         ios="checkmark"
//                         material="check"
//                         tintColor="#fff"
//                         size={12}
//                       />
//                     </View>
//                   ) : (
//                     <PlatformSymbol
//                       ios="chevron.right"
//                       material="chevron-right"
//                       tintColor={t.textMuted}
//                       size={14}
//                     />
//                   )}
//                 </Pressable>
//               </Animated.View>
//             );
//           })}
//         </View>
//       ) : (
//         <Pressable
//           style={[styles.recoveryBtn, { backgroundColor: t.danger }]}
//           onPress={handleStartRecovery}
//         >
//           <PlatformSymbol
//             ios="arrow.counterclockwise"
//             material="refresh"
//             tintColor="#fff"
//             size={16}
//           />
//           <Body variant="headline" color="#fff">
//             Start Recovery
//           </Body>
//         </Pressable>
//       )}
//     </Animated.View>
//   );
// }

// ─── Animated Progress Bar ─────────────────────────────────────

function ProgressBar({
  progress,
  color,
  trackColor,
}: {
  progress: number;
  color: string;
  trackColor: string;
}) {
  const width = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    width.value = withSpring(progress, { damping: 18, stiffness: 100 });
    shimmer.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(width.value * 100, 100)}%`,
    opacity: 0.3 + shimmer.value * 0.7,
  }));

  return (
    <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
      <Animated.View
        style={[styles.progressFill, { backgroundColor: color }, fillStyle]}
      />
    </View>
  );
}

// ─── Stat Pill ─────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const t = useAppTheme();
  const animValue = useSharedValue(0);

  useEffect(() => {
    animValue.value = withTiming(value, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [value]);

  const scaleStyle = useAnimatedStyle(() => {
    const bounce = animValue.value === value ? 1 : 0.95;
    return { transform: [{ scale: bounce }] };
  });

  return (
    <Animated.View style={[styles.statPill, { backgroundColor: t.background }, scaleStyle]}>
      <Heading variant="title3" color={color}>
        {value}
      </Heading>
      <Caption variant="caption2" color={t.textMuted}>
        {label}
      </Caption>
    </Animated.View>
  );
}

// ─── Habit Card ────────────────────────────────────────────────

function HabitCard({
  habit,
  index,
  activeExperiment,
  targetDate,
  onToggle,
  onPress,
  minimal,
}: {
  habit: HabitRow;
  index: number;
  activeExperiment?: RoutineExperiment;
  targetDate?: string;
  onToggle: (id: number, tier?: HabitDifficultyTier) => void;
  onPress: () => void;
  minimal?: boolean;
}) {
  const t = useAppTheme();
  const icon = parseHabitIcon(habit.icon);
  const isDone = habit.completed === 1;
  const itemProgress = isDone ? 1 : 0;
  const neonLime = "#D4FE33";

  const todayExpVariant = activeExperiment
    ? getTodayExperimentVariant(activeExperiment, targetDate)
    : null;

  const checkScale = useSharedValue(1);
  const checkRotate = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const iconPop = useSharedValue(1);

  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: checkScale.value },
      { rotate: `${checkRotate.value}deg` },
    ],
  }));

  const cardPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconPop.value }],
  }));

  const handleCheck = () => {
    checkScale.value = withSpring(0.5, { damping: 8, stiffness: 500 }, () => {
      checkScale.value = withSpring(1.2, { damping: 6, stiffness: 300 }, () => {
        checkScale.value = withSpring(1, { damping: 10, stiffness: 200 });
      });
    });
    checkRotate.value = withSpring(isDone ? 0 : 360, { damping: 14, stiffness: 160 }, () => {
      checkRotate.value = 0;
    });
    iconPop.value = withSpring(1.3, { damping: 8, stiffness: 400 }, () => {
      iconPop.value = withSpring(1, { damping: 12, stiffness: 200 });
    });
    onToggle(habit.id);
  };

  const hasTiers = Boolean(
    habit.difficultyLevels?.minimum || habit.difficultyLevels?.ambitious
  );

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50)
        .springify()
        .damping(18)
        .stiffness(120)}
      layout={Layout.springify().damping(18)}
    >
      <Animated.View style={cardPressStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={() => {
            cardScale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
          }}
          onPressOut={() => {
            cardScale.value = withSpring(1, { damping: 12, stiffness: 200 });
          }}
          style={{ opacity: isDone ? 0.7 : 1 }}
        >
          <View style={[styles.habitCard, { backgroundColor: t.card }]}>
            <View style={styles.habitRow}>
              <Animated.View
                style={[
                  styles.habitIconBox,
                  { backgroundColor: habit.color + "18" },
                  iconAnimStyle,
                ]}
              >
                <HabitIconView
                  icon={icon}
                  color={habit.color}
                  size={22}
                />
              </Animated.View>

              <View style={styles.habitTitleCol}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Body
                    variant="bodyMedium"
                    numberOfLines={2}
                    style={isDone ? styles.doneText : undefined}
                  >
                    {habit.name}
                  </Body>
                  {habit.detoxOnly && (
                    <View
                      style={{
                        backgroundColor: "#10B98120",
                        borderColor: "#10B98155",
                        borderWidth: 1,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 6,
                      }}
                    >
                      <Caption variant="caption2" color="#10B981" style={{ fontWeight: "700" }}>
                        🛡️ Detox
                      </Caption>
                    </View>
                  )}
                </View>

                {/* Stacking anchor & Time slot badge row */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                  {habit.stackAnchorName && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                        backgroundColor: neonLime + "18",
                        borderColor: neonLime + "50",
                        borderWidth: 1,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 6,
                      }}
                    >
                      <Ionicons name="link" size={10} color={neonLime} />
                      <Caption variant="caption2" color={neonLime} style={{ fontWeight: "700" }}>
                        After {habit.stackAnchorName}
                      </Caption>
                    </View>
                  )}
                  {habit.timeSlot && habit.timeSlot !== "anytime" && (
                    <View
                      style={{
                        backgroundColor: t.borderLight,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 6,
                      }}
                    >
                      <Caption variant="caption2" color={t.textMuted} style={{ textTransform: "capitalize", fontSize: 10 }}>
                        {habit.timeSlot === "morning"
                          ? "🌅 Morning"
                          : habit.timeSlot === "afternoon"
                            ? "☀️ Afternoon"
                            : habit.timeSlot === "evening"
                              ? "🌙 Evening"
                              : "✨ Night"}
                      </Caption>
                    </View>
                  )}
                  {todayExpVariant && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                        backgroundColor: "#60A5FA18",
                        borderColor: "#60A5FA50",
                        borderWidth: 1,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 6,
                      }}
                    >
                      <Ionicons name="flask" size={10} color="#60A5FA" />
                      <Caption variant="caption2" color="#60A5FA" style={{ fontWeight: "700", fontSize: 10 }}>
                        {todayExpVariant.variantLetter}: {todayExpVariant.variant.label}
                      </Caption>
                    </View>
                  )}
                  {habit.completedTier && (
                    <View
                      style={{
                        backgroundColor:
                          habit.completedTier === "minimum"
                            ? neonLime + "20"
                            : habit.completedTier === "ambitious"
                              ? "#FBBF2420"
                              : habit.color + "20",
                        borderColor:
                          habit.completedTier === "minimum"
                            ? neonLime
                            : habit.completedTier === "ambitious"
                              ? "#FBBF24"
                              : habit.color,
                        borderWidth: 1,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                        borderRadius: 6,
                      }}
                    >
                      <Caption
                        variant="caption2"
                        color={
                          habit.completedTier === "minimum"
                            ? neonLime
                            : habit.completedTier === "ambitious"
                              ? "#FBBF24"
                              : habit.color
                        }
                        style={{ fontWeight: "700", textTransform: "uppercase", fontSize: 9 }}
                      >
                        {habit.completedTier}
                      </Caption>
                    </View>
                  )}
                </View>

                {habit.targetPerDay > 1 && !minimal && (
                  <Caption variant="caption2" color={t.textMuted}>
                    Target: {habit.targetPerDay}x daily
                  </Caption>
                )}
              </View>

              <Animated.View style={checkAnimStyle}>
                <Pressable
                  onPress={handleCheck}
                  hitSlop={12}
                  style={[
                    styles.checkbox,
                    {
                      borderColor: isDone ? habit.color : t.borderLight,
                      backgroundColor: isDone ? habit.color : "transparent",
                    },
                  ]}
                >
                  {isDone && (
                    <Ionicons name="checkmark" size={15} color="#fff" />
                  )}
                </Pressable>
              </Animated.View>
            </View>

            {/* Elastic Difficulty Tiers Selector */}
            {hasTiers && (
              <View style={styles.tierChipsRow}>
                {habit.difficultyLevels?.minimum && (
                  <Pressable
                    onPress={() => onToggle(habit.id, "minimum")}
                    style={[
                      styles.tierPill,
                      { borderColor: t.borderLight },
                      habit.completedTier === "minimum" && { backgroundColor: neonLime + "25", borderColor: neonLime },
                    ]}
                  >
                    <Caption
                      variant="caption2"
                      color={habit.completedTier === "minimum" ? neonLime : t.textMuted}
                      style={{ fontWeight: "600", fontSize: 10 }}
                    >
                      Min: {habit.difficultyLevels.minimum}
                    </Caption>
                  </Pressable>
                )}
                {habit.difficultyLevels?.standard && (
                  <Pressable
                    onPress={() => onToggle(habit.id, "standard")}
                    style={[
                      styles.tierPill,
                      { borderColor: t.borderLight },
                      (!habit.completedTier || habit.completedTier === "standard") && isDone && {
                        backgroundColor: habit.color + "25",
                        borderColor: habit.color,
                      },
                    ]}
                  >
                    <Caption
                      variant="caption2"
                      color={(!habit.completedTier || habit.completedTier === "standard") && isDone ? habit.color : t.textMuted}
                      style={{ fontWeight: "600", fontSize: 10 }}
                    >
                      Std: {habit.difficultyLevels.standard}
                    </Caption>
                  </Pressable>
                )}
                {habit.difficultyLevels?.ambitious && (
                  <Pressable
                    onPress={() => onToggle(habit.id, "ambitious")}
                    style={[
                      styles.tierPill,
                      { borderColor: t.borderLight },
                      habit.completedTier === "ambitious" && { backgroundColor: "#FBBF2425", borderColor: "#FBBF24" },
                    ]}
                  >
                    <Caption
                      variant="caption2"
                      color={habit.completedTier === "ambitious" ? "#FBBF24" : t.textMuted}
                      style={{ fontWeight: "600", fontSize: 10 }}
                    >
                      Amb: {habit.difficultyLevels.ambitious}
                    </Caption>
                  </Pressable>
                )}
              </View>
            )}

            <View style={styles.habitProgressBlock}>
              <View style={styles.habitBarTrack}>
                <ProgressBar
                  progress={itemProgress}
                  color={habit.color}
                  trackColor={t.border}
                />
              </View>
              <Caption
                variant="caption2"
                color={isDone ? habit.color : t.textMuted}
              >
                {isDone ? (habit.completedTier ? `${habit.completedTier.toUpperCase()} DONE` : "Done") : "Pending"}
              </Caption>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ─── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  homeSafetyBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  modeStreakRow: {
    flexDirection: "row",
    gap: spacing.md,
    width: "100%",
  },
  modeStreakCard: {
    flex: 1,
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: spacing.xxs,
  },
  modeStreakCardActive: {
    borderWidth: 2,
  },
  modeStreakNum: {
    marginVertical: spacing.xxs,
  },
  urgeBar: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  urgePanel: {
    width: "100%",
    gap: spacing.sm,
  },

  // Header
  header: {
    width: "100%",
    gap: spacing.md,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    width: "100%",
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    marginTop: spacing.xxs,
  },
  headerActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.sm,
    width: "100%",
  },
  headerIconBtn: {
    minWidth: 56,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  headerBtnLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
  },

  focusBanner: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
  },
  focusBannerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  focusBannerBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },

  dangerStrip: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    flexDirection: "row",
    gap: spacing.md,
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },

  // Detox toggle
  detoxToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.xs,
    borderRadius: 12,
  },
  detoxLabel: {
    fontWeight: "600",
  },
  detoxProtocolBanner: {
    borderRadius: radius.xl,
    borderWidth: 1.5,
    padding: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  detoxBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  detoxBannerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  detoxStreakBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },

  // Detox hero
  detoxHero: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    paddingHorizontal: spacing.xl,
    borderRadius: radius["2xl"],
    gap: spacing.sm,
  },
  detoxGlow: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  detoxNumber: {
    fontSize: 64,
    lineHeight: 72,
  },

  // Screen Time Input
  stCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  stRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  stIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  stTextCol: {
    flex: 1,
    gap: spacing.xxs,
  },
  stInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  stInput: {
    width: 64,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600" as const,
  },

  // Risk Meter
  riskCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  riskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  riskLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  levelHint: {
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  riskDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  riskTrack: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  riskFill: {
    height: "100%",
    borderRadius: 5,
  },
  riskScale: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  // Alert
  alertCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  alertIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(239,68,68,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  alertBody: {
    textAlign: "center",
    lineHeight: 22,
  },
  recoveryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    width: '100%',
    marginTop: spacing.xs,
  },
  actionList: {
    width: '100%',
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Progress Card
  progressCard: {
    gap: spacing.lg,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xxs,
  },

  // Empty
  emptyCard: {
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing["3xl"],
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 22,
  },

  // Habit list
  habitList: {
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: spacing.xs,
  },

  // Habit card
  habitCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  habitIconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  habitTitleCol: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xxs,
    justifyContent: "center",
  },
  habitProgressBlock: {
    gap: spacing.xs,
  },
  doneText: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  habitBarTrack: {
    width: "100%",
  },
  tierChipsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  tierPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  activeChallengeCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  activeChallengeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  activeChallengeIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  activeChallengePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  activeChallengeTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginVertical: 4,
  },
  activeChallengeBar: {
    height: "100%",
    borderRadius: 3,
  },
  activeChallengeFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.sm,
  },
});
