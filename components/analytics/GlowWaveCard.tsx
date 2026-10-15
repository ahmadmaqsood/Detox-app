import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { Body, Caption } from "@/components/Typography";
import { radius, spacing } from "@/theme/spacing";

interface GlowWaveCardProps {
  title: string;
  badgeLabel?: string;
  value: string;
  subtitle: string;
  color: string;
  secondaryColor?: string;
  dataPoints: number[];
  width?: number;
  height?: number;
}

/**
 * Generates smooth SVG cubic Bezier path coordinates from numeric points.
 */
function buildSmoothPath(
  points: number[],
  width: number,
  height: number,
): { linePath: string; areaPath: string } {
  if (!points || points.length === 0) {
    return { linePath: `M 0 ${height / 2} L ${width} ${height / 2}`, areaPath: "" };
  }

  const minVal = Math.min(...points, 0);
  const maxVal = Math.max(...points, 100);
  const range = maxVal - minVal || 1;

  const coords = points.map((val, idx) => {
    const x = (idx / Math.max(points.length - 1, 1)) * width;
    const norm = (val - minVal) / range;
    const y = height - norm * (height - 14) - 7;
    return { x, y };
  });

  let linePath = `M ${coords[0].x} ${coords[0].y}`;

  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? i : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2 < coords.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  const last = coords[coords.length - 1];
  const first = coords[0];
  const areaPath = `${linePath} L ${last.x} ${height} L ${first.x} ${height} Z`;

  return { linePath, areaPath };
}

export function GlowWaveCard({
  title,
  badgeLabel = "Progress",
  value,
  subtitle,
  color,
  secondaryColor,
  dataPoints,
  width = 150,
  height = 56,
}: GlowWaveCardProps) {
  const gradientId = useMemo(
    () => `glowWaveGrad_${Math.random().toString(36).slice(2, 8)}`,
    [],
  );

  const sec = secondaryColor || color;
  const { linePath, areaPath } = useMemo(
    () => buildSmoothPath(dataPoints, width, height),
    [dataPoints, width, height],
  );

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

      {/* Glowing SVG Wave Chart */}
      <View style={styles.chartContainer}>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={color} stopOpacity="0.45" />
              <Stop offset="80%" stopColor={sec} stopOpacity="0.08" />
              <Stop offset="100%" stopColor={sec} stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id={`${gradientId}_stroke`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={color} />
              <Stop offset="100%" stopColor={sec} />
            </LinearGradient>
          </Defs>

          {/* Area Fill */}
          <Path d={areaPath} fill={`url(#${gradientId})`} />

          {/* Stroke Line */}
          <Path
            d={linePath}
            fill="none"
            stroke={`url(#${gradientId}_stroke)`}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </Svg>
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
  chartContainer: {
    height: 56,
    width: "100%",
    marginVertical: 4,
    overflow: "hidden",
  },
  footerNote: {
    fontSize: 9,
    marginTop: 2,
    fontWeight: "500",
  },
});
