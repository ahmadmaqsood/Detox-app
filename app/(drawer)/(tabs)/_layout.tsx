import { useAppTheme } from "@/theme";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabName =
  | "today"
  | "streaks"
  | "challenges"
  | "history"
  | "coach"
  | "profile";

const TAB_ICONS: Record<
  Exclude<TabName, "coach">,
  { active: keyof typeof MaterialCommunityIcons.glyphMap; inactive: keyof typeof MaterialCommunityIcons.glyphMap }
> = {
  today: { active: "calendar-today", inactive: "calendar-blank-outline" },
  streaks: { active: "chart-box", inactive: "chart-box-outline" },
  challenges: { active: "trophy", inactive: "trophy-outline" },
  history: { active: "history", inactive: "history" },
  profile: { active: "account-circle", inactive: "account-circle-outline" },
};

export default function TabLayout() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === "android" ? 12 : 8);
  const tabBarHeight = 52 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.tabIconSelected,
        tabBarInactiveTintColor: t.tabIconDefault,
        tabBarStyle: {
          backgroundColor: t.tabBar,
          borderTopColor: t.tabBarBorder,
          borderTopWidth: 0.5,
          height: tabBarHeight,
          paddingBottom: bottomInset,
          paddingTop: 8,
          paddingHorizontal: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        headerStyle: { backgroundColor: t.background },
        headerTintColor: t.textPrimary,
        headerShadowVisible: false,
        animation: "shift",
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? TAB_ICONS.today.active : TAB_ICONS.today.inactive}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="streaks"
        options={{
          title: "Insights",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? TAB_ICONS.streaks.active : TAB_ICONS.streaks.inactive}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="challenges"
        options={{
          title: "Challenges",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={
                focused ? TAB_ICONS.challenges.active : TAB_ICONS.challenges.inactive
              }
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? TAB_ICONS.history.active : TAB_ICONS.history.inactive}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="coach"
        options={{
          title: "Coach",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "chatbubbles" : "chatbubbles-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? TAB_ICONS.profile.active : TAB_ICONS.profile.inactive}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
