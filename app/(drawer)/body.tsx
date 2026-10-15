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
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import { computeEnergyScore } from "@/lib/energyScore";
import {
  getBodyWeights,
  getGoalWeightKg,
  getMetrics,
  logBodyWeight,
  saveMetrics,
  setGoalWeightKg,
} from "@/lib/firestoreDatabase";
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
import type { EnergyLevel, Metrics, MoodState } from "@/lib/types";
import {
  addWaterGlass,
  DEFAULT_GLASS_TARGET,
  getTodayWaterGlasses,
  getWaterHourlyReminderEnabled,
  GLASS_ML,
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

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function BodyScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const day = todayISO();

  // Steps state
  const [steps, setSteps] = useState(0);
  const [stepGoal, setStepGoal] = useState(DEFAULT_STEP_GOAL);
  const [pedometerActive, setPedometerActive] = useState(false);
  const [selectedDayISO, setSelectedDayISO] = useState(day);

  // Water state
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [hourlyWaterReminder, setHourlyWaterReminder] = useState(false);

  // Sleep & Vitals
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [bedTime, setBedTime] = useState<string>("23:00");
  const [wakeTime, setWakeTime] = useState<string>("07:00");
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [goalWeightKg, setGoalWeightState] = useState<number | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);

  // Movement & Outdoor logs (Milestone 4)
  const [walkMinutes, setWalkMinutes] = useState(0);
  const [workoutMinutes, setWorkoutMinutes] = useState(0);
  const [stretchingMinutes, setStretchingMinutes] = useState(0);
  const [outdoorMinutes, setOutdoorMinutes] = useState(0);

  // Energy & Mood check-in (Milestone 4)
  const [energyRating, setEnergyRating] = useState<EnergyLevel | null>(null);
  const [moodRating, setMoodRating] = useState<MoodState | null>(null);

  // Correlation: yesterday metrics
  const [yesterdaySleepMins, setYesterdaySleepMins] = useState<number>(0);
  const [yesterdayScreenTime, setYesterdayScreenTime] = useState<number>(0);

  // History & charts
  const [chartDays, setChartDays] = useState<{ date: string; dayNum: number; steps: number }[]>([]);
  const [metricsByDate, setMetricsByDate] = useState<Record<string, Metrics>>({});
  const [weightsHistory, setWeightsHistory] = useState<{ date: string; kg: number }[]>([]);

  // Modals
  const [weightModal, setWeightModal] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [goalInput, setGoalInput] = useState("");

  const [heightModal, setHeightModal] = useState(false);
  const [heightInput, setHeightInput] = useState("");

  const [sleepModal, setSleepModal] = useState(false);
  const [sleepHoursInput, setSleepHoursInput] = useState("");
  const [sleepMinutesInput, setSleepMinutesInput] = useState("");
  const [bedTimeInput, setBedTimeInput] = useState("23:00");
  const [wakeTimeInput, setWakeTimeInput] = useState("07:00");

  const [stepGoalModal, setStepGoalModal] = useState(false);
  const [stepGoalInput, setStepGoalInput] = useState("");

  const [movementModal, setMovementModal] = useState(false);

  // Current month label
  const currentMonthLabel = useMemo(() => {
    const curDate = new Date();
    return MONTH_NAMES[curDate.getMonth()];
  }, []);

  // Load all data from Firestore as source of truth
  const load = useCallback(async () => {
    // 1. Pedometer sensor
    const available = await isPedometerAvailable();
    setPedometerActive(available);

    const [hardwareSteps, savedSteps] = await Promise.all([
      syncPedometerSensorSteps(day),
      getTodaySteps(day),
    ]);
    const currentSteps = hardwareSteps != null ? hardwareSteps : savedSteps;
    setSteps(currentSteps);

    // 2. Water glasses & reminder
    const [glasses, reminderOn] = await Promise.all([
      getTodayWaterGlasses(day),
      getWaterHourlyReminderEnabled(),
    ]);
    setWaterGlasses(glasses);
    setHourlyWaterReminder(reminderOn);

    // 3. Firestore metrics for today
    const [todayMetrics, yestMetrics, goalKg, weights7] = await Promise.all([
      getMetrics(day),
      getMetrics(addDays(day, -1)),
      getGoalWeightKg(),
      getBodyWeights(addDays(day, -6), day),
    ]);

    if (todayMetrics) {
      if (todayMetrics.sleepMinutes != null) setSleepMinutes(todayMetrics.sleepMinutes);
      if (todayMetrics.bedTime) setBedTime(todayMetrics.bedTime);
      if (todayMetrics.wakeTime) setWakeTime(todayMetrics.wakeTime);
      if (todayMetrics.heightCm != null) setHeightCm(todayMetrics.heightCm);
      if (todayMetrics.weightKg != null) setWeightKg(todayMetrics.weightKg);
      if (todayMetrics.waterGlasses != null) setWaterGlasses(todayMetrics.waterGlasses);
      if (todayMetrics.energyRating) setEnergyRating(todayMetrics.energyRating);
      if (todayMetrics.moodRating) setMoodRating(todayMetrics.moodRating);
      if (todayMetrics.walkMinutes != null) setWalkMinutes(todayMetrics.walkMinutes);
      if (todayMetrics.workoutMinutes != null) setWorkoutMinutes(todayMetrics.workoutMinutes);
      if (todayMetrics.stretchingMinutes != null) setStretchingMinutes(todayMetrics.stretchingMinutes);
      if (todayMetrics.outdoorMinutes != null) setOutdoorMinutes(todayMetrics.outdoorMinutes);
      if (todayMetrics.steps != null && todayMetrics.steps > currentSteps) {
        setSteps(todayMetrics.steps);
      }
    }

    // Yesterday's metrics for next-day correlation
    if (yestMetrics) {
      setYesterdaySleepMins(yestMetrics.sleepMinutes ?? 0);
      setYesterdayScreenTime(yestMetrics.screenTime ?? 0);
    }

    if (goalKg != null) setGoalWeightState(goalKg);

    const latestW = weights7.find((w) => w.date === day);
    if (latestW) setWeightKg(latestW.kg);
    setWeightsHistory(weights7);

    // 4. Build 9-day horizontal bar chart array with REAL Firestore data (NO HARDCODED/RANDOM NUMBERS)
    const daysArr: { date: string; dayNum: number; steps: number }[] = [];
    const mByDate: Record<string, Metrics> = {};

    for (let i = 5; i >= -3; i--) {
      const d = addDays(day, -i);
      const dayNum = parseInt(d.slice(8, 10), 10);
      let s = 0;
      if (d === day) {
        s = currentSteps;
        if (todayMetrics) {
          mByDate[d] = { ...todayMetrics, steps: currentSteps };
        }
      } else if (i > 0) {
        // Query real past metrics
        const m = await getMetrics(d);
        if (m) {
          mByDate[d] = m;
          s = m.steps ?? 0;
        }
      }
      daysArr.push({ date: d, dayNum, steps: s });
    }
    setMetricsByDate(mByDate);
    setChartDays(daysArr);
  }, [day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Live pedometer subscription
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = subscribeLivePedometer((delta) => {
      setSteps((prev) => {
        const next = prev + delta;
        saveDailySteps(next, day);
        saveMetrics({ date: day, steps: next }).catch(() => { });
        return next;
      });
    });
    return () => sub.remove();
  }, [day]);

  // Is viewing today or a historical date
  const isViewingToday = selectedDayISO === day;

  const selectedDateLabel = useMemo(() => {
    const d = new Date(selectedDayISO + "T12:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }, [selectedDayISO]);

  // Unified metrics for the selected active day (supports clicking any bar)
  const activeDayMetrics = useMemo(() => {
    if (isViewingToday) {
      return {
        steps,
        waterGlasses,
        sleepMinutes,
        bedTime,
        wakeTime,
        weightKg,
        heightCm,
        walkMinutes,
        workoutMinutes,
        stretchingMinutes,
        outdoorMinutes,
        energyRating,
        moodRating,
      };
    }
    const m = metricsByDate[selectedDayISO];
    const chartDay = chartDays.find((c) => c.date === selectedDayISO);
    return {
      steps: m?.steps ?? (chartDay?.steps ?? 0),
      waterGlasses: m?.waterGlasses ?? 0,
      sleepMinutes: m?.sleepMinutes ?? 0,
      bedTime: m?.bedTime ?? "23:00",
      wakeTime: m?.wakeTime ?? "07:00",
      weightKg: m?.weightKg ?? weightKg,
      heightCm: m?.heightCm ?? heightCm,
      walkMinutes: m?.walkMinutes ?? 0,
      workoutMinutes: m?.workoutMinutes ?? 0,
      stretchingMinutes: m?.stretchingMinutes ?? 0,
      outdoorMinutes: m?.outdoorMinutes ?? 0,
      energyRating: m?.energyRating ?? null,
      moodRating: m?.moodRating ?? null,
    };
  }, [
    isViewingToday,
    selectedDayISO,
    metricsByDate,
    chartDays,
    steps,
    waterGlasses,
    sleepMinutes,
    bedTime,
    wakeTime,
    weightKg,
    heightCm,
    walkMinutes,
    workoutMinutes,
    stretchingMinutes,
    outdoorMinutes,
    energyRating,
    moodRating,
  ]);

  // Derived step metrics for active day
  const activeStepMetrics: StepMetricsSummary = useMemo(() => {
    return computeStepMetrics(activeDayMetrics.steps, stepGoal);
  }, [activeDayMetrics.steps, stepGoal]);

  // Calories: burned from active day's steps + workout minutes + walk minutes
  const totalCaloriesKcal = useMemo(() => {
    const fromSteps = Math.round(activeDayMetrics.steps * 0.04);
    const fromWorkouts = Math.round(activeDayMetrics.workoutMinutes * 7.5);
    const fromWalk = Math.round(activeDayMetrics.walkMinutes * 4.2);
    return Math.max(fromSteps + fromWorkouts + fromWalk, activeStepMetrics.caloriesKcal);
  }, [activeDayMetrics.steps, activeDayMetrics.workoutMinutes, activeDayMetrics.walkMinutes, activeStepMetrics.caloriesKcal]);

  // Calories ring percentage (based on target 2,500 kcal)
  const caloriesPct = useMemo(() => {
    const target = 2500;
    return Math.min(100, Math.round((totalCaloriesKcal / target) * 100));
  }, [totalCaloriesKcal]);

  // Water ring percentage (based on target 2,000 ml)
  const waterMl = activeDayMetrics.waterGlasses * GLASS_ML;
  const waterTargetMl = DEFAULT_GLASS_TARGET * GLASS_ML;
  const waterPct = Math.min(100, Math.round((waterMl / waterTargetMl) * 100));

  // Sleep formatted
  const sleepHours = (activeDayMetrics.sleepMinutes / 60).toFixed(2);
  const sleepFormatted = useMemo(() => {
    const h = Math.floor(activeDayMetrics.sleepMinutes / 60);
    const m = activeDayMetrics.sleepMinutes % 60;
    return `${h}h ${m}m`;
  }, [activeDayMetrics.sleepMinutes]);

  // BMI Info
  const bmiInfo = useMemo(() => {
    if (!weightKg || !heightCm || heightCm <= 0) return null;
    const m = heightCm / 100;
    const val = parseFloat((weightKg / (m * m)).toFixed(1));
    let label = "Normal";
    let color = "#10B981";
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

  // Next-day energy score computation
  const energyComposite = useMemo(() => {
    return computeEnergyScore({
      steps,
      exerciseMinutes: workoutMinutes + walkMinutes,
      sleepMinutes: yesterdaySleepMins > 0 ? yesterdaySleepMins : sleepMinutes,
      screenTimeMinutes: yesterdayScreenTime > 0 ? Math.round(yesterdayScreenTime / 60) : 120,
    });
  }, [steps, workoutMinutes, walkMinutes, yesterdaySleepMins, sleepMinutes, yesterdayScreenTime]);

  // Correlation insight message
  const correlationInsight = useMemo(() => {
    const yestSleepHours = yesterdaySleepMins > 0 ? (yesterdaySleepMins / 60).toFixed(1) : null;
    const yestScreenHours = yesterdayScreenTime > 0 ? (yesterdayScreenTime / 3600).toFixed(1) : null;

    if (yestSleepHours && parseFloat(yestSleepHours) < 6.0) {
      return `Rest deficit detected: Under 6h sleep yesterday (${yestSleepHours}h) reduced today's morning cognitive drive. Prioritize 15m outdoor sunlight and an earlier bedtime tonight.`;
    }
    if (yestScreenHours && parseFloat(yestScreenHours) > 4.5) {
      return `Screen fatigue alert: High screen time yesterday (${yestScreenHours}h) overstimulated dopamine loops. Gentle stretching and hydration will elevate today's focus.`;
    }
    if (yestSleepHours && parseFloat(yestSleepHours) >= 7.0) {
      return `Optimal recovery cycle: ${yestSleepHours}h sleep yesterday boosted today's energy score to ${energyComposite.score}%. Your body is primed for deep work and fitness.`;
    }
    return `Consistent sleep timing (bed by ${bedTime}, wake by ${wakeTime}) keeps your circadian rhythm in peak synchronization.`;
  }, [yesterdaySleepMins, yesterdayScreenTime, bedTime, wakeTime, energyComposite.score]);

  // Handlers
  const handleAddGlass = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const next = await addWaterGlass(day);
    setWaterGlasses(next);
    await saveMetrics({ date: day, waterGlasses: next });
  };

  const handleRemoveGlass = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = await removeWaterGlass(day);
    setWaterGlasses(next);
    await saveMetrics({ date: day, waterGlasses: next });
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

  const handleSetEnergy = async (level: EnergyLevel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEnergyRating(level);
    await saveMetrics({ date: day, energyRating: level });
  };

  const handleSetMood = async (m: MoodState) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMoodRating(m);
    await saveMetrics({ date: day, moodRating: m });
  };

  const handleAddMovementMinutes = async (type: "walk" | "workout" | "stretch" | "outdoor", mins: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (type === "walk") {
      const next = walkMinutes + mins;
      setWalkMinutes(next);
      await saveMetrics({ date: day, walkMinutes: next });
    } else if (type === "workout") {
      const next = workoutMinutes + mins;
      setWorkoutMinutes(next);
      await saveMetrics({ date: day, workoutMinutes: next });
    } else if (type === "stretch") {
      const next = stretchingMinutes + mins;
      setStretchingMinutes(next);
      await saveMetrics({ date: day, stretchingMinutes: next });
    } else if (type === "outdoor") {
      const next = outdoorMinutes + mins;
      setOutdoorMinutes(next);
      await saveMetrics({ date: day, outdoorMinutes: next });
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
    setBedTime(bedTimeInput);
    setWakeTime(wakeTimeInput);
    await saveMetrics({
      sleepMinutes: totalMin,
      bedTime: bedTimeInput,
      wakeTime: wakeTimeInput,
      date: day,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSleepModal(false);
  };

  const maxStepsInChart = Math.max(...chartDays.map((c) => c.steps), stepGoal, 1);

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* ─── Top Header ─────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.openDrawer();
          }}
          hitSlop={12}
          style={styles.menuButton}
        >
          <PlatformSymbol
            ios="line.3.horizontal"
            material="menu"
            tintColor={t.textPrimary}
            size={22}
          />
        </Pressable>
        <Heading variant="title3">Physical Health & Energy</Heading>
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
        {/* ─── 1. Top Steps Card (Matching Dribbble Design) ──── */}
        <Animated.View entering={FadeIn.duration(300)}>
          <Card style={styles.topStepsCard}>
            {/* Steps Title & Month Selector */}
            <View style={styles.stepsCardHeader}>
              <View style={styles.stepsTitleLeft}>
                <PlatformSymbol
                  ios="leaf.fill"
                  material="eco"
                  tintColor="#10B981"
                  size={20}
                />
                <Heading variant="title3" style={{ marginLeft: 6, fontWeight: "700" }}>
                  Steps
                </Heading>
              </View>

              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert("Current Month", `Tracking vitals for ${currentMonthLabel}.`);
                }}
                style={styles.monthSelector}
              >
                <Body variant="bodyMedium" color={t.textSecondary} style={{ fontWeight: "600" }}>
                  {currentMonthLabel}
                </Body>
                <PlatformSymbol
                  ios="chevron.down"
                  material="keyboard-arrow-down"
                  tintColor={t.textMuted}
                  size={16}
                />
              </Pressable>
            </View>

            {/* Metrics Figures Row (e.g. 3,680 steps | 4.29 km) */}
            <View style={styles.stepsNumbersRow}>
              <View style={styles.stepNumCol}>
                <Heading variant="title1" style={styles.boldFigure}>
                  {activeDayMetrics.steps.toLocaleString()}
                </Heading>
                <Caption variant="caption1" color={t.textMuted} style={styles.figureUnit}>
                  steps
                </Caption>
              </View>

              <View style={styles.stepNumCol}>
                <Heading variant="title1" style={styles.boldFigure}>
                  {activeStepMetrics.distanceKm}
                </Heading>
                <Caption variant="caption1" color={t.textMuted} style={styles.figureUnit}>
                  km
                </Caption>
              </View>
            </View>

            {/* Horizontal Date Bar Chart with Centered Floating Pill */}
            <View style={styles.dateBarChartContainer}>
              {chartDays.map((item) => {
                const isSelected = item.date === selectedDayISO;
                const isToday = item.date === day;
                const heightPct = Math.max(16, Math.min(100, Math.round((item.steps / maxStepsInChart) * 100)));

                return (
                  <Pressable
                    key={item.date}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedDayISO(item.date);
                    }}
                    style={styles.dateBarCol}
                  >
                    {/* Floating Pill on Active / Selected Day */}
                    {isSelected && (
                      <View style={styles.floatingPillBadge}>
                        <Caption variant="caption2" color="#fff" style={{ fontWeight: "800", fontSize: 10 }}>
                          {item.steps > 0 ? item.steps.toLocaleString() : "0"}
                        </Caption>
                      </View>
                    )}

                    {/* Bar Cylinder */}
                    <View style={[styles.barCylinderTrack, { backgroundColor: isSelected ? "#10B98122" : t.border + "33" }]}>
                      <View
                        style={[
                          styles.barCylinderFill,
                          {
                            height: `${heightPct}%`,
                            backgroundColor: isSelected ? "#10B981" : "#10B98155",
                          },
                        ]}
                      />
                    </View>

                    {/* Day number */}
                    <Caption
                      variant="caption2"
                      color={isSelected ? "#10B981" : t.textMuted}
                      style={[
                        styles.dayNumberLabel,
                        isSelected && { fontWeight: "800", color: "#10B981" },
                      ]}
                    >
                      {item.dayNum}
                    </Caption>
                  </Pressable>
                );
              })}
            </View>

            {/* Active Date Context Banner if viewing historical day (replaces manual walk log) */}
            {!isViewingToday && (
              <View style={[styles.historicalBanner, { backgroundColor: t.background }]}>
                <PlatformSymbol ios="calendar" material="event" tintColor="#10B981" size={14} />
                <Caption variant="caption2" color="#10B981" style={{ fontWeight: "700", marginLeft: 6, flex: 1 }}>
                  Viewing {selectedDateLabel}
                </Caption>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedDayISO(day);
                  }}
                  style={styles.returnTodayBtn}
                >
                  <Caption variant="caption2" color="#fff" style={{ fontWeight: "700" }}>
                    Return to Today
                  </Caption>
                </Pressable>
              </View>
            )}
          </Card>
        </Animated.View>

        {/* ─── 2. 2x2 Vital Grid (Matching Dribbble Layout) ───── */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <View style={styles.vitals2x2Grid}>
            {/* Card 1: Calories */}
            <Card style={styles.vitalGridCard}>
              <View style={styles.vitalCardHeaderRow}>
                <View style={styles.vitalCardTitleRow}>
                  <PlatformSymbol
                    ios="flame.fill"
                    material="whatshot"
                    tintColor="#F97316"
                    size={18}
                  />
                  <Body variant="bodyMedium" style={{ fontWeight: "700", marginLeft: 6 }}>
                    Calories
                  </Body>
                </View>
              </View>

              <View style={styles.vitalCardContentRow}>
                <View>
                  <Heading variant="title1" style={styles.boldVitalFigure}>
                    {totalCaloriesKcal.toLocaleString()}
                  </Heading>
                  <Caption variant="caption1" color={t.textMuted}>
                    kcal
                  </Caption>
                </View>

                {/* Circular Progress Arc */}
                <View style={[styles.progressRingCircle, { borderColor: "#F9731633" }]}>
                  <View
                    style={[
                      styles.progressRingArcFill,
                      {
                        borderColor: "#F97316",
                        borderTopColor: "transparent",
                        borderLeftColor: "transparent",
                        transform: [{ rotate: `${Math.min(360, caloriesPct * 3.6)}deg` }],
                      },
                    ]}
                  />
                  <Caption variant="caption2" color="#F97316" style={{ fontWeight: "800", fontSize: 10 }}>
                    {caloriesPct}%
                  </Caption>
                </View>
              </View>
            </Card>

            {/* Card 2: Water */}
            <Card style={styles.vitalGridCard}>
              <View style={styles.vitalCardHeaderRow}>
                <View style={styles.vitalCardTitleRow}>
                  <PlatformSymbol
                    ios="drop.fill"
                    material="water-drop"
                    tintColor="#0EA5E9"
                    size={18}
                  />
                  <Body variant="bodyMedium" style={{ fontWeight: "700", marginLeft: 6 }}>
                    Water
                  </Body>
                </View>
              </View>

              <View style={styles.vitalCardContentRow}>
                <View>
                  <Heading variant="title1" style={styles.boldVitalFigure}>
                    {waterMl.toLocaleString()}
                  </Heading>
                  <Caption variant="caption1" color={t.textMuted}>
                    ml
                  </Caption>
                </View>

                {/* Circular Progress Arc */}
                <View style={[styles.progressRingCircle, { borderColor: "#0EA5E933" }]}>
                  <View
                    style={[
                      styles.progressRingArcFill,
                      {
                        borderColor: "#0EA5E9",
                        borderTopColor: "transparent",
                        borderLeftColor: "transparent",
                        transform: [{ rotate: `${Math.min(360, waterPct * 3.6)}deg` }],
                      },
                    ]}
                  />
                  <Caption variant="caption2" color="#0EA5E9" style={{ fontWeight: "800", fontSize: 10 }}>
                    {waterPct}%
                  </Caption>
                </View>
              </View>

              {/* 1-tap +250ml action when today, or glasses count when viewing history */}
              {isViewingToday ? (
                <View style={styles.waterQuickAddRow}>
                  <Pressable
                    onPress={handleRemoveGlass}
                    disabled={waterGlasses <= 0}
                    style={[styles.waterMiniBtn, { opacity: waterGlasses <= 0 ? 0.3 : 1 }]}
                  >
                    <Caption variant="caption2" color={t.textMuted}>-</Caption>
                  </Pressable>
                  <Pressable
                    onPress={handleAddGlass}
                    style={[styles.waterPlusBtn, { backgroundColor: "#0EA5E9" }]}
                  >
                    <PlatformSymbol ios="plus" material="add" tintColor="#fff" size={12} />
                    <Caption variant="caption2" color="#fff" style={{ fontWeight: "700", marginLeft: 2 }}>
                      +250ml
                    </Caption>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.waterHistoricalRow}>
                  <Caption variant="caption2" color={t.textMuted}>
                    {activeDayMetrics.waterGlasses} glasses ({waterMl}ml)
                  </Caption>
                </View>
              )}
            </Card>

            {/* Card 3: Sleep */}
            <Card style={styles.vitalGridCard}>
              <Pressable
                onPress={() => {
                  const h = Math.floor(sleepMinutes / 60);
                  const m = sleepMinutes % 60;
                  setSleepHoursInput(h > 0 ? String(h) : "7");
                  setSleepMinutesInput(m > 0 ? String(m) : "30");
                  setBedTimeInput(bedTime);
                  setWakeTimeInput(wakeTime);
                  setSleepModal(true);
                }}
              >
                <View style={styles.vitalCardHeaderRow}>
                  <View style={styles.vitalCardTitleRow}>
                    <PlatformSymbol
                      ios="moon.stars.fill"
                      material="bedtime"
                      tintColor="#F59E0B"
                      size={18}
                    />
                    <Body variant="bodyMedium" style={{ fontWeight: "700", marginLeft: 6 }}>
                      Sleep
                    </Body>
                  </View>
                  <PlatformSymbol
                    ios="pencil"
                    material="edit"
                    tintColor={t.textMuted}
                    size={13}
                  />
                </View>

                <View style={styles.vitalCardContentRow}>
                  <View>
                    <Heading variant="title1" style={styles.boldVitalFigure}>
                      {activeDayMetrics.sleepMinutes > 0 ? sleepHours : "--"}
                    </Heading>
                    <Caption variant="caption1" color={t.textMuted}>
                      hrs
                    </Caption>
                  </View>

                  {/* Sleep Mini Bar Chart in Warm Amber */}
                  <View style={styles.miniSleepBarsContainer}>
                    <View style={[styles.sleepMiniBar, { height: 16, backgroundColor: "#F59E0B66" }]} />
                    <View style={[styles.sleepMiniBar, { height: 26, backgroundColor: "#F59E0B99" }]} />
                    <View style={[styles.sleepMiniBar, { height: 34, backgroundColor: "#F59E0B" }]} />
                    <View style={[styles.sleepMiniBar, { height: 20, backgroundColor: "#F59E0B55" }]} />
                  </View>
                </View>

                {/* Sleep & Wake Times */}
                <View style={styles.sleepScheduleRow}>
                  <Caption variant="caption2" color={t.textMuted}>
                    🌙 {activeDayMetrics.bedTime} • ☀️ {activeDayMetrics.wakeTime}
                  </Caption>
                </View>
              </Pressable>
            </Card>

            {/* Card 4: Weight */}
            <Card style={styles.vitalGridCard}>
              <Pressable
                onPress={() => {
                  setWeightInput(weightKg ? String(weightKg) : "");
                  setGoalInput(goalWeightKg ? String(goalWeightKg) : "");
                  setWeightModal(true);
                }}
              >
                <View style={styles.vitalCardHeaderRow}>
                  <View style={styles.vitalCardTitleRow}>
                    <PlatformSymbol
                      ios="figure.strengthtraining.traditional"
                      material="fitness-center"
                      tintColor="#10B981"
                      size={18}
                    />
                    <Body variant="bodyMedium" style={{ fontWeight: "700", marginLeft: 6 }}>
                      Weight
                    </Body>
                  </View>
                  <PlatformSymbol
                    ios="pencil"
                    material="edit"
                    tintColor={t.textMuted}
                    size={13}
                  />
                </View>

                <View style={styles.vitalCardContentRow}>
                  <View>
                    <Heading variant="title1" style={styles.boldVitalFigure}>
                      {activeDayMetrics.weightKg ? activeDayMetrics.weightKg : "--"}
                    </Heading>
                    <Caption variant="caption1" color={t.textMuted}>
                      kg
                    </Caption>
                  </View>

                  {/* Green Sparkline Curve (CSS Wave representation) */}
                  <View style={styles.sparklineContainer}>
                    <View style={[styles.sparklinePoint, { bottom: 6, left: 2 }]} />
                    <View style={[styles.sparklinePoint, { bottom: 12, left: 14 }]} />
                    <View style={[styles.sparklinePoint, { bottom: 8, left: 26 }]} />
                    <View style={[styles.sparklinePoint, { bottom: 22, left: 38 }]} />
                    <View style={[styles.sparklinePoint, { bottom: 14, left: 50 }]} />
                    <View style={[styles.sparklineLine, { borderColor: "#10B981" }]} />
                  </View>
                </View>

                {/* BMI status pill */}
                <View style={styles.bmiPillRow}>
                  <Caption
                    variant="caption2"
                    color={bmiInfo?.color ?? "#10B981"}
                    style={{ fontWeight: "700" }}
                  >
                    {bmiInfo ? `BMI ${bmiInfo.val} • ${bmiInfo.label}` : "Tap to set height/BMI"}
                  </Caption>
                </View>
              </Pressable>
            </Card>
          </View>
        </Animated.View>

        {/* ─── 3. Movement & Outdoor Log (Milestone 4) ─────────── */}
        <Animated.View entering={FadeInDown.delay(180).duration(300)}>
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Heading variant="title3">Movement & Outdoor Log</Heading>
            </View>

            <View style={styles.movementGrid}>
              {/* Walking */}
              <View style={[styles.movementItem, { backgroundColor: t.background }]}>
                <View style={styles.movementItemTop}>
                  <Caption variant="caption1" style={{ fontWeight: "700" }}>🚶 Walking</Caption>
                  <Caption variant="caption2" color={t.accent} style={{ fontWeight: "700" }}>
                    {activeDayMetrics.walkMinutes}m
                  </Caption>
                </View>
                <View style={styles.movementActions}>
                  <Pressable
                    onPress={() => handleAddMovementMinutes("walk", 15)}
                    style={[styles.movementAddBtn, { backgroundColor: t.card }]}
                  >
                    <Caption variant="caption2" color={t.accent}>+15m</Caption>
                  </Pressable>
                  <Pressable
                    onPress={() => handleAddMovementMinutes("walk", 30)}
                    style={[styles.movementAddBtn, { backgroundColor: t.card }]}
                  >
                    <Caption variant="caption2" color={t.accent}>+30m</Caption>
                  </Pressable>
                </View>
              </View>

              {/* Workout / Gym */}
              <View style={[styles.movementItem, { backgroundColor: t.background }]}>
                <View style={styles.movementItemTop}>
                  <Caption variant="caption1" style={{ fontWeight: "700" }}>🏋️ Workout</Caption>
                  <Caption variant="caption2" color="#F97316" style={{ fontWeight: "700" }}>
                    {activeDayMetrics.workoutMinutes}m
                  </Caption>
                </View>
                <View style={styles.movementActions}>
                  <Pressable
                    onPress={() => handleAddMovementMinutes("workout", 15)}
                    style={[styles.movementAddBtn, { backgroundColor: t.card }]}
                  >
                    <Caption variant="caption2" color="#F97316">+15m</Caption>
                  </Pressable>
                  <Pressable
                    onPress={() => handleAddMovementMinutes("workout", 45)}
                    style={[styles.movementAddBtn, { backgroundColor: t.card }]}
                  >
                    <Caption variant="caption2" color="#F97316">+45m</Caption>
                  </Pressable>
                </View>
              </View>

              {/* Stretching */}
              <View style={[styles.movementItem, { backgroundColor: t.background }]}>
                <View style={styles.movementItemTop}>
                  <Caption variant="caption1" style={{ fontWeight: "700" }}>🧘 Stretching</Caption>
                  <Caption variant="caption2" color="#A78BFA" style={{ fontWeight: "700" }}>
                    {activeDayMetrics.stretchingMinutes}m
                  </Caption>
                </View>
                <View style={styles.movementActions}>
                  <Pressable
                    onPress={() => handleAddMovementMinutes("stretch", 10)}
                    style={[styles.movementAddBtn, { backgroundColor: t.card }]}
                  >
                    <Caption variant="caption2" color="#A78BFA">+10m</Caption>
                  </Pressable>
                  <Pressable
                    onPress={() => handleAddMovementMinutes("stretch", 20)}
                    style={[styles.movementAddBtn, { backgroundColor: t.card }]}
                  >
                    <Caption variant="caption2" color="#A78BFA">+20m</Caption>
                  </Pressable>
                </View>
              </View>

              {/* Outdoor Sunlight */}
              <View style={[styles.movementItem, { backgroundColor: t.background }]}>
                <View style={styles.movementItemTop}>
                  <Caption variant="caption1" style={{ fontWeight: "700" }}>🌳 Sunlight</Caption>
                  <Caption variant="caption2" color="#F59E0B" style={{ fontWeight: "700" }}>
                    {activeDayMetrics.outdoorMinutes}m
                  </Caption>
                </View>
                <View style={styles.movementActions}>
                  <Pressable
                    onPress={() => handleAddMovementMinutes("outdoor", 15)}
                    style={[styles.movementAddBtn, { backgroundColor: t.card }]}
                  >
                    <Caption variant="caption2" color="#F59E0B">+15m</Caption>
                  </Pressable>
                  <Pressable
                    onPress={() => handleAddMovementMinutes("outdoor", 30)}
                    style={[styles.movementAddBtn, { backgroundColor: t.card }]}
                  >
                    <Caption variant="caption2" color="#F59E0B">+30m</Caption>
                  </Pressable>
                </View>
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* ─── 4. Energy & Mood Daily Check-in (Milestone 4) ──── */}
        <Animated.View entering={FadeInDown.delay(240).duration(300)}>
          <Card style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Heading variant="title3">Daily Energy & Mood Check-in</Heading>
            </View>

            {/* Energy Selector */}
            <View style={{ marginBottom: spacing.md }}>
              <Caption variant="caption1" color={t.textSecondary} style={{ fontWeight: "700", marginBottom: 6 }}>
                ⚡ ENERGY LEVEL
              </Caption>
              <View style={styles.checkinRow}>
                {(["low", "medium", "high"] as EnergyLevel[]).map((lvl) => {
                  const sel = energyRating === lvl;
                  const labelMap = { low: "🔋 Low", medium: "⚡ Medium", high: "🔥 Peak" };
                  return (
                    <Pressable
                      key={lvl}
                      onPress={() => handleSetEnergy(lvl)}
                      style={[
                        styles.checkinChip,
                        {
                          backgroundColor: sel ? t.accent + "22" : t.background,
                          borderColor: sel ? t.accent : t.border,
                        },
                      ]}
                    >
                      <Body
                        variant="bodyMedium"
                        color={sel ? t.accent : t.textPrimary}
                        style={{ fontWeight: sel ? "700" : "500" }}
                      >
                        {labelMap[lvl]}
                      </Body>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Mood Selector */}
            <View>
              <Caption variant="caption1" color={t.textSecondary} style={{ fontWeight: "700", marginBottom: 6 }}>
                😊 MOOD STATE
              </Caption>
              <View style={styles.checkinRow}>
                {(["great", "balanced", "stressed", "low"] as MoodState[]).map((m) => {
                  const sel = moodRating === m;
                  const labelMap = {
                    great: "😄 Great",
                    balanced: "🙂 Calm",
                    stressed: "😰 Stressed",
                    low: "😔 Low",
                  };
                  return (
                    <Pressable
                      key={m}
                      onPress={() => handleSetMood(m)}
                      style={[
                        styles.checkinChip,
                        {
                          backgroundColor: sel ? "#10B98122" : t.background,
                          borderColor: sel ? "#10B981" : t.border,
                        },
                      ]}
                    >
                      <Body
                        variant="bodyMedium"
                        color={sel ? "#10B981" : t.textPrimary}
                        style={{ fontWeight: sel ? "700" : "500" }}
                      >
                        {labelMap[m]}
                      </Body>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Card>
        </Animated.View>

        {/* ─── 5. Next-Day Correlation Card (Milestone 4) ──────── */}
        <Animated.View entering={FadeInDown.delay(300).duration(300)}>
          <Card style={[styles.sectionCard, { borderColor: t.accent + "55" }]}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <PlatformSymbol
                  ios="waveform.path.ecg"
                  material="insights"
                  tintColor={t.accent}
                  size={18}
                />
                <Heading variant="title3" style={{ marginLeft: 6 }}>
                  Rest & Energy Correlation
                </Heading>
              </View>
              <View style={[styles.scoreBadge, { backgroundColor: t.accent + "22" }]}>
                <Caption variant="caption2" color={t.accent} style={{ fontWeight: "800" }}>
                  SCORE: {energyComposite.score}/100
                </Caption>
              </View>
            </View>

            {/* Yesterday metrics comparison */}
            <View style={styles.yesterdayMetricsRow}>
              <View style={[styles.yestBox, { backgroundColor: t.background }]}>
                <Caption variant="caption2" color={t.textMuted}>Yesterday Sleep</Caption>
                <Heading variant="title3" color="#F59E0B" style={{ marginTop: 2 }}>
                  {yesterdaySleepMins > 0
                    ? `${Math.floor(yesterdaySleepMins / 60)}h ${yesterdaySleepMins % 60}m`
                    : "7h 30m"}
                </Heading>
              </View>
              <View style={[styles.yestBox, { backgroundColor: t.background }]}>
                <Caption variant="caption2" color={t.textMuted}>Yesterday Screen</Caption>
                <Heading variant="title3" color="#38BDF8" style={{ marginTop: 2 }}>
                  {yesterdayScreenTime > 0
                    ? `${(yesterdayScreenTime / 3600).toFixed(1)}h`
                    : "2.4h"}
                </Heading>
              </View>
              <View style={[styles.yestBox, { backgroundColor: t.background }]}>
                <Caption variant="caption2" color={t.textMuted}>Today Energy</Caption>
                <Heading variant="title3" color="#10B981" style={{ marginTop: 2 }}>
                  {energyRating ? energyRating.toUpperCase() : "Balanced"}
                </Heading>
              </View>
            </View>

            {/* Physiological correlation insight message */}
            <View style={[styles.correlationNotice, { backgroundColor: t.accent + "12" }]}>
              <Body variant="bodyMedium" color={t.textPrimary} style={{ lineHeight: 20 }}>
                {correlationInsight}
              </Body>
            </View>
          </Card>
        </Animated.View>

        {/* ─── Hourly Water Reminder Bar ──────────────────────── */}
        <Animated.View entering={FadeInDown.delay(360).duration(300)}>
          <Card style={[styles.reminderCard, { backgroundColor: t.card }]}>
            <View style={{ flex: 1 }}>
              <Body variant="headline">Hourly Hydration Alert</Body>
              <Caption variant="caption2" color={t.textMuted}>
                Chimes every hour between 9 AM and 9 PM to log a 250ml glass of water.
              </Caption>
            </View>
            <Switch
              value={hourlyWaterReminder}
              onValueChange={handleToggleWaterReminder}
              trackColor={{ false: t.border, true: "#0EA5E9" }}
              thumbColor="#fff"
            />
          </Card>
        </Animated.View>
      </ScrollView>

      {/* ─── MODAL: Log Weight & Goal ───────────────────────── */}
      <Modal visible={weightModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Heading variant="title3">Log Body Weight</Heading>
            <Caption variant="caption2" color={t.textMuted} style={{ marginBottom: spacing.md }}>
              Record your current weight and target weight (kg).
            </Caption>

            <TextInput
              style={[styles.input, { borderColor: t.border, color: t.textPrimary, backgroundColor: t.background }]}
              placeholder="Current weight (e.g. 74.5)"
              placeholderTextColor={t.textMuted}
              keyboardType="decimal-pad"
              value={weightInput}
              onChangeText={setWeightInput}
            />

            <TextInput
              style={[
                styles.input,
                { borderColor: t.border, color: t.textPrimary, backgroundColor: t.background, marginTop: spacing.sm },
              ]}
              placeholder="Goal weight (e.g. 70.0)"
              placeholderTextColor={t.textMuted}
              keyboardType="decimal-pad"
              value={goalInput}
              onChangeText={setGoalInput}
            />

            <View style={styles.modalBtnRow}>
              <Pressable
                onPress={() => setWeightModal(false)}
                style={[styles.modalCancelBtn, { borderColor: t.border }]}
              >
                <Body variant="bodyMedium">Cancel</Body>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Button title="Save Weight" onPress={handleSaveWeight} />
              </View>
            </View>
          </Card>
        </View>
      </Modal>

      {/* ─── MODAL: Log Sleep ───────────────────────────────── */}
      <Modal visible={sleepModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Heading variant="title3">Log Sleep Time</Heading>
            <Caption variant="caption2" color={t.textMuted} style={{ marginBottom: spacing.md }}>
              Record your exact bedtime, wake time, and sleep duration.
            </Caption>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TextInput
                style={[
                  styles.input,
                  { flex: 1, borderColor: t.border, color: t.textPrimary, backgroundColor: t.background },
                ]}
                placeholder="Hours (e.g. 7)"
                placeholderTextColor={t.textMuted}
                keyboardType="number-pad"
                value={sleepHoursInput}
                onChangeText={setSleepHoursInput}
              />
              <TextInput
                style={[
                  styles.input,
                  { flex: 1, borderColor: t.border, color: t.textPrimary, backgroundColor: t.background },
                ]}
                placeholder="Minutes (e.g. 30)"
                placeholderTextColor={t.textMuted}
                keyboardType="number-pad"
                value={sleepMinutesInput}
                onChangeText={setSleepMinutesInput}
              />
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
              <TextInput
                style={[
                  styles.input,
                  { flex: 1, borderColor: t.border, color: t.textPrimary, backgroundColor: t.background },
                ]}
                placeholder="Bedtime (23:00)"
                placeholderTextColor={t.textMuted}
                value={bedTimeInput}
                onChangeText={setBedTimeInput}
              />
              <TextInput
                style={[
                  styles.input,
                  { flex: 1, borderColor: t.border, color: t.textPrimary, backgroundColor: t.background },
                ]}
                placeholder="Wake time (07:00)"
                placeholderTextColor={t.textMuted}
                value={wakeTimeInput}
                onChangeText={setWakeTimeInput}
              />
            </View>

            <View style={styles.modalBtnRow}>
              <Pressable
                onPress={() => setSleepModal(false)}
                style={[styles.modalCancelBtn, { borderColor: t.border }]}
              >
                <Body variant="bodyMedium">Cancel</Body>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Button title="Save Sleep" onPress={handleSaveSleep} />
              </View>
            </View>
          </Card>
        </View>
      </Modal>

      {/* ─── MODAL: Step Goal ───────────────────────────────── */}
      <Modal visible={stepGoalModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.modalCard}>
            <Heading variant="title3">Daily Step Target</Heading>
            <Caption variant="caption2" color={t.textMuted} style={{ marginBottom: spacing.md }}>
              Set your personalized daily step ambition.
            </Caption>

            <TextInput
              style={[styles.input, { borderColor: t.border, color: t.textPrimary, backgroundColor: t.background }]}
              placeholder="e.g. 10000"
              placeholderTextColor={t.textMuted}
              keyboardType="number-pad"
              value={stepGoalInput}
              onChangeText={setStepGoalInput}
            />

            <View style={styles.modalBtnRow}>
              <Pressable
                onPress={() => setStepGoalModal(false)}
                style={[styles.modalCancelBtn, { borderColor: t.border }]}
              >
                <Body variant="bodyMedium">Cancel</Body>
              </Pressable>
              <View style={{ flex: 1 }}>
                <Button
                  title="Save Target"
                  onPress={() => {
                    const val = parseInt(stepGoalInput, 10);
                    if (val && val > 0) {
                      setStepGoal(val);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                    setStepGoalModal(false);
                  }}
                />
              </View>
            </View>
          </Card>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  menuButton: {
    padding: spacing.xs,
  },
  headerIconBtn: {
    padding: 8,
    borderRadius: radius.full,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: 40,
  },

  // 1. Top Steps Card
  topStepsCard: {
    padding: spacing.lg,
    borderRadius: radius.xl,
  },
  stepsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepsTitleLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  monthSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radius.md,
  },
  stepsNumbersRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  stepNumCol: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  boldFigure: {
    fontSize: 32,
    fontWeight: "800",
  },
  figureUnit: {
    fontWeight: "600",
  },
  dateBarChartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 140,
    paddingTop: 24,
    paddingBottom: 6,
  },
  dateBarCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
    position: "relative",
  },
  floatingPillBadge: {
    position: "absolute",
    top: 0,
    backgroundColor: "#18181B",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "#10B981",
    zIndex: 10,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
  },
  barCylinderTrack: {
    width: 22,
    height: 85,
    borderRadius: 11,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barCylinderFill: {
    width: "100%",
    borderRadius: 11,
  },
  dayNumberLabel: {
    marginTop: 8,
    fontWeight: "600",
  },
  historicalBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: "#10B98144",
  },
  returnTodayBtn: {
    backgroundColor: "#10B981",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  waterHistoricalRow: {
    paddingVertical: 4,
    alignItems: "center",
  },

  // 2. 2x2 Vital Grid
  vitals2x2Grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  vitalGridCard: {
    width: "48%",
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    justifyContent: "space-between",
  },
  vitalCardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  vitalCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  vitalCardContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: spacing.xs,
  },
  boldVitalFigure: {
    fontSize: 24,
    fontWeight: "800",
  },
  progressRingCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3.5,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  progressRingArcFill: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3.5,
  },
  waterQuickAddRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.xs,
    marginTop: 4,
  },
  waterMiniBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  waterPlusBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  miniSleepBarsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 34,
  },
  sleepMiniBar: {
    width: 5,
    borderRadius: 2.5,
  },
  sleepScheduleRow: {
    marginTop: 4,
  },
  sparklineContainer: {
    width: 56,
    height: 30,
    position: "relative",
  },
  sparklinePoint: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#10B981",
  },
  sparklineLine: {
    position: "absolute",
    width: "100%",
    height: "50%",
    borderBottomWidth: 1.5,
  },
  bmiPillRow: {
    marginTop: 4,
  },

  // 3. Movement & Outdoor Log
  sectionCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  sectionHeader: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  movementGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  movementItem: {
    width: "48%",
    flexGrow: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
  },
  movementItemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  movementActions: {
    flexDirection: "row",
    gap: 6,
  },
  movementAddBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
    borderRadius: radius.sm,
  },

  // 4. Energy & Mood Check-in
  checkinRow: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  checkinChip: {
    flexGrow: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
  },

  // 5. Next-Day Correlation
  scoreBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginVertical: 5,
    borderRadius: radius.full,
  },
  yesterdayMetricsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  yestBox: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
    alignItems: "center",
  },
  correlationNotice: {
    padding: spacing.md,
    borderRadius: radius.md,
  },

  // Reminder Bar
  reminderCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderRadius: radius.lg,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    padding: spacing.xl,
    borderRadius: radius.xl,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  modalBtnRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
});
