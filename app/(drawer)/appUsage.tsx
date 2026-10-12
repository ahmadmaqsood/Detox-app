import { type DrawerNavigationProp } from "@react-navigation/drawer";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import {
  addCustomAppTimer,
  getAppTimers,
  openAndroidUsageAccessSettings,
  startAppSessionTimer,
  triggerAppLimitExceededNotification,
  updateAppTimer,
  type AppTimerConfig,
} from "@/lib/appUsageService";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";

const PRESET_LIMITS = [15, 30, 45, 60, 90];

export default function AppUsageScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<any>>();

  const [timers, setTimers] = useState<AppTimerConfig[]>([]);
  const [activeSessionApp, setActiveSessionApp] = useState<string | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppLimit, setNewAppLimit] = useState("30");

  const load = useCallback(async () => {
    const list = await getAppTimers();
    setTimers(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleToggle = async (pkg: string, enabled: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = await updateAppTimer(pkg, { enabled });
    setTimers(updated);
  };

  const handleSetLimit = async (pkg: string, limitMinutes: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = await updateAppTimer(pkg, { limitMinutes });
    setTimers(updated);
  };

  const handleStartSession = async (app: AppTimerConfig) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setActiveSessionApp(app.appName);
    await startAppSessionTimer(app.appName, app.limitMinutes);
    Alert.alert(
      `Session Started: ${app.appName}`,
      `Timer set for ${app.limitMinutes} minutes. You will receive an alert notification when your time is up!`,
      [{ text: "Got it" }],
    );
  };

  const handleTestAlert = async (app: AppTimerConfig) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await triggerAppLimitExceededNotification(app.appName, app.limitMinutes, app.limitMinutes + 5);
    Alert.alert(
      "Notification Triggered",
      `Sent limit alert for ${app.appName}. Check your phone's notification bar!`,
    );
  };

  const handleAddCustomApp = async () => {
    if (!newAppName.trim()) return;
    const limit = parseInt(newAppLimit, 10) || 30;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const updated = await addCustomAppTimer(newAppName.trim(), limit);
    setTimers(updated);
    setNewAppName("");
    setAddModalVisible(false);
  };

  const activeCount = timers.filter((t) => t.enabled).length;
  const totalBudgetMinutes = timers
    .filter((t) => t.enabled)
    .reduce((s, x) => s + x.limitMinutes, 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* ─── Header ────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.openDrawer();
          }}
          hitSlop={12}
        >
          <PlatformSymbol
            ios="line.3.horizontal"
            material="menu"
            tintColor={t.textPrimary}
            size={22}
          />
        </Pressable>
        <Heading variant="title3">App Timers & Limits</Heading>
        <Pressable
          onPress={() => setAddModalVisible(true)}
          hitSlop={12}
          style={[styles.addBtn, { backgroundColor: t.accent + "20" }]}
        >
          <PlatformSymbol
            ios="plus"
            material="add"
            tintColor={t.accent}
            size={20}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Hero Overview Card ────────────────────────────── */}
        <Animated.View entering={FadeIn.duration(400)}>
          <View style={[styles.heroCard, { backgroundColor: t.card }]}>
            <View style={[styles.heroIconWrap, { backgroundColor: t.accent + "18" }]}>
              <PlatformSymbol
                ios="hourglass"
                material="hourglass-top"
                tintColor={t.accent}
                size={28}
              />
            </View>
            <Heading variant="title2">Distraction Budget</Heading>
            <Body variant="body" color={t.textSecondary} style={{ textAlign: "center" }}>
              Set daily limits on problem apps. When you exceed your set time, the app alerts you to close it and protect your mental focus.
            </Body>
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStatCol}>
                <Heading variant="title2" color={t.accent}>
                  {activeCount}
                </Heading>
                <Caption variant="caption2" color={t.textMuted}>
                  Active Timers
                </Caption>
              </View>
              <View style={[styles.heroDivider, { backgroundColor: t.border }]} />
              <View style={styles.heroStatCol}>
                <Heading variant="title2" color={t.textPrimary}>
                  {Math.round(totalBudgetMinutes / 60)}h {totalBudgetMinutes % 60}m
                </Heading>
                <Caption variant="caption2" color={t.textMuted}>
                  Total Max Budget
                </Caption>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ─── Android Native Access Banner ──────────────────── */}
        {Platform.OS === "android" && (
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <View
              style={[
                styles.permissionCard,
                { backgroundColor: t.accent + "12", borderColor: t.accent + "40" },
              ]}
            >
              <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
                <PlatformSymbol
                  ios="shield.lefthalf.filled"
                  material="security"
                  tintColor={t.accent}
                  size={22}
                />
                <View style={{ flex: 1, gap: spacing.xxs }}>
                  <Heading variant="title3" color={t.accent}>
                    Android Usage Access
                  </Heading>
                  <Caption variant="caption2" color={t.textSecondary}>
                    To automatically read exact Chrome and WhatsApp minutes from your phone, grant Special Usage Access in Android Settings.
                  </Caption>
                </View>
              </View>
              <Pressable
                onPress={openAndroidUsageAccessSettings}
                style={[styles.grantBtn, { backgroundColor: t.accent }]}
              >
                <Body variant="bodyMedium" color="#fff" style={{ fontWeight: "700" }}>
                  Open Android Settings → Grant Access
                </Body>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* ─── Target Apps List ──────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Heading variant="title3">App Limits</Heading>
          <Caption variant="caption2" color={t.textMuted}>
            Tap chips to adjust limit
          </Caption>
        </View>

        <View style={styles.list}>
          {timers.map((app, index) => {
            const isExceeded = app.usedMinutesToday >= app.limitMinutes && app.enabled;
            const progress =
              app.limitMinutes > 0
                ? Math.min(1, app.usedMinutesToday / app.limitMinutes)
                : 0;

            return (
              <Animated.View
                key={app.packageName}
                entering={FadeInDown.delay(index * 40).duration(260)}
              >
                <Card
                  style={[
                    styles.appCard,
                    isExceeded && { borderColor: t.danger, borderWidth: 1.5 },
                  ]}
                >
                  <View style={styles.appTopRow}>
                    <View style={styles.appInfoCol}>
                      <Heading variant="title3">{app.appName}</Heading>
                      <Caption variant="caption2" color={t.textMuted}>
                        {app.packageName}
                      </Caption>
                    </View>
                    <Switch
                      value={app.enabled}
                      onValueChange={(val) => handleToggle(app.packageName, val)}
                      trackColor={{ false: t.border, true: t.accent }}
                      thumbColor="#fff"
                    />
                  </View>

                  {/* Limit & Progress */}
                  <View style={styles.progressSection}>
                    <View style={styles.progressLabels}>
                      <Caption variant="caption2" color={isExceeded ? t.danger : t.textMuted}>
                        Daily Limit: {app.limitMinutes}m
                      </Caption>
                      <Caption
                        variant="caption2"
                        color={isExceeded ? t.danger : t.accent}
                        style={{ fontWeight: "700" }}
                      >
                        {isExceeded ? "LIMIT EXCEEDED" : "Active Monitor"}
                      </Caption>
                    </View>
                    <View style={[styles.track, { backgroundColor: t.background }]}>
                      <View
                        style={[
                          styles.bar,
                          {
                            width: `${Math.max(12, Math.min(100, Math.round(progress * 100)))}%`,
                            backgroundColor: isExceeded ? t.danger : t.accent,
                          },
                        ]}
                      />
                    </View>
                  </View>

                  {/* Limit Selection Chips */}
                  <View style={styles.chipsRow}>
                    {PRESET_LIMITS.map((mins) => {
                      const selected = app.limitMinutes === mins;
                      return (
                        <Pressable
                          key={mins}
                          onPress={() => handleSetLimit(app.packageName, mins)}
                          style={[
                            styles.chip,
                            {
                              backgroundColor: selected ? t.accent : t.background,
                              borderColor: selected ? t.accent : t.border,
                            },
                          ]}
                        >
                          <Caption
                            variant="caption2"
                            color={selected ? "#fff" : t.textSecondary}
                            style={{ fontWeight: selected ? "700" : "500" }}
                          >
                            {mins}m
                          </Caption>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Action Row */}
                  <View style={styles.appActionRow}>
                    <Pressable
                      onPress={() => handleStartSession(app)}
                      style={[styles.sessionBtn, { backgroundColor: t.accent + "18" }]}
                    >
                      <PlatformSymbol
                        ios="play.fill"
                        material="play-arrow"
                        tintColor={t.accent}
                        size={14}
                      />
                      <Caption variant="caption2" color={t.accent} style={{ fontWeight: "700" }}>
                        Start {app.limitMinutes}m Timer
                      </Caption>
                    </Pressable>

                    <Pressable
                      onPress={() => handleTestAlert(app)}
                      style={[styles.testBtn, { borderColor: t.border }]}
                    >
                      <Caption variant="caption2" color={t.textMuted}>
                        Test Alert 🔔
                      </Caption>
                    </Pressable>
                  </View>
                </Card>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>

      {/* ─── Add Custom App Modal ──────────────────────────── */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: t.card }]}>
            <Heading variant="title2">Add App to Monitor</Heading>
            <Caption variant="caption1" color={t.textSecondary}>
              Specify the name and your maximum allowed daily usage limit.
            </Caption>

            <View style={{ gap: spacing.xs, marginTop: spacing.sm }}>
              <Caption variant="caption2" color={t.textMuted}>
                APP NAME
              </Caption>
              <TextInput
                style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
                placeholder="e.g. Reddit, PUBG, Telegram"
                placeholderTextColor={t.textMuted}
                value={newAppName}
                onChangeText={setNewAppName}
                autoFocus
              />
            </View>

            <View style={{ gap: spacing.xs }}>
              <Caption variant="caption2" color={t.textMuted}>
                DAILY LIMIT (MINUTES)
              </Caption>
              <TextInput
                style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
                placeholder="30"
                placeholderTextColor={t.textMuted}
                value={newAppLimit}
                onChangeText={setNewAppLimit}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Add App Timer"
                onPress={handleAddCustomApp}
                disabled={!newAppName.trim()}
              />
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setAddModalVisible(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.sm,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: spacing.xl,
    paddingTop: spacing.xs,
    paddingBottom: spacing["5xl"],
    gap: spacing.lg,
  },
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  heroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xxs,
  },
  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  heroStatCol: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xxs,
  },
  heroDivider: {
    width: 1,
    height: 32,
  },
  permissionCard: {
    borderRadius: radius.xl,
    borderWidth: 1.5,
    padding: spacing.lg,
    gap: spacing.md,
  },
  grantBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  list: {
    gap: spacing.md,
  },
  appCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  appTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  appInfoCol: {
    gap: spacing.xxs,
  },
  progressSection: {
    gap: spacing.xs,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 3,
  },
  chipsRow: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  appActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.15)",
  },
  sessionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  testBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalContent: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
  },
  modalActions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
