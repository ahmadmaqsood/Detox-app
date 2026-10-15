import React from "react";
import { StyleSheet, View } from "react-native";
import { Body, Caption } from "@/components/Typography";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { radius, spacing } from "@/theme/spacing";
import type { DayOfWeekStat } from "@/lib/progressAnalyticsService";

interface DayRankingCardProps {
  dayStats: DayOfWeekStat[];
}

export function DayRankingCard({ dayStats }: DayRankingCardProps) {
  // Sort starting Monday (1) to Sunday (0)
  const mondayFirst = [...dayStats].sort((a, b) => {
    const aIdx = a.dayIndex === 0 ? 7 : a.dayIndex;
    const bIdx = b.dayIndex === 0 ? 7 : b.dayIndex;
    return aIdx - bIdx;
  });

  const strongest = dayStats.find((d) => d.isStrongest);
  const weakest = dayStats.find((d) => d.isWeakest);

  return (
    <View style={[styles.card, { backgroundColor: "#0F1626", borderColor: "#1E2A3F" }]}>
      {/* ─── Header ────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <PlatformSymbol
            ios="calendar.badge.clock"
            material="today"
            tintColor="#06B6D4"
            size={18}
          />
          <Body variant="headline" color="#F8FAFC" style={{ fontWeight: "700" }}>
            Weekly Performance Pattern
          </Body>
        </View>
        <Caption variant="caption2" color="#64748B">
          Identifies your highest discipline days vs days at risk
        </Caption>
      </View>

      {/* ─── Highlights Row (Strongest vs Weakest) ─────── */}
      <View style={styles.highlightRow}>
        {strongest && (
          <View style={[styles.highlightBox, { backgroundColor: "#00F5A015", borderColor: "#00F5A035" }]}>
            <View style={styles.highlightHeader}>
              <PlatformSymbol
                ios="trophy.fill"
                material="emoji-events"
                tintColor="#00F5A0"
                size={14}
              />
              <Caption variant="caption2" color="#00F5A0" style={{ fontWeight: "700" }}>
                Strongest Day
              </Caption>
            </View>
            <Body variant="subhead" color="#F8FAFC" style={{ fontWeight: "700", marginTop: 2 }}>
              {strongest.dayName} • {strongest.avgCompletionRate}%
            </Body>
          </View>
        )}

        {weakest && (
          <View style={[styles.highlightBox, { backgroundColor: "#F59E0B15", borderColor: "#F59E0B35" }]}>
            <View style={styles.highlightHeader}>
              <PlatformSymbol
                ios="shield.slash.fill"
                material="gpp-bad"
                tintColor="#F59E0B"
                size={14}
              />
              <Caption variant="caption2" color="#F59E0B" style={{ fontWeight: "700" }}>
                Weakest Day
              </Caption>
            </View>
            <Body variant="subhead" color="#F8FAFC" style={{ fontWeight: "700", marginTop: 2 }}>
              {weakest.dayName} • {weakest.avgCompletionRate}%
            </Body>
          </View>
        )}
      </View>

      {/* ─── Mon - Sun Bar Breakdown ────────────────────── */}
      <View style={styles.daysList}>
        {mondayFirst.map((d) => {
          const isBest = d.isStrongest;
          const isWorst = d.isWeakest;
          const barColor = isBest ? "#00F5A0" : isWorst ? "#F59E0B" : "#8B5CF6";

          return (
            <View key={d.dayIndex} style={styles.dayRow}>
              <View style={styles.dayLabelWrap}>
                <Caption
                  variant="caption2"
                  color={isBest ? "#00F5A0" : isWorst ? "#F59E0B" : "#94A3B8"}
                  style={{ fontWeight: "700" }}
                >
                  {d.dayShort}
                </Caption>
              </View>

              {/* Progress Track */}
              <View style={styles.track}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.max(d.avgCompletionRate, 4)}%`,
                      backgroundColor: barColor,
                      shadowColor: barColor,
                      shadowOpacity: isBest ? 0.6 : 0,
                      shadowRadius: 5,
                    },
                  ]}
                />
              </View>

              {/* Rate percentage */}
              <View style={styles.rateWrap}>
                <Caption
                  variant="caption2"
                  color={isBest ? "#00F5A0" : isWorst ? "#F59E0B" : "#E2E8F0"}
                  style={{ fontWeight: "600" }}
                >
                  {d.avgCompletionRate}%
                </Caption>
              </View>
            </View>
          );
        })}
      </View>
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
    marginBottom: spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 3,
  },
  highlightRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  highlightBox: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  highlightHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  daysList: {
    marginTop: spacing.sm,
    gap: 8,
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  dayLabelWrap: {
    width: 32,
  },
  track: {
    flex: 1,
    height: 10,
    backgroundColor: "#141D30",
    borderRadius: 5,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 5,
  },
  rateWrap: {
    width: 38,
    alignItems: "flex-end",
  },
});
