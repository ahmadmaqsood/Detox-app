import type { HabitIcon } from "@/lib/types";
import { PlatformSymbol } from "@/components/PlatformSymbol";

function fallbackColor(color: string | undefined): string {
  return typeof color === "string" ? color : "#888888";
}

/**
 * Renders a habit’s icon in a platform-safe way.
 * Uses `PlatformSymbol` so legacy/seed names (e.g. `phonelink_off`) map correctly.
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
  return (
    <PlatformSymbol
      ios={icon.ios}
      material={icon.android}
      tintColor={c}
      size={size}
    />
  );
}
