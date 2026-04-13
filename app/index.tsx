import { useRootNavigationState, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { useAuth } from "@/store/AuthContext";

/**
 * Entry `/` — send cold start to onboarding once (does not re-run on every navigation).
 */
export default function Index() {
  const router = useRouter();
  const navState = useRootNavigationState();
  const { ready } = useAuth();
  const sentToOnboarding = useRef(false);

  useEffect(() => {
    if (!navState?.key || !ready || sentToOnboarding.current) return;

    sentToOnboarding.current = true;
    router.replace("/onboarding");
  }, [navState?.key, router, ready]);

  return null;
}
