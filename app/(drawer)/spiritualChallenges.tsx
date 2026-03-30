import { type DrawerNavigationProp } from "@react-navigation/drawer";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import {
  getSpiritualChallengesDashboard,
  toggleSpiritualChallengeDay,
} from "@/lib/database";
import type { SpiritualChallengeDashboard } from "@/lib/types";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SpiritualChallengesScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const [items, setItems] = useState<SpiritualChallengeDashboard[]>([]);
  const day = todayISO();

  const load = useCallback(async () => {
    const rows = await getSpiritualChallengesDashboard(day);
    setItems(rows);
  }, [day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const daily = useMemo(
    () => items.filter((i) => i.cadence === "daily"),
    [items],
  );
  const weekly = useMemo(
    () => items.filter((i) => i.cadence === "weekly"),
    [items],
  );

  const onToggle = async (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleSpiritualChallengeDay(id, day);
    load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <View
        style={[styles.header, { paddingTop: insets.top + spacing.md }]}
      >
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
        <Heading variant="title3">Spiritual</Heading>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(320)}>
          <View style={[styles.hero, { backgroundColor: t.card }]}>
            <View style={[styles.heroGlow, { backgroundColor: "#FBBF2418" }]}>
              <PlatformSymbol
                ios="hands.sparkles.fill"
                material="hands-pray"
                tintColor="#FBBF24"
                size={26}
              />
            </View>
            <Heading variant="title2">Daily and weekly rhythm</Heading>
            <Body variant="callout" color={t.textSecondary} style={styles.heroSub}>
              Track what matters: mark today done and watch your streak grow.
            </Body>
          </View>
        </Animated.View>

        {daily.length > 0 && (
          <View style={styles.section}>
            <SectionTitle label="Daily" t={t} />
            {daily.map((row, i) => (
              <Animated.View
                key={row.id}
                entering={FadeInDown.delay(i * 55).duration(260)}
              >
                <SpiritualCard
                  row={row}
                  t={t}
                  onToggle={() => onToggle(row.id)}
                />
              </Animated.View>
            ))}
          </View>
        )}

        {weekly.length > 0 && (
          <View style={styles.section}>
            <SectionTitle label="Weekly" t={t} />
            {weekly.map((row, i) => (
              <Animated.View
                key={row.id}
                entering={FadeInDown.delay((daily.length + i) * 55).duration(
                  260,
                )}
              >
                <SpiritualCard
                  row={row}
                  t={t}
                  onToggle={() => onToggle(row.id)}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SectionTitle({
  label,
  t,
}: {
  label: string;
  t: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={[styles.sectionDot, { backgroundColor: "#FBBF24" }]} />
      <Caption
        variant="footnote"
        color={t.textMuted}
        style={{ fontWeight: "700", letterSpacing: 1 }}
      >
        {label.toUpperCase()}
      </Caption>
    </View>
  );
}

function SpiritualCard({
  row,
  t,
  onToggle,
}: {
  row: SpiritualChallengeDashboard;
  t: ReturnType<typeof useAppTheme>;
  onToggle: () => void;
}) {
  const streakLabel =
    row.cadence === "weekly" ? "Week streak" : "Day streak";
  const meta =
    row.cadence === "weekly"
      ? `${row.weekDaysComplete}/7 days this week · ${streakLabel}: ${row.streak}`
      : `${streakLabel}: ${row.streak}`;

  return (
    <View style={[styles.card, { backgroundColor: t.card }]}>
      <View style={styles.cardTop}>
        <View style={styles.cardText}>
          <Heading variant="title3">{row.title}</Heading>
          <Caption variant="caption2" color={t.textMuted}>
            {meta}
          </Caption>
        </View>
        <Switch
          value={row.completedToday}
          onValueChange={onToggle}
          trackColor={{ false: t.border, true: "#FBBF2488" }}
          thumbColor={row.completedToday ? "#FBBF24" : t.textMuted}
        />
      </View>
      <Body variant="callout" color={t.textSecondary}>
        {row.description}
      </Body>
      {row.completedToday ? (
        <View
          style={[
            styles.doneRow,
            { backgroundColor: t.accent + "14" },
          ]}
        >
          <PlatformSymbol
            ios="checkmark.circle.fill"
            material="check-circle"
            tintColor={t.accent}
            size={18}
          />
          <Caption variant="caption1" color={t.accent} style={{ fontWeight: "600" }}>
            Done today
          </Caption>
        </View>
      ) : null}
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
    paddingTop: spacing.sm,
    paddingBottom: spacing["5xl"],
    gap: spacing.lg,
  },
  hero: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius["2xl"],
    gap: spacing.sm,
  },
  heroGlow: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  heroSub: {
    textAlign: "center",
    lineHeight: 22,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  cardText: {
    flex: 1,
    gap: spacing.xs,
  },
  doneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
});
