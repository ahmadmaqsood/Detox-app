import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, View, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/theme";
import { spacing, radius } from "@/theme/spacing";

type TabKey = "today" | "challenges" | "coach" | "profile";

const TAB_ORDER: TabKey[] = ["today", "challenges", "coach", "profile"];

const TAB_META: Record<
  TabKey,
  { label: string; icon: { active: string; inactive: string; lib: "mci" | "ion" } }
> = {
  today: {
    label: "Home",
    icon: { active: "calendar-today", inactive: "calendar-blank-outline", lib: "mci" },
  },
  challenges: {
    label: "Challenges",
    icon: { active: "trophy", inactive: "trophy-outline", lib: "mci" },
  },
  coach: {
    label: "Coach",
    icon: { active: "chatbubbles", inactive: "chatbubbles-outline", lib: "ion" },
  },
  profile: {
    label: "Profile",
    icon: { active: "person-circle", inactive: "person-circle-outline", lib: "ion" },
  },
};

function isTabKey(name: string): name is TabKey {
  return (TAB_ORDER as string[]).includes(name);
}

export function GlassTabBar(props: BottomTabBarProps) {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const bottomPad = Math.max(insets.bottom, 10);
  // Lift the whole bar slightly above the bottom edge.
  const floatAbove = 10;

  const onPlus = () => {
    router.push("/addHabit");
  };

  const stateByName = new Map(props.state.routes.map((r) => [r.name, r]));

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View
        style={[
          styles.bar,
          {
            backgroundColor: "rgba(10, 15, 25, 0.94)",
            borderColor: "rgba(255, 255, 255, 0.14)",
            shadowColor: "#000",
            paddingBottom: bottomPad,
          },
        ]}
      >
        {TAB_ORDER.slice(0, 2).map((key) => (
          <TabItem key={key} tabKey={key} {...props} />
        ))}

        <View style={styles.plusSlot}>
          <Pressable
            onPress={onPlus}
            hitSlop={12}
            style={({ pressed }) => [
              styles.plusBtn,
              {
                backgroundColor: t.accent,
                opacity: pressed ? 0.85 : 1,
                shadowColor: t.accent,
              },
            ]}
          >
            <Ionicons name="add" size={30} color={t.textInverse} />
          </Pressable>
        </View>

        {TAB_ORDER.slice(2).map((key) => (
          <TabItem key={key} tabKey={key} {...props} />
        ))}
      </View>
    </View>
  );
}

function TabItem({
  tabKey,
  state,
  descriptors,
  navigation,
}: BottomTabBarProps & { tabKey: TabKey }) {
  const t = useAppTheme();

  const route = state.routes.find((r) => r.name === tabKey);
  if (!route || !isTabKey(route.name)) return null;

  const index = state.routes.findIndex((r) => r.key === route.key);
  const focused = state.index === index;

  const { icon } = TAB_META[tabKey];
  const color = focused ? t.tabIconSelected : t.tabIconDefault;
  const glyph = focused ? icon.active : icon.inactive;

  const onPress = () => {
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const onLongPress = () => {
    navigation.emit({ type: "tabLongPress", target: route.key });
  };

  const accessibilityLabel =
    descriptors[route.key]?.options?.tabBarAccessibilityLabel ?? TAB_META[tabKey].label;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.item,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.iconWrap, focused && { backgroundColor: t.accent + "18" }]}>
        {icon.lib === "mci" ? (
          <MaterialCommunityIcons
            name={glyph as any}
            size={24}
            color={color}
          />
        ) : (
          <Ionicons name={glyph as any} size={24} color={color} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: (Platform.OS === "ios" ? spacing.xs : spacing.sm) + 10,
  },
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderRadius: radius.full,
    borderWidth: 1,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.22,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: {
        elevation: 14,
      },
      default: {
        shadowOpacity: 0.22,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
    }),
  },
  item: {
    width: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  plusSlot: {
    width: 70,
    alignItems: "center",
  },
  plusBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    ...Platform.select({
      ios: {
        shadowOpacity: 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
      android: {
        elevation: 18,
      },
      default: {
        shadowOpacity: 0.35,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
      },
    }),
  },
});

