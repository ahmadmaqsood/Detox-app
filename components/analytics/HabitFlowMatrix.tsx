import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Body, Caption } from "@/components/Typography";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import type { HabitFlowMatrixData } from "@/lib/progressAnalyticsService";

interface HabitFlowMatrixProps {
  matrixData: HabitFlowMatrixData;
  timeRangeLabel: string;
}

export function HabitFlowMatrix({ matrixData, timeRangeLabel }: HabitFlowMatrixProps) {
  const t = useAppTheme();

  // Colors matching the screenshot:
  // Top rows use emerald green (#00F5A0 / #10B981)
  // Middle rows use electric cyan/purple (#06B6D4 / #8B5CF6)
  // Bottom rows use violet (#A855F7)
  const rowPalette = useMemo(
    () => ["#00F5A0", "#10B981", "#06B6D4", "#8B5CF6", "#A855F7", "#EC4899", "#F59E0B"],
    [],
  );

  return (
    <View style={[styles.card, { backgroundColor: "#0F1626", borderColor: "#1E2A3F" }]}>
      {/* ─── Header ────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View>
          <Body variant="headline" color="#F8FAFC" style={{ fontWeight: "700" }}>
            Habit Completed
          </Body>
          <Caption variant="caption2" color="#64748B">
            Routine consistency • {timeRangeLabel}
          </Caption>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Caption variant="caption2" color="#00F5A0" style={{ fontWeight: "700" }}>
              Live Data
            </Caption>
          </View>
        </View>
      </View>

      {/* ─── Scrollable Matrix Grid ────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.matrixScroll}
      >
        <View>
          {/* Month & Date Header Row */}
          <View style={styles.columnHeaderRow}>
            <View style={styles.rowLabelSpacer} />
            {matrixData.columns.map((col, idx) => (
              <View key={col.date} style={styles.columnHeaderCell}>
                {col.monthLabel ? (
                  <Caption variant="caption2" color="#94A3B8" style={styles.monthLabel}>
                    {col.monthLabel}
                  </Caption>
                ) : (
                  <Caption
                    variant="caption2"
                    color="#475569"
                    style={[styles.dayNumLabel, idx % 5 === 0 && { color: "#64748B" }]}
                  >
                    {idx % 5 === 0 ? col.label : ""}
                  </Caption>
                )}
              </View>
            ))}
          </View>

          {/* Matrix Rows (Habits / Days) */}
          {matrixData.rows.map((row, rowIdx) => {
            const activeColor = rowPalette[rowIdx % rowPalette.length];

            return (
              <View key={row.id} style={styles.dataRow}>
                {/* Row Label (Habit Name) */}
                <View style={styles.rowLabelWrap}>
                  <View style={[styles.rowColorDot, { backgroundColor: activeColor }]} />
                  <Caption
                    variant="caption2"
                    color="#E2E8F0"
                    numberOfLines={1}
                    style={styles.rowLabelText}
                  >
                    {row.title}
                  </Caption>
                </View>

                {/* Cells across dates */}
                {row.cells.map((cell) => {
                  const isDone = cell.isCompleted;

                  return (
                    <View
                      key={cell.date}
                      style={[
                        styles.matrixCell,
                        isDone
                          ? {
                              backgroundColor: activeColor,
                              shadowColor: activeColor,
                              shadowOpacity: 0.6,
                              shadowRadius: 5,
                              shadowOffset: { width: 0, height: 0 },
                              elevation: 4,
                            }
                          : {
                              backgroundColor: "#131C2E",
                              borderColor: "#1E293B",
                            },
                      ]}
                    />
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* ─── Legend Footer ─────────────────────────────── */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSquare, { backgroundColor: "#00F5A0" }]} />
          <Caption variant="caption2" color="#94A3B8">
            Completed (100%)
          </Caption>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.legendSquare, { backgroundColor: "#8B5CF6" }]} />
          <Caption variant="caption2" color="#94A3B8">
            Solidified Habit
          </Caption>
        </View>

        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendSquare,
              { backgroundColor: "#131C2E", borderWidth: 1, borderColor: "#1E293B" },
            ]}
          />
          <Caption variant="caption2" color="#64748B">
            Rest / Incomplete
          </Caption>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.md + 2,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: "#00F5A040",
    backgroundColor: "#00F5A012",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#00F5A0",
  },
  matrixScroll: {
    paddingVertical: spacing.xs,
    paddingRight: spacing.lg,
  },
  columnHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: spacing.xs + 2,
  },
  rowLabelSpacer: {
    width: 104,
  },
  columnHeaderCell: {
    width: 18,
    marginRight: 6,
    alignItems: "center",
    height: 18,
    justifyContent: "flex-end",
  },
  monthLabel: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  dayNumLabel: {
    fontSize: 8,
    fontWeight: "600",
  },
  dataRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 7,
  },
  rowLabelWrap: {
    width: 104,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: spacing.xs,
  },
  rowColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowLabelText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "600",
  },
  matrixCell: {
    width: 18,
    height: 18,
    borderRadius: 5,
    marginRight: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#1E2A3F",
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendSquare: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
});
