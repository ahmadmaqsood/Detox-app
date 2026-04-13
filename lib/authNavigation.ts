import type { User } from "firebase/auth";
import type { Href } from "expo-router";

export type AuthNavigationResult =
  | { action: "allow" }
  | { action: "replace"; href: Href };

const TODAY: Href = "/(drawer)/(tabs)/today";

/**
 * Single place for “who may see what”.
 * - Onboarding is always allowed (and is shown on every app open).
 * - Not logged in: only `/onboarding`, `/login`, `/signup` are allowed.
 * - Logged in: full app; `/` goes to Today.
 */
export function resolveAuthNavigation(args: {
  pathname: string;
  segments: string[];
  user: User | null;
  onboardingDone: boolean;
}): AuthNavigationResult {
  const { pathname, segments, user, onboardingDone } = args;
  const path = pathname || "/";
  const isRoot = path === "/" || path === "/index";

  const onOnboarding =
    path.startsWith("/onboarding") || segments.includes("onboarding");

  const onAuth =
    path === "/login" ||
    path === "/signup" ||
    segments[0] === "(auth)" ||
    path.endsWith("/login") ||
    path.endsWith("/signup");

  // Onboarding is always accessible.
  if (onOnboarding) return { action: "allow" };

  // Guest: allow login/signup first (finish onboarding → login must work even if
  // onboarding was never persisted to Firestore / local).
  if (!user) {
    if (onAuth) return { action: "allow" };
    if (!onboardingDone) return { action: "replace", href: "/onboarding" };
    return { action: "replace", href: "/login" };
  }

  // ── Signed in
  if (onAuth) return { action: "replace", href: TODAY };
  if (isRoot) {
    return { action: "replace", href: TODAY };
  }

  return { action: "allow" };
}
