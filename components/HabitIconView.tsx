import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Platform } from "react-native";

import type { HabitIcon } from "@/lib/types";

/** Seed `icon.android` names are Google Material Icons font names. */
const HABIT_MATERIAL_TO_ION: Partial<
  Record<string, ComponentProps<typeof Ionicons>["name"]>
> = {
  shield: "shield-checkmark",
  phonelink_off: "phone-portrait-outline",
  block: "close-circle",
  videocam_off: "videocam-off-outline",
  desktop_access_disabled: "desktop-outline",
  self_improvement: "body-outline",
  menu_book: "book",
  wb_twilight: "partly-sunny-outline",
  nightlight: "moon",
  hotel: "bed",
  fitness_center: "barbell",
  psychology: "bulb",
  schedule: "calendar-outline",
  directions_walk: "walk",
};

function fallbackColor(color: string | undefined): string {
  return typeof color === "string" ? color : "#888888";
}

/**
 * Renders a habit’s icon using Material Icons on Android/web and Ionicons on iOS.
 */
export function HabitIconView({
  icon,
  color,
  size = 22,
}: {
  icon: HabitIcon;
  color: string;
  size?: number;
}) {
  const c = fallbackColor(color);
  const mat = icon.android;

  if (Platform.OS === "ios") {
    const ion = HABIT_MATERIAL_TO_ION[mat] ?? "ellipse-outline";
    return <Ionicons name={ion} size={size} color={c} />;
  }

  return (
    <MaterialIcons
      name={mat as ComponentProps<typeof MaterialIcons>["name"]}
      size={size}
      color={c}
    />
  );
}
