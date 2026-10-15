import React from "react";
import { StyleSheet, View } from "react-native";
import { Body, Caption } from "@/components/Typography";
import { radius, spacing } from "@/theme/spacing";

interface GlowBarCardProps {
  title: string;
  badgeLabel?: string;
  value: string;
  subtitle: string;
  color: string;
  secondaryColor?: string;
  bars: number[]; // normalized 0..100
  dense?: boolean;
}

export function GlowBarCard({
  title,
  badgeLabel = "Progress",
  value,
  subtitle,
  color,
  secondaryColor = "#8B5CF6",
  bars,
  dense = false,
}: GlowBarCardProps) {
  const maxVal = Math.max(...bars, 1);

  return (
    <View style={[styles.card, { backgroundColor: "#0F1626", borderColor: "#1E2A3F" }]}>
      {/* Top Header */}
      <View style={styles.topRow}>
        <Caption variant="caption2" color="#94A3B8" style={{ fontWeight: "700" }}>
          {badgeLabel}
        </Caption>
        <View style={[styles.pillDot, { backgroundColor: color }]} />
      </View>

      {/* Metric Main Stats */}
      <View style={styles.statWrap}>
        <Body variant="headline" color="#F8FAFC" style={{ fontWeight: "800", fontSize: 17 }}>
          {value}
        </Body>
        <Caption variant="caption2" color="#64748B" numberOfLines={1}>
          {title}
        </Caption>
      </View>

      {/* Vertical Glowing Bars */}
      <View style={styles.barContainer}>
        {bars.slice(-14).map((val, idx) => {
          const heightPct = Math.max(12, Math.min(100, (val / maxVal) * 100));
          const isHigh = val >= maxVal * 0.7;

          return (
            <View key={idx} style={styles.barCol}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${heightPct}%`,
                    backgroundColor: isHigh ? color : secondaryColor,
                    opacity: val > 0 ? (isHigh ? 1 : 0.8) : 0.2,
                    shadowColor: isHigh ? color : secondaryColor,
                    shadowOpacity: isHigh ? 0.6 : 0.3,
                    shadowRadius: 4,
                  },
                  dense && styles.denseBar,
                ]}
              />
            </View>
          );
        })}
      </View>

      {/* Subtitle Footer */}
      <Caption variant="caption2" color="#94A3B8" style={styles.footerNote} numberOfLines={1}>
        {subtitle}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.sm + 2,
    borderWidth: 1,
    flex: 1,
    minWidth: 145,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  pillDot: {
    width: 14,
    height: 4,
    borderRadius: 2,
  },
  statWrap: {
    marginBottom: 6,
  },
  barContainer: {
    height: 56,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginVertical: 4,
    paddingHorizontal: 2,
  },
  barCol: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bar: {
    width: 6,
    borderRadius: 3,
    minHeight: 6,
  },
  denseBar: {
    width: 3.5,
    borderRadius: 2,
  },
  footerNote: {
    fontSize: 9,
    marginTop: 2,
    fontWeight: "500",
  },
});
