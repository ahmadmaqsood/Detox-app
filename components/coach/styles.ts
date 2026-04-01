import { radius, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { Platform, StyleSheet } from "react-native";

export const coachStyles = StyleSheet.create({
  screenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },

  chatHeader: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
    gap: spacing.sm,
  },
  coachAvatarOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  coachAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headerDivider: {
    width: 40,
    height: 2,
    borderRadius: 1,
    marginTop: spacing.sm,
  },

  quickGrid: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  quickLabel: {
    textAlign: "center",
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  quickRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  quickCard: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  quickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  pillScroll: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pillRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },

  bubbleRow: {
    flexDirection: "row",
    marginBottom: spacing.md,
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  bubbleRowUser: {
    justifyContent: "flex-end",
  },
  bubbleRowCoach: {
    justifyContent: "flex-start",
  },
  bubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xxs,
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  bubbleUser: {
    borderRadius: radius.xl,
    borderBottomRightRadius: 6,
  },
  bubbleCoach: {
    borderRadius: radius.xl,
    borderBottomLeftRadius: 6,
  },
  bubbleTime: {
    alignSelf: "flex-end",
  },

  typingDots: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  inputBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === "ios" ? spacing.md : spacing.sm,
    maxHeight: 120,
    ...typography.callout,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
