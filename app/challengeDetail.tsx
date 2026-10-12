import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { type DrawerNavigationProp } from "@react-navigation/drawer";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import { getChallenges } from "@/lib/firestoreDatabase";

export default function ChallengeDetailScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const { id } = useLocalSearchParams<{ id: string }>();
  const challengeId = Number(id);

  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await getChallenges();
      const c = all.find((x) => x.id === challengeId) ?? null;
      setChallenge(c);
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pct = useMemo(() => {
    if (!challenge) return 0;
    const d = challenge.duration || 1;
    return Math.max(0, Math.min(100, (challenge.progress / d) * 100));
  }, [challenge]);

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
          hitSlop={12}
        >
          <PlatformSymbol
            ios="chevron.left"
            material="arrow-back"
            tintColor={t.textPrimary}
            size={22}
          />
        </Pressable>
        <Heading variant="title3">Challenge</Heading>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(240)}>
          <Card style={[styles.hero, { backgroundColor: t.card }]}>
            <Heading variant="title2">
              {challenge?.name ?? (loading ? "Loading…" : "Not found")}
            </Heading>
            {!!challenge?.description && (
              <Body variant="body" color={t.textSecondary}>
                {challenge.description}
              </Body>
            )}

            {challenge && (
              <View style={styles.row}>
                <Card style={[styles.mini, { backgroundColor: t.background }]}>
                  <Caption variant="caption2" color={t.textMuted}>
                    Progress
                  </Caption>
                  <Heading variant="title3">
                    {challenge.progress}/{challenge.duration}
                  </Heading>
                </Card>
                <Card style={[styles.mini, { backgroundColor: t.background }]}>
                  <Caption variant="caption2" color={t.textMuted}>
                    Status
                  </Caption>
                  <Heading variant="title3">
                    {challenge.status === "completed"
                      ? "Completed"
                      : challenge.status === "active"
                        ? "Active"
                        : "Locked"}
                  </Heading>
                </Card>
              </View>
            )}

            {challenge && (
              <View style={[styles.barOuter, { backgroundColor: t.border }]}>
                <View
                  style={[
                    styles.barInner,
                    { width: `${pct}%`, backgroundColor: challenge.status === "completed" ? "#10B981" : t.accent },
                  ]}
                />
              </View>
            )}

            <Caption variant="caption1" color={t.textMuted}>
              {challenge?.status === "locked"
                ? `Locked: Complete Challenge #${challenge.id - 1} to unlock this challenge.`
                : "Progress is tracked automatically based on your daily habit checklist (≥50% completion). If you miss a day, requirement restarts from day 0."}
            </Caption>
          </Card>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.md,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing["2xl"],
    gap: spacing.lg,
  },
  hero: {
    padding: spacing.xl,
    borderRadius: radius.xl,
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  mini: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  barOuter: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  barInner: {
    height: 10,
    borderRadius: 999,
  },
});

