import { PlatformSymbol } from '@/components/PlatformSymbol';
import { type DrawerNavigationProp } from '@react-navigation/drawer';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Body, Caption, Heading } from '@/components/Typography';
import {
  addTimeBlock,
  deleteTimeBlock,
  getTimeBlockLog,
  getTimeBlocks,
  setTimeBlockLog,
} from '@/lib/database';
import type { TimeBlock, TimeBlockCategory } from '@/lib/types';
import { useAppTheme } from '@/theme';
import { radius, spacing } from '@/theme/spacing';

const CATEGORY_LABEL: Record<TimeBlockCategory, string> = {
  morning_routine: 'Morning routine',
  work_block: 'Work blocks',
  night_routine: 'Night routine',
};

const CATEGORIES: TimeBlockCategory[] = ['morning_routine', 'work_block', 'night_routine'];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TimeBlocksScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<DrawerNavigationProp<any>>();
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [logs, setLogs] = useState<Record<number, boolean>>({});
  const day = todayISO();
  const [modal, setModal] = useState(false);
  const [cat, setCat] = useState<TimeBlockCategory>('morning_routine');
  const [label, setLabel] = useState('');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');

  const load = useCallback(async () => {
    const list = await getTimeBlocks(true);
    setBlocks(list);
    const m: Record<number, boolean> = {};
    for (const b of list) {
      m[b.id] = await getTimeBlockLog(b.id, day);
    }
    setLogs(m);
  }, [day]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggle = async (b: TimeBlock) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !logs[b.id];
    await setTimeBlockLog(b.id, day, next);
    setLogs((p) => ({ ...p, [b.id]: next }));
  };

  const handleAdd = async () => {
    if (!label.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addTimeBlock({
      category: cat,
      label: label.trim(),
      startTime: start,
      endTime: end,
      sortOrder: blocks.filter((x) => x.category === cat).length,
    });
    setLabel('');
    setModal(false);
    load();
  };

  const remove = async (id: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await deleteTimeBlock(id);
    load();
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
        <Heading variant="title3">Time blocks</Heading>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setModal(true);
          }}
        >
          <PlatformSymbol ios="plus.circle.fill" material="add_circle" tintColor={t.accent} size={24} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Caption color={t.textMuted} style={styles.lead}>
          Define morning, work, and night windows. Check them off daily to build rhythm.
        </Caption>

        {CATEGORIES.map((c) => {
          const rows = blocks.filter((b) => b.category === c);
          return (
            <View key={c} style={styles.section}>
              <Caption variant="caption1" color={t.textMuted} style={styles.sectionLabel}>
                {CATEGORY_LABEL[c].toUpperCase()}
              </Caption>
              {rows.length === 0 ? (
                <Card>
                  <Caption color={t.textMuted}>No blocks yet — tap + to add.</Caption>
                </Card>
              ) : (
                rows.map((b) => (
                  <Card key={b.id} style={styles.blockCard}>
                    <View style={styles.blockTop}>
                      <View style={{ flex: 1 }}>
                        <Body variant="headline">{b.label}</Body>
                        <Caption color={t.textSecondary}>
                          {b.startTime} – {b.endTime}
                        </Caption>
                      </View>
                      <Switch
                        value={!!logs[b.id]}
                        onValueChange={() => toggle(b)}
                        trackColor={{ false: t.border, true: t.accent + '55' }}
                        thumbColor={logs[b.id] ? t.accent : t.textMuted}
                      />
                    </View>
                    <Pressable onPress={() => remove(b.id)} style={styles.del}>
                      <Caption color={t.danger}>Remove</Caption>
                    </Pressable>
                  </Card>
                ))
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={modal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: t.card }]}>
            <Heading variant="title3">New block</Heading>
            <Caption color={t.textMuted}>Category</Caption>
            <View style={styles.catRow}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCat(c)}
                  style={[
                    styles.catChip,
                    { borderColor: cat === c ? t.accent : t.border, backgroundColor: cat === c ? t.accent + '18' : t.background },
                  ]}
                >
                  <Caption color={cat === c ? t.accent : t.textSecondary}>{CATEGORY_LABEL[c]}</Caption>
                </Pressable>
              ))}
            </View>
            <Caption color={t.textMuted}>Label</Caption>
            <TextInput
              style={[styles.miniIn, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.background }]}
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Office work"
              placeholderTextColor={t.textMuted}
            />
            <View style={styles.row2}>
              <View style={{ flex: 1 }}>
                <Caption color={t.textMuted}>Start (HH:MM)</Caption>
                <TextInput
                  style={[styles.miniIn, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.background }]}
                  value={start}
                  onChangeText={setStart}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Caption color={t.textMuted}>End</Caption>
                <TextInput
                  style={[styles.miniIn, { color: t.textPrimary, borderColor: t.border, backgroundColor: t.background }]}
                  value={end}
                  onChangeText={setEnd}
                />
              </View>
            </View>
            <Button title="Add block" onPress={handleAdd} disabled={!label.trim()} />
            <Pressable onPress={() => setModal(false)} style={{ alignItems: 'center', padding: spacing.md }}>
              <Caption color={t.textMuted}>Cancel</Caption>
            </Pressable>
          </Card>
        </View>
      </Modal>
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
  section: { gap: spacing.sm },
  sectionLabel: { marginLeft: spacing.xs, fontWeight: '600', letterSpacing: 0.6 },
  blockCard: { gap: spacing.sm },
  blockTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  del: { alignSelf: 'flex-start' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    padding: spacing.xl,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    gap: spacing.sm,
  },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  catChip: { padding: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
  miniIn: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  row2: { flexDirection: 'row', gap: spacing.md },
});
