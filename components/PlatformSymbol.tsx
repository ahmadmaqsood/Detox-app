import {
  AntDesign,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
} from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { Platform } from "react-native";

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
  "self-improvement": "body",
  self_improvement: "body",
  "fitness-center": "barbell",
  fitness_center: "barbell",
  "directions-walk": "walk",
  directions_walk: "walk",
  "menu-book": "book-outline",
  menu_book: "book-outline",
  "phonelink-off": "phone-portrait-outline",
  phonelink_off: "phone-portrait-outline",
  schedule: "time-outline",
  "check-circle": "checkmark-circle",
  "account-question": "help-circle-outline",
  "star-four-points": "sparkles",
  warning: "warning",
  visibility_off: "eye-off-outline",
  bolt: "flash",
  forum: "chatbubbles-outline",
  psychology: "bulb",
  "arrow-upward": "arrow-up",
  "arrow-downward": "arrow-down",
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
  "self-improvement": "self-improvement",
  self_improvement: "self-improvement",
  "fitness-center": "fitness-center",
  fitness_center: "fitness-center",
  "directions-walk": "directions-walk",
  directions_walk: "directions-walk",
  "menu-book": "menu-book",
  menu_book: "menu-book",
  "phonelink-off": "phonelink-off",
  phonelink_off: "phonelink-off",
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

/** Names that must render via MaterialCommunityIcons to prevent Android missing-glyph question marks */
const LEGACY_MCI_FALLBACKS: Record<string, string> = {
  "directions-walk": "walk",
  directions_walk: "walk",
  "fitness-center": "dumbbell",
  fitness_center: "dumbbell",
  "self-improvement": "hands-pray",
  self_improvement: "hands-pray",
  "menu-book": "book-open-page-variant",
  menu_book: "book-open-page-variant",
  "wb-twilight": "weather-sunset-up",
  "water-drop": "water",
  "videocam-off": "video-off",
  "phonelink-off": "cellphone-off",
  phonelink_off: "cellphone-off",
  "lunch-dining": "silverware-fork-knife",
  "dinner-dining": "silverware-fork-knife",
  "nights-stay": "weather-night",
  "auto-stories": "book-open-page-variant",
  bedtime: "bed",
  hotel: "bed",
  groups: "account-group",
  mosque: "mosque",
  "hands-pray": "hands-pray",
  "star-crescent": "star-crescent",
  "silverware-fork-knife": "silverware-fork-knife",
  "food-apple": "food-apple",
  "cup-water": "cup-water",
  "cellphone-off": "cellphone-off",
  "cellphone-lock": "cellphone-lock",
  "table-tennis": "table-tennis",
  television: "television",
  "gamepad-variant": "gamepad-variant",
  "map-marker": "map-marker",
  "office-building": "office-building",
  "weather-sunset-up": "weather-sunset-up",
  "weather-sunny": "weather-sunny",
  "weather-partly-cloudy": "weather-partly-cloudy",
  "weather-sunset-down": "weather-sunset-down",
  "weather-night": "weather-night",
  "book-open-page-variant": "book-open-page-variant",
  "bookmark-check": "bookmark-check",
  "code-tags": "code-tags",
  "lightbulb-on": "lightbulb-on",
  "heart-pulse": "heart-pulse",
  "movie-open": "movie-open",
  "notebook-edit": "notebook-edit",
  meditation: "meditation",
};

export type PlatformSymbolProps = {
  /** Legacy SF name (unused for rendering; keeps call sites stable). */
  ios: string;
  /** MaterialCommunity-style alias, AntDesign glyph, or Material Icons glyph name. */
  material: string;
  size?: number;
  tintColor?: ColorValue;
  library?: "MaterialCommunityIcons" | "AntDesign" | "Ionicons" | "MaterialIcons";
};

/**
 * Universal platform-safe icon renderer.
 * Supports AntDesign, MaterialCommunityIcons, Ionicons, and MaterialIcons.
 */
export function PlatformSymbol({
  ios: _ios,
  material,
  size = 24,
  tintColor,
  library,
}: PlatformSymbolProps) {
  const color = fallbackColor(tintColor);
  const raw = material || "";

  // 1. Explicit vector library
  if (library === "AntDesign") {
    return <AntDesign name={raw as any} size={size} color={color} />;
  }
  if (library === "MaterialCommunityIcons") {
    return <MaterialCommunityIcons name={raw as any} size={size} color={color} />;
  }
  if (library === "Ionicons") {
    return <Ionicons name={raw as any} size={size} color={color} />;
  }
  if (library === "MaterialIcons") {
    return <MaterialIcons name={raw as any} size={size} color={color} />;
  }

  // 2. Automatically resolve known MaterialCommunityIcons (avoids question marks on Android)
  const mciFallback =
    LEGACY_MCI_FALLBACKS[raw] ?? LEGACY_MCI_FALLBACKS[raw.replace(/_/g, "-")];
  if (mciFallback) {
    return (
      <MaterialCommunityIcons name={mciFallback as any} size={size} color={color} />
    );
  }

  // 3. iOS Ionicons mapping
  if (Platform.OS === "ios") {
    const hyphenated = raw.replace(/_/g, "-");
    const underscored = raw.replace(/-/g, "_");
    const ion =
      TO_ION[raw] ??
      TO_ION[hyphenated] ??
      TO_ION[underscored] ??
      "ellipse-outline";
    return <Ionicons name={ion} size={size} color={color} />;
  }

  // 4. Android/Web MaterialIcons fallback
  const hyphenated = raw.replace(/_/g, "-");
  const mat = (TO_MATERIAL[raw] ?? TO_MATERIAL[hyphenated] ?? hyphenated) as MaterialIconName;
  return <MaterialIcons name={mat} size={size} color={color} />;
}
