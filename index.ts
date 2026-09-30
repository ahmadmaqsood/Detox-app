import { LogBox } from "react-native";

// Ignore Expo Go push notification deprecation error from expo-notifications
LogBox.ignoreLogs([
  "expo-notifications: Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go",
  "`expo-notifications` functionality is not fully supported in Expo Go",
]);

if (__DEV__) {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      first.includes(
        "expo-notifications: Android Push notifications (remote notifications)",
      )
    ) {
      return;
    }
    originalError(...args);
  };

  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      (first.includes(
        "expo-notifications: Android Push notifications (remote notifications)",
      ) ||
        first.includes(
          "`expo-notifications` functionality is not fully supported in Expo Go",
        ))
    ) {
      return;
    }
    originalWarn(...args);
  };
}

import "expo-router/entry";
