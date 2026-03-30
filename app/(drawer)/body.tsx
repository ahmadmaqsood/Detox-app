import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import {
  addExerciseEntry,
  deleteExerciseEntry,
  getBodyWeights,
  getExerciseEntries,
  getExerciseMinutesByDay,
  getGoalWeightKg,
  getMetrics,
  logBodyWeight,
  saveMetrics,
  setGoalWeightKg,
} from "@/lib/database";
import { computeEnergyScore } from "@/lib/energyScore";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation } from "expo-router";
import { type DrawerNavigationProp } from "@react-navigation/drawer";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, delta: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function weekdayShort(iso: string): string {
  const w = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  return w[new Date(iso + "T12:00:00").getDay()];
}

export default function BodyScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const day = todayISO();

  const [weightText, setWeightText] = useState("");
  const [goalText, setGoalText] = useState("");
  const [sleepText, setSleepText] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [exType, setExType] = useState("Walk");
  const [exMin, setExMin] = useState("30");

  const [energy, setEnergy] = useState(computeEnergyScore({
    steps: 0,
    exerciseMinutes: 0,
    sleepMinutes: 0,
    screenTimeMinutes: 0,
  }));
  const [weights7, setWeights7] = useState<{ date: string; kg: number }[]>([]);
  const [exWeek, setExWeek] = useState<{ date: string; minutes: number }[]>([]);
  const [todayEx, setTodayEx] = useState<
    { id: number; type: string; durationMinutes: number }[]
  >([]);

  const load = useCallback(async () => {
    const from7 = addDays(day, -6);
    const m = await getMetrics(day);
    const goal = await getGoalWeightKg();
    const wRows = await getBodyWeights(from7, day);
    const exD = await getExerciseMinutesByDay(from7, day);
    const exList = await getExerciseEntries(day, day);
    const exTotal = exList.reduce((s, r) => s + r.durationMinutes, 0);

    setWeights7(wRows);
    setExWeek(exD);
    setTodayEx(exList);

    setSleepText(m?.sleepMinutes != null ? String(m.sleepMinutes) : "");
    setStepsText(m?.steps != null ? String(m.steps) : "");

    const lastW = wRows.filter((r) => r.date === day)[0];
    setWeightText(lastW ? String(lastW.kg) : "");

    setGoalText(goal != null ? String(goal) : "");

    const e = computeEnergyScore({
      steps: m?.steps ?? 0,
      exerciseMinutes: exTotal,
      sleepMinutes: m?.sleepMinutes ?? 0,
      screenTimeMinutes: m?.screenTime ?? 0,
    });
    setEnergy(e);
  }, [day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const weightBars = useMemo(() => {
    const map = new Map(weights7.map((r) => [r.date, r.kg]));
    const pts: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(day, -i);
      const v = map.get(d);
      pts.push({
        label: weekdayShort(d),
        value: v ?? 0,
      });
    }
    const maxKg = Math.max(...pts.map((p) => p.value), 1);
    return { pts, maxKg };
  }, [weights7, day]);

  const exChart = useMemo(() => {
    const map = new Map(exWeek.map((x) => [x.date, x.minutes]));
    const out: { date: string; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = addDays(day, -i);
      out.push({ date: d, minutes: map.get(d) ?? 0 });
    }
    return out;
  }, [exWeek, day]);

  const saveWeight = async () => {
    const kg = parseFloat(weightText.replace(",", "."));
    if (Number.isNaN(kg) || kg <= 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await logBodyWeight(day, kg);
    await load();
  };

  const saveGoal = async () => {
    const g = parseFloat(goalText.replace(",", "."));
    if (Number.isNaN(g) || g <= 0) {
      await setGoalWeightKg(null);
    } else {
      await setGoalWeightKg(g);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await load();
  };

  const saveVitals = async () => {
    const sleep = parseInt(sleepText, 10);
    const steps = parseInt(stepsText, 10);
    if (sleepText !== "" && (Number.isNaN(sleep) || sleep < 0)) return;
    if (stepsText !== "" && (Number.isNaN(steps) || steps < 0)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await saveMetrics({
      sleepMinutes: sleepText === "" ? undefined : sleep,
      steps: stepsText === "" ? undefined : steps,
      date: day,
    });
    await load();
  };

  const addEx = async () => {
    const mins = parseInt(exMin, 10);
    if (!exType.trim() || Number.isNaN(mins) || mins <= 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addExerciseEntry(day, exType.trim(), mins);
    setExMin("30");
    await load();
  };

  const removeEx = async (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await deleteExerciseEntry(id);
    await load();
  };

  const exMax = Math.max(...exChart.map((x) => x.minutes), 1);

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
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
        <Heading variant="title3">Body</Heading>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Caption variant="caption1" color={t.textMuted} style={styles.tag}>
          LIFE OPTIMIZATION · MOVEMENT & WEIGHT
        </Caption>

        <Card style={{ gap: spacing.md }}>
          <View style={styles.rowBetween}>
            <Heading variant="title2">Energy score</Heading>
            <View style={[styles.scorePill, { backgroundColor: t.accent + "22" }]}>
              <Heading variant="title1" color={t.accent}>
                {energy.score}
              </Heading>
            </View>
          </View>
          <Body variant="callout" color={t.textSecondary}>
            Blends movement (steps + exercise), sleep, and lower screen time.
          </Body>
          <View style={styles.subScores}>
            <SubScore label="Movement" value={energy.movement} color="#34D399" />
            <SubScore label="Sleep" value={energy.sleep} color="#60A5FA" />
            <SubScore label="Screen↓" value={energy.screen} color="#FBBF24" />
          </View>
        </Card>

        <Heading variant="title3" style={{ marginTop: spacing.lg }}>
          Today
        </Heading>
        <Card style={{ gap: spacing.sm }}>
          <Field
            label="Weight (kg)"
            value={weightText}
            onChangeText={setWeightText}
            keyboardType="decimal-pad"
            placeholder="e.g. 72.5"
            t={t}
          />
          <Button title="Save weight" onPress={saveWeight} />
          <Field
            label="Sleep (minutes)"
            value={sleepText}
            onChangeText={setSleepText}
            keyboardType="number-pad"
            placeholder="e.g. 420"
            t={t}
          />
          <Field
            label="Steps (manual)"
            value={stepsText}
            onChangeText={setStepsText}
            keyboardType="number-pad"
            placeholder="e.g. 8000"
            t={t}
          />
          <Button title="Save sleep & steps" onPress={saveVitals} variant="secondary" />
        </Card>

        <Card style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Heading variant="title3">Goal weight</Heading>
          <Field
            label="Target kg (optional)"
            value={goalText}
            onChangeText={setGoalText}
            keyboardType="decimal-pad"
            placeholder="e.g. 70"
            t={t}
          />
          <Button title="Save goal" onPress={saveGoal} variant="secondary" />
        </Card>

        <Heading variant="title3" style={{ marginTop: spacing.lg }}>
          Exercise
        </Heading>
        <Card style={{ gap: spacing.sm }}>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Caption variant="caption2" color={t.textMuted}>
                Type
              </Caption>
              <TextInput
                value={exType}
                onChangeText={setExType}
                placeholder="Walk, run…"
                placeholderTextColor={t.textMuted}
                style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
              />
            </View>
            <View style={{ width: 88 }}>
              <Caption variant="caption2" color={t.textMuted}>
                Minutes
              </Caption>
              <TextInput
                value={exMin}
                onChangeText={setExMin}
                keyboardType="number-pad"
                placeholderTextColor={t.textMuted}
                style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
              />
            </View>
          </View>
          <Button title="Log workout" onPress={addEx} />
          {todayEx.length > 0 && (
            <View style={{ gap: spacing.xs }}>
              {todayEx.map((r) => (
                <View
                  key={r.id}
                  style={[styles.exRow, { borderColor: t.border }]}
                >
                  <Body variant="bodyMedium">
                    {r.type} · {r.durationMinutes}m
                  </Body>
                  <Pressable onPress={() => removeEx(r.id)} hitSlop={8}>
                    <Caption variant="caption2" color={t.textMuted}>
                      Remove
                    </Caption>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </Card>

        <Heading variant="title3" style={{ marginTop: spacing.lg }}>
          Last 7 days · weight
        </Heading>
        <Card>
          <View style={styles.chartRow}>
            {weightBars.pts.map((p) => (
              <View key={p.label} style={styles.barCol}>
                <View
                  style={[
                    styles.barTrack,
                    { backgroundColor: t.background },
                  ]}
                >
                  {p.value > 0 && (
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.min(100, (p.value / weightBars.maxKg) * 100)}%`,
                          backgroundColor: t.accent,
                        },
                      ]}
                    />
                  )}
                </View>
                <Caption variant="caption2" color={t.textMuted}>
                  {p.label}
                </Caption>
              </View>
            ))}
          </View>
        </Card>

        <Heading variant="title3" style={{ marginTop: spacing.lg }}>
          Last 7 days · exercise min.
        </Heading>
        <Card>
          <View style={styles.chartRow}>
            {exChart.map((p) => (
              <View key={p.date} style={styles.barCol}>
                <View
                  style={[
                    styles.barTrack,
                    { backgroundColor: t.background },
                  ]}
                >
                  {p.minutes > 0 && (
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${Math.min(100, (p.minutes / exMax) * 100)}%`,
                          backgroundColor: "#34D399",
                        },
                      ]}
                    />
                  )}
                </View>
                <Caption variant="caption2" color={t.textMuted}>
                  {weekdayShort(p.date)}
                </Caption>
              </View>
            ))}
          </View>
        </Card>

        <View style={{ height: spacing["3xl"] }} />
      </ScrollView>
    </View>
  );
}

function SubScore({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.subScore}>
      <Caption variant="caption2" color={color}>
        {label}
      </Caption>
      <Heading variant="title3" color={color}>
        {value}
      </Heading>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
  t,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  keyboardType: "decimal-pad" | "number-pad";
  placeholder: string;
  t: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View>
      <Caption variant="caption2" color={t.textMuted}>
        {label}
      </Caption>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing["5xl"],
    gap: spacing.md,
  },
  tag: { letterSpacing: 0.6, marginBottom: -spacing.xs },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scorePill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  subScores: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
  },
  subScore: { alignItems: "center", gap: 2 },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xxs,
  },
  row2: { flexDirection: "row", gap: spacing.md },
  exRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chartRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 4,
    alignItems: "flex-end",
  },
  barCol: { flex: 1, alignItems: "center", gap: 6 },
  barTrack: {
    width: "100%",
    height: 100,
    borderRadius: 6,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  barFill: {
    width: "100%",
    borderRadius: 6,
    minHeight: 4,
  },
});
