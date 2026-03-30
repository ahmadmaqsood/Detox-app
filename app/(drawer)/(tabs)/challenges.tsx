import { type DrawerNavigationProp } from "@react-navigation/drawer";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  ZoomIn,
} from "react-native-reanimated";

import { Button } from "@/components/Button";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import {
  getChallengeStats,
  getChallenges,
  incrementChallengeProgress,
  resetChallenge,
  startChallenge,
} from "@/lib/database";
import { useScrollToTopOnTabFocus } from "@/lib/useScrollToTopOnTabFocus";
import type { Challenge, ChallengeCategory, ChallengeStats } from "@/lib/types";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Category (Life OS) ────────────────────────────────────────

const CATEGORY_LABELS: Record<ChallengeCategory, string> = {
  discipline: "Discipline",
  physical: "Physical",
  mental: "Mental",
  spiritual: "Spiritual",
};

function categoryVisual(cat: ChallengeCategory) {
  switch (cat) {
    case "discipline":
      return {
        color: "#60A5FA",
        ios: "shield.checkered" as const,
        material: "shield-check",
      };
    case "physical":
      return {
        color: "#34D399",
        ios: "figure.run" as const,
        material: "run",
      };
    case "mental":
      return {
        color: "#A78BFA",
        ios: "brain.head.profile" as const,
        material: "head-cog",
      };
    case "spiritual":
      return {
        color: "#FBBF24",
        ios: "hands.sparkles.fill" as const,
        material: "hands-pray",
      };
    default:
      return {
        color: "#60A5FA",
        ios: "star.fill" as const,
        material: "star",
      };
  }
}

// ─── Color mapping per challenge tier ──────────────────────────

function challengeMeta(duration: number) {
  if (duration <= 7)
    return {
      color: "#60A5FA",
      icon: {
        ios: "bolt.fill" as const,
        android: "bolt" as const,
        web: "bolt" as const,
      },
      tier: "Starter",
    };
  if (duration <= 30)
    return {
      color: "#A78BFA",
      icon: {
        ios: "flame.fill" as const,
        android: "whatshot" as const,
        web: "whatshot" as const,
      },
      tier: "Warrior",
    };
  return {
    color: "#F59E0B",
    icon: {
      ios: "trophy.fill" as const,
      android: "emoji_events" as const,
      web: "emoji_events" as const,
    },
    tier: "Legend",
  };
}

// ────────────────────────────────────────────────────────────────

type CatFilter = "all" | ChallengeCategory;

export default function ChallengesScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [challengeStats, setChallengeStats] = useState<ChallengeStats>({
    totalCompleted: 0,
    totalDaysCompleted: 0,
  });
  const [catFilter, setCatFilter] = useState<CatFilter>("all");
  const [showChallengeComplete, setShowChallengeComplete] = useState(false);
  const scrollRef = useScrollToTopOnTabFocus();

  const load = useCallback(async () => {
    const [data, stats] = await Promise.all([
      getChallenges(),
      getChallengeStats(),
    ]);
    setChallenges(data);
    setChallengeStats(stats);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const visible = useMemo(
    () =>
      challenges.filter(
        (c) =>
          catFilter === "all" ||
          (c.category ?? "discipline") === catFilter,
      ),
    [challenges, catFilter],
  );

  const activeChallenges = visible.filter(
    (c) => c.startedAt && !c.completedAt,
  );
  const availableChallenges = visible.filter(
    (c) => !c.startedAt && !c.completedAt,
  );

  const handleStart = async (id: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await startChallenge(id);
    load();
  };

  const handleLogDay = async (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const finished = await incrementChallengeProgress(id);
    await load();
    if (finished) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowChallengeComplete(true);
      setTimeout(() => setShowChallengeComplete(false), 4000);
    }
  };

  const handleReset = (id: number, name: string) => {
    Alert.alert("Reset Challenge", `Reset "${name}" back to day 0?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await resetChallenge(id);
          load();
        },
      },
    ]);
  };

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
        <Heading variant="title3">Challenges</Heading>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Summary Hero ────────────────────────── */}
        <Animated.View entering={FadeIn.duration(400)}>
          <View style={[styles.hero, { backgroundColor: t.card }]}>
            <View style={styles.heroTrophyRow}>
              <View style={[styles.heroGlow, { backgroundColor: "#F59E0B18" }]}>
                <PlatformSymbol
                  ios="trophy.fill"
                  material="trophy"
                  tintColor="#F59E0B"
                  size={28}
                />
              </View>
            </View>
            <Heading variant="title1">Challenges</Heading>
            <Body variant="body" color={t.textSecondary}>
              Push your limits. Build discipline.
            </Body>
            <View style={styles.heroStats}>
              <HeroStat
                label="Active"
                value={activeChallenges.length}
                color={t.accent}
                t={t}
              />
              <View
                style={[styles.heroDivider, { backgroundColor: t.border }]}
              />
              <HeroStat
                label="Completed"
                value={challengeStats.totalCompleted}
                color="#F59E0B"
                t={t}
              />
              <View
                style={[styles.heroDivider, { backgroundColor: t.border }]}
              />
              <HeroStat
                label="Days done"
                value={challengeStats.totalDaysCompleted}
                color="#60A5FA"
                t={t}
              />
            </View>
          </View>
        </Animated.View>

        {/* ─── Category filter ─────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {(
            [
              "all",
              "discipline",
              "physical",
              "mental",
              "spiritual",
            ] as const
          ).map((key) => {
            const activeChip = catFilter === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  Haptics.selectionAsync();
                  setCatFilter(key);
                }}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: activeChip ? t.accent + "22" : t.card,
                    borderColor: activeChip ? t.accent : t.border,
                  },
                ]}
              >
                <Caption
                  variant="caption2"
                  color={activeChip ? t.accent : t.textSecondary}
                  style={{ fontWeight: "700" }}
                >
                  {key === "all" ? "All" : CATEGORY_LABELS[key]}
                </Caption>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ─── Active Challenges ───────────────────── */}
        {activeChallenges.length > 0 && (
          <View style={styles.section}>
            <SectionLabel label="ACTIVE" color={t.accent} t={t} />
            {activeChallenges.map((c, i) => (
              <Animated.View
                key={c.id}
                entering={FadeInDown.delay(i * 80).duration(300)}
              >
                <ChallengeCard
                  challenge={c}
                  t={t}
                  onLogDay={() => handleLogDay(c.id)}
                  onReset={() => handleReset(c.id, c.name)}
                />
              </Animated.View>
            ))}
          </View>
        )}

        {/* ─── Available Challenges ────────────────── */}
        {availableChallenges.length > 0 && (
          <View style={styles.section}>
            <SectionLabel label="AVAILABLE" color={t.textSecondary} t={t} />
            {availableChallenges.map((c, i) => (
              <Animated.View
                key={c.id}
                entering={FadeInDown.delay(
                  (activeChallenges.length + i) * 80,
                ).duration(300)}
              >
                <ChallengeCard
                  challenge={c}
                  t={t}
                  onStart={() => handleStart(c.id)}
                />
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      {showChallengeComplete && (
        <Animated.View
          entering={ZoomIn.springify().damping(16).stiffness(200)}
          exiting={FadeOut.duration(220)}
          style={[
            StyleSheet.absoluteFillObject,
            styles.celebrateBackdrop,
          ]}
          pointerEvents="box-none"
        >
          <Animated.View
            entering={FadeInDown.delay(80).springify().damping(18)}
            style={[styles.celebrateCard, { backgroundColor: t.card }]}
          >
            <PlatformSymbol
              ios="trophy.fill"
              material="trophy"
              tintColor="#F59E0B"
              size={44}
            />
            <Heading variant="title3" style={styles.celebrateTitle}>
              Challenge Completed. You are leveling up.
            </Heading>
            <Caption variant="caption1" color={t.textSecondary} style={{ textAlign: "center" }}>
              Your stats have been updated.
            </Caption>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Challenge Card ────────────────────────────────────────────

function ChallengeCard({
  challenge: c,
  t,
  onStart,
  onLogDay,
  onReset,
}: {
  challenge: Challenge;
  t: ReturnType<typeof useAppTheme>;
  onStart?: () => void;
  onLogDay?: () => void;
  onReset?: () => void;
}) {
  const meta = challengeMeta(c.duration);
  const cat = (c.category ?? "discipline") as ChallengeCategory;
  const cv = categoryVisual(cat);
  const pct = c.duration > 0 ? (c.progress / c.duration) * 100 : 0;
  const isActive = !!c.startedAt && !c.completedAt;
  const isCompleted = !!c.completedAt;
  const remaining = c.duration - c.progress;

  return (
    <View style={[styles.card, { backgroundColor: t.card }]}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View
          style={[styles.cardIconWrap, { backgroundColor: cv.color + "18" }]}
        >
          <PlatformSymbol
            ios={cv.ios}
            material={cv.material}
            tintColor={cv.color}
            size={20}
          />
        </View>
        <View style={styles.cardHeaderText}>
          <Heading variant="title3">{c.name}</Heading>
          <Caption variant="caption2" color={t.textMuted}>
            {CATEGORY_LABELS[cat]} · {meta.tier} · {c.duration} days
          </Caption>
        </View>
        {isCompleted && <CompletionBadge color={cv.color} />}
        {isActive && (
          <View
            style={[styles.activePill, { backgroundColor: t.accent + "18" }]}
          >
            <Caption
              variant="caption2"
              color={t.accent}
              style={{ fontWeight: "700" }}
            >
              Day {c.progress}
            </Caption>
          </View>
        )}
      </View>

      {/* Description */}
      <Body variant="callout" color={t.textSecondary} style={styles.cardDesc}>
        {c.description}
      </Body>
      {c.rules ? (
        <View
          style={[
            styles.rulesBox,
            { backgroundColor: t.background, borderColor: t.border },
          ]}
        >
          <Caption variant="caption2" color={t.textMuted} style={styles.rulesLabel}>
            RULES
          </Caption>
          <Body variant="footnote" color={t.textSecondary}>
            {c.rules}
          </Body>
        </View>
      ) : null}

      {/* Progress bar */}
      <AnimatedProgressBar pct={pct} color={cv.color} track={t.background} />

      {/* Footer stats */}
      <View style={styles.cardFooter}>
        <Caption variant="caption2" color={t.textMuted}>
          {c.progress}/{c.duration} days
        </Caption>
        <Caption
          variant="caption2"
          color={cv.color}
          style={{ fontWeight: "700" }}
        >
          {Math.round(pct)}%
        </Caption>
      </View>

      {/* Day milestones */}
      {(isActive || isCompleted) && (
        <View style={styles.milestoneRow}>
          {buildMilestones(c.duration).map((m) => {
            const reached = c.progress >= m;
            return (
              <View key={m} style={styles.milestone}>
                <View
                  style={[
                    styles.milestoneDot,
                    {
                      backgroundColor: reached ? cv.color : t.border,
                      borderColor: reached ? cv.color : t.border,
                    },
                  ]}
                >
                  {reached && (
                    <PlatformSymbol
                      ios="checkmark"
                      material="check"
                      tintColor="#fff"
                      size={8}
                    />
                  )}
                </View>
                <Caption
                  variant="caption2"
                  color={reached ? cv.color : t.textMuted}
                >
                  {m}d
                </Caption>
              </View>
            );
          })}
        </View>
      )}

      {/* Actions */}
      <View style={styles.cardActions}>
        {!isActive && !isCompleted && onStart && (
          <Button title="Start Challenge" onPress={onStart} />
        )}
        {isActive && onLogDay && (
          <Pressable
            onPress={onLogDay}
            style={[styles.logDayBtn, { backgroundColor: cv.color }]}
          >
            <PlatformSymbol
              ios="plus.circle.fill"
              material="plus-circle"
              tintColor="#fff"
              size={18}
            />
            <Body variant="headline" color="#fff">
              Log Day {c.progress + 1}
            </Body>
          </Pressable>
        )}
        {isActive && remaining > 0 && (
          <Caption
            variant="footnote"
            color={t.textMuted}
            style={{ textAlign: "center", marginTop: spacing.xs }}
          >
            {remaining} {remaining === 1 ? "day" : "days"} remaining
          </Caption>
        )}
        {isCompleted && (
          <View
            style={[
              styles.completedBanner,
              { backgroundColor: cv.color + "12" },
            ]}
          >
            <PlatformSymbol
              ios="checkmark.seal.fill"
              material="check-decagram"
              tintColor={cv.color}
              size={18}
            />
            <Body variant="bodyMedium" color={cv.color}>
              Challenge Complete!
            </Body>
          </View>
        )}
        {(isActive || isCompleted) && onReset && (
          <Pressable onPress={onReset} style={styles.resetBtn}>
            <PlatformSymbol
              ios="arrow.counterclockwise"
              material="refresh"
              tintColor={t.textMuted}
              size={14}
            />
            <Caption variant="footnote" color={t.textMuted}>
              Reset
            </Caption>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Animated Progress Bar ─────────────────────────────────────

function AnimatedProgressBar({
  pct,
  color,
  track,
}: {
  pct: number;
  color: string;
  track: string;
}) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withSpring(pct / 100, { damping: 20, stiffness: 100 });
  }, [pct]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(width.value * 100, 100)}%`,
  }));

  return (
    <View style={[styles.progressTrack, { backgroundColor: track }]}>
      <Animated.View
        style={[styles.progressFill, { backgroundColor: color }, fillStyle]}
      />
    </View>
  );
}

// ─── Completion Badge ──────────────────────────────────────────

function CompletionBadge({ color }: { color: string }) {
  return (
    <Animated.View
      entering={ZoomIn.springify()}
      style={[styles.badge, { backgroundColor: color + "22" }]}
    >
      <PlatformSymbol
        ios="checkmark.seal.fill"
        material="check-decagram"
        tintColor={color}
        size={20}
      />
    </Animated.View>
  );
}

// ─── Hero Stat ─────────────────────────────────────────────────

function HeroStat({
  label,
  value,
  color,
  t,
}: {
  label: string;
  value: number;
  color: string;
  t: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View style={styles.heroStat}>
      <Heading variant="title2" color={color}>
        {value}
      </Heading>
      <Caption variant="caption2" color={t.textMuted}>
        {label}
      </Caption>
    </View>
  );
}

// ─── Section Label ─────────────────────────────────────────────

function SectionLabel({
  label,
  color,
  t,
}: {
  label: string;
  color: string;
  t: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View style={styles.sectionLabel}>
      <View style={[styles.sectionDot, { backgroundColor: color }]} />
      <Caption
        variant="footnote"
        color={t.textMuted}
        style={{ fontWeight: "700", letterSpacing: 1 }}
      >
        {label}
      </Caption>
    </View>
  );
}

// ─── Milestone builder ─────────────────────────────────────────

function buildMilestones(duration: number): number[] {
  if (duration <= 7) return [1, 3, 5, 7];
  if (duration <= 30) return [1, 7, 14, 21, 30];
  return [1, 7, 30, 60, 90];
}

// ─── Styles ────────────────────────────────────────────────────

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

  // Hero
  hero: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    paddingHorizontal: spacing.xl,
    borderRadius: radius["2xl"],
    gap: spacing.sm,
  },
  heroTrophyRow: {
    marginBottom: spacing.xs,
  },
  heroGlow: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  heroStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  heroStat: {
    alignItems: "center",
    gap: spacing.xxs,
  },
  heroDivider: {
    width: 1,
    height: 24,
  },

  // Sections
  section: {
    gap: spacing.md,
  },
  sectionLabel: {
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

  filterScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
  },

  // Card
  card: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderText: {
    flex: 1,
    gap: spacing.xxs,
  },
  cardDesc: {
    marginTop: -spacing.xs,
  },
  rulesBox: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  rulesLabel: {
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardActions: {
    gap: spacing.sm,
  },

  // Progress
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },

  // Milestones
  milestoneRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  milestone: {
    alignItems: "center",
    gap: spacing.xxs,
  },
  milestoneDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  // Active pill
  activePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },

  // Badge
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  // Log day
  logDayBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },

  // Completed banner
  completedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },

  // Reset
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },

  celebrateBackdrop: {
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    zIndex: 50,
  },
  celebrateCard: {
    borderRadius: radius["2xl"],
    padding: spacing["2xl"],
    alignItems: "center",
    gap: spacing.md,
    maxWidth: 320,
    width: "100%",
  },
  celebrateTitle: {
    textAlign: "center",
    lineHeight: 26,
  },
});
