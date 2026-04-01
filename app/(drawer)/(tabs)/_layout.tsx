import { GlassTabBar } from "@/components/navigation/GlassTabBar";
import { Tabs } from "expo-router";

type TabName =
  | "today"
  | "streaks"
  | "challenges"
  | "history"
  | "coach"
  | "profile";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        animation: "shift",
      }}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="challenges"
        options={{
          title: "Challenges",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="streaks"
        options={{
          title: "Insights",
          headerShown: false,
          // Keep in router, hide from bottom bar (still accessible via drawer).
          href: null,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          headerShown: false,
          // Keep in router, hide from bottom bar (still accessible via drawer).
          href: null,
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: "Coach",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
