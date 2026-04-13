import {
  DrawerContentScrollView,
  type DrawerContentComponentProps,
} from "@react-navigation/drawer";
import * as Haptics from "expo-haptics";
import { usePathname, useRouter } from "expo-router";
import { Drawer } from "expo-router/drawer";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  FadeInLeft,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import { useDetox } from "@/store/DetoxContext";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";

// ─── Drawer items ─────────────────────────────────────────────

interface DrawerItem {
  label: string;
  route: string;
  icon: { ios: string; material: string };
  badge?: () => string | null;
}

const DRAWER_ITEMS: DrawerItem[] = [
  {
    label: "Today",
    route: "/(drawer)/(tabs)/today",
    icon: { ios: "sun.max.fill", material: "weather-sunny" },
  },
  {
    label: "Life Hub",
    route: "/(drawer)/lifeDashboard",
    icon: { ios: "circle.grid.cross.fill", material: "view-dashboard" },
  },
  {
    label: "Insights",
    route: "/(drawer)/(tabs)/streaks",
    icon: { ios: "chart.bar.fill", material: "chart-box" },
  },
  {
    label: "AI Coach",
    route: "/(drawer)/(tabs)/coach",
    icon: { ios: "bubble.left.and.bubble.right.fill", material: "forum" },
  },
  {
    label: "Challenges",
    route: "/(drawer)/(tabs)/challenges",
    icon: { ios: "trophy.fill", material: "trophy" },
  },
  {
    label: "Achievements",
    route: "/(drawer)/achievements",
    icon: { ios: "star.circle.fill", material: "trophy-award" },
  },
  {
    label: "Spiritual",
    route: "/(drawer)/spiritualChallenges",
    icon: { ios: "hands.sparkles.fill", material: "hands-pray" },
  },
  {
    label: "Body",
    route: "/(drawer)/body",
    icon: { ios: "figure.run", material: "run" },
  },
  {
    label: "Diet",
    route: "/(drawer)/diet",
    icon: { ios: "leaf.fill", material: "leaf" },
  },
  {
    label: "Profile",
    route: "/(drawer)/(tabs)/profile",
    icon: { ios: "person.fill", material: "account" },
  },
  {
    label: "Time blocks",
    route: "/(drawer)/timeBlocks",
    icon: { ios: "clock.fill", material: "clock-outline" },
  },
  {
    label: "Focus mode",
    route: "/(drawer)/focusMode",
    icon: { ios: "lock.shield.fill", material: "shield-lock" },
  },
  {
    label: "Settings",
    route: "/(drawer)/settings",
    icon: { ios: "gearshape.fill", material: "cog" },
  },
];

// ─── Custom drawer content ────────────────────────────────────

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const t = useAppTheme();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { detox, setDetox } = useDetox();

  const handlePress = (item: DrawerItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (item.label === "Detox Mode") {
      setDetox(!detox);
      props.navigation.closeDrawer();
      return;
    }

    router.navigate(item.route as any);
    props.navigation.closeDrawer();
  };

  const isActive = (item: DrawerItem) => {
    if (item.label === "Detox Mode") return detox;
    if (item.label === "Today" && pathname === "/today") return true;
    if (item.label === "Life Hub" && pathname === "/lifeDashboard") return true;
    if (item.label === "Insights" && pathname === "/streaks") return true;
    if (item.label === "Challenges" && pathname === "/challenges") return true;
    if (item.label === "Spiritual" && pathname === "/spiritualChallenges")
      return true;
    if (item.label === "Profile" && pathname === "/profile") return true;
    if (
      item.label === "AI Coach" &&
      (pathname === "/coach" || pathname.endsWith("/coach"))
    )
      return true;
    if (item.label === "Settings" && pathname === "/settings") return true;
    if (item.label === "Time blocks" && pathname === "/timeBlocks") return true;
    if (item.label === "Focus mode" && pathname === "/focusMode") return true;
    if (item.label === "Body" && pathname === "/body") return true;
    if (item.label === "Diet" && pathname === "/diet") return true;
    return false;
  };

  return (
    <DrawerContentScrollView
      {...props}
      style={{ backgroundColor: t.background }}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingTop: insets.top + spacing.lg },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeInLeft.duration(300)} style={styles.header}>
        <View style={[styles.logoWrap, { backgroundColor: t.accent + "18" }]}>
          <PlatformSymbol
            ios="shield.checkmark.fill"
            material="shield-check"
            tintColor={t.accent}
            size={24}
          />
        </View>
        <View>
          <Heading variant="title3">Detox</Heading>
          <Caption variant="caption1" color={t.textMuted}>
            Take control
          </Caption>
        </View>
      </Animated.View>

      <View style={[styles.divider, { backgroundColor: t.border }]} />

      {/* Items */}
      {DRAWER_ITEMS.map((item, i) => (
        <DrawerItemRow
          key={item.label}
          item={item}
          index={i}
          active={isActive(item)}
          onPress={() => handlePress(item)}
          t={t}
          isDetoxToggle={item.label === "Detox Mode"}
          detoxOn={detox}
        />
      ))}

      <View style={{ flex: 1 }} />

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: t.border }]}>
        <Caption variant="caption2" color={t.textMuted}>
          Detox App v1.0
        </Caption>
      </View>
    </DrawerContentScrollView>
  );
}

// ─── Single drawer item ───────────────────────────────────────

function DrawerItemRow({
  item,
  index,
  active,
  onPress,
  t,
  isDetoxToggle,
  detoxOn,
}: {
  item: DrawerItem;
  index: number;
  active: boolean;
  onPress: () => void;
  t: ReturnType<typeof useAppTheme>;
  isDetoxToggle: boolean;
  detoxOn: boolean;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInLeft.delay(60 + index * 40)
        .springify()
        .damping(18)}
      style={animStyle}
    >
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 12, stiffness: 200 });
        }}
        onPress={onPress}
        style={[styles.item, active && { backgroundColor: t.accent + "12" }]}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: active ? t.accent + "20" : t.card },
          ]}
        >
          <PlatformSymbol
            ios={item.icon.ios}
            material={item.icon.material}
            tintColor={active ? t.accent : t.textSecondary}
            size={18}
          />
        </View>
        <Body
          variant="bodyMedium"
          color={active ? t.accent : t.textPrimary}
          style={{ flex: 1 }}
        >
          {item.label}
        </Body>
        {isDetoxToggle && (
          <View
            style={[
              styles.detoxBadge,
              { backgroundColor: detoxOn ? t.accent + "20" : t.card },
            ]}
          >
            <Caption
              variant="caption2"
              color={detoxOn ? t.accent : t.textMuted}
              style={{ fontWeight: "700" }}
            >
              {detoxOn ? "ON" : "OFF"}
            </Caption>
          </View>
        )}
        {active && !isDetoxToggle && (
          <View style={[styles.activeDot, { backgroundColor: t.accent }]} />
        )}
      </Pressable>
    </Animated.View>
  );
}

// ─── Drawer navigator ─────────────────────────────────────────

export default function DrawerLayout() {
  const t = useAppTheme();
  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "slide",
        drawerStyle: {
          backgroundColor: t.background,
          width: 280,
        },
        overlayColor: "rgba(0, 0, 0, 0.6)",
        swipeEdgeWidth: 50,
        swipeMinDistance: 10,
      }}
    >
      <Drawer.Screen
        name="(tabs)"
        options={{ drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen
        name="coach"
        options={{ drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen
        name="settings"
        options={{ drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen
        name="timeBlocks"
        options={{ drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen
        name="focusMode"
        options={{ drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen
        name="body"
        options={{ drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen
        name="spiritualChallenges"
        options={{ drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen
        name="lifeDashboard"
        options={{ drawerItemStyle: { display: "none" } }}
      />
      <Drawer.Screen
        name="diet"
        options={{ drawerItemStyle: { display: "none" } }}
      />
    </Drawer>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["2xl"],
    minHeight: "100%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.lg,
  },
  logoWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: 1,
    marginBottom: spacing.md,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xxs,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  detoxBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.lg,
    alignItems: "center",
  },
});
