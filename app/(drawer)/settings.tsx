import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlatformSymbol } from '@/components/PlatformSymbol';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from 'expo-router';
import { type DrawerNavigationProp } from '@react-navigation/drawer';
import { useCallback, useEffect, useState } from 'react';

import { getNotificationsEnabled, setNotificationsEnabled } from '@/lib/notificationPrefs';
import { rescheduleSmartNotifications } from '@/lib/smartNotifications';
import { useAppTheme } from '@/theme';
import { spacing, radius } from '@/theme/spacing';
import { Card } from '@/components/Card';
import { Body, Caption, Heading } from '@/components/Typography';

interface SettingsRow {
  label: string;
  icon: { ios: string; android: string; web: string };
  type: 'chevron' | 'toggle';
  value?: boolean;
}

const SECTIONS: { title: string; rows: SettingsRow[] }[] = [
  {
    title: 'General',
    rows: [
      { label: 'Haptic Feedback', icon: { ios: 'hand.tap.fill', android: 'touch_app', web: 'touch_app' }, type: 'toggle', value: true },
      { label: 'Default Mode', icon: { ios: 'house.fill', android: 'home', web: 'home' }, type: 'chevron' },
    ],
  },
  {
    title: 'Data',
    rows: [
      { label: 'Export Data', icon: { ios: 'square.and.arrow.up.fill', android: 'upload', web: 'upload' }, type: 'chevron' },
      { label: 'Reset All Data', icon: { ios: 'trash.fill', android: 'delete', web: 'delete' }, type: 'chevron' },
    ],
  },
  {
    title: 'About',
    rows: [
      { label: 'Privacy Policy', icon: { ios: 'lock.fill', android: 'lock', web: 'lock' }, type: 'chevron' },
      { label: 'Version', icon: { ios: 'info.circle.fill', android: 'info', web: 'info' }, type: 'chevron' },
    ],
  },
];

export default function SettingsScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const [notificationsOn, setNotificationsOn] = useState(true);

  const loadNotif = useCallback(async () => {
    setNotificationsOn(await getNotificationsEnabled());
  }, []);

  useEffect(() => {
    loadNotif();
  }, [loadNotif]);

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.openDrawer();
          }}
          hitSlop={12}
        >
          <PlatformSymbol ios="line.3.horizontal" material="menu" tintColor={t.textPrimary} size={22} />
        </Pressable>
        <Heading variant="title3">Settings</Heading>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((section, si) => (
          <Animated.View
            key={section.title}
            entering={FadeInDown.delay(si * 80).springify().damping(18)}
          >
            <Caption
              variant="caption1"
              color={t.textMuted}
              style={styles.sectionTitle}
            >
              {section.title.toUpperCase()}
            </Caption>
            <Card>
              {section.title === 'General' && si === 0 && (
                <Pressable
                  style={[styles.row, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.border }]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: t.accent + '12' }]}>
                    <PlatformSymbol ios="bell.fill" material="notifications" tintColor={t.accent} size={16} />
                  </View>
                  <Body variant="bodyMedium" style={{ flex: 1 }}>
                    Notifications
                  </Body>
                  <Switch
                    value={notificationsOn}
                    onValueChange={async (v) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setNotificationsOn(v);
                      await setNotificationsEnabled(v);
                      await rescheduleSmartNotifications();
                    }}
                    trackColor={{ false: t.border, true: t.accent + '60' }}
                    thumbColor={notificationsOn ? t.accent : t.textMuted}
                  />
                </Pressable>
              )}

              {section.rows.map((row, ri) => (
                <Pressable
                  key={row.label}
                  style={[
                    styles.row,
                    (ri > 0 || (section.title === 'General' && si === 0)) && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: t.border,
                    },
                  ]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: t.accent + '12' }]}>
                    <PlatformSymbol ios={row.icon.ios} material={row.icon.android} tintColor={t.accent} size={16} />
                  </View>
                  <Body variant="bodyMedium" style={{ flex: 1 }}>
                    {row.label}
                  </Body>
                  {row.type === 'toggle' ? (
                    <Switch
                      value={row.value}
                      trackColor={{ false: t.border, true: t.accent + '60' }}
                      thumbColor={row.value ? t.accent : t.textMuted}
                    />
                  ) : (
                    <PlatformSymbol ios="chevron.right" material="chevron_right" tintColor={t.textMuted} size={14} />
                  )}
                </Pressable>
              ))}
            </Card>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing['5xl'],
    gap: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
    fontWeight: '600',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
