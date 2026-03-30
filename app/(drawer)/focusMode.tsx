import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from 'expo-router';
import { type DrawerNavigationProp } from '@react-navigation/drawer';
import { PlatformSymbol } from '@/components/PlatformSymbol';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Body, Caption, Heading } from '@/components/Typography';
import {
  getAppOpenCountSince,
  getFocusManualMinutes,
  setFocusManualMinutes,
} from '@/lib/database';
import { useFocusLock } from '@/store/FocusContext';
import { useAppTheme } from '@/theme';
import { spacing } from '@/theme/spacing';

const WINDOW_MS = 45 * 60 * 1000;

export default function FocusModeScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<DrawerNavigationProp<any>>();
  const { focusLock, setFocusLock, refreshFocusState } = useFocusLock();
  const [opens, setOpens] = useState(0);
  const [manual, setManual] = useState('');
  const [loadedMin, setLoadedMin] = useState(0);

  const refresh = useCallback(async () => {
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    setOpens(await getAppOpenCountSince(since));
    const m = await getFocusManualMinutes();
    setLoadedMin(m);
    setManual(String(m));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshFocusState();
      refresh();
    }, [refresh, refreshFocusState]),
  );

  const saveMinutes = async () => {
    const n = parseInt(manual, 10);
    if (Number.isNaN(n) || n < 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await setFocusManualMinutes(n);
    setLoadedMin(n);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            nav.openDrawer();
          }}
          hitSlop={12}
        >
          <PlatformSymbol ios="line.3.horizontal" material="menu" tintColor={t.textPrimary} size={22} />
        </Pressable>
        <Heading variant="title3">Focus / lock</Heading>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Caption color={t.textMuted} style={styles.lead}>
          When focus lock is on, we count how often you return to this app. If you bounce too much in 45 minutes, we
          nudge you to put the phone down. Track rough phone time manually below for honesty.
        </Caption>

        <Card>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Body variant="headline">Focus lock</Body>
              <Caption color={t.textSecondary}>Frequent-open warnings</Caption>
            </View>
            <Switch
              value={focusLock}
              onValueChange={async (v) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                await setFocusLock(v);
              }}
              trackColor={{ false: t.border, true: t.accent + '55' }}
              thumbColor={focusLock ? t.accent : t.textMuted}
            />
          </View>
        </Card>

        <Card>
          <Body variant="headline">Opens (last 45 min)</Body>
          <Heading variant="title1" color={t.warning}>
            {opens}
          </Heading>
          <Caption color={t.textMuted}>High counts trigger reminders on Today.</Caption>
        </Card>

        <Card>
          <Body variant="headline">Manual phone time today</Body>
          <Caption color={t.textMuted}>Minutes you estimate on your phone (manual)</Caption>
          <TextInput
            style={[styles.input, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.background }]}
            keyboardType="number-pad"
            value={manual}
            onChangeText={setManual}
            placeholder="Minutes"
            placeholderTextColor={t.textMuted}
          />
          <Button title="Save minutes" onPress={saveMinutes} />
          <Caption color={t.textMuted}>Saved: {loadedMin} min</Caption>
        </Card>
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
    gap: spacing.lg,
  },
  lead: { lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginVertical: spacing.md,
  },
});
