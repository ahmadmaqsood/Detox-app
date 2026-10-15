import React from "react";
import { StyleSheet, View } from "react-native";
import { Body, Caption, Heading } from "@/components/Typography";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { radius, spacing } from "@/theme/spacing";
import type { ModeAndDetoxStats } from "@/lib/progressAnalyticsService";

interface ModeDetoxCardProps {
  stats: ModeAndDetoxStats;
}

export function ModeDetoxCard({ stats }: ModeDetoxCardProps) {
  return (
    <View style={[styles.card, { backgroundColor: "#0F1626", borderColor: "#1E2A3F" }]}>
      {/* ─── Header ────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <PlatformSymbol
            ios="arrow.triangle.swap"
            material="swap-horiz"
            tintColor="#8B5CF6"
            size={18}
          />
          <Body variant="headline" color="#F8FAFC" style={{ fontWeight: "700" }}>
            Environment & Mode Comparison
          </Body>
        </View>
        <Caption variant="caption2" color="#64748B">
          Discipline tracked separately for Home, Hostel, and Detox days
        </Caption>
      </View>

      {/* ─── 3 Column Grid (Home | Hostel | Detox) ─────── */}
      <View style={styles.grid}>
        {/* Home */}
        <View style={[styles.statTile, { backgroundColor: "#141D30", borderColor: "#F59E0B30" }]}>
          <View style={[styles.iconWrap, { backgroundColor: "#F59E0B18" }]}>
            <PlatformSymbol ios="house.fill" material="home" tintColor="#F59E0B" size={16} />
          </View>
          <Heading variant="title3" color="#F59E0B" style={{ marginTop: 6 }}>
            {stats.home.avgRate}%
          </Heading>
          <Caption variant="caption2" color="#E2E8F0" style={{ fontWeight: "700" }}>
            Home Mode
          </Caption>
          <Caption variant="caption2" color="#64748B">
            {stats.home.totalDays} active day(s)
          </Caption>
        </View>

        {/* Hostel */}
        <View style={[styles.statTile, { backgroundColor: "#141D30", borderColor: "#06B6D430" }]}>
          <View style={[styles.iconWrap, { backgroundColor: "#06B6D418" }]}>
            <PlatformSymbol ios="building.2.fill" material="apartment" tintColor="#06B6D4" size={16} />
          </View>
          <Heading variant="title3" color="#06B6D4" style={{ marginTop: 6 }}>
            {stats.hostel.avgRate}%
          </Heading>
          <Caption variant="caption2" color="#E2E8F0" style={{ fontWeight: "700" }}>
            Hostel Mode
          </Caption>
          <Caption variant="caption2" color="#64748B">
            {stats.hostel.totalDays} active day(s)
          </Caption>
        </View>

        {/* Detox */}
        <View style={[styles.statTile, { backgroundColor: "#141D30", borderColor: "#00F5A030" }]}>
          <View style={[styles.iconWrap, { backgroundColor: "#00F5A018" }]}>
            <PlatformSymbol ios="shield.lefthalf.filled" material="security" tintColor="#00F5A0" size={16} />
          </View>
          <Heading variant="title3" color="#00F5A0" style={{ marginTop: 6 }}>
            {stats.detox.avgRate}%
          </Heading>
          <Caption variant="caption2" color="#E2E8F0" style={{ fontWeight: "700" }}>
            Detox Protocol
          </Caption>
          <Caption variant="caption2" color="#64748B">
            {stats.detox.totalDays} active day(s)
          </Caption>
        </View>
      </View>

      {/* ─── Smart Verdict Note ────────────────────────── */}
      <View style={[styles.verdictBox, { backgroundColor: "#8B5CF612", borderColor: "#8B5CF630" }]}>
        <PlatformSymbol ios="sparkles" material="auto-awesome" tintColor="#8B5CF6" size={14} />
        <Caption variant="caption2" color="#C4B5FD" style={styles.verdictText}>
          {stats.verdict}
        </Caption>
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
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 3,
  },
  grid: {
    flexDirection: "row",
    gap: spacing.xs + 2,
    marginBottom: spacing.sm,
  },
  statTile: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.lg,
    alignItems: "center",
    borderWidth: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  verdictBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  verdictText: {
    flex: 1,
    lineHeight: 16,
  },
});
