import { HabitIconView } from '@/components/HabitIconView';
import { PlatformSymbol } from '@/components/PlatformSymbol';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Body, Caption, Heading } from '@/components/Typography';
import { addHabit, getHabitById, updateHabit } from "@/lib/firestoreDatabase";
import type { HabitIcon, LifeArea, Mode, TimeSlot } from '@/lib/types';
import { parseHabitIcon } from '@/lib/types';
import { useMode } from '@/store/ModeContext';
import { useAppTheme } from '@/theme';
import { radius, spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import {
  HABIT_ICON_OPTIONS,
  ICON_CATEGORIES,
  type HabitIconOption,
  type IconCategory,
} from '@/constants/habitIcons';

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
  { label: '💼 Office', value: 'office' },
  { label: '✈️ Travel', value: 'travel' },
];

const LIFE_AREA_OPTIONS: { label: string; value: LifeArea }[] = [
  { label: 'Spiritual', value: 'spiritual' },
  { label: 'Physical', value: 'physical' },
  { label: 'Mental', value: 'mental' },
  { label: 'Work', value: 'work' },
  { label: 'Walk', value: 'walk' },
  { label: 'Learning', value: 'learning' },
  { label: 'Cold Shower', value: 'cold_shower' },
  { label: 'Reading', value: 'reading' },
  { label: 'Meditation', value: 'meditation' },
  { label: 'Stretching', value: 'stretching' },
  { label: 'Food', value: 'food' },
];

const TIME_SLOT_OPTIONS: { label: string; value: TimeSlot }[] = [
  { label: '🌅 Morning', value: 'morning' },
  { label: '☀️ Afternoon', value: 'afternoon' },
  { label: '🌙 Evening', value: 'evening' },
  { label: '✨ Night', value: 'night' },
  { label: '⚡ Anytime', value: 'anytime' },
];

const STACK_PRESETS = [
  'Fajr Prayer',
  'Morning Coffee',
  'Breakfast',
  'Starting Work',
  'Lunch',
  'Evening Walk',
  'Bedtime',
];

// ─── Helpers ───────────────────────────────────────────────────

function parseHabitIconSafe(raw: any): HabitIcon {
  if (!raw) return { ios: 'star.fill', android: 'star', web: 'star' };
  if (typeof raw === 'object' && (raw.ios || raw.android)) return raw as HabitIcon;
  try {
    return parseHabitIcon(raw);
  } catch {
    return { ios: 'star.fill', android: 'star', web: 'star' };
  }
}

function iconIndex(icon: HabitIcon): number {
  const idx = HABIT_ICON_OPTIONS.findIndex(
    (o) => o.icon.android === icon.android || o.icon.ios === icon.ios
  );
  return idx >= 0 ? idx : 0;
}

function colorIndex(color: string): number {
  const idx = COLOR_OPTIONS.findIndex((c) => c.toLowerCase() === color.toLowerCase());
  return idx >= 0 ? idx : 0;
}

// ────────────────────────────────────────────────────────────────

export default function AddHabitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; editId?: string }>();
  const isEditing = Boolean(params.editId);
  const editHabitId = params.editId ? Number(params.editId) : null;
  const t = useAppTheme();
  const { mode: currentMode } = useMode();

  const [loadingHabit, setLoadingHabit] = useState(isEditing);
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(0);
  const [iconCategory, setIconCategory] = useState<IconCategory>('all');
  const [selectedColor, setSelectedColor] = useState(0);
  const initialMode: Mode =
    params.mode === 'home' || params.mode === 'hostel' || params.mode === 'office' || params.mode === 'travel'
      ? (params.mode as Mode)
      : currentMode;
  const [habitMode, setHabitMode] = useState<Mode>(initialMode);
  const [lifeArea, setLifeArea] = useState<LifeArea>('mental');
  const [target, setTarget] = useState(1);
  const [detoxOnly, setDetoxOnly] = useState(false);

  // Adaptive routine fields
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('morning');
  const [stackAnchor, setStackAnchor] = useState('');
  const [minVersion, setMinVersion] = useState('');
  const [stdVersion, setStdVersion] = useState('');
  const [ambVersion, setAmbVersion] = useState('');

  const [saving, setSaving] = useState(false);

  // Prepopulate if in editing mode
  useEffect(() => {
    if (!editHabitId) return;
    let active = true;
    (async () => {
      try {
        setLoadingHabit(true);
        const h = await getHabitById(editHabitId);
        if (!active) return;
        if (!h) {
          Alert.alert("Error", "Habit not found");
          router.back();
          return;
        }
        setName(h.name);
        const parsedIcon = parseHabitIconSafe(h.icon);
        const iIdx = iconIndex(parsedIcon);
        setSelectedIcon(iIdx);
        if (HABIT_ICON_OPTIONS[iIdx]?.category) {
          setIconCategory(HABIT_ICON_OPTIONS[iIdx].category);
        }
        const cIdx = colorIndex(h.color);
        setSelectedColor(cIdx);
        setHabitMode(h.mode);
        setLifeArea(h.lifeArea ?? 'mental');
        setTarget(h.targetPerDay ?? 1);
        setDetoxOnly(Boolean(h.detoxOnly));
        setTimeSlot(h.timeSlot ?? 'morning');
        setStackAnchor(h.stackAnchorName ?? '');
        setMinVersion(h.difficultyLevels?.minimum ?? '');
        setStdVersion(h.difficultyLevels?.standard ?? '');
        setAmbVersion(h.difficultyLevels?.ambitious ?? '');
      } catch (err) {
        console.error("Failed to load habit for editing:", err);
        Alert.alert("Error", "Could not load habit details.");
        router.back();
      } finally {
        if (active) setLoadingHabit(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [editHabitId]);

  const selectedOption = HABIT_ICON_OPTIONS[selectedIcon] ?? HABIT_ICON_OPTIONS[0];
  const icon = selectedOption.icon;
  const color = COLOR_OPTIONS[selectedColor];

  const displayedIcons = useMemo(() => {
    if (iconCategory === 'all') return HABIT_ICON_OPTIONS;
    return HABIT_ICON_OPTIONS.filter((opt) => opt.category === iconCategory);
  }, [iconCategory]);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    try {
      setSaving(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const diffLevels =
        minVersion.trim() || stdVersion.trim() || ambVersion.trim()
          ? {
              minimum: minVersion.trim() || undefined,
              standard: stdVersion.trim() || undefined,
              ambitious: ambVersion.trim() || undefined,
            }
          : undefined;

      if (isEditing && editHabitId) {
        await updateHabit(editHabitId, {
          name: name.trim(),
          icon,
          color,
          mode: habitMode,
          lifeArea,
          targetPerDay: target,
          detoxOnly,
          difficultyLevels: diffLevels,
          timeSlot,
          stackAnchorName: stackAnchor.trim() || undefined,
        });
      } else {
        await addHabit({
          name: name.trim(),
          icon,
          color,
          mode: habitMode,
          lifeArea,
          targetPerDay: target,
          detoxOnly,
          difficultyLevels: diffLevels,
          timeSlot,
          stackAnchorName: stackAnchor.trim() || undefined,
        });
      }
      router.back();
    } catch (err) {
      console.error(isEditing ? "Failed to update habit:" : "Failed to add habit:", err);
      Alert.alert("Error", isEditing ? "Could not save changes. Please try again." : "Could not create habit. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (isEditing && loadingHabit) {
    return (
      <View style={[styles.centered, { backgroundColor: t.background }]}>
        <Stack.Screen options={{ title: 'Edit Habit' }} />
        <ActivityIndicator size="large" color={t.accent} />
        <Body variant="body" color={t.textMuted} style={{ marginTop: spacing.md }}>
          Loading habit details...
        </Body>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ title: isEditing ? 'Edit Habit' : 'New Habit' }} />
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
                {lifeArea} · {habitMode} · {target}x daily{detoxOnly ? ' · 🛡️ Detox Only' : ''}
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
            autoFocus={!isEditing}
          />
        </View>

        {/* ─── Icon Picker ───────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Caption variant="footnote" color={t.textSecondary} style={styles.sectionLabel}>
              ICON
            </Caption>
            <Caption variant="caption1" color={color} style={styles.iconSelectedBadge}>
              {selectedOption.label}
            </Caption>
          </View>

          {/* Category Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {ICON_CATEGORIES.map((cat) => {
              const active = iconCategory === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIconCategory(cat.id);
                  }}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: active ? color : t.card,
                      borderColor: active ? color : t.border,
                    },
                  ]}
                >
                  <Caption
                    variant="caption2"
                    color={active ? '#FFFFFF' : t.textSecondary}
                    style={active && { fontWeight: '700' }}
                  >
                    {cat.label}
                  </Caption>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Icon Grid */}
          <View style={styles.iconGrid}>
            {displayedIcons.map((opt) => {
              const globalIdx = HABIT_ICON_OPTIONS.findIndex((o) => o === opt);
              const active = globalIdx === selectedIcon;
              return (
                <Pressable
                  key={opt.label}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedIcon(globalIdx);
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
                    size={22}
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

        {/* ─── Time of Day Slot ──────────────────── */}
        <View style={styles.section}>
          <Caption variant="footnote" color={t.textSecondary} style={styles.sectionLabel}>
            TIME OF DAY
          </Caption>
          <View style={styles.slotRow}>
            {TIME_SLOT_OPTIONS.map((slot) => {
              const active = timeSlot === slot.value;
              return (
                <Pressable
                  key={slot.value}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setTimeSlot(slot.value);
                  }}
                  style={[
                    styles.slotChip,
                    {
                      backgroundColor: active ? t.accent + '20' : t.card,
                      borderColor: active ? t.accent : t.borderLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.slotChipText,
                      { color: active ? t.accent : t.textSecondary },
                      active && { fontWeight: '700' },
                    ]}
                  >
                    {slot.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ─── Habit Stacking (Routine Anchor) ───── */}
        <View style={styles.section}>
          <Caption variant="footnote" color={t.textSecondary} style={styles.sectionLabel}>
            HABIT STACKING (ROUTINE ANCHOR)
          </Caption>
          <Caption variant="caption2" color={t.textMuted}>
            Link this habit to a daily anchor event so it happens automatically.
          </Caption>
          <TextInput
            style={[styles.input, { backgroundColor: t.card, color: t.textPrimary, borderColor: t.borderLight }]}
            placeholder="e.g. After Fajr, After Morning Coffee..."
            placeholderTextColor={t.textMuted}
            value={stackAnchor}
            onChangeText={setStackAnchor}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {STACK_PRESETS.map((preset) => (
              <Pressable
                key={preset}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setStackAnchor(preset);
                }}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: stackAnchor === preset ? '#D4FE3320' : t.card,
                    borderColor: stackAnchor === preset ? '#D4FE33' : t.borderLight,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    { color: stackAnchor === preset ? '#D4FE33' : t.textMuted },
                    stackAnchor === preset && { fontWeight: '700' },
                  ]}
                >
                  After {preset}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* ─── Elastic Difficulty Levels ─────────── */}
        <View style={styles.section}>
          <Caption variant="footnote" color={t.textSecondary} style={styles.sectionLabel}>
            ELASTIC DIFFICULTY TIERS (OPTIONAL)
          </Caption>
          <Caption variant="caption2" color={t.textMuted}>
            Scalable versions adapt to your daily energy and prevent broken streaks.
          </Caption>
          <View style={[styles.tierInputCard, { backgroundColor: t.card, borderColor: t.borderLight }]}>
            <View style={styles.tierInputRow}>
              <View style={[styles.tierTag, { backgroundColor: '#D4FE3320' }]}>
                <Text style={{ color: '#D4FE33', fontSize: 10, fontWeight: '800' }}>MINIMUM</Text>
              </View>
              <TextInput
                style={[styles.tierTextInput, { color: t.textPrimary }]}
                placeholder="Low energy target (e.g. 5 min / 2 pages)"
                placeholderTextColor={t.textMuted}
                value={minVersion}
                onChangeText={setMinVersion}
              />
            </View>
            <View style={[styles.tierDivider, { backgroundColor: t.borderLight }]} />
            <View style={styles.tierInputRow}>
              <View style={[styles.tierTag, { backgroundColor: t.accent + '20' }]}>
                <Text style={{ color: t.accent, fontSize: 10, fontWeight: '800' }}>STANDARD</Text>
              </View>
              <TextInput
                style={[styles.tierTextInput, { color: t.textPrimary }]}
                placeholder="Regular target (e.g. 20 min / 10 pages)"
                placeholderTextColor={t.textMuted}
                value={stdVersion}
                onChangeText={setStdVersion}
              />
            </View>
            <View style={[styles.tierDivider, { backgroundColor: t.borderLight }]} />
            <View style={styles.tierInputRow}>
              <View style={[styles.tierTag, { backgroundColor: '#FBBF2420' }]}>
                <Text style={{ color: '#FBBF24', fontSize: 10, fontWeight: '800' }}>AMBITIOUS</Text>
              </View>
              <TextInput
                style={[styles.tierTextInput, { color: t.textPrimary }]}
                placeholder="Peak energy target (e.g. 45 min / 25 pages)"
                placeholderTextColor={t.textMuted}
                value={ambVersion}
                onChangeText={setAmbVersion}
              />
            </View>
          </View>
        </View>

        {/* ─── Detox Protocol Task ──────────────── */}
        <View style={styles.section}>
          <View style={[styles.switchCard, { backgroundColor: t.card }]}>
            <View style={{ flex: 1, paddingRight: spacing.md }}>
              <Heading variant="title3">🛡️ Detox Protocol Task</Heading>
              <Caption variant="caption2" color={t.textMuted} style={{ marginTop: spacing.xxs }}>
                When enabled, this habit is an extra task that only activates during Detox Mode days.
              </Caption>
            </View>
            <Switch
              value={detoxOnly}
              onValueChange={(val) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDetoxOnly(val);
              }}
              trackColor={{ false: t.border, true: t.accent }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
      </ScrollView>

      {/* ─── Actions (pinned) ───────────────────── */}
      <View style={[styles.actions, { backgroundColor: t.background }]}>
        <Button
          title={isEditing ? 'Save Changes' : 'Create Habit'}
          onPress={handleSave}
          disabled={!name.trim() || saving}
          loading={saving}
        />
        <Button
          title="Cancel"
          variant="secondary"
          onPress={() => router.back()}
          disabled={saving}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconSelectedBadge: {
    fontWeight: '700',
  },
  categoryScroll: {
    gap: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
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

  // Switch card
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: radius.lg,
  },

  // Adaptive styles
  slotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  slotChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tierInputCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tierInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tierTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    width: 84,
    alignItems: 'center',
  },
  tierTextInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 4,
  },
  tierDivider: {
    height: 1,
  },

  // Actions
  actions: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
});
