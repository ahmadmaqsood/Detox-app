import { Caption } from "@/components/Typography";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface AdaptiveDateCarouselProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  todayDate?: string;
}

export function AdaptiveDateCarousel({
  selectedDate,
  onSelectDate,
  todayDate = new Date().toISOString().slice(0, 10),
}: AdaptiveDateCarouselProps) {
  const t = useAppTheme();

  // Selected date object
  const currentObj = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDate]);

  const monthLabel = `${MONTH_NAMES[currentObj.getMonth()]} ${currentObj.getFullYear()}`;

  // Generate 5 days centered around selected date (like in Dribbble screenshot: Sun 2 .. Thu 6)
  const days = useMemo(() => {
    const list: { iso: string; dayName: string; dayNum: number; isToday: boolean }[] = [];
    for (let offset = -2; offset <= 2; offset++) {
      const dt = new Date(currentObj);
      dt.setDate(dt.getDate() + offset);
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      list.push({
        iso,
        dayName: DAY_NAMES[dt.getDay()],
        dayNum: dt.getDate(),
        isToday: iso === todayDate,
      });
    }
    return list;
  }, [currentObj, todayDate]);

  const shiftDate = (deltaDays: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const dt = new Date(currentObj);
    dt.setDate(dt.getDate() + deltaDays);
    const nextIso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    onSelectDate(nextIso);
  };

  // Dribbble signature neon lime accent
  const neonLime = "#D4FE33";

  return (
    <View style={styles.container}>
      {/* ─── Month Navigation Header ─────────────────────── */}
      <View style={styles.monthHeader}>
        <Text style={[styles.monthText, { color: t.textPrimary }]}>{monthLabel}</Text>
        <View style={styles.navArrows}>
          <Pressable
            onPress={() => shiftDate(-1)}
            hitSlop={8}
            style={({ pressed }) => [styles.arrowBtn, { borderColor: t.borderLight }, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="chevron-back" size={16} color={t.textPrimary} />
          </Pressable>
          <Pressable
            onPress={() => shiftDate(1)}
            hitSlop={8}
            style={({ pressed }) => [styles.arrowBtn, { borderColor: t.borderLight }, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="chevron-forward" size={16} color={t.textPrimary} />
          </Pressable>
        </View>
      </View>

      {/* ─── 5-Day Pill Row ─────────────────────────────── */}
      <View style={styles.pillsRow}>
        {days.map((item) => {
          const isSelected = item.iso === selectedDate;
          return (
            <Pressable
              key={item.iso}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelectDate(item.iso);
              }}
              style={({ pressed }) => [
                styles.dayPill,
                {
                  backgroundColor: isSelected ? neonLime : t.card,
                  borderColor: isSelected ? neonLime : t.borderLight,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={[
                  styles.dayName,
                  { color: isSelected ? "#0F140A" : t.textMuted },
                  isSelected && { fontWeight: "700" },
                ]}
              >
                {item.dayName}
              </Text>
              <Text
                style={[
                  styles.dayNum,
                  { color: isSelected ? "#0F140A" : t.textPrimary },
                ]}
              >
                {item.dayNum}
              </Text>
              {item.isToday && (
                <View
                  style={[
                    styles.todayDot,
                    { backgroundColor: isSelected ? "#0F140A" : neonLime },
                  ]}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingHorizontal: 2,
  },
  monthText: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  navArrows: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  arrowBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pillsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  dayPill: {
    flex: 1,
    height: 68,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  dayName: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
    marginBottom: 2,
  },
  dayNum: {
    fontSize: 18,
    fontWeight: "800",
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
  },
});
