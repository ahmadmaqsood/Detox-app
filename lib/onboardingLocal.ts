import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const KEY = "@detox/onboarding_complete_v1";

function webGet(key: string): string | null {
  try {
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
      return globalThis.localStorage.getItem(key);
    }
  } catch {
    /* private mode / SSR */
  }
  return null;
}

function webSet(key: string, value: string): void {
  try {
    if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
      globalThis.localStorage.setItem(key, value);
    }
  } catch {
    /* ignore */
  }
}

export async function getLocalOnboardingComplete(): Promise<boolean> {
  if (Platform.OS === "web") {
    return webGet(KEY) === "1";
  }
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export async function setLocalOnboardingComplete(): Promise<void> {
  if (Platform.OS === "web") {
    webSet(KEY, "1");
    return;
  }
  try {
    await AsyncStorage.setItem(KEY, "1");
  } catch {
    /* ignore */
  }
}
