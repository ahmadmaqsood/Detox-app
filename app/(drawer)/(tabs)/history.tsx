import { type DrawerNavigationProp } from "@react-navigation/drawer";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import { getChallengeCompletionHistory } from "@/lib/firestoreDatabase";
import { useScrollToTopOnTabFocus } from "@/lib/useScrollToTopOnTabFocus";
import type { ChallengeCompletionRecord } from "@/lib/types";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";

function formatCompletedDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
}

export default function ChallengeHistoryScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const [completedChallenges, setCompletedChallenges] = useState<
    ChallengeCompletionRecord[]
  >([]);
  const scrollRef = useScrollToTopOnTabFocus();

  const load = useCallback(async () => {
    const rows = await getChallengeCompletionHistory();
    setCompletedChallenges(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <View
        style={[styles.screenHeader, { paddingTop: insets.top + spacing.md }]}
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
        <Heading variant="title3">History</Heading>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)}>
          <Body variant="body" color={t.textSecondary} style={styles.intro}>
            Completed challenges stay here forever — even if you reset an
            active run on the Challenges tab.
          </Body>
        </Animated.View>

        {completedChallenges.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: t.card }]}>
            <PlatformSymbol
              ios="trophy"
              material="trophy-outline"
              tintColor={t.textMuted}
              size={40}
            />
            <Body variant="body" color={t.textSecondary} style={styles.emptyText}>
              No completed challenges yet. Finish a challenge to see it here.
            </Body>
          </View>
        ) : (
          <View style={styles.list}>
            {completedChallenges.map((item, i) => (
              <Animated.View
                key={item.id}
                entering={FadeInDown.delay(i * 60).duration(280)}
              >
                <View style={[styles.row, { backgroundColor: t.card }]}>
                  <View style={styles.rowMain}>
                    <Heading variant="title3" numberOfLines={2}>
                      {item.name}
                    </Heading>
                    <Caption variant="caption2" color={t.textMuted}>
                      {item.duration} {item.duration === 1 ? "day" : "days"}
                    </Caption>
                  </View>
                  <View style={styles.rowMeta}>
                    <Caption
                      variant="caption2"
                      color={t.textSecondary}
                      style={styles.dateLabel}
                    >
                      Completed
                    </Caption>
                    <Body variant="bodyMedium" color={t.textPrimary}>
                      {formatCompletedDate(item.completedAt)}
                    </Body>
                  </View>
                </View>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenHeader: {
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
  intro: {
    lineHeight: 22,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  rowMain: {
    flex: 1,
    gap: spacing.xs,
  },
  rowMeta: {
    alignItems: "flex-end",
    gap: spacing.xxs,
  },
  dateLabel: {
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  empty: {
    borderRadius: radius["2xl"],
    padding: spacing["2xl"],
    alignItems: "center",
    gap: spacing.md,
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 22,
  },
});
