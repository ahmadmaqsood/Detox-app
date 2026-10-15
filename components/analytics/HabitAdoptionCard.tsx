import React from "react";
import { StyleSheet, View } from "react-native";
import { Body, Caption } from "@/components/Typography";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { radius, spacing } from "@/theme/spacing";
import type { HabitAdoptionStatus } from "@/lib/progressAnalyticsService";

interface HabitAdoptionCardProps {
  adoptionList: HabitAdoptionStatus[];
}

export function HabitAdoptionCard({ adoptionList }: HabitAdoptionCardProps) {
  const adopted = adoptionList.filter((h) => h.status === "adopted");
  const needsFocus = adoptionList.filter((h) => h.status === "needs_focus");
  const inProgress = adoptionList.filter((h) => h.status === "in_progress");

  return (
    <View style={[styles.card, { backgroundColor: "#0F1626", borderColor: "#1E2A3F" }]}>
      {/* ─── Header ────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <PlatformSymbol
            ios="brain.head.profile"
            material="psychology"
            tintColor="#00F5A0"
            size={18}
          />
          <Body variant="headline" color="#F8FAFC" style={{ fontWeight: "700" }}>
            Habit Adoption Advisory
          </Body>
        </View>
        <Caption variant="caption2" color="#64748B">
          Identifies solidified habits vs routines needing attention
        </Caption>
      </View>

      {/* ─── 1. Needs Focus (< 50%) ─────────────────────── */}
      {needsFocus.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.statusBadge, { backgroundColor: "#F59E0B20", borderColor: "#F59E0B" }]}>
              <PlatformSymbol
                ios="exclamationmark.triangle.fill"
                material="warning"
                tintColor="#F59E0B"
                size={12}
              />
              <Caption variant="caption2" color="#F59E0B" style={{ fontWeight: "700" }}>
                Needs Focus ({needsFocus.length})
              </Caption>
            </View>
            <Caption variant="caption2" color="#64748B">
              Low consistency (&lt;50%)
            </Caption>
          </View>

          <View style={styles.itemsWrap}>
            {needsFocus.map((h) => (
              <View key={h.habitId} style={[styles.itemCard, { backgroundColor: "#141D30", borderColor: "#F59E0B30" }]}>
                <View style={styles.itemTop}>
                  <Body variant="subhead" color="#F1F5F9" style={{ fontWeight: "600" }}>
                    {h.habitName}
                  </Body>
                  <View style={[styles.ratePill, { backgroundColor: "#F59E0B25" }]}>
                    <Caption variant="caption2" color="#F59E0B" style={{ fontWeight: "700" }}>
                      {h.consistencyRate}% ({h.completedDays}/{h.totalDays}d)
                    </Caption>
                  </View>
                </View>

                <Caption variant="caption2" color="#94A3B8" style={styles.adviceText}>
                  💡 {h.advice}
                </Caption>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ─── 2. Adopted Habits (≥ 80%) ─────────────────── */}
      {adopted.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.statusBadge, { backgroundColor: "#00F5A020", borderColor: "#00F5A0" }]}>
              <PlatformSymbol
                ios="checkmark.seal.fill"
                material="verified"
                tintColor="#00F5A0"
                size={12}
              />
              <Caption variant="caption2" color="#00F5A0" style={{ fontWeight: "700" }}>
                Solidified & Adopted ({adopted.length})
              </Caption>
            </View>
            <Caption variant="caption2" color="#64748B">
              High consistency (≥80%)
            </Caption>
          </View>

          <View style={styles.itemsWrap}>
            {adopted.map((h) => (
              <View key={h.habitId} style={[styles.itemCard, { backgroundColor: "#141D30", borderColor: "#00F5A030" }]}>
                <View style={styles.itemTop}>
                  <Body variant="subhead" color="#F1F5F9" style={{ fontWeight: "600" }}>
                    {h.habitName}
                  </Body>
                  <View style={[styles.ratePill, { backgroundColor: "#00F5A020" }]}>
                    <Caption variant="caption2" color="#00F5A0" style={{ fontWeight: "700" }}>
                      ⭐ {h.consistencyRate}% • {h.currentStreak}d streak
                    </Caption>
                  </View>
                </View>

                <Caption variant="caption2" color="#64748B" style={styles.adviceText}>
                  ✓ Successfully formed into automatic daily muscle memory.
                </Caption>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ─── 3. In Progress (50% - 79%) ────────────────── */}
      {inProgress.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.statusBadge, { backgroundColor: "#8B5CF620", borderColor: "#8B5CF6" }]}>
              <PlatformSymbol
                ios="arrow.up.forward.circle.fill"
                material="trending-up"
                tintColor="#8B5CF6"
                size={12}
              />
              <Caption variant="caption2" color="#8B5CF6" style={{ fontWeight: "700" }}>
                In Progress ({inProgress.length})
              </Caption>
            </View>
            <Caption variant="caption2" color="#64748B">
              50% - 79%
            </Caption>
          </View>

          <View style={styles.itemsWrap}>
            {inProgress.map((h) => (
              <View key={h.habitId} style={[styles.itemCard, { backgroundColor: "#141D30", borderColor: "#8B5CF625" }]}>
                <View style={styles.itemTop}>
                  <Body variant="subhead" color="#F1F5F9" style={{ fontWeight: "600" }}>
                    {h.habitName}
                  </Body>
                  <View style={[styles.ratePill, { backgroundColor: "#8B5CF620" }]}>
                    <Caption variant="caption2" color="#8B5CF6" style={{ fontWeight: "700" }}>
                      {h.consistencyRate}% • {h.completedDays}/{h.totalDays}d
                    </Caption>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {adoptionList.length === 0 && (
        <Caption variant="caption2" color="#64748B" style={{ textAlign: "center", paddingVertical: spacing.md }}>
          No habits logged yet for this period. Mark your habits daily to reveal adoption insights.
        </Caption>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.md + 2,
    borderWidth: 1,
  },
  header: {
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 3,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs + 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  itemsWrap: {
    gap: 6,
  },
  itemCard: {
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    borderWidth: 1,
  },
  itemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ratePill: {
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  adviceText: {
    marginTop: 4,
    lineHeight: 16,
  },
});
