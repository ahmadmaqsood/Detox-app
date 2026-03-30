import { useAppearance } from "@/store/AppearanceContext";
import { colors, type ThemeColors } from "./colors";

export function useAppTheme(): ThemeColors {
  const { scheme } = useAppearance();
  return scheme === "light" ? colors.light : colors.dark;
}
