import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import type { ScrollView } from "react-native";

/**
 * When a bottom tab gains focus, scroll the main vertical ScrollView to the top.
 */
export function useScrollToTopOnTabFocus() {
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      const raf = requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
      });
      return () => cancelAnimationFrame(raf);
    }, []),
  );

  return scrollRef;
}
