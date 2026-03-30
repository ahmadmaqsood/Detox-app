export const colors = {
  dark: {
    background: "#0B0F14",
    card: "#121821",
    cardElevated: "#1A2230",
    border: "#1E2A3A",
    borderLight: "#253345",

    textPrimary: "#E5E7EB",
    textSecondary: "#9CA3AF",
    textMuted: "#6B7280",
    textInverse: "#0B0F14",

    accent: "#4ADE80",
    accentMuted: "rgba(74, 222, 128, 0.15)",
    warning: "#F59E0B",
    warningMuted: "rgba(245, 158, 11, 0.15)",
    danger: "#EF4444",
    dangerMuted: "rgba(239, 68, 68, 0.15)",

    tabBar: "#0D1117",
    tabBarBorder: "#151D28",
    tabIconDefault: "#6B7280",
    tabIconSelected: "#4ADE80",
  },
  light: {
    background: "#F4F6F8",
    card: "#FFFFFF",
    cardElevated: "#F0F3F7",
    border: "#D8DEE6",
    borderLight: "#E2E8F0",

    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#64748B",
    textInverse: "#FFFFFF",

    accent: "#16A34A",
    accentMuted: "rgba(22, 163, 74, 0.12)",
    warning: "#D97706",
    warningMuted: "rgba(217, 119, 6, 0.12)",
    danger: "#DC2626",
    dangerMuted: "rgba(220, 38, 38, 0.12)",

    tabBar: "#FFFFFF",
    tabBarBorder: "#E2E8F0",
    tabIconDefault: "#64748B",
    tabIconSelected: "#16A34A",
  },
} as const;

export type ThemeColors = (typeof colors)["dark"] | (typeof colors)["light"];
