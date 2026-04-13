import { DrawerActions, useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import { syncFirestoreAchievements, type AchievementDefV2 } from "@/lib/firestoreAchievements";
import { getAchievementDefinitions, getUnlockedAchievementIds } from "@/lib/firestoreDatabase";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";

function normalizeMaterialName(name: string): string {
  // Many defs use MaterialIcons legacy underscore names; PlatformSymbol expects hyphenated.
  return name.replace(/_/g, "-");
}

export default function AchievementsScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [defs, setDefs] = useState<AchievementDefV2[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const catalog = await getAchievementDefinitions();
      setDefs(catalog);
      await syncFirestoreAchievements();
      const unlockedRows = await getUnlockedAchievementIds();
      setUnlocked(new Set(unlockedRows.map((r) => r.achievementId)));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const unlockedCount = unlocked.size;

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.dispatch(DrawerActions.openDrawer());
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
        <Heading variant="title3">Achievements</Heading>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(240)}>
          <Card style={[styles.hero, { backgroundColor: t.card }]}>
            <Heading variant="title1">Your wins</Heading>
            <Body variant="body" color={t.textSecondary}>
              Unlock achievements by streaks, detox, consistency, and urge control.
            </Body>
            <View style={styles.heroRow}>
              <Card style={[styles.mini, { backgroundColor: t.background }]}>
                <Caption variant="caption2" color={t.textMuted}>
                  Unlocked
                </Caption>
                <Heading variant="title2">{unlockedCount}</Heading>
              </Card>
              <Card style={[styles.mini, { backgroundColor: t.background }]}>
                <Caption variant="caption2" color={t.textMuted}>
                  Total
                </Caption>
                <Heading variant="title2">{defs.length}</Heading>
              </Card>
            </View>
            <Caption variant="caption1" color={t.textMuted}>
              {loading ? "Syncing…" : "Synced with Firestore"}
            </Caption>
          </Card>
        </Animated.View>

        <View style={{ gap: spacing.md }}>
          {!loading && defs.length === 0 ? (
            <Card style={{ padding: spacing.xl, backgroundColor: t.card }}>
              <Body variant="body" color={t.textSecondary}>
                No achievement catalog in Firestore yet. Run the one-time seed script (or ask an admin to seed
                the achievement_defs collection for your account).
              </Body>
            </Card>
          ) : null}
          {defs.map((a, idx) => {
            const isUnlocked = unlocked.has(a.id);
            const material = normalizeMaterialName(a.icon?.android ?? "emoji_events");
            const ios = a.icon?.ios ?? "star.circle.fill";
            return (
              <Animated.View key={a.id} entering={FadeInDown.delay(idx * 30).duration(220)}>
                <Card
                  style={[
                    styles.rowCard,
                    {
                      backgroundColor: t.card,
                      borderColor: isUnlocked ? t.accent : t.border,
                      opacity: isUnlocked ? 1 : 0.6,
                    },
                  ]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: (isUnlocked ? t.accent : t.textMuted) + "18" }]}>
                    <PlatformSymbol
                      ios={ios}
                      material={material}
                      tintColor={isUnlocked ? t.accent : t.textMuted}
                      size={22}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Heading variant="title3">{a.title}</Heading>
                    <Caption variant="caption1" color={t.textSecondary}>
                      {a.description}
                    </Caption>
                  </View>
                  {isUnlocked && (
                    <PlatformSymbol
                      ios="checkmark.seal.fill"
                      material="verified"
                      tintColor={t.accent}
                      size={18}
                    />
                  )}
                </Card>
              </Animated.View>
            );
          })}
        </View>
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
  heroRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  mini: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  rowCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});

