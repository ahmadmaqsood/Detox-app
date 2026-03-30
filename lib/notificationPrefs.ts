import Storage from "expo-sqlite/kv-store";

const KEY = "@detox_smart_notifications_enabled";

export async function getNotificationsEnabled(): Promise<boolean> {
  const v = await Storage.getItem(KEY);
  if (v === null) return true;
  return v === "1";
}

export async function setNotificationsEnabled(on: boolean): Promise<void> {
  await Storage.setItem(KEY, on ? "1" : "0");
}
