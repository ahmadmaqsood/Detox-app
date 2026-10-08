import { type DrawerNavigationProp } from "@react-navigation/drawer";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown, Layout } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { HabitIconView } from "@/components/HabitIconView";
import { HabitsLoadingSkeleton } from "@/components/HabitSkeleton";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Body, Caption, Heading } from "@/components/Typography";
import { deleteHabit, getAllHabits } from "@/lib/firestoreDatabase";
import { parseHabitIcon, type Habit, type LifeArea } from "@/lib/types";
import { useMode } from "@/store/ModeContext";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";

type ModeFilter = "home" | "hostel" | "all";

const FILTER_SEGMENTS: { label: string; value: ModeFilter }[] = [
  { label: "🏠 Home", value: "home" },
  { label: "🏢 Hostel", value: "hostel" },
  { label: "🌐 All", value: "all" },
];

const LIFE_AREA_COLORS: Record<LifeArea, string> = {
  spiritual: "#A78BFA",
  physical: "#34D399",
  mental: "#60A5FA",
  work: "#FBBF24",
};

export default function HabitsScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const { mode: currentMode } = useMode();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [filter, setFilter] = useState<ModeFilter>(currentMode);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const all = await getAllHabits();
      setHabits(all);
    } catch (e) {
      console.error("Failed to load habits", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleDelete = (habit: Habit) => {
    Alert.alert(
      "Delete Habit",
      `Are you sure you want to delete "${habit.name}"? This will remove it from daily tracking.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setDeletingId(habit.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await deleteHabit(habit.id);
              setHabits((prev) => prev.filter((h) => h.id !== habit.id));
            } catch (err) {
              console.error("Failed to delete habit:", err);
              Alert.alert("Error", "Could not delete habit. Please try again.");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
  };

  const handleEdit = (habit: Habit) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/habitDetail",
      params: { id: String(habit.id) },
    });
  };

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const targetMode = filter === "all" ? currentMode : filter;
    router.push({
      pathname: "/addHabit",
      params: { mode: targetMode },
    });
  };

  // Filtered list
  const filteredHabits = habits.filter((h) => {
    if (filter !== "all" && h.mode !== filter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = h.name.toLowerCase().includes(q);
      const matchArea = (h.lifeArea || "").toLowerCase().includes(q);
      return matchName || matchArea;
    }
    return true;
  });

  const homeCount = habits.filter((h) => h.mode === "home").length;
  const hostelCount = habits.filter((h) => h.mode === "hostel").length;

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* ─── Header ─────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.openDrawer();
          }}
          hitSlop={12}
          style={styles.iconBtn}
        >
          <PlatformSymbol
            ios="line.3.horizontal"
            material="menu"
            tintColor={t.textPrimary}
            size={22}
          />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Heading variant="title3">Manage Habits</Heading>
          <Caption variant="caption2" color={t.textMuted}>
            {filter === "all"
              ? `${habits.length} total habits`
              : filter === "home"
                ? `${homeCount} Home habits`
                : `${hostelCount} Hostel habits`}
          </Caption>
        </View>

        <Pressable onPress={handleAdd} hitSlop={12} style={styles.addBtn}>
          <PlatformSymbol
            ios="plus.circle.fill"
            material="add_circle"
            tintColor={t.accent}
            size={26}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={t.accent}
          />
        }
      >
        {/* ─── Mode Filter Segments ───────────────────────────── */}
        <Animated.View entering={FadeIn.duration(250)} style={styles.segmentWrap}>
          <SegmentedControl
            segments={FILTER_SEGMENTS}
            selected={filter}
            onChange={(next) => {
              Haptics.selectionAsync();
              setFilter(next);
            }}
          />
        </Animated.View>

        {/* ─── Mode Stats Cards ───────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(280)} style={styles.statsRow}>
          <Pressable
            style={[
              styles.statCard,
              { backgroundColor: t.card },
              filter === "home" && { borderColor: t.accent, borderWidth: 1.5 },
            ]}
            onPress={() => setFilter("home")}
          >
            <View style={styles.statCardTop}>
              <Body variant="headline" color={filter === "home" ? t.accent : t.textPrimary}>
                {homeCount}
              </Body>
              <Caption variant="caption2" color={t.textMuted}>
                Home
              </Caption>
            </View>
            <Caption variant="caption2" color={t.textSecondary}>
              🏠 Household routine
            </Caption>
          </Pressable>

          <Pressable
            style={[
              styles.statCard,
              { backgroundColor: t.card },
              filter === "hostel" && { borderColor: t.accent, borderWidth: 1.5 },
            ]}
            onPress={() => setFilter("hostel")}
          >
            <View style={styles.statCardTop}>
              <Body variant="headline" color={filter === "hostel" ? t.accent : t.textPrimary}>
                {hostelCount}
              </Body>
              <Caption variant="caption2" color={t.textMuted}>
                Hostel
              </Caption>
            </View>
            <Caption variant="caption2" color={t.textSecondary}>
              🏢 Campus discipline
            </Caption>
          </Pressable>
        </Animated.View>

        {/* ─── Search Bar ─────────────────────────────────────── */}
        <View style={[styles.searchBox, { backgroundColor: t.card, borderColor: t.border }]}>
          <PlatformSymbol
            ios="magnifyingglass"
            material="search"
            tintColor={t.textMuted}
            size={16}
          />
          <TextInput
            style={[styles.searchInput, { color: t.textPrimary }]}
            placeholder="Search habits or life areas..."
            placeholderTextColor={t.textMuted}
            value={search}
            onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <PlatformSymbol
                ios="xmark.circle.fill"
                material="cancel"
                tintColor={t.textMuted}
                size={16}
              />
            </Pressable>
          )}
        </View>

        {/* ─── Habit List ─────────────────────────────────────── */}
        <View style={styles.listSection}>
          <View style={styles.listHeaderRow}>
            <Caption variant="footnote" color={t.textMuted} style={styles.listTitle}>
              {filter === "all"
                ? "ALL HABITS"
                : filter === "home"
                  ? "HOME HABITS"
                  : "HOSTEL HABITS"}
            </Caption>
            <Caption variant="caption2" color={t.textMuted}>
              {filteredHabits.length} found
            </Caption>
          </View>

          {loading ? (
            <HabitsLoadingSkeleton count={4} showProgress={false} />
          ) : filteredHabits.length === 0 ? (
            <Card style={styles.emptyCard}>
              <View style={[styles.emptyIconWrap, { backgroundColor: t.accent + "18" }]}>
                <PlatformSymbol
                  ios="checklist"
                  material="format-list-checks"
                  tintColor={t.accent}
                  size={32}
                />
              </View>
              <Heading variant="title3" style={{ marginTop: spacing.sm, textAlign: "center" }}>
                {search.trim() ? "No matching habits" : `No ${filter} habits yet`}
              </Heading>
              <Caption color={t.textMuted} style={{ textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.md }}>
                {search.trim()
                  ? "Try searching for a different keyword or habit name."
                  : `Add your first ${filter === "all" ? "" : filter} habit to build discipline and stay on track.`}
              </Caption>
              <Button title={`+ Add ${filter === "all" ? "Habit" : filter === "home" ? "Home Habit" : "Hostel Habit"}`} onPress={handleAdd} />
            </Card>
          ) : (
            filteredHabits.map((habit, index) => {
              const parsedIcon = parseHabitIcon(habit.icon);
              const habitColor = habit.color || t.accent;
              const areaColor =
                LIFE_AREA_COLORS[habit.lifeArea] || t.textSecondary;
              const isDeleting = deletingId === habit.id;

              return (
                <Animated.View
                  key={habit.id}
                  entering={FadeInDown.delay(index * 40).duration(250)}
                  layout={Layout.springify()}
                  style={styles.itemWrap}
                >
                  <Card style={styles.habitCard}>
                    <Pressable
                      style={styles.habitMainRow}
                      onPress={() => handleEdit(habit)}
                      android_ripple={{ color: t.border }}
                    >
                      {/* Icon */}
                      <View
                        style={[
                          styles.habitIconWrap,
                          { backgroundColor: habitColor + "22" },
                        ]}
                      >
                        <HabitIconView
                          icon={parsedIcon}
                          color={habitColor}
                          size={22}
                        />
                      </View>

                      {/* Info */}
                      <View style={styles.habitInfo}>
                        <Body variant="headline" style={styles.habitName}>
                          {habit.name}
                        </Body>

                        <View style={styles.badgeRow}>
                          {/* Mode Badge */}
                          <View
                            style={[
                              styles.modeBadge,
                              {
                                backgroundColor:
                                  habit.mode === "home"
                                    ? "#4ADE8018"
                                    : "#60A5FA18",
                              },
                            ]}
                          >
                            <Caption
                              variant="caption2"
                              color={
                                habit.mode === "home" ? "#4ADE80" : "#60A5FA"
                              }
                              style={{ fontWeight: "600" }}
                            >
                              {habit.mode === "home" ? "🏠 Home" : "🏢 Hostel"}
                            </Caption>
                          </View>

                          {/* Life Area Badge */}
                          {habit.lifeArea && (
                            <View
                              style={[
                                styles.areaBadge,
                                { backgroundColor: areaColor + "18" },
                              ]}
                            >
                              <Caption
                                variant="caption2"
                                color={areaColor}
                                style={{ fontWeight: "600" }}
                              >
                                {habit.lifeArea.toUpperCase()}
                              </Caption>
                            </View>
                          )}

                          {/* Target */}
                          <Caption variant="caption2" color={t.textMuted}>
                            {habit.targetPerDay ?? 1}x daily
                          </Caption>
                        </View>
                      </View>
                    </Pressable>

                    {/* Action Buttons Row */}
                    <View style={[styles.cardActionsRow, { borderTopColor: t.border }]}>
                      <Pressable
                        style={styles.actionBtn}
                        onPress={() => handleEdit(habit)}
                        hitSlop={8}
                      >
                        <PlatformSymbol
                          ios="pencil"
                          material="edit"
                          tintColor={t.accent}
                          size={15}
                        />
                        <Body variant="subhead" color={t.accent} style={{ fontWeight: "600" }}>
                          Edit
                        </Body>
                      </Pressable>

                      <View style={[styles.actionDivider, { backgroundColor: t.border }]} />

                      <Pressable
                        style={[styles.actionBtn, isDeleting && { opacity: 0.5 }]}
                        onPress={() => handleDelete(habit)}
                        disabled={isDeleting}
                        hitSlop={8}
                      >
                        <PlatformSymbol
                          ios="trash"
                          material="delete_outline"
                          tintColor={t.danger}
                          size={15}
                        />
                        <Body variant="subhead" color={t.danger} style={{ fontWeight: "600" }}>
                          {isDeleting ? "Deleting..." : "Delete"}
                        </Body>
                      </Pressable>
                    </View>
                  </Card>
                </Animated.View>
              );
            })
          )}
        </View>

        {/* Bottom spacer */}
        <View style={{ height: spacing["2xl"] }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitleWrap: {
    alignItems: "center",
  },
  iconBtn: {
    padding: spacing.xs,
  },
  addBtn: {
    padding: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  segmentWrap: {
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "transparent",
  },
  statCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  listSection: {
    marginTop: spacing.xs,
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xxs,
  },
  listTitle: {
    letterSpacing: 0.8,
    fontWeight: "600",
  },
  itemWrap: {
    marginBottom: spacing.sm,
  },
  habitCard: {
    padding: 0,
    overflow: "hidden",
  },
  habitMainRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
  },
  habitIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  habitInfo: {
    flex: 1,
  },
  habitName: {
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  modeBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  areaBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  cardActionsRow: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  actionDivider: {
    width: StyleSheet.hairlineWidth,
    height: "60%",
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
