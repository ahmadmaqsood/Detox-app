import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import {
  addDietMeal,
  buildDietInsights,
  deleteDietMeal,
  getBodyWeights,
  getDietMealsForDate,
  getDietMealsRange,
  getDietRules,
  getExerciseMinutesByDay,
  setDietRules,
} from "@/lib";
import type { DietMeal, MealQuality } from "@/lib/types";
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
  Switch,
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

export default function DietScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const day = todayISO();

  const [rules, setRulesState] = useState({
    noLateEating: true,
    lateHour: 21,
    lightDinner: true,
    noJunkWeekdays: false,
  });
  const [hourText, setHourText] = useState("19");
  const [quality, setQuality] = useState<MealQuality>("healthy");
  const [overeating, setOvereating] = useState(false);
  const [meals, setMeals] = useState<DietMeal[]>([]);
  const [insights, setInsights] = useState<string[]>([]);

  const load = useCallback(async () => {
    const r = await getDietRules();
    setRulesState(r);
    const m = await getDietMealsForDate(day);
    setMeals(m);

    const from = addDays(day, -13);
    const mealRange = await getDietMealsRange(from, day);
    const weights = await getBodyWeights(from, day);
    const exFrom = addDays(day, -6);
    const ex = await getExerciseMinutesByDay(exFrom, day);
    const exSum = ex.reduce((s, x) => s + x.minutes, 0);
    setInsights(buildDietInsights(r, weights, mealRange, exSum));
  }, [day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const persistRules = async (next: typeof rules) => {
    setRulesState(next);
    await setDietRules(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await load();
  };

  const logMeal = async () => {
    const h = parseInt(hourText, 10);
    if (Number.isNaN(h) || h < 0 || h > 23) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addDietMeal({
      date: day,
      quality,
      overeating,
      hour: h,
    });
    setOvereating(false);
    await load();
  };

  const removeMeal = async (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await deleteDietMeal(id);
    await load();
  };

  const junkToday = useMemo(
    () => meals.filter((m) => m.quality === "junk").length,
    [meals],
  );

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
        <Heading variant="title3">Diet</Heading>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Caption variant="caption1" color={t.textMuted} style={styles.tag}>
          DISCIPLINE EATING · NO CALORIE COUNTING
        </Caption>

        <Heading variant="title3">Rules</Heading>
        <Card style={{ gap: spacing.md }}>
          <RuleRow
            label="No late eating"
            sub={`Flag meals at or after ${rules.lateHour}:00`}
            value={rules.noLateEating}
            onValueChange={(v) => persistRules({ ...rules, noLateEating: v })}
            t={t}
          />
          <View style={styles.hourStep}>
            <Caption variant="caption2" color={t.textMuted}>
              Late cutoff (meals at or after this hour count as late)
            </Caption>
            <View style={styles.hourRow}>
              <Pressable
                onPress={() =>
                  persistRules({
                    ...rules,
                    lateHour: Math.max(0, rules.lateHour - 1),
                  })
                }
                style={[styles.hourBtn, { borderColor: t.border }]}
              >
                <Body variant="title3">−</Body>
              </Pressable>
              <Heading variant="title2">{rules.lateHour}:00</Heading>
              <Pressable
                onPress={() =>
                  persistRules({
                    ...rules,
                    lateHour: Math.min(23, rules.lateHour + 1),
                  })
                }
                style={[styles.hourBtn, { borderColor: t.border }]}
              >
                <Body variant="title3">+</Body>
              </Pressable>
            </View>
          </View>
          <RuleRow
            label="Light dinner"
            sub="Mindful portions in the evening"
            value={rules.lightDinner}
            onValueChange={(v) => persistRules({ ...rules, lightDinner: v })}
            t={t}
          />
          <RuleRow
            label="No junk on weekdays"
            sub="Mon–Fri · healthy choices"
            value={rules.noJunkWeekdays}
            onValueChange={(v) =>
              persistRules({ ...rules, noJunkWeekdays: v })
            }
            t={t}
          />
        </Card>

        <Heading variant="title3" style={{ marginTop: spacing.lg }}>
          Log a meal
        </Heading>
        <Card style={{ gap: spacing.md }}>
          <View style={styles.qualityRow}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setQuality("healthy");
              }}
              style={[
                styles.qualityChip,
                {
                  borderColor: quality === "healthy" ? "#34D399" : t.border,
                  backgroundColor:
                    quality === "healthy" ? "#34D39922" : "transparent",
                },
              ]}
            >
              <Body
                variant="bodyMedium"
                color={quality === "healthy" ? "#34D399" : t.textSecondary}
              >
                Healthy
              </Body>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setQuality("junk");
              }}
              style={[
                styles.qualityChip,
                {
                  borderColor: quality === "junk" ? "#F87171" : t.border,
                  backgroundColor:
                    quality === "junk" ? "#F8717122" : "transparent",
                },
              ]}
            >
              <Body
                variant="bodyMedium"
                color={quality === "junk" ? "#F87171" : t.textSecondary}
              >
                Junk
              </Body>
            </Pressable>
          </View>
          <RuleRow
            label="Overeating"
            sub="Felt overly full"
            value={overeating}
            onValueChange={setOvereating}
            t={t}
          />
          <View>
            <Caption variant="caption2" color={t.textMuted}>
              Approx. hour eaten (0–23)
            </Caption>
            <TextInput
              value={hourText}
              onChangeText={setHourText}
              keyboardType="number-pad"
              placeholder="19"
              placeholderTextColor={t.textMuted}
              style={[
                styles.smallInput,
                { color: t.textPrimary, borderColor: t.border },
              ]}
            />
          </View>
          <Button title="Add meal" onPress={logMeal} />
          <Caption variant="caption2" color={t.textMuted}>
            Junk meals today: {junkToday}
          </Caption>
        </Card>

        <Heading variant="title3" style={{ marginTop: spacing.lg }}>
          Today
        </Heading>
        <Card style={{ gap: spacing.sm }}>
          {meals.length === 0 ? (
            <Body variant="callout" color={t.textSecondary}>
              No meals logged yet.
            </Body>
          ) : (
            meals.map((m) => (
              <View
                key={m.id}
                style={[styles.mealRow, { borderColor: t.border }]}
              >
                <View>
                  <Body variant="bodyMedium">
                    {m.quality === "healthy" ? "Healthy" : "Junk"} · {m.hour}:00
                  </Body>
                  <Caption variant="caption2" color={t.textMuted}>
                    {m.overeating ? "Overeating" : "Normal fullness"}
                  </Caption>
                </View>
                <Pressable onPress={() => removeMeal(m.id)} hitSlop={8}>
                  <Caption variant="caption2" color={t.textMuted}>
                    Remove
                  </Caption>
                </Pressable>
              </View>
            ))
          )}
        </Card>

        <Heading variant="title3" style={{ marginTop: spacing.lg }}>
          Insights
        </Heading>
        <Card style={{ gap: spacing.sm }}>
          {insights.map((line, i) => (
            <View key={i} style={styles.insightRow}>
              <PlatformSymbol
                ios="sparkles"
                material="star-four-points"
                size={16}
                tintColor={t.accent}
              />
              <Body variant="callout" color={t.textSecondary} style={{ flex: 1 }}>
                {line}
              </Body>
            </View>
          ))}
        </Card>

        <View style={{ height: spacing["3xl"] }} />
      </ScrollView>
    </View>
  );
}

function RuleRow({
  label,
  sub,
  value,
  onValueChange,
  t,
}: {
  label: string;
  sub: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  t: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View style={styles.ruleRow}>
      <View style={{ flex: 1 }}>
        <Body variant="bodyMedium">{label}</Body>
        <Caption variant="caption2" color={t.textMuted}>
          {sub}
        </Caption>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: t.border, true: t.accent + "88" }}
        thumbColor={value ? t.accent : "#f4f3f4"}
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
  qualityRow: { flexDirection: "row", gap: spacing.md },
  qualityChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    alignItems: "center",
  },
  smallInput: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xxs,
    maxWidth: 120,
  },
  mealRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  insightRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  hourStep: { gap: spacing.sm },
  hourRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  hourBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
