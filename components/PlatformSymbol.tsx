import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Platform } from "react-native";
import type { ColorValue } from "react-native";

export type MaterialIconName = ComponentProps<typeof MaterialIcons>["name"];
export type IonIconName = ComponentProps<typeof Ionicons>["name"];

function fallbackColor(tintColor: ColorValue | undefined): string {
  if (typeof tintColor === "string") return tintColor;
  return "#888888";
}

/** MaterialCommunity-style name (or Material Icons name) → Ionicons */
const TO_ION: Partial<Record<string, IonIconName>> = {
  "weather-sunny": "sunny",
  "view-dashboard": "grid-outline",
  "chart-box": "bar-chart-outline",
  run: "fitness",
  account: "person-circle-outline",
  "clock-outline": "time-outline",
  "shield-lock": "lock-closed",
  cog: "settings-outline",
  menu: "menu",
  "trophy-outline": "trophy-outline",
  trophy: "trophy",
  check: "checkmark",
  "plus-circle": "add-circle",
  "check-decagram": "ribbon",
  refresh: "refresh",
  "shield-check": "shield-checkmark",
  leaf: "leaf",
  "timer-sand": "hourglass-outline",
  alert: "warning",
  "phone-off": "phone-portrait-outline",
  "chevron-right": "chevron-forward",
  "hands-pray": "heart-outline",
  "check-circle": "checkmark-circle",
  "account-question": "help-circle-outline",
  "star-four-points": "sparkles",
  warning: "warning",
  visibility_off: "eye-off-outline",
  bolt: "flash",
  forum: "chatbubbles-outline",
  psychology: "bulb",
  "arrow-upward": "arrow-up",
  "message-text-outline": "chatbubble-outline",
  "head-cog": "chatbubbles-outline",
  whatshot: "flame",
  emoji_events: "trophy",
  track_changes: "git-compare-outline",
  date_range: "calendar-outline",
  bar_chart: "bar-chart-outline",
  show_chart: "trending-up",
  timeline: "pulse",
  insights: "analytics",
  compare_arrows: "swap-horizontal",
  swap_horiz: "swap-horizontal",
  home: "home",
  apartment: "business",
  info: "information-circle-outline",
  star: "star",
  health_and_safety: "shield-checkmark",
  label: "pricetag-outline",
  chevron_right: "chevron-forward",
  settings: "settings-outline",
  add_circle: "add-circle",
  local_fire_department: "flame",
  military_tech: "ribbon",
  trending_up: "trending-up",
  verified: "checkmark-done",
  shield: "shield-checkmark",
  touch_app: "hand-left",
  upload: "cloud-upload-outline",
  delete: "trash-outline",
  lock: "lock-closed",
  notifications: "notifications",
  trending_down: "trending-down",
  eco: "leaf",
  remove: "remove",
  add: "add",
};

/** MaterialCommunity-style name → MaterialIcons */
const TO_MATERIAL: Partial<Record<string, MaterialIconName>> = {
  "weather-sunny": "wb-sunny",
  "view-dashboard": "dashboard",
  "chart-box": "insert-chart",
  run: "directions-run",
  account: "person",
  "clock-outline": "schedule",
  "shield-lock": "security",
  cog: "settings",
  menu: "menu",
  "trophy-outline": "emoji-events",
  trophy: "emoji-events",
  check: "check",
  "plus-circle": "add-circle",
  "check-decagram": "verified",
  refresh: "refresh",
  "shield-check": "verified-user",
  leaf: "spa",
  "timer-sand": "hourglass-empty",
  alert: "warning",
  "phone-off": "phone-disabled",
  "chevron-right": "chevron-right",
  "hands-pray": "self-improvement",
  "check-circle": "check-circle",
  "account-question": "contact-support",
  "star-four-points": "auto-awesome",
  warning: "warning",
  visibility_off: "visibility-off",
  bolt: "bolt",
  forum: "forum",
  psychology: "psychology",
  "arrow-upward": "arrow-upward",
  "message-text-outline": "chat",
  "head-cog": "chat",
  whatshot: "local-fire-department",
  emoji_events: "emoji-events",
  track_changes: "track-changes",
  date_range: "date-range",
  bar_chart: "bar-chart",
  show_chart: "show-chart",
  timeline: "timeline",
  insights: "lightbulb",
  compare_arrows: "compare-arrows",
  swap_horiz: "swap-horiz",
  home: "home",
  apartment: "apartment",
  info: "info",
  star: "star",
  health_and_safety: "health-and-safety",
  label: "label",
  chevron_right: "chevron-right",
  settings: "settings",
  add_circle: "add-circle",
  local_fire_department: "local-fire-department",
  military_tech: "military-tech",
  trending_up: "trending-up",
  verified: "verified",
  shield: "security",
  touch_app: "touch-app",
  upload: "upload",
  delete: "delete",
  lock: "lock",
  notifications: "notifications",
  trending_down: "trending-down",
  eco: "eco",
  remove: "remove",
  add: "add",
};

export type PlatformSymbolProps = {
  /** Legacy SF name (unused for rendering; keeps call sites stable). */
  ios: string;
  /** MaterialCommunity-style alias or Material Icons glyph name. */
  material: string;
  size?: number;
  tintColor?: ColorValue;
};

/**
 * iOS: Ionicons · Android/web: MaterialIcons (no SF Symbol / expo-symbols).
 */
export function PlatformSymbol({
  ios: _ios,
  material,
  size = 24,
  tintColor,
}: PlatformSymbolProps) {
  const color = fallbackColor(tintColor);

  if (Platform.OS === "ios") {
    const ion = TO_ION[material] ?? "ellipse-outline";
    return <Ionicons name={ion} size={size} color={color} />;
  }

  const mat = (TO_MATERIAL[material] ?? material) as MaterialIconName;
  return <MaterialIcons name={mat} size={size} color={color} />;
}
