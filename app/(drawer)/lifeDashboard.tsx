import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import {
  getAntiLazinessEnabled,
  getDailyReset,
  getExerciseMinutesForDate,
  getGlobalStreak,
  getMetrics,
  getTodayHabits,
  getUrgeLogs,
  logUrge,
  saveDailyMorning,
  saveDailyNight,
  setAntiLazinessEnabled,
} from "@/lib/database";
import {
  buildIdentityMessage,
  computeLifeScores,
  evaluateDangerZone,
  movementHeuristic,
  summarizeUrgePatterns,
  type DangerZoneResult,
  type LifeScores,
} from "@/lib/lifeOS";
import { rescheduleSmartNotifications } from "@/lib/smartNotifications";
import { useHardMode } from "@/store/HardModeContext";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import { type DrawerNavigationProp } from "@react-navigation/drawer";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function LifeDashboardScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const { hardMode, hardModeStreak, setHardMode, refresh: refreshHard } =
    useHardMode();

  const [scores, setScores] = useState<LifeScores | null>(null);
  const [danger, setDanger] = useState<DangerZoneResult | null>(null);
  const [globalStreak, setGlobalStreak] = useState(0);
  const [antiLazy, setAntiLazy] = useState(false);
  const [morningPlan, setMorningPlan] = useState("");
  const [nightReflection, setNightReflection] = useState("");
  const [urgeIntensity, setUrgeIntensity] = useState(5);
  const [urgeTrigger, setUrgeTrigger] = useState("");
  const [patterns, setPatterns] = useState(
    summarizeUrgePatterns([]),
  );

  const identity = useMemo(
    () =>
      buildIdentityMessage({
        hardModeStreak,
        globalStreak,
      }),
    [hardModeStreak, globalStreak],
  );

  const load = useCallback(async () => {
    const day = todayISO();
    const [sc, gs, rows, metrics, exMin, journal, lazy, urges] =
      await Promise.all([
        computeLifeScores(),
        getGlobalStreak(),
        getTodayHabits(),
        getMetrics(),
        getExerciseMinutesForDate(day),
        getDailyReset(day),
        getAntiLazinessEnabled(),
        getUrgeLogs(400),
      ]);

    setScores(sc);
    setGlobalStreak(gs);
    setAntiLazy(lazy);
    setMorningPlan(journal?.morningPlan ?? "");
    setNightReflection(journal?.nightReflection ?? "");
    setPatterns(summarizeUrgePatterns(urges));

    const done = rows.filter((r) => r.completed).length;
    const rate = rows.length ? done / rows.length : 1;
    const move = movementHeuristic({
      steps: metrics?.steps ?? 0,
      exerciseMinutes: exMin,
    });
    setDanger(
      evaluateDangerZone({
        screenTimeMinutes: metrics?.screenTime ?? 0,
        habitCompletionRate: rate,
        movementScore: move,
      }),
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      void refreshHard();
    }, [load, refreshHard]),
  );

  const logUrgeNow = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await logUrge({ intensity: urgeIntensity, triggerTag: urgeTrigger.trim() });
    setUrgeTrigger("");
    await load();
  };

  const saveMorning = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await saveDailyMorning(todayISO(), morningPlan.trim());
    await load();
  };

  const saveNight = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await saveDailyNight(todayISO(), nightReflection.trim());
    await load();
  };

  const toggleAnti = async (v: boolean) => {
    setAntiLazy(v);
    await setAntiLazinessEnabled(v);
    await rescheduleSmartNotifications();
    Haptics.selectionAsync();
  };

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
        <Heading variant="title3">Life Hub</Heading>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Caption variant="caption1" color={t.textMuted} style={styles.kicker}>
          ALL SYSTEMS · ONE DASHBOARD
        </Caption>

        {scores && (
          <Card style={{ gap: spacing.md }}>
            <Heading variant="title3">Scores</Heading>
            <View style={styles.scoreRow}>
              <ScoreOrb label="Discipline" value={scores.discipline} color="#A78BFA" />
              <ScoreOrb label="Health" value={scores.health} color="#34D399" />
              <ScoreOrb label="Spiritual" value={scores.spiritual} color="#FBBF24" />
            </View>
          </Card>
        )}

        {danger && danger.level !== "ok" && (
          <Card
            style={{
              gap: spacing.sm,
              borderWidth: danger.level === "critical" ? 2 : 1,
              borderColor:
                danger.level === "critical" ? t.danger : t.warning,
            }}
          >
            <Heading
              variant="title3"
              color={danger.level === "critical" ? t.danger : t.warning}
            >
              {danger.title}
            </Heading>
            <Body variant="callout" color={t.textSecondary}>
              {danger.body}
            </Body>
            {danger.suggestions.length > 0 && (
              <View style={{ gap: spacing.xs }}>
                {danger.suggestions.map((s) => (
                  <Caption key={s} variant="caption2" color={t.textMuted}>
                    • {s}
                  </Caption>
                ))}
              </View>
            )}
          </Card>
      )}

        <Card style={{ gap: spacing.md }}>
          <View style={styles.rowTitle}>
            <PlatformSymbol
              ios="person.fill.questionmark"
              material="account-question"
              tintColor={t.accent}
              size={22}
            />
            <Heading variant="title3">Identity</Heading>
          </View>
          <Heading variant="title2">{identity.headline}</Heading>
          {identity.lines.map((line) => (
            <Body key={line} variant="bodyMedium" color={t.textSecondary}>
              {line}
            </Body>
          ))}
          <Caption variant="caption2" color={t.accent}>
            {identity.footnote}
          </Caption>
        </Card>

        <Card style={{ gap: spacing.md }}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Heading variant="title3">Hard Mode</Heading>
              <Caption variant="caption2" color={t.textMuted}>
                Stricter risk, stronger alerts, no unchecking habits.
              </Caption>
            </View>
            <Switch
              value={hardMode}
              onValueChange={(v) => {
                void setHardMode(v);
                Haptics.notificationAsync(
                  v
                    ? Haptics.NotificationFeedbackType.Success
                    : Haptics.NotificationFeedbackType.Warning,
                );
              }}
              trackColor={{ false: t.border, true: t.danger + "88" }}
              thumbColor={hardMode ? t.danger : "#f4f3f4"}
            />
          </View>
          {hardMode && (
            <Caption variant="caption2" color={t.accent}>
              Full completion streak: {hardModeStreak} day(s)
            </Caption>
          )}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Heading variant="title3">Anti-laziness</Heading>
              <Caption variant="caption2" color={t.textMuted}>
                Midday movement pings + stronger copy when idle.
              </Caption>
            </View>
            <Switch
              value={antiLazy}
              onValueChange={(v) => void toggleAnti(v)}
              trackColor={{ false: t.border, true: t.accent + "88" }}
              thumbColor={antiLazy ? t.accent : "#f4f3f4"}
            />
          </View>
        </Card>

        <Heading variant="title3" style={{ marginTop: spacing.md }}>
          Daily reset
        </Heading>
        <Card style={{ gap: spacing.sm }}>
          <Caption variant="caption2" color={t.textMuted}>
            Morning — plan
          </Caption>
          <TextInput
            value={morningPlan}
            onChangeText={setMorningPlan}
            placeholder="Win condition for today (3 bullets max)."
            placeholderTextColor={t.textMuted}
            multiline
            style={[styles.area, { color: t.textPrimary, borderColor: t.border }]}
          />
          <Button title="Save morning plan" onPress={saveMorning} variant="secondary" />
        </Card>
        <Card style={{ gap: spacing.sm }}>
          <Caption variant="caption2" color={t.textMuted}>
            Night — reflection
          </Caption>
          <TextInput
            value={nightReflection}
            onChangeText={setNightReflection}
            placeholder="What went wrong? What will you tighten tomorrow?"
            placeholderTextColor={t.textMuted}
            multiline
            style={[styles.area, { color: t.textPrimary, borderColor: t.border }]}
          />
          <Button title="Save night reflection" onPress={saveNight} variant="secondary" />
        </Card>

        <Heading variant="title3" style={{ marginTop: spacing.md }}>
          Urge tracker
        </Heading>
        <Card style={{ gap: spacing.md }}>
          <Caption variant="caption2" color={t.textMuted}>
            Intensity (1–10)
          </Caption>
          <View style={styles.intensityRow}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <Pressable
                key={n}
                onPress={() => {
                  Haptics.selectionAsync();
                  setUrgeIntensity(n);
                }}
                style={[
                  styles.intChip,
                  urgeIntensity === n && { backgroundColor: t.accent + "33" },
                  { borderColor: t.border },
                ]}
              >
                <Caption
                  variant="caption2"
                  color={urgeIntensity === n ? t.accent : t.textSecondary}
                  style={{ fontWeight: "700" }}
                >
                  {n}
                </Caption>
              </Pressable>
            ))}
          </View>
          <Caption variant="caption2" color={t.textMuted}>
            Trigger tag (optional)
          </Caption>
          <TextInput
            value={urgeTrigger}
            onChangeText={setUrgeTrigger}
            placeholder="alone, tired, social media..."
            placeholderTextColor={t.textMuted}
            style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
          />
          <Button title="Log urge now" onPress={logUrgeNow} />
          <View style={{ gap: spacing.xs }}>
            <Caption variant="caption2" color={t.textMuted}>
              Patterns ({patterns.total} logs)
            </Caption>
            {patterns.peakHour != null && (
              <Body variant="callout" color={t.textSecondary}>
                Peak hour: {patterns.peakHour}:00 · avg intensity{" "}
                {patterns.avgIntensity}
              </Body>
            )}
            {patterns.topTriggers.map((tr) => (
              <Caption key={tr.tag} variant="caption2" color={t.textMuted}>
                {tr.tag}: {tr.count}×
              </Caption>
            ))}
          </View>
        </Card>

        <View style={{ height: spacing["4xl"] }} />
      </ScrollView>
    </View>
  );
}

function ScoreOrb({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.orb}>
      <View style={[styles.orbRing, { borderColor: color }]}>
        <Heading variant="title2" color={color}>
          {value}
        </Heading>
      </View>
      <Caption variant="caption2" color="#888">
        {label}
      </Caption>
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
  kicker: { letterSpacing: 0.6, marginBottom: -spacing.xs },
  scoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  orb: { flex: 1, alignItems: "center", gap: spacing.xs },
  orbRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  area: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    textAlignVertical: "top",
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  intensityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  intChip: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
