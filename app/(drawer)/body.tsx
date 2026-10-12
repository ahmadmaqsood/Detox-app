import { type DrawerNavigationProp } from "@react-navigation/drawer";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import {
  addExerciseEntry,
  getBodyWeights,
  getExerciseEntries,
  getGoalWeightKg,
  logBodyWeight,
  setGoalWeightKg,
} from "@/lib/database";
import { getMetrics, saveMetrics } from "@/lib/firestoreDatabase";
import {
  computeStepMetrics,
  DEFAULT_STEP_GOAL,
  getTodaySteps,
  isPedometerAvailable,
  saveDailySteps,
  subscribeLivePedometer,
  syncPedometerSensorSteps,
  type StepMetricsSummary,
} from "@/lib/pedometerService";
import {
  addWaterGlass,
  DEFAULT_GLASS_TARGET,
  GLASS_ML,
  getTodayWaterGlasses,
  getWaterHourlyReminderEnabled,
  removeWaterGlass,
  setWaterHourlyReminderEnabled,
} from "@/lib/waterService";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, delta: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function weekdayShort(iso: string): string {
  const w = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return w[new Date(iso + "T12:00:00").getDay()];
}

export default function BodyScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const day = todayISO();

  // Steps state
  const [steps, setSteps] = useState(0);
  const [stepGoal, setStepGoal] = useState(DEFAULT_STEP_GOAL);
  const [pedometerActive, setPedometerActive] = useState(false);

  // Water state
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [hourlyWaterReminder, setHourlyWaterReminder] = useState(false);

  // Vitals state
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [goalWeightKg, setGoalWeightState] = useState<number | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [sleepMinutes, setSleepMinutes] = useState(0);

  // History & weekly data
  const [weeklySteps, setWeeklySteps] = useState<{ date: string; steps: number }[]>([]);
  const [weightsHistory, setWeightsHistory] = useState<{ date: string; kg: number }[]>([]);

  // Modals for editing
  const [weightModal, setWeightModal] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [goalInput, setGoalInput] = useState("");

  const [heightModal, setHeightModal] = useState(false);
  const [heightInput, setHeightInput] = useState("");

  const [sleepModal, setSleepModal] = useState(false);
  const [sleepHoursInput, setSleepHoursInput] = useState("");
  const [sleepMinutesInput, setSleepMinutesInput] = useState("");

  const [stepGoalModal, setStepGoalModal] = useState(false);
  const [stepGoalInput, setStepGoalInput] = useState("");

  // Load all data
  const load = useCallback(async () => {
    // 1. Pedometer availability & steps
    const available = await isPedometerAvailable();
    setPedometerActive(available);

    const [hardwareSteps, savedSteps] = await Promise.all([
      syncPedometerSensorSteps(),
      getTodaySteps(day),
    ]);
    const currentSteps = hardwareSteps != null ? hardwareSteps : savedSteps;
    setSteps(currentSteps);

    // 2. Water glasses & hourly reminder
    const [glasses, reminderOn] = await Promise.all([
      getTodayWaterGlasses(day),
      getWaterHourlyReminderEnabled(),
    ]);
    setWaterGlasses(glasses);
    setHourlyWaterReminder(reminderOn);

    // 3. Vitals from Firestore & SQLite
    const [metrics, goalKg, weights7] = await Promise.all([
      getMetrics(day),
      getGoalWeightKg(),
      getBodyWeights(addDays(day, -6), day),
    ]);

    if (metrics) {
      if (metrics.sleepMinutes != null) setSleepMinutes(metrics.sleepMinutes);
      if (metrics.heightCm != null) setHeightCm(metrics.heightCm);
      if (metrics.weightKg != null) setWeightKg(metrics.weightKg);
      if (metrics.steps != null && metrics.steps > currentSteps) {
        setSteps(metrics.steps);
      }
    }

    if (goalKg != null) setGoalWeightState(goalKg);

    const latestW = weights7.find((w) => w.date === day);
    if (latestW) setWeightKg(latestW.kg);
    setWeightsHistory(weights7);

    // 4. Build 7-day step history
    const weekArr: { date: string; steps: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(day, -i);
      const m = await getMetrics(d);
      weekArr.push({
        date: d,
        steps: d === day ? currentSteps : m?.steps ?? 0,
      });
    }
    setWeeklySteps(weekArr);
  }, [day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Subscribe to live pedometer updates
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = subscribeLivePedometer((delta) => {
      setSteps((prev) => {
        const next = prev + delta;
        saveDailySteps(next, day);
        return next;
      });
    });
    return () => sub.remove();
  }, [day]);

  // Derived metrics
  const stepMetrics: StepMetricsSummary = useMemo(() => {
    return computeStepMetrics(steps, stepGoal);
  }, [steps, stepGoal]);

  const stepsLeft = Math.max(0, stepGoal - steps);

  // BMI Calculation
  const bmiInfo = useMemo(() => {
    if (!weightKg || !heightCm || heightCm <= 0) return null;
    const m = heightCm / 100;
    const val = parseFloat((weightKg / (m * m)).toFixed(1));
    let label = "Normal";
    let color = "#10B981"; // green
    if (val < 18.5) {
      label = "Underweight";
      color = "#F59E0B";
    } else if (val >= 25 && val < 30) {
      label = "Overweight";
      color = "#F59E0B";
    } else if (val >= 30) {
      label = "Obese";
      color = "#EF4444";
    }
    return { val, label, color };
  }, [weightKg, heightCm]);

  // Sleep formatted
  const sleepFormatted = useMemo(() => {
    const h = Math.floor(sleepMinutes / 60);
    const m = sleepMinutes % 60;
    return `${h}h ${m}m`;
  }, [sleepMinutes]);

  // Handlers
  const handleQuickAddSteps = async (amount: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = steps + amount;
    setSteps(next);
    await saveDailySteps(next, day);
  };

  const handleAddGlass = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const next = await addWaterGlass(day);
    setWaterGlasses(next);
  };

  const handleRemoveGlass = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = await removeWaterGlass(day);
    setWaterGlasses(next);
  };

  const handleToggleWaterReminder = async (enabled: boolean) => {
    Haptics.notificationAsync(
      enabled
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    setHourlyWaterReminder(enabled);
    const success = await setWaterHourlyReminderEnabled(enabled);
    if (enabled && !success) {
      setHourlyWaterReminder(false);
      Alert.alert(
        "Notifications Disabled",
        "Please enable notification permissions in your phone settings to receive hourly water reminders.",
      );
    }
  };

  const handleSaveWeight = async () => {
    const w = parseFloat(weightInput.replace(",", "."));
    const g = parseFloat(goalInput.replace(",", "."));
    if (!Number.isNaN(w) && w > 0) {
      setWeightKg(w);
      await logBodyWeight(day, w);
      await saveMetrics({ weightKg: w, date: day });
    }
    if (!Number.isNaN(g) && g > 0) {
      setGoalWeightState(g);
      await setGoalWeightKg(g);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setWeightModal(false);
    load();
  };

  const handleSaveHeight = async () => {
    const h = parseFloat(heightInput.replace(",", "."));
    if (!Number.isNaN(h) && h > 0) {
      setHeightCm(h);
      await saveMetrics({ heightCm: h, date: day });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setHeightModal(false);
  };

  const handleSaveSleep = async () => {
    const h = parseInt(sleepHoursInput, 10) || 0;
    const m = parseInt(sleepMinutesInput, 10) || 0;
    const totalMin = h * 60 + m;
    setSleepMinutes(totalMin);
    await saveMetrics({ sleepMinutes: totalMin, date: day });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSleepModal(false);
  };

  const maxWeekSteps = Math.max(...weeklySteps.map((s) => s.steps), stepGoal);

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* ─── Header ────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.openDrawer();
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
        <Heading variant="title3">Body & Fitness</Heading>
        <Pressable
          onPress={() => {
            setStepGoalInput(String(stepGoal));
            setStepGoalModal(true);
          }}
          hitSlop={12}
          style={[styles.headerIconBtn, { backgroundColor: t.card }]}
        >
          <PlatformSymbol
            ios="target"
            material="track-changes"
            tintColor={t.accent}
            size={18}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Hero Gauge Card (Inspired by Screenshot 1 & 3) ── */}
        <Animated.View entering={FadeIn.duration(400)}>
          <View style={[styles.heroGaugeCard, { backgroundColor: t.card }]}>
            <View style={styles.gaugeHeader}>
              <Caption variant="caption2" color={t.textMuted} style={styles.todayDateText}>
                {new Date().toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </Caption>
              <View style={[styles.intensityPill, { backgroundColor: t.accent + "20" }]}>
                <Caption variant="caption2" color={t.accent} style={{ fontWeight: "700" }}>
                  {stepMetrics.intensity.toUpperCase()} ACTIVITY
                </Caption>
              </View>
            </View>

            {/* Speedometer Arc Visual */}
            <View style={styles.arcContainer}>
              <View style={[styles.arcBackgroundTrack, { borderColor: t.border }]}>
                <View
                  style={[
                    styles.arcFillOverlay,
                    {
                      borderColor: t.accent,
                      borderTopColor: t.accent,
                      borderRightColor: t.accent,
                      transform: [
                        {
                          rotate: `${Math.min(180, Math.round((stepMetrics.percentage / 100) * 180) - 180)}deg`,
                        },
                      ],
                    },
                  ]}
                />
              </View>

              <View style={styles.arcCenterContent}>
                <Heading variant="largeTitle" color={t.accent} style={styles.arcPercentage}>
                  {stepMetrics.percentage}%
                </Heading>
                <Caption variant="caption1" color={t.textSecondary} style={{ fontWeight: "600" }}>
                  {stepsLeft > 0 ? `${stepsLeft.toLocaleString()} steps left` : "Goal Achieved! 🎉"}
                </Caption>
              </View>
            </View>

            {/* Target indicator */}
            <View style={styles.targetBarRow}>
              <Caption variant="caption2" color={t.textMuted}>
                0
              </Caption>
              <Caption variant="caption2" color={t.textSecondary} style={{ fontWeight: "600" }}>
                Target: {stepGoal.toLocaleString()} steps
              </Caption>
              <Caption variant="caption2" color={t.textMuted}>
                {stepGoal.toLocaleString()}
              </Caption>
            </View>

            {/* Quick Walk Test Adders */}
            <View style={styles.quickAddRow}>
              <Caption variant="caption2" color={t.textMuted}>
                {pedometerActive ? "📱 Sensor Active" : "📱 Manual Log"}:
              </Caption>
              <Pressable
                onPress={() => handleQuickAddSteps(250)}
                style={[styles.quickStepBtn, { backgroundColor: t.background }]}
              >
                <Caption variant="caption2" color={t.accent} style={{ fontWeight: "600" }}>
                  +250
                </Caption>
              </Pressable>
              <Pressable
                onPress={() => handleQuickAddSteps(500)}
                style={[styles.quickStepBtn, { backgroundColor: t.background }]}
              >
                <Caption variant="caption2" color={t.accent} style={{ fontWeight: "600" }}>
                  +500
                </Caption>
              </Pressable>
              <Pressable
                onPress={() => handleQuickAddSteps(1000)}
                style={[styles.quickStepBtn, { backgroundColor: t.background }]}
              >
                <Caption variant="caption2" color={t.accent} style={{ fontWeight: "600" }}>
                  +1k
                </Caption>
              </Pressable>
            </View>
          </View>
        </Animated.View>

        {/* ─── 3 Metrics Pill Row (Screenshot 1 & 3) ──────────── */}
        <Animated.View entering={FadeInDown.delay(60).duration(300)}>
          <View style={styles.metricsTripleRow}>
            {/* Steps */}
            <View style={[styles.tripleMetricCard, { backgroundColor: t.card }]}>
              <View style={[styles.tripleIconWrap, { backgroundColor: "#10B98120" }]}>
                <PlatformSymbol
                  ios="figure.walk"
                  material="directions-walk"
                  tintColor="#10B981"
                  size={18}
                />
              </View>
              <Heading variant="title3">{steps.toLocaleString()}</Heading>
              <Caption variant="caption2" color={t.textMuted}>
                Steps Walked
              </Caption>
            </View>

            {/* Distance */}
            <View style={[styles.tripleMetricCard, { backgroundColor: t.card }]}>
              <View style={[styles.tripleIconWrap, { backgroundColor: "#38BDF820" }]}>
                <PlatformSymbol
                  ios="map"
                  material="place"
                  tintColor="#38BDF8"
                  size={18}
                />
              </View>
              <Heading variant="title3">{stepMetrics.distanceKm} km</Heading>
              <Caption variant="caption2" color={t.textMuted}>
                Distance
              </Caption>
            </View>

            {/* Calories */}
            <View style={[styles.tripleMetricCard, { backgroundColor: t.card }]}>
              <View style={[styles.tripleIconWrap, { backgroundColor: "#F59E0B20" }]}>
                <PlatformSymbol
                  ios="flame.fill"
                  material="whatshot"
                  tintColor="#F59E0B"
                  size={18}
                />
              </View>
              <Heading variant="title3">{stepMetrics.caloriesKcal}</Heading>
              <Caption variant="caption2" color={t.textMuted}>
                kCal Lost
              </Caption>
            </View>
          </View>
        </Animated.View>

        {/* ─── Water Hydration Tracker with Animation ────────── */}
        <Animated.View entering={FadeInDown.delay(120).duration(300)}>
          <View style={[styles.waterCard, { backgroundColor: t.card }]}>
            <View style={styles.waterHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                <View style={[styles.waterIconCircle, { backgroundColor: "#38BDF820" }]}>
                  <PlatformSymbol
                    ios="drop.fill"
                    material="water-drop"
                    tintColor="#38BDF8"
                    size={22}
                  />
                </View>
                <View>
                  <Heading variant="title3">Daily Hydration</Heading>
                  <Caption variant="caption2" color={t.textMuted}>
                    Target: {DEFAULT_GLASS_TARGET} glasses ({DEFAULT_GLASS_TARGET * GLASS_ML} ml)
                  </Caption>
                </View>
              </View>

              <View style={styles.waterGlassesBadge}>
                <Heading variant="title2" color="#38BDF8">
                  {waterGlasses}
                </Heading>
                <Caption variant="caption2" color={t.textMuted}>
                  / {DEFAULT_GLASS_TARGET}
                </Caption>
              </View>
            </View>

            {/* Glasses Visual Display */}
            <View style={styles.glassesContainer}>
              {Array.from({ length: DEFAULT_GLASS_TARGET }).map((_, idx) => {
                const filled = idx < waterGlasses;
                return (
                  <View
                    key={idx}
                    style={[
                      styles.glassBox,
                      {
                        backgroundColor: filled ? "#38BDF8" : t.background,
                        borderColor: filled ? "#38BDF8" : t.border,
                      },
                    ]}
                  >
                    <PlatformSymbol
                      ios="drop.fill"
                      material="water-drop"
                      tintColor={filled ? "#fff" : t.textMuted}
                      size={14}
                    />
                  </View>
                );
              })}
            </View>

            {/* Water Action Buttons */}
            <View style={styles.waterActionsRow}>
              <Pressable
                onPress={handleRemoveGlass}
                disabled={waterGlasses <= 0}
                style={[
                  styles.waterBtnSec,
                  { borderColor: t.border, opacity: waterGlasses <= 0 ? 0.3 : 1 },
                ]}
              >
                <Caption variant="caption2" color={t.textPrimary}>
                  - 1 Glass
                </Caption>
              </Pressable>

              <Pressable
                onPress={handleAddGlass}
                style={[styles.waterBtnPrimary, { backgroundColor: "#38BDF8" }]}
              >
                <PlatformSymbol
                  ios="plus"
                  material="add"
                  tintColor="#fff"
                  size={16}
                />
                <Body variant="bodyMedium" color="#fff" style={{ fontWeight: "700" }}>
                  + Drink Glass ({GLASS_ML}ml)
                </Body>
              </Pressable>
            </View>

            {/* Hourly Reminder Toggle */}
            <View style={[styles.reminderBar, { backgroundColor: t.background }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Body variant="bodyMedium">Hourly Water Notification</Body>
                <Caption variant="caption2" color={t.textMuted}>
                  Alerts you every hour between 9 AM and 9 PM to hydrate.
                </Caption>
              </View>
              <Switch
                value={hourlyWaterReminder}
                onValueChange={handleToggleWaterReminder}
                trackColor={{ false: t.border, true: "#38BDF8" }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </Animated.View>

        {/* ─── Body Vitals: Weight, Height, BMI, Sleep ───────── */}
        <Animated.View entering={FadeInDown.delay(180).duration(300)}>
          <View style={styles.vitalsGrid}>
            {/* Weight Card */}
            <Pressable
              onPress={() => {
                setWeightInput(weightKg ? String(weightKg) : "");
                setGoalInput(goalWeightKg ? String(goalWeightKg) : "");
                setWeightModal(true);
              }}
              style={[styles.vitalCard, { backgroundColor: t.card }]}
            >
              <View style={styles.vitalHeader}>
                <Caption variant="caption2" color={t.textMuted}>
                  WEIGHT
                </Caption>
                <PlatformSymbol
                  ios="pencil"
                  material="edit"
                  tintColor={t.textMuted}
                  size={14}
                />
              </View>
              <Heading variant="title1" color={t.textPrimary}>
                {weightKg ? `${weightKg} kg` : "Set weight"}
              </Heading>
              <Caption variant="caption2" color={t.accent}>
                {goalWeightKg ? `Goal: ${goalWeightKg} kg` : "Tap to set goal"}
              </Caption>
            </Pressable>

            {/* Height & BMI Card */}
            <Pressable
              onPress={() => {
                setHeightInput(heightCm ? String(heightCm) : "");
                setHeightModal(true);
              }}
              style={[styles.vitalCard, { backgroundColor: t.card }]}
            >
              <View style={styles.vitalHeader}>
                <Caption variant="caption2" color={t.textMuted}>
                  HEIGHT & BMI
                </Caption>
                <PlatformSymbol
                  ios="pencil"
                  material="edit"
                  tintColor={t.textMuted}
                  size={14}
                />
              </View>
              <Heading variant="title1" color={t.textPrimary}>
                {heightCm ? `${heightCm} cm` : "Set height"}
              </Heading>
              <Caption
                variant="caption2"
                color={bmiInfo?.color ?? t.textMuted}
                style={{ fontWeight: "700" }}
              >
                {bmiInfo ? `BMI: ${bmiInfo.val} (${bmiInfo.label})` : "Enter height for BMI"}
              </Caption>
            </Pressable>

            {/* Sleep Card */}
            <Pressable
              onPress={() => {
                const h = Math.floor(sleepMinutes / 60);
                const m = sleepMinutes % 60;
                setSleepHoursInput(h > 0 ? String(h) : "7");
                setSleepMinutesInput(m > 0 ? String(m) : "30");
                setSleepModal(true);
              }}
              style={[styles.vitalCardFull, { backgroundColor: t.card }]}
            >
              <View style={styles.vitalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                  <PlatformSymbol
                    ios="moon.stars.fill"
                    material="bedtime"
                    tintColor="#A78BFA"
                    size={18}
                  />
                  <Heading variant="title3">Sleep Time</Heading>
                </View>
                <PlatformSymbol
                  ios="pencil"
                  material="edit"
                  tintColor={t.textMuted}
                  size={14}
                />
              </View>
              <View style={styles.sleepValuesRow}>
                <Heading variant="largeTitle" color="#A78BFA">
                  {sleepMinutes > 0 ? sleepFormatted : "7h 30m"}
                </Heading>
                <View style={[styles.sleepQualityPill, { backgroundColor: "#A78BFA20" }]}>
                  <Caption variant="caption2" color="#A78BFA" style={{ fontWeight: "700" }}>
                    {sleepMinutes >= 420 ? "OPTIMAL RECOVERY" : "LIGHT SLEEP"}
                  </Caption>
                </View>
              </View>
            </Pressable>
          </View>
        </Animated.View>

        {/* ─── 7-Day Steps Chart (Screenshot 3 Style) ────────── */}
        <Animated.View entering={FadeInDown.delay(240).duration(300)}>
          <View style={[styles.chartCard, { backgroundColor: t.card }]}>
            <View style={styles.chartHeaderRow}>
              <View>
                <Heading variant="title3">Steps Overview</Heading>
                <Caption variant="caption2" color={t.textMuted}>
                  Past 7 days activity
                </Caption>
              </View>
              <View style={[styles.weekBadge, { backgroundColor: t.accent + "18" }]}>
                <Caption variant="caption2" color={t.accent} style={{ fontWeight: "700" }}>
                  THIS WEEK
                </Caption>
              </View>
            </View>

            <View style={styles.barsContainer}>
              {weeklySteps.map((item) => {
                const isToday = item.date === day;
                const pct = maxWeekSteps > 0 ? (item.steps / maxWeekSteps) * 100 : 0;
                return (
                  <View key={item.date} style={styles.barCol}>
                    {/* Floating badge for active/today steps */}
                    {isToday && item.steps > 0 && (
                      <View style={[styles.activeFloatingPill, { backgroundColor: t.accent }]}>
                        <Caption variant="caption2" color="#fff" style={{ fontWeight: "700", fontSize: 9 }}>
                          {item.steps >= 1000 ? `${(item.steps / 1000).toFixed(1)}k` : item.steps}
                        </Caption>
                      </View>
                    )}
                    <View style={[styles.barTrack, { backgroundColor: t.background }]}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${Math.max(8, Math.min(100, Math.round(pct)))}%`,
                            backgroundColor: isToday ? t.accent : t.borderLight,
                          },
                        ]}
                      />
                    </View>
                    <Caption
                      variant="caption2"
                      color={isToday ? t.accent : t.textMuted}
                      style={{ fontWeight: isToday ? "700" : "500", marginTop: 4 }}
                    >
                      {weekdayShort(item.date)}
                    </Caption>
                  </View>
                );
              })}
            </View>
          </View>
        </Animated.View>

        {/* ─── Step History Cards List (Screenshot 3) ───────── */}
        <Animated.View entering={FadeInDown.delay(300).duration(300)}>
          <Heading variant="title3" style={{ marginBottom: spacing.xs }}>
            Steps History
          </Heading>
          <View style={styles.historyList}>
            {weeklySteps
              .slice()
              .reverse()
              .map((item) => {
                const metric = computeStepMetrics(item.steps, stepGoal);
                const isToday = item.date === day;
                return (
                  <Card key={item.date} style={styles.historyCard}>
                    <View style={styles.historyCardTop}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Heading variant="title3">
                          {item.steps.toLocaleString()} steps
                        </Heading>
                        <Caption variant="caption2" color={t.textMuted}>
                          {isToday
                            ? "Today"
                            : new Date(item.date + "T12:00:00").toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                        </Caption>
                      </View>
                      <View
                        style={[
                          styles.historyIntensityBadge,
                          {
                            backgroundColor:
                              metric.intensity === "Intense"
                                ? "#F59E0B20"
                                : metric.intensity === "Active"
                                  ? "#10B98120"
                                  : t.background,
                          },
                        ]}
                      >
                        <Caption
                          variant="caption2"
                          color={
                            metric.intensity === "Intense"
                              ? "#F59E0B"
                              : metric.intensity === "Active"
                                ? "#10B981"
                                : t.textMuted
                          }
                          style={{ fontWeight: "700" }}
                        >
                          ⚡ {metric.intensity}
                        </Caption>
                      </View>
                    </View>

                    <View style={styles.historyCardBottom}>
                      <View style={{ flexDirection: "row", gap: spacing.md }}>
                        <Caption variant="caption2" color={t.textSecondary}>
                          📍 {metric.distanceKm} km
                        </Caption>
                        <Caption variant="caption2" color={t.textSecondary}>
                          🔥 {metric.caloriesKcal} kcal
                        </Caption>
                      </View>
                      <Caption variant="caption2" color={t.accent} style={{ fontWeight: "700" }}>
                        {metric.percentage}%
                      </Caption>
                    </View>
                  </Card>
                );
              })}
          </View>
        </Animated.View>
      </ScrollView>

      {/* ─── Weight Modal ──────────────────────────────────── */}
      <Modal visible={weightModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: t.card }]}>
            <Heading variant="title2">Weight Tracker</Heading>
            <View style={{ gap: spacing.xs }}>
              <Caption variant="caption2" color={t.textMuted}>
                CURRENT WEIGHT (KG)
              </Caption>
              <TextInput
                style={[styles.modalInput, { color: t.textPrimary, borderColor: t.border }]}
                value={weightInput}
                onChangeText={setWeightInput}
                placeholder="72.5"
                placeholderTextColor={t.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ gap: spacing.xs }}>
              <Caption variant="caption2" color={t.textMuted}>
                GOAL WEIGHT (KG)
              </Caption>
              <TextInput
                style={[styles.modalInput, { color: t.textPrimary, borderColor: t.border }]}
                value={goalInput}
                onChangeText={setGoalInput}
                placeholder="68.0"
                placeholderTextColor={t.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.modalBtns}>
              <Button title="Save Weight" onPress={handleSaveWeight} />
              <Button title="Cancel" variant="secondary" onPress={() => setWeightModal(false)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Height Modal ──────────────────────────────────── */}
      <Modal visible={heightModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: t.card }]}>
            <Heading variant="title2">Enter Height for BMI</Heading>
            <View style={{ gap: spacing.xs }}>
              <Caption variant="caption2" color={t.textMuted}>
                HEIGHT (CM)
              </Caption>
              <TextInput
                style={[styles.modalInput, { color: t.textPrimary, borderColor: t.border }]}
                value={heightInput}
                onChangeText={setHeightInput}
                placeholder="175"
                placeholderTextColor={t.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.modalBtns}>
              <Button title="Save Height" onPress={handleSaveHeight} />
              <Button title="Cancel" variant="secondary" onPress={() => setHeightModal(false)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Sleep Modal ───────────────────────────────────── */}
      <Modal visible={sleepModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: t.card }]}>
            <Heading variant="title2">Log Sleep Time</Heading>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Caption variant="caption2" color={t.textMuted}>
                  HOURS
                </Caption>
                <TextInput
                  style={[styles.modalInput, { color: t.textPrimary, borderColor: t.border }]}
                  value={sleepHoursInput}
                  onChangeText={setSleepHoursInput}
                  placeholder="7"
                  placeholderTextColor={t.textMuted}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Caption variant="caption2" color={t.textMuted}>
                  MINUTES
                </Caption>
                <TextInput
                  style={[styles.modalInput, { color: t.textPrimary, borderColor: t.border }]}
                  value={sleepMinutesInput}
                  onChangeText={setSleepMinutesInput}
                  placeholder="30"
                  placeholderTextColor={t.textMuted}
                  keyboardType="number-pad"
                />
              </View>
            </View>
            <View style={styles.modalBtns}>
              <Button title="Save Sleep" onPress={handleSaveSleep} />
              <Button title="Cancel" variant="secondary" onPress={() => setSleepModal(false)} />
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Step Goal Modal ───────────────────────────────── */}
      <Modal visible={stepGoalModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: t.card }]}>
            <Heading variant="title2">Daily Step Target</Heading>
            <View style={{ gap: spacing.xs }}>
              <Caption variant="caption2" color={t.textMuted}>
                DAILY STEP GOAL
              </Caption>
              <TextInput
                style={[styles.modalInput, { color: t.textPrimary, borderColor: t.border }]}
                value={stepGoalInput}
                onChangeText={setStepGoalInput}
                placeholder="10000"
                placeholderTextColor={t.textMuted}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.modalBtns}>
              <Button
                title="Save Target"
                onPress={() => {
                  const g = parseInt(stepGoalInput, 10);
                  if (g > 0) setStepGoal(g);
                  setStepGoalModal(false);
                }}
              />
              <Button title="Cancel" variant="secondary" onPress={() => setStepGoalModal(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing["5xl"],
    gap: spacing.lg,
  },

  // Gauge Hero
  heroGaugeCard: {
    borderRadius: radius["2xl"],
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  gaugeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  todayDateText: {
    fontWeight: "600",
  },
  intensityPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  arcContainer: {
    width: 220,
    height: 120,
    alignItems: "center",
    justifyContent: "flex-end",
    position: "relative",
    overflow: "hidden",
  },
  arcBackgroundTrack: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 16,
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
    position: "absolute",
    top: 0,
    transform: [{ rotate: "225deg" }],
  },
  arcFillOverlay: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 16,
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
    position: "absolute",
    top: -16,
    left: -16,
  },
  arcCenterContent: {
    alignItems: "center",
    paddingBottom: spacing.xs,
  },
  arcPercentage: {
    fontSize: 48,
    lineHeight: 52,
    fontWeight: "800",
  },
  targetBarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: spacing.md,
  },
  quickAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  quickStepBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },

  // 3 Metric Pills
  metricsTripleRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  tripleMetricCard: {
    flex: 1,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.xxs,
  },
  tripleIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },

  // Water Card
  waterCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  waterHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  waterIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  waterGlassesBadge: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  glassesContainer: {
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "space-between",
  },
  glassBox: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  waterActionsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  waterBtnSec: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  waterBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  reminderBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.xs,
  },

  // Vitals Grid
  vitalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  vitalCard: {
    width: "48%",
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  vitalCardFull: {
    width: "100%",
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  vitalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sleepValuesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  sleepQualityPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },

  // Chart Card
  chartCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  chartHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weekBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  barsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 140,
    paddingTop: spacing.lg,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
    position: "relative",
  },
  activeFloatingPill: {
    position: "absolute",
    top: -18,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: radius.full,
    zIndex: 2,
  },
  barTrack: {
    width: 14,
    height: 100,
    borderRadius: 7,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barFill: {
    width: "100%",
    borderRadius: 7,
  },

  // History List
  historyList: {
    gap: spacing.sm,
  },
  historyCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  historyCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  historyIntensityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  historyCardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.15)",
    paddingTop: spacing.xs,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  modalBtns: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
