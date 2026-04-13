import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Button } from '@/components/Button';
import { Body, Caption, Heading } from '@/components/Typography';
import { logRelapseEvent } from '@/lib/firestoreDatabase';
import { syncFirestoreAchievements } from '@/lib/firestoreAchievements';
import { RELAPSE_TRIGGERS, type RelapseTriggerId } from '@/lib/relapseTriggers';
import { useAppTheme } from '@/theme';
import { spacing, radius } from '@/theme/spacing';

export default function RelapseLogScreen() {
  const t = useAppTheme();
  const router = useRouter();
  const [trigger, setTrigger] = useState<RelapseTriggerId>('stress');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await logRelapseEvent({ triggerTag: trigger, note: note.trim() });
      await syncFirestoreAchievements();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Caption variant="footnote" color={t.textMuted} style={styles.lead}>
        Logging honestly helps you see patterns. Pick what was closest — you can add detail below.
      </Caption>

      <Heading variant="title3" style={styles.section}>
        What triggered it?
      </Heading>
      <View style={styles.grid}>
        {RELAPSE_TRIGGERS.map((opt) => {
          const on = opt.id === trigger;
          return (
            <Pressable
              key={opt.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setTrigger(opt.id);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: on ? t.accent + '22' : t.card,
                  borderColor: on ? t.accent : t.border,
                },
              ]}
            >
              <Body variant="bodyMedium" color={on ? t.accent : t.textPrimary}>
                {opt.label}
              </Body>
            </Pressable>
          );
        })}
      </View>

      <Heading variant="title3" style={styles.section}>
        Notes (optional)
      </Heading>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: t.card,
            color: t.textPrimary,
            borderColor: t.border,
          },
        ]}
        value={note}
        onChangeText={setNote}
        placeholder="What happened right before?"
        placeholderTextColor={t.textMuted}
        multiline
        maxLength={500}
      />

      <Button title="Save — start again" onPress={save} loading={saving} fullWidth />
      <Pressable onPress={() => router.back()} style={styles.cancel}>
        <Caption color={t.textMuted}>Cancel</Caption>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.xl,
    paddingBottom: spacing['4xl'],
    gap: spacing.md,
  },
  lead: {
    lineHeight: 20,
  },
  section: {
    marginTop: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  cancel: {
    alignItems: 'center',
    padding: spacing.lg,
  },
});
