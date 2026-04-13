import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { HabitIconView } from '@/components/HabitIconView';
import { PlatformSymbol } from '@/components/PlatformSymbol';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { useAppTheme } from '@/theme';
import { spacing, radius } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import { Button } from '@/components/Button';
import { Body, Caption, Heading } from '@/components/Typography';
import { addHabit } from "@/lib/firestoreDatabase";
import { useMode } from '@/store/ModeContext';
import type { HabitIcon, LifeArea, Mode } from '@/lib/types';

// ─── Icon catalog ──────────────────────────────────────────────

const ICON_OPTIONS: { icon: HabitIcon; label: string }[] = [
  { icon: { ios: 'shield.checkmark.fill', android: 'shield', web: 'shield' }, label: 'Shield' },
  { icon: { ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }, label: 'Walk' },
  { icon: { ios: 'dumbbell.fill', android: 'fitness_center', web: 'fitness_center' }, label: 'Gym' },
  { icon: { ios: 'moon.stars.fill', android: 'self_improvement', web: 'self_improvement' }, label: 'Pray' },
  { icon: { ios: 'book.fill', android: 'menu_book', web: 'menu_book' }, label: 'Read' },
  { icon: { ios: 'bed.double.fill', android: 'hotel', web: 'hotel' }, label: 'Sleep' },
  { icon: { ios: 'sunrise.fill', android: 'wb_twilight', web: 'wb_twilight' }, label: 'Morning' },
  { icon: { ios: 'moon.fill', android: 'nightlight', web: 'nightlight' }, label: 'Night' },
  { icon: { ios: 'brain.head.profile.fill', android: 'psychology', web: 'psychology' }, label: 'Focus' },
  { icon: { ios: 'clock.badge.checkmark.fill', android: 'schedule', web: 'schedule' }, label: 'Timer' },
  { icon: { ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }, label: 'Water' },
  { icon: { ios: 'heart.fill', android: 'favorite', web: 'favorite' }, label: 'Heart' },
  { icon: { ios: 'leaf.fill', android: 'eco', web: 'eco' }, label: 'Nature' },
  { icon: { ios: 'xmark.app.fill', android: 'block', web: 'block' }, label: 'Block' },
  { icon: { ios: 'play.slash.fill', android: 'videocam_off', web: 'videocam_off' }, label: 'No Video' },
  { icon: { ios: 'iphone.slash', android: 'phonelink_off', web: 'phonelink_off' }, label: 'No Phone' },
  { icon: { ios: 'pencil.line', android: 'edit', web: 'edit' }, label: 'Journal' },
  { icon: { ios: 'star.fill', android: 'star', web: 'star' }, label: 'Star' },
];

// ─── Color palette ─────────────────────────────────────────────

const COLOR_OPTIONS = [
  '#4ADE80', '#34D399', '#22D3EE', '#60A5FA',
  '#818CF8', '#A78BFA', '#C084FC', '#F472B6',
  '#F87171', '#EF4444', '#F59E0B', '#FBBF24',
];

// ─── Mode segments ─────────────────────────────────────────────

const MODE_OPTIONS: { label: string; value: Mode }[] = [
  { label: '🏠 Home', value: 'home' },
  { label: '🏢 Hostel', value: 'hostel' },
];

const LIFE_AREA_OPTIONS: { label: string; value: LifeArea }[] = [
  { label: 'Spiritual', value: 'spiritual' },
  { label: 'Physical', value: 'physical' },
  { label: 'Mental', value: 'mental' },
  { label: 'Work', value: 'work' },
];

// ────────────────────────────────────────────────────────────────

export default function AddHabitScreen() {
  const router = useRouter();
  const t = useAppTheme();
  const { mode: currentMode } = useMode();

  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(0);
  const [selectedColor, setSelectedColor] = useState(0);
  const [habitMode, setHabitMode] = useState<Mode>(currentMode);
  const [lifeArea, setLifeArea] = useState<LifeArea>('mental');
  const [target, setTarget] = useState(1);

  const icon = ICON_OPTIONS[selectedIcon].icon;
  const color = COLOR_OPTIONS[selectedColor];

  const handleSave = async () => {
    if (!name.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addHabit({
      name: name.trim(),
      icon,
      color,
      mode: habitMode,
      lifeArea,
      targetPerDay: target,
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Live Preview ──────────────────────── */}
        <Animated.View entering={FadeIn.duration(300)}>
          <View style={[styles.preview, { backgroundColor: t.card }]}>
            <View style={[styles.previewIcon, { backgroundColor: color + '22' }]}>
              <HabitIconView icon={icon} color={color} size={24} />
            </View>
            <View style={styles.previewText}>
              <Body variant="bodyMedium">
                {name.trim() || 'Habit Name'}
              </Body>
              <Caption variant="caption2" color={t.textMuted}>
                {lifeArea} · {habitMode} · {target}x daily
              </Caption>
            </View>
            <View style={[styles.previewCheck, { borderColor: color }]} />
          </View>
        </Animated.View>

        {/* ─── Name ──────────────────────────────── */}
        <View style={styles.section}>
          <Caption variant="footnote" color={t.textSecondary} style={styles.sectionLabel}>
            HABIT NAME
          </Caption>
          <TextInput
            style={[styles.input, { backgroundColor: t.card, color: t.textPrimary, borderColor: t.border }]}
            value={name}
            onChangeText={setName}
            placeholder="e.g. No social media before noon"
            placeholderTextColor={t.textMuted}
            selectionColor={t.accent}
            autoFocus
          />
        </View>

        {/* ─── Icon Picker ───────────────────────── */}
        <View style={styles.section}>
          <Caption variant="footnote" color={t.textSecondary} style={styles.sectionLabel}>
            ICON
          </Caption>
          <View style={styles.iconGrid}>
            {ICON_OPTIONS.map((opt, i) => {
              const active = i === selectedIcon;
              return (
                <Pressable
                  key={i}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedIcon(i);
                  }}
                  style={[
                    styles.iconCell,
                    { backgroundColor: active ? color + '22' : t.card },
                    active && { borderColor: color, borderWidth: 1.5 },
                  ]}
                >
                  <HabitIconView
                    icon={opt.icon}
                    color={active ? color : t.textMuted}
                    size={20}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ─── Color Picker ──────────────────────── */}
        <View style={styles.section}>
          <Caption variant="footnote" color={t.textSecondary} style={styles.sectionLabel}>
            COLOR
          </Caption>
          <View style={styles.colorRow}>
            {COLOR_OPTIONS.map((c, i) => {
              const active = i === selectedColor;
              return (
                <Pressable
                  key={c}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedColor(i);
                  }}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    active && styles.colorDotActive,
                  ]}
                >
                  {active && (
                    <PlatformSymbol ios="checkmark" material="check" tintColor="#fff" size={14} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ─── Mode ──────────────────────────────── */}
        <View style={styles.section}>
          <Caption variant="footnote" color={t.textSecondary} style={styles.sectionLabel}>
            MODE
          </Caption>
          <View style={styles.modeRow}>
            {MODE_OPTIONS.map((opt) => {
              const active = opt.value === habitMode;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setHabitMode(opt.value);
                  }}
                  style={[
                    styles.modeChip,
                    { backgroundColor: active ? t.accent + '18' : t.card },
                    active && { borderColor: t.accent, borderWidth: 1.5 },
                  ]}
                >
                  <Body
                    variant="subhead"
                    color={active ? t.accent : t.textSecondary}
                    style={{ fontWeight: active ? '600' : '400' }}
                  >
                    {opt.label}
                  </Body>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ─── Life area ─────────────────────────── */}
        <View style={styles.section}>
          <Caption variant="footnote" color={t.textSecondary} style={styles.sectionLabel}>
            LIFE AREA
          </Caption>
          <View style={styles.modeRow}>
            {LIFE_AREA_OPTIONS.map((opt) => {
              const active = opt.value === lifeArea;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setLifeArea(opt.value);
                  }}
                  style={[
                    styles.modeChip,
                    { backgroundColor: active ? t.accent + '18' : t.card },
                    active && { borderColor: t.accent, borderWidth: 1.5 },
                  ]}
                >
                  <Body
                    variant="subhead"
                    color={active ? t.accent : t.textSecondary}
                    style={{ fontWeight: active ? '600' : '400' }}
                  >
                    {opt.label}
                  </Body>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ─── Target Per Day ────────────────────── */}
        <View style={styles.section}>
          <Caption variant="footnote" color={t.textSecondary} style={styles.sectionLabel}>
            TARGET PER DAY
          </Caption>
          <View style={[styles.stepperRow, { backgroundColor: t.card }]}>
            <Pressable
              onPress={() => {
                if (target > 1) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTarget((v) => v - 1);
                }
              }}
              style={[styles.stepperBtn, { opacity: target <= 1 ? 0.3 : 1 }]}
            >
              <PlatformSymbol ios="minus" material="remove" tintColor={t.textPrimary} size={18} />
            </Pressable>

            <View style={styles.stepperValue}>
              <Heading variant="title2">{target}</Heading>
              <Caption variant="caption2" color={t.textMuted}>
                {target === 1 ? 'time' : 'times'}
              </Caption>
            </View>

            <Pressable
              onPress={() => {
                if (target < 20) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setTarget((v) => v + 1);
                }
              }}
              style={[styles.stepperBtn, { opacity: target >= 20 ? 0.3 : 1 }]}
            >
              <PlatformSymbol ios="plus" material="add" tintColor={t.textPrimary} size={18} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* ─── Actions (pinned) ───────────────────── */}
      <View style={[styles.actions, { backgroundColor: t.background }]}>
        <Button title="Save Habit" onPress={handleSave} disabled={!name.trim()} />
        <Button title="Cancel" variant="secondary" onPress={() => router.back()} />
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    padding: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.xl,
  },

  // Preview
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.xl,
    gap: spacing.md,
  },
  previewIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: {
    flex: 1,
    gap: spacing.xxs,
  },
  previewCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },

  // Sections
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    ...typography.body,
  },

  // Icon grid
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  iconCell: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Color picker
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  colorDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.4)',
  },

  // Mode
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modeChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },

  // Stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
  },

  // Actions
  actions: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
});
