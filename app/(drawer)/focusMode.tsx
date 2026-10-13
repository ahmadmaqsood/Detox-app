import { type DrawerNavigationProp } from "@react-navigation/drawer";
import * as Haptics from "expo-haptics";
import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { PlatformSymbol } from "@/components/PlatformSymbol";
import { Body, Caption, Heading } from "@/components/Typography";
import { todayISO } from "@/lib/dateUtils";
import {
  ABANDON_REASONS,
  CATEGORY_INFO,
  DURATION_GRID,
  FOCUS_PRESETS,
  addDeepWorkTask,
  clearActiveSession,
  deleteDeepWorkTask,
  getActiveSession,
  getDeepWorkDailyTargetMinutes,
  getDeepWorkSessions,
  getDeepWorkTasks,
  getDeepWorkWeeklySummary,
  getLastDeepWorkSession,
  saveActiveSession,
  saveDeepWorkSession,
  scheduleFocusCompleteNotification,
  setDeepWorkDailyTargetMinutes,
  toggleDeepWorkTask,
  type ActiveDeepWorkSession,
} from "@/lib/deepWorkService";
import { getMetrics } from "@/lib/firestoreDatabase";
import { useFocusLock } from "@/store/FocusContext";
import { useAppTheme } from "@/theme";
import { radius, spacing } from "@/theme/spacing";
import type {
  DeepWorkAbandonReason,
  DeepWorkCategory,
  DeepWorkSession,
  DeepWorkTask,
  DeepWorkTaskType,
} from "@/lib/types";

type ViewTab = "plan" | "timer" | "report";

function addDays(iso: string, delta: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function getDayLetter(iso: string): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[new Date(iso + "T12:00:00").getDay()];
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DeepWorkFocusScreen() {
  const t = useAppTheme();
  const insets = useSafeAreaInsets();
  const nav = useNavigation<DrawerNavigationProp<any>>();
  const today = todayISO();

  // Tab State
  const [activeTab, setActiveTab] = useState<ViewTab>("plan");
  const [selectedDate, setSelectedDate] = useState(today);

  // Data State
  const [tasks, setTasks] = useState<DeepWorkTask[]>([]);
  const [sessions, setSessions] = useState<DeepWorkSession[]>([]);
  const [lastSession, setLastSession] = useState<DeepWorkSession | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<{ date: string; minutes: number }[]>([]);
  const [dailyTarget, setDailyTarget] = useState(120);
  const [stepsToday, setStepsToday] = useState(0);
  const [sleepMinutesToday, setSleepMinutesToday] = useState(0);

  // Timer State
  const [activeTaskId, setActiveTaskId] = useState<string | number | null>(null);
  const [activeTaskTitle, setActiveTaskTitle] = useState("Deep Work Focus");
  const [activeCategory, setActiveCategory] = useState<DeepWorkCategory>("programming");
  const [selectedDuration, setSelectedDuration] = useState<number>(25);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [totalSessionSeconds, setTotalSessionSeconds] = useState(25 * 60);
  const [interruptions, setInterruptions] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<string>("");

  // Modals
  const [addTaskModal, setAddTaskModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<DeepWorkCategory>("programming");
  const [newTaskType, setNewTaskType] = useState<DeepWorkTaskType>("todo");
  const [newTaskEventTime, setNewTaskEventTime] = useState("11:00 am");

  const [abandonModal, setAbandonModal] = useState(false);
  const [targetModal, setTargetModal] = useState(false);
  const [targetInput, setTargetInput] = useState("120");

  const timerRef = useRef<any>(null);

  // Load screen data
  const load = useCallback(async () => {
    const [taskList, sessionList, weekly, target, metrics, lastSess] = await Promise.all([
      getDeepWorkTasks(selectedDate),
      getDeepWorkSessions(selectedDate),
      getDeepWorkWeeklySummary(selectedDate),
      getDeepWorkDailyTargetMinutes(),
      getMetrics(today),
      getLastDeepWorkSession(),
    ]);

    setTasks(taskList);
    setSessions(sessionList);
    setWeeklyReport(weekly);
    setDailyTarget(target);
    setTargetInput(String(target));
    setLastSession(lastSess);

    if (metrics) {
      if (metrics.steps != null) setStepsToday(metrics.steps);
      if (metrics.sleepMinutes != null) setSleepMinutesToday(metrics.sleepMinutes);
    }

    // Check if active session was saved in storage
    const stored = await getActiveSession();
    if (stored && !isRunning) {
      setActiveTaskId(stored.taskId);
      setActiveTaskTitle(stored.taskTitle);
      setActiveCategory(stored.category);
      setSelectedDuration(stored.durationMinutes);
      setTotalSessionSeconds(stored.durationMinutes * 60);
      setRemainingSeconds(stored.remainingSeconds);
      setIsPaused(stored.isPaused);
      setInterruptions(stored.interruptionCount);
      setIsRunning(true);
    }
  }, [selectedDate, today, isRunning]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Interval loop for timer
  useEffect(() => {
    if (isRunning && !isPaused) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            handleCompleteSession();
            return 0;
          }
          const next = prev - 1;
          // save state in storage periodically
          if (next % 15 === 0) {
            saveActiveSession({
              taskId: activeTaskId,
              taskTitle: activeTaskTitle,
              category: activeCategory,
              durationMinutes: selectedDuration,
              startedAtTimestamp: Date.now(),
              isPaused: false,
              remainingSeconds: next,
              interruptionCount: interruptions,
            });
          }
          return next;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, isPaused, activeTaskId, activeTaskTitle, activeCategory, selectedDuration, interruptions]);

  // Start timer
  const handleStartTimer = async (
    durationMinutes: number = selectedDuration,
    taskId?: string | number,
    taskTitle?: string,
    category?: DeepWorkCategory,
  ) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const durSec = durationMinutes * 60;
    const title = taskTitle ?? activeTaskTitle;
    const cat = category ?? activeCategory;
    const tid = taskId !== undefined ? taskId : activeTaskId;

    setSelectedDuration(durationMinutes);
    setTotalSessionSeconds(durSec);
    setRemainingSeconds(durSec);
    setActiveTaskId(tid);
    setActiveTaskTitle(title);
    setActiveCategory(cat);
    setIsRunning(true);
    setIsPaused(false);
    setInterruptions(0);
    setSessionStartTime(new Date().toISOString());
    setActiveTab("timer");

    await scheduleFocusCompleteNotification(title, durationMinutes);
    await saveActiveSession({
      taskId: tid,
      taskTitle: title,
      category: cat,
      durationMinutes,
      startedAtTimestamp: Date.now(),
      isPaused: false,
      remainingSeconds: durSec,
      interruptionCount: 0,
    });
  };

  const handlePauseResume = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsPaused((p) => {
      const next = !p;
      saveActiveSession({
        taskId: activeTaskId,
        taskTitle: activeTaskTitle,
        category: activeCategory,
        durationMinutes: selectedDuration,
        startedAtTimestamp: Date.now(),
        isPaused: next,
        remainingSeconds,
        interruptionCount: interruptions,
      });
      return next;
    });
  };

  const handleLogInterruption = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInterruptions((prev) => prev + 1);
  };

  const handleCompleteSession = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsRunning(false);
    setIsPaused(false);
    await clearActiveSession();

    await saveDeepWorkSession({
      taskId: activeTaskId,
      taskTitle: activeTaskTitle,
      category: activeCategory,
      scheduledMinutes: selectedDuration,
      actualMinutes: selectedDuration,
      status: "completed",
      interruptionCount: interruptions,
      date: today,
      startedAt: sessionStartTime || new Date().toISOString(),
      endedAt: new Date().toISOString(),
    });

    Alert.alert(
      "🎯 Deep Work Completed!",
      `You crushed ${selectedDuration} minutes of focused deep work on "${activeTaskTitle}". Excellent discipline!`,
      [{ text: "Great!" }],
    );

    await load();
  };

  const handleAbandonSession = async (reason: DeepWorkAbandonReason) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setIsRunning(false);
    setIsPaused(false);
    await clearActiveSession();
    setAbandonModal(false);

    const actualMins = Math.max(1, Math.round((totalSessionSeconds - remainingSeconds) / 60));

    await saveDeepWorkSession({
      taskId: activeTaskId,
      taskTitle: activeTaskTitle,
      category: activeCategory,
      scheduledMinutes: selectedDuration,
      actualMinutes: actualMins,
      status: "abandoned",
      abandonReason: reason,
      interruptionCount: interruptions,
      date: today,
      startedAt: sessionStartTime || new Date().toISOString(),
      endedAt: new Date().toISOString(),
    });

    Alert.alert(
      "Session Logged",
      `Logged ${actualMins} minutes before interruption. Reflection helps you safeguard future sessions.`,
      [{ text: "Got it" }],
    );

    await load();
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await addDeepWorkTask({
      title: newTaskTitle.trim(),
      category: newTaskCategory,
      type: newTaskType,
      eventTime: newTaskType === "event" ? newTaskEventTime : undefined,
      date: selectedDate,
      targetMinutes: 25,
    });
    setNewTaskTitle("");
    setAddTaskModal(false);
    load();
  };

  const handleToggleTask = async (task: DeepWorkTask) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleDeepWorkTask(task.id, task.completed === 0);
    load();
  };

  const handleDeleteTask = async (id: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    await deleteDeepWorkTask(id);
    load();
  };

  const handleSaveDailyTarget = async () => {
    const val = parseInt(targetInput, 10);
    if (!Number.isNaN(val) && val > 0) {
      setDailyTarget(val);
      await setDeepWorkDailyTargetMinutes(val);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTargetModal(false);
    load();
  };

  // Calculations
  const todayFocusedMinutes = useMemo(() => {
    return sessions.reduce((acc, s) => acc + s.actualMinutes, 0);
  }, [sessions]);

  const targetProgressPct = Math.min(100, Math.round((todayFocusedMinutes / (dailyTarget || 120)) * 100));

  const timerProgressPct = useMemo(() => {
    if (totalSessionSeconds <= 0) return 0;
    return Math.max(0, Math.min(1, (totalSessionSeconds - remainingSeconds) / totalSessionSeconds));
  }, [totalSessionSeconds, remainingSeconds]);

  // Calendar dates (past 3 days + today + next 3 days)
  const calendarDates = useMemo(() => {
    const dates: { iso: string; dayLetter: string; dayNum: number; isToday: boolean }[] = [];
    for (let i = -3; i <= 3; i++) {
      const d = addDays(today, i);
      const parts = d.split("-");
      dates.push({
        iso: d,
        dayLetter: getDayLetter(d),
        dayNum: parseInt(parts[2], 10),
        isToday: d === today,
      });
    }
    return dates;
  }, [today]);

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      {/* ─── Top Header (Matching Screenshot 1 & 2) ─────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              nav.openDrawer();
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
          <View style={{ marginLeft: spacing.sm }}>
            <Heading variant="title3">Deep Work</Heading>
            <Caption variant="caption2" color={t.textMuted}>
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })}
            </Caption>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setTargetModal(true)}
            style={[styles.targetPill, { backgroundColor: t.card }]}
          >
            <PlatformSymbol
              ios="target"
              material="track-changes"
              tintColor={t.accent}
              size={14}
            />
            <Caption variant="caption2" color={t.accent} style={{ fontWeight: "700" }}>
              {todayFocusedMinutes}/{dailyTarget}m
            </Caption>
          </Pressable>

          <Pressable
            onPress={() => setAddTaskModal(true)}
            style={[styles.addCircleBtn, { backgroundColor: t.accent }]}
            hitSlop={8}
          >
            <PlatformSymbol ios="plus" material="add" tintColor="#fff" size={18} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Tab 1: PLAN & SCHEDULE (Screenshot 2) ─────────── */}
        {activeTab === "plan" && (
          <Animated.View entering={FadeIn.duration(300)}>
            {/* Vitals Summary Pill Row (Screenshot 1: 5.2k steps, 7h 35m sleep) */}
            <View style={[styles.vitalsRow, { backgroundColor: t.card }]}>
              <View style={styles.vitalCol}>
                <PlatformSymbol
                  ios="figure.walk"
                  material="directions-walk"
                  tintColor={t.accent}
                  size={16}
                />
                <Body variant="bodyMedium" style={{ fontWeight: "700" }}>
                  {stepsToday >= 1000 ? `${(stepsToday / 1000).toFixed(1)}k` : stepsToday} steps
                </Body>
              </View>
              <View style={[styles.vitalsDivider, { backgroundColor: t.border }]} />
              <View style={styles.vitalCol}>
                <PlatformSymbol
                  ios="moon.stars.fill"
                  material="bedtime"
                  tintColor="#A78BFA"
                  size={15}
                />
                <Body variant="bodyMedium" style={{ fontWeight: "700" }}>
                  {sleepMinutesToday > 0 ? `${Math.floor(sleepMinutesToday / 60)}h ${sleepMinutesToday % 60}m` : "7h 35m"} sleep
                </Body>
              </View>
            </View>

            {/* Horizontal Day Calendar Strip (Screenshot 2) */}
            <View style={styles.calendarStrip}>
              {calendarDates.map((item) => {
                const isSelected = item.iso === selectedDate;
                return (
                  <Pressable
                    key={item.iso}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedDate(item.iso);
                    }}
                    style={[
                      styles.calendarDayCard,
                      {
                        backgroundColor: isSelected ? t.accent : t.card,
                        borderColor: isSelected ? t.accent : t.border,
                      },
                    ]}
                  >
                    <Caption
                      variant="caption2"
                      color={isSelected ? "#fff" : t.textMuted}
                      style={{ fontWeight: "600" }}
                    >
                      {item.dayLetter}
                    </Caption>
                    <Heading
                      variant="title3"
                      color={isSelected ? "#fff" : t.textPrimary}
                      style={{ marginTop: 2 }}
                    >
                      {item.dayNum}
                    </Heading>
                    {item.isToday && (
                      <View
                        style={[
                          styles.todayDot,
                          { backgroundColor: isSelected ? "#fff" : t.accent },
                        ]}
                      />
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Daily Goal Banner */}
            <View style={[styles.targetBanner, { backgroundColor: t.card }]}>
              <View style={styles.targetBannerTop}>
                <Body variant="headline">Daily Deep Work Progress</Body>
                <Heading variant="title3" color={t.accent}>
                  {targetProgressPct}%
                </Heading>
              </View>
              <View style={[styles.targetTrack, { backgroundColor: t.background }]}>
                <View
                  style={[
                    styles.targetFill,
                    { width: `${targetProgressPct}%`, backgroundColor: t.accent },
                  ]}
                />
              </View>
              <Caption variant="caption2" color={t.textMuted}>
                {todayFocusedMinutes} min completed • {Math.max(0, dailyTarget - todayFocusedMinutes)} min remaining
              </Caption>
            </View>

            {/* Last Deep Work & Focus Session Banner */}
            {lastSession && (
              <Animated.View entering={FadeIn.duration(250)} style={{ marginBottom: spacing.md }}>
                <View style={styles.sectionHeaderRow}>
                  <Heading variant="title3">LAST FOCUS SESSION</Heading>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          lastSession.status === "completed" ? "#10B98122" : "#F59E0B22",
                      },
                    ]}
                  >
                    <Caption
                      variant="caption2"
                      color={lastSession.status === "completed" ? "#10B981" : "#F59E0B"}
                      style={{ fontWeight: "700" }}
                    >
                      {lastSession.status === "completed" ? "✓ Completed" : "⚠️ Interrupted"}
                    </Caption>
                  </View>
                </View>

                <Card
                  style={[
                    styles.lastSessionCard,
                    {
                      borderColor:
                        lastSession.status === "completed"
                          ? "#10B98144"
                          : "#F59E0B44",
                    },
                  ]}
                >
                  <View style={styles.lastSessionTop}>
                    <View
                      style={[
                        styles.catIconCircle,
                        {
                          backgroundColor:
                            (CATEGORY_INFO[lastSession.category] || CATEGORY_INFO.other).color + "22",
                        },
                      ]}
                    >
                      <PlatformSymbol
                        ios={(CATEGORY_INFO[lastSession.category] || CATEGORY_INFO.other).iconIos}
                        material={(CATEGORY_INFO[lastSession.category] || CATEGORY_INFO.other).iconMaterial}
                        tintColor={(CATEGORY_INFO[lastSession.category] || CATEGORY_INFO.other).color}
                        size={18}
                      />
                    </View>

                    <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                      <Body variant="headline" numberOfLines={1}>
                        {lastSession.taskTitle}
                      </Body>
                      <Caption variant="caption2" color={t.textMuted}>
                        {(CATEGORY_INFO[lastSession.category] || CATEGORY_INFO.other).label} •{" "}
                        {lastSession.actualMinutes} min focus
                        {lastSession.interruptionCount > 0
                          ? ` • ${lastSession.interruptionCount} interruptions`
                          : ""}
                      </Caption>
                    </View>

                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        setActiveTaskId(lastSession.taskId ?? null);
                        setActiveTaskTitle(lastSession.taskTitle);
                        setActiveCategory(lastSession.category);
                        setSelectedDuration(lastSession.scheduledMinutes || 25);
                        setActiveTab("timer");
                      }}
                      style={[
                        styles.repeatButton,
                        { backgroundColor: t.accent + "18", borderColor: t.accent + "44" },
                      ]}
                    >
                      <PlatformSymbol
                        ios="arrow.clockwise"
                        material="replay"
                        tintColor={t.accent}
                        size={13}
                      />
                      <Caption
                        variant="caption2"
                        color={t.accent}
                        style={{ fontWeight: "700", marginLeft: 4 }}
                      >
                        Repeat
                      </Caption>
                    </Pressable>
                  </View>

                  <View style={[styles.lastSessionBottom, { borderTopColor: t.border }]}>
                    <Caption variant="caption2" color={t.textMuted}>
                      Ended{" "}
                      {lastSession.endedAt
                        ? new Date(lastSession.endedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "recently"}{" "}
                      • {lastSession.date}
                    </Caption>
                    {lastSession.status === "abandoned" && lastSession.abandonReason && (
                      <Caption variant="caption2" color="#F59E0B" style={{ fontWeight: "600" }}>
                        Reason: {lastSession.abandonReason.replace("_", " ")}
                      </Caption>
                    )}
                  </View>
                </Card>
              </Animated.View>
            )}

            {/* Task List (Screenshot 1 & 2) */}
            <View style={styles.sectionHeaderRow}>
              <Heading variant="title3">Tasks & Schedule</Heading>
              <Caption variant="caption2" color={t.textMuted}>
                {tasks.length} items
              </Caption>
            </View>

            <View style={styles.taskList}>
              {tasks.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <PlatformSymbol
                    ios="sparkles"
                    material="bolt"
                    tintColor={t.textMuted}
                    size={28}
                  />
                  <Body variant="body" color={t.textMuted} style={{ textAlign: "center" }}>
                    No planned tasks for this day. Tap + to add a To-Do or timed Event.
                  </Body>
                </Card>
              ) : (
                tasks.map((task, idx) => {
                  const isDone = task.completed === 1;
                  const isEvent = task.type === "event";
                  const catInfo = CATEGORY_INFO[task.category] || CATEGORY_INFO.other;

                  return (
                    <Animated.View
                      key={task.id}
                      entering={FadeInDown.delay(idx * 30).duration(200)}
                    >
                      <View
                        style={[
                          styles.taskCard,
                          {
                            backgroundColor: isEvent ? "#EDE9FE" : t.card,
                            borderColor: isEvent ? "#C4B5FD" : t.border,
                          },
                        ]}
                      >
                        {/* Checkbox (for To-Dos) or Calendar Icon (for Events) */}
                        {isEvent ? (
                          <View style={[styles.eventIconWrap, { backgroundColor: "#DDD6FE" }]}>
                            <PlatformSymbol
                              ios="calendar"
                              material="event"
                              tintColor="#7C3AED"
                              size={16}
                            />
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => handleToggleTask(task)}
                            style={[
                              styles.checkCircle,
                              {
                                borderColor: isDone ? t.accent : t.border,
                                backgroundColor: isDone ? t.accent : "transparent",
                              },
                            ]}
                            hitSlop={8}
                          >
                            {isDone && (
                              <PlatformSymbol
                                ios="checkmark"
                                material="check"
                                tintColor="#fff"
                                size={12}
                              />
                            )}
                          </Pressable>
                        )}

                        {/* Title & Metadata */}
                        <View style={styles.taskTextCol}>
                          <Body
                            variant="bodyMedium"
                            color={isEvent ? "#4C1D95" : t.textPrimary}
                            style={[
                              { fontWeight: "600" },
                              isDone && !isEvent && styles.taskDoneText,
                            ]}
                          >
                            {task.title}
                          </Body>
                          <View style={styles.taskSubRow}>
                            <Caption
                              variant="caption2"
                              color={isEvent ? "#6D28D9" : catInfo.color}
                              style={{ fontWeight: "600" }}
                            >
                              {catInfo.label}
                            </Caption>
                            {task.completedMinutes > 0 && (
                              <Caption variant="caption2" color={t.textMuted}>
                                • {task.completedMinutes}m focused
                              </Caption>
                            )}
                          </View>
                        </View>

                        {/* Right side: Event Time pill OR Quick Focus Button */}
                        {isEvent ? (
                          <View style={styles.eventTimePill}>
                            <Caption variant="caption2" color="#6D28D9" style={{ fontWeight: "700" }}>
                              {task.eventTime || "11:00 am"}
                            </Caption>
                          </View>
                        ) : (
                          <Pressable
                            onPress={() => handleStartTimer(25, task.id, task.title, task.category)}
                            style={[styles.taskFocusPlayBtn, { backgroundColor: t.accent + "18" }]}
                            hitSlop={8}
                          >
                            <PlatformSymbol
                              ios="play.fill"
                              material="play-arrow"
                              tintColor={t.accent}
                              size={14}
                            />
                            <Caption variant="caption2" color={t.accent} style={{ fontWeight: "700" }}>
                              Focus
                            </Caption>
                          </Pressable>
                        )}
                      </View>
                    </Animated.View>
                  );
                })
              )}
            </View>
          </Animated.View>
        )}

        {/* ─── Tab 2: FOCUS TIMER (Screenshot 1) ─────────────── */}
        {activeTab === "timer" && (
          <Animated.View entering={FadeIn.duration(300)}>
            {/* If Timer is running or paused */}
            {isRunning ? (
              <View style={[styles.timerRunningCard, { backgroundColor: t.card }]}>
                {/* Active Task Name */}
                <View style={styles.activeTaskBadge}>
                  <PlatformSymbol
                    ios={CATEGORY_INFO[activeCategory].iconIos}
                    material={CATEGORY_INFO[activeCategory].iconMaterial}
                    tintColor={CATEGORY_INFO[activeCategory].color}
                    size={16}
                  />
                  <Body variant="bodyMedium" color={t.textPrimary} style={{ fontWeight: "700" }}>
                    {activeTaskTitle}
                  </Body>
                </View>

                {/* Minimalist Circular Countdown Dial (Screenshot 1) */}
                <View style={styles.dialContainer}>
                  <View style={[styles.dialCircleTrack, { borderColor: t.borderLight }]}>
                    <View
                      style={[
                        styles.dialArcFill,
                        {
                          borderColor: t.accent,
                          transform: [
                            { rotate: `${Math.round(timerProgressPct * 360)}deg` },
                          ],
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.dialCenterContent}>
                    <Heading variant="largeTitle" color={t.textPrimary} style={styles.dialDigits}>
                      {formatSeconds(remainingSeconds)}
                    </Heading>
                    <Caption variant="caption1" color={t.textMuted} style={styles.dialSubtitle}>
                      {isPaused ? "paused" : "just focus"}
                    </Caption>
                  </View>
                </View>

                {/* Interruption tracker badge */}
                <View style={styles.interruptionStrip}>
                  <Caption variant="caption2" color={t.textMuted}>
                    ⚡ Interruptions: <Caption variant="caption2" color={interruptions > 0 ? t.danger : t.accent} style={{ fontWeight: "700" }}>{interruptions}</Caption>
                  </Caption>
                  <Pressable
                    onPress={handleLogInterruption}
                    style={[styles.logDistractionBtn, { backgroundColor: t.background }]}
                  >
                    <Caption variant="caption2" color={t.textSecondary}>
                      + Log Distraction
                    </Caption>
                  </Pressable>
                </View>

                {/* Controls (Stop & Pause/Play - Screenshot 1) */}
                <View style={styles.timerControlsRow}>
                  {/* Stop / Abandon Button */}
                  <Pressable
                    onPress={() => setAbandonModal(true)}
                    style={[styles.controlSquareBtn, { backgroundColor: t.background }]}
                  >
                    <PlatformSymbol
                      ios="stop.fill"
                      material="stop"
                      tintColor={t.danger}
                      size={20}
                    />
                  </Pressable>

                  {/* Pause / Resume Button */}
                  <Pressable
                    onPress={handlePauseResume}
                    style={[styles.controlRoundBtn, { backgroundColor: t.accent }]}
                  >
                    <PlatformSymbol
                      ios={isPaused ? "play.fill" : "pause.fill"}
                      material={isPaused ? "play-arrow" : "pause"}
                      tintColor="#fff"
                      size={26}
                    />
                  </Pressable>
                </View>
              </View>
            ) : (
              /* Idle Timer Setup: Choose Task & Duration Grid (Screenshot 1) */
              <View>
                <Card style={{ marginBottom: spacing.lg }}>
                  <Caption variant="caption2" color={t.textMuted} style={{ marginBottom: 4 }}>
                    TARGET SINGLE-TASK FOCUS
                  </Caption>
                  <TextInput
                    value={activeTaskTitle}
                    onChangeText={setActiveTaskTitle}
                    placeholder="What will you focus on?"
                    placeholderTextColor={t.textMuted}
                    style={[styles.taskInput, { color: t.textPrimary, borderColor: t.border }]}
                  />

                  {/* Category Chips */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
                    {(["programming", "learning", "reading", "work"] as DeepWorkCategory[]).map((cat) => {
                      const sel = activeCategory === cat;
                      const cInfo = CATEGORY_INFO[cat];
                      return (
                        <Pressable
                          key={cat}
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setActiveCategory(cat);
                          }}
                          style={[
                            styles.categoryChip,
                            {
                              backgroundColor: sel ? cInfo.color + "25" : t.background,
                              borderColor: sel ? cInfo.color : t.border,
                            },
                          ]}
                        >
                          <PlatformSymbol
                            ios={cInfo.iconIos}
                            material={cInfo.iconMaterial}
                            tintColor={sel ? cInfo.color : t.textMuted}
                            size={14}
                          />
                          <Caption
                            variant="caption2"
                            color={sel ? cInfo.color : t.textMuted}
                            style={{ fontWeight: sel ? "700" : "500" }}
                          >
                            {cInfo.label}
                          </Caption>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </Card>

                {/* Duration Presets Title (Screenshot 1: "TRACK YOUR FOCUS TIME") */}
                <View style={styles.sectionHeaderRow}>
                  <Heading variant="title3">TRACK YOUR FOCUS TIME</Heading>
                  <Caption variant="caption2" color={t.textMuted}>
                    Select session length
                  </Caption>
                </View>

                {/* Duration Grid (Screenshot 1) */}
                <View style={styles.durationGrid}>
                  {DURATION_GRID.map((mins) => {
                    const sel = selectedDuration === mins;
                    return (
                      <Pressable
                        key={mins}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          setSelectedDuration(mins);
                        }}
                        style={[
                          styles.durationTile,
                          {
                            backgroundColor: sel ? t.accent + "18" : t.card,
                            borderColor: sel ? t.accent : t.border,
                          },
                        ]}
                      >
                        <Heading
                          variant="largeTitle"
                          color={sel ? t.accent : t.textPrimary}
                          style={styles.durationNumber}
                        >
                          {mins}
                        </Heading>
                        <Caption variant="caption2" color={t.textMuted}>
                          min
                        </Caption>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Start Focus Button */}
                <View style={{ marginTop: spacing.xl }}>
                  <Button
                    title={`Start ${selectedDuration} min Session`}
                    onPress={() => handleStartTimer(selectedDuration)}
                  />
                </View>

                {/* Last Session summary on Timer tab */}
                {lastSession && (
                  <View style={{ marginTop: spacing.xl }}>
                    <View style={styles.sectionHeaderRow}>
                      <Heading variant="title3">PREVIOUS FOCUS SESSION</Heading>
                      <Caption variant="caption2" color={t.textMuted}>
                        {lastSession.date}
                      </Caption>
                    </View>
                    <Card style={[styles.lastSessionCard, { borderColor: t.border }]}>
                      <View style={styles.lastSessionTop}>
                        <View
                          style={[
                            styles.catIconCircle,
                            {
                              backgroundColor:
                                (CATEGORY_INFO[lastSession.category] || CATEGORY_INFO.other).color + "22",
                            },
                          ]}
                        >
                          <PlatformSymbol
                            ios={(CATEGORY_INFO[lastSession.category] || CATEGORY_INFO.other).iconIos}
                            material={(CATEGORY_INFO[lastSession.category] || CATEGORY_INFO.other).iconMaterial}
                            tintColor={(CATEGORY_INFO[lastSession.category] || CATEGORY_INFO.other).color}
                            size={18}
                          />
                        </View>
                        <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                          <Body variant="headline" numberOfLines={1}>
                            {lastSession.taskTitle}
                          </Body>
                          <Caption variant="caption2" color={t.textMuted}>
                            {lastSession.actualMinutes}m logged • {lastSession.status === "completed" ? "✓ Completed" : "⚠️ Interrupted"}
                          </Caption>
                        </View>
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setActiveTaskId(lastSession.taskId ?? null);
                            setActiveTaskTitle(lastSession.taskTitle);
                            setActiveCategory(lastSession.category);
                            setSelectedDuration(lastSession.scheduledMinutes || 25);
                          }}
                          style={[
                            styles.repeatButton,
                            { backgroundColor: t.accent + "18", borderColor: t.accent + "44" },
                          ]}
                        >
                          <PlatformSymbol
                            ios="arrow.clockwise"
                            material="replay"
                            tintColor={t.accent}
                            size={13}
                          />
                          <Caption
                            variant="caption2"
                            color={t.accent}
                            style={{ fontWeight: "700", marginLeft: 4 }}
                          >
                            Load
                          </Caption>
                        </Pressable>
                      </View>
                    </Card>
                  </View>
                )}
              </View>
            )}
          </Animated.View>
        )}

        {/* ─── Tab 3: WEEKLY REPORT & ANALYTICS ──────────────── */}
        {activeTab === "report" && (
          <Animated.View entering={FadeIn.duration(300)}>
            {/* Target Progress Card */}
            <Card style={{ marginBottom: spacing.lg }}>
              <Heading variant="title3">Deep Work Weekly Report</Heading>
              <Caption variant="caption2" color={t.textMuted} style={{ marginTop: 2 }}>
                High-intensity cognitive output history
              </Caption>

              {/* 7-Day Chart */}
              <View style={styles.reportChartRow}>
                {weeklyReport.map((item) => {
                  const maxMins = Math.max(...weeklyReport.map((w) => w.minutes), dailyTarget);
                  const pct = maxMins > 0 ? (item.minutes / maxMins) * 100 : 0;
                  const isCur = item.date === selectedDate;

                  return (
                    <View key={item.date} style={styles.reportCol}>
                      {isCur && item.minutes > 0 && (
                        <View style={[styles.reportBadgePill, { backgroundColor: t.accent }]}>
                          <Caption variant="caption2" color="#fff" style={{ fontSize: 9, fontWeight: "700" }}>
                            {item.minutes}m
                          </Caption>
                        </View>
                      )}
                      <View style={[styles.reportTrack, { backgroundColor: t.background }]}>
                        <View
                          style={[
                            styles.reportBar,
                            {
                              height: `${Math.max(6, Math.min(100, Math.round(pct)))}%`,
                              backgroundColor: isCur ? t.accent : t.borderLight,
                            },
                          ]}
                        />
                      </View>
                      <Caption variant="caption2" color={isCur ? t.accent : t.textMuted} style={{ marginTop: 4, fontWeight: isCur ? "700" : "500" }}>
                        {getDayLetter(item.date)}
                      </Caption>
                    </View>
                  );
                })}
              </View>
            </Card>

            {/* Last Completed Focus Session Highlight */}
            {lastSession && (
              <View style={{ marginBottom: spacing.lg }}>
                <View style={styles.sectionHeaderRow}>
                  <Heading variant="title3">LAST RECORDED SESSION</Heading>
                  <Caption variant="caption2" color={t.textMuted}>
                    Most Recent
                  </Caption>
                </View>
                <Card
                  style={[
                    styles.lastSessionCard,
                    {
                      borderColor:
                        lastSession.status === "completed"
                          ? "#10B98155"
                          : "#F59E0B55",
                    },
                  ]}
                >
                  <View style={styles.lastSessionTop}>
                    <View
                      style={[
                        styles.catIconCircle,
                        {
                          backgroundColor:
                            (CATEGORY_INFO[lastSession.category] || CATEGORY_INFO.other).color + "22",
                        },
                      ]}
                    >
                      <PlatformSymbol
                        ios={(CATEGORY_INFO[lastSession.category] || CATEGORY_INFO.other).iconIos}
                        material={(CATEGORY_INFO[lastSession.category] || CATEGORY_INFO.other).iconMaterial}
                        tintColor={(CATEGORY_INFO[lastSession.category] || CATEGORY_INFO.other).color}
                        size={18}
                      />
                    </View>
                    <View style={{ flex: 1, marginHorizontal: spacing.sm }}>
                      <Body variant="headline" numberOfLines={1}>
                        {lastSession.taskTitle}
                      </Body>
                      <Caption variant="caption2" color={t.textMuted}>
                        {(CATEGORY_INFO[lastSession.category] || CATEGORY_INFO.other).label} •{" "}
                        {lastSession.actualMinutes}m / {lastSession.scheduledMinutes}m
                      </Caption>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            lastSession.status === "completed" ? "#10B98122" : "#F59E0B22",
                        },
                      ]}
                    >
                      <Caption
                        variant="caption2"
                        color={lastSession.status === "completed" ? "#10B981" : "#F59E0B"}
                        style={{ fontWeight: "700" }}
                      >
                        {lastSession.status === "completed" ? "✓ Completed" : "⚠️ Abandoned"}
                      </Caption>
                    </View>
                  </View>
                  <View style={[styles.lastSessionBottom, { borderTopColor: t.border }]}>
                    <Caption variant="caption2" color={t.textMuted}>
                      {lastSession.date} •{" "}
                      {lastSession.endedAt
                        ? new Date(lastSession.endedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}{" "}
                      • {lastSession.interruptionCount} interruptions
                    </Caption>
                  </View>
                </Card>
              </View>
            )}

            {/* Sessions Log History */}
            <View style={styles.sectionHeaderRow}>
              <Heading variant="title3">Session History ({sessions.length})</Heading>
              <Caption variant="caption2" color={t.textMuted}>
                {todayFocusedMinutes}m total
              </Caption>
            </View>

            <View style={styles.sessionList}>
              {sessions.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <Caption color={t.textMuted}>No recorded sessions today.</Caption>
                </Card>
              ) : (
                sessions.map((sess) => {
                  const isDone = sess.status === "completed";
                  const cat = CATEGORY_INFO[sess.category] || CATEGORY_INFO.other;
                  return (
                    <Card key={sess.id} style={styles.sessionCard}>
                      <View style={styles.sessionCardTop}>
                        <View style={{ flex: 1 }}>
                          <Body variant="headline">{sess.taskTitle}</Body>
                          <Caption variant="caption2" color={cat.color}>
                            {cat.label} • {sess.actualMinutes}m of {sess.scheduledMinutes}m
                          </Caption>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: isDone ? "#10B98120" : "#EF444420" },
                          ]}
                        >
                          <Caption
                            variant="caption2"
                            color={isDone ? "#10B981" : "#EF4444"}
                            style={{ fontWeight: "700" }}
                          >
                            {isDone ? "COMPLETED" : "ABANDONED"}
                          </Caption>
                        </View>
                      </View>
                      {sess.abandonReason && (
                        <Caption variant="caption2" color={t.danger} style={{ marginTop: 4 }}>
                          Interrupted by: {sess.abandonReason}
                        </Caption>
                      )}
                    </Card>
                  );
                })
              )}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* ─── Bottom Floating Navigation Pill Bar (Screenshots 1 & 2) ─── */}
      <View style={[styles.bottomBarWrap, { paddingBottom: insets.bottom + spacing.xs }]}>
        <View style={[styles.bottomPillBar, { backgroundColor: t.card, borderColor: t.border }]}>
          {/* Plan Tab */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab("plan");
            }}
            style={[
              styles.navTabBtn,
              activeTab === "plan" && { backgroundColor: t.background },
            ]}
          >
            <PlatformSymbol
              ios="checklist"
              material="task-alt"
              tintColor={activeTab === "plan" ? t.accent : t.textMuted}
              size={16}
            />
            <Caption
              variant="caption2"
              color={activeTab === "plan" ? t.textPrimary : t.textMuted}
              style={{ fontWeight: activeTab === "plan" ? "700" : "500" }}
            >
              Plan
            </Caption>
          </Pressable>

          {/* Timer Tab */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab("timer");
            }}
            style={[
              styles.navTabBtn,
              activeTab === "timer" && { backgroundColor: t.background },
            ]}
          >
            <PlatformSymbol
              ios="clock.fill"
              material="timer"
              tintColor={activeTab === "timer" ? t.accent : t.textMuted}
              size={16}
            />
            <Caption
              variant="caption2"
              color={activeTab === "timer" ? t.textPrimary : t.textMuted}
              style={{ fontWeight: activeTab === "timer" ? "700" : "500" }}
            >
              {isRunning ? formatSeconds(remainingSeconds) : "Timer"}
            </Caption>
          </Pressable>

          {/* Report Tab */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab("report");
            }}
            style={[
              styles.navTabBtn,
              activeTab === "report" && { backgroundColor: t.background },
            ]}
          >
            <PlatformSymbol
              ios="chart.bar.fill"
              material="bar-chart"
              tintColor={activeTab === "report" ? t.accent : t.textMuted}
              size={16}
            />
            <Caption
              variant="caption2"
              color={activeTab === "report" ? t.textPrimary : t.textMuted}
              style={{ fontWeight: activeTab === "report" ? "700" : "500" }}
            >
              Report
            </Caption>
          </Pressable>

          {/* Plus Add Button inside pill */}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setAddTaskModal(true);
            }}
            style={[styles.navPlusBtn, { backgroundColor: t.accent }]}
            hitSlop={8}
          >
            <PlatformSymbol ios="plus" material="add" tintColor="#fff" size={16} />
          </Pressable>
        </View>
      </View>

      {/* ─── Modal: Add To-Do or Event (Screenshot 2) ───────── */}
      <Modal visible={addTaskModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: t.card }]}>
            <Heading variant="title3">Create Plan Item</Heading>
            <Caption variant="caption2" color={t.textMuted} style={{ marginBottom: spacing.md }}>
              Add a To-Do item or a scheduled Event
            </Caption>

            {/* Type selector: To-Do vs Event */}
            <View style={styles.typeSelectorRow}>
              <Pressable
                onPress={() => setNewTaskType("todo")}
                style={[
                  styles.typeOptionBtn,
                  {
                    backgroundColor: newTaskType === "todo" ? t.accent : t.background,
                    borderColor: newTaskType === "todo" ? t.accent : t.border,
                  },
                ]}
              >
                <PlatformSymbol
                  ios="checkmark.circle.fill"
                  material="check-circle"
                  tintColor={newTaskType === "todo" ? "#fff" : t.textMuted}
                  size={16}
                />
                <Caption
                  variant="caption2"
                  color={newTaskType === "todo" ? "#fff" : t.textPrimary}
                  style={{ fontWeight: "700" }}
                >
                  To Do
                </Caption>
              </Pressable>

              <Pressable
                onPress={() => setNewTaskType("event")}
                style={[
                  styles.typeOptionBtn,
                  {
                    backgroundColor: newTaskType === "event" ? "#7C3AED" : t.background,
                    borderColor: newTaskType === "event" ? "#7C3AED" : t.border,
                  },
                ]}
              >
                <PlatformSymbol
                  ios="calendar"
                  material="event"
                  tintColor={newTaskType === "event" ? "#fff" : t.textMuted}
                  size={16}
                />
                <Caption
                  variant="caption2"
                  color={newTaskType === "event" ? "#fff" : t.textPrimary}
                  style={{ fontWeight: "700" }}
                >
                  Event
                </Caption>
              </Pressable>
            </View>

            {/* Title Input */}
            <TextInput
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              placeholder={newTaskType === "todo" ? "e.g. Finish design for project" : "e.g. Daily meeting"}
              placeholderTextColor={t.textMuted}
              style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
            />

            {/* If Event: Time input */}
            {newTaskType === "event" && (
              <TextInput
                value={newTaskEventTime}
                onChangeText={setNewTaskEventTime}
                placeholder="Time: e.g. 11:00 am - 12:30 pm"
                placeholderTextColor={t.textMuted}
                style={[styles.input, { color: t.textPrimary, borderColor: t.border, marginTop: spacing.sm }]}
              />
            )}

            {/* Category selection */}
            <Caption variant="caption2" color={t.textMuted} style={{ marginTop: spacing.md, marginBottom: 4 }}>
              CATEGORY
            </Caption>
            <View style={styles.catWrap}>
              {(["programming", "learning", "reading", "work", "other"] as DeepWorkCategory[]).map((cat) => {
                const sel = newTaskCategory === cat;
                const c = CATEGORY_INFO[cat];
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setNewTaskCategory(cat)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: sel ? c.color + "25" : t.background,
                        borderColor: sel ? c.color : t.border,
                      },
                    ]}
                  >
                    <Caption
                      variant="caption2"
                      color={sel ? c.color : t.textMuted}
                      style={{ fontWeight: sel ? "700" : "500" }}
                    >
                      {c.label}
                    </Caption>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalButtonsRow}>
              <Pressable
                onPress={() => setAddTaskModal(false)}
                style={[styles.modalCancelBtn, { borderColor: t.border }]}
              >
                <Caption variant="caption2" color={t.textPrimary}>
                  Cancel
                </Caption>
              </Pressable>
              <Pressable
                onPress={handleCreateTask}
                style={[styles.modalSubmitBtn, { backgroundColor: t.accent }]}
              >
                <Caption variant="caption2" color="#fff" style={{ fontWeight: "700" }}>
                  Add to Plan
                </Caption>
              </Pressable>
            </View>
          </Card>
        </View>
      </Modal>

      {/* ─── Modal: Abandon Session Reason ─────────────────── */}
      <Modal visible={abandonModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: t.card }]}>
            <Heading variant="title3">Stop Focus Session?</Heading>
            <Caption variant="caption2" color={t.textMuted} style={{ marginBottom: spacing.md }}>
              Why was your session interrupted? Tracking this protects your future focus.
            </Caption>

            <View style={{ gap: spacing.sm }}>
              {ABANDON_REASONS.map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => handleAbandonSession(item.key)}
                  style={[styles.abandonOptionBtn, { backgroundColor: t.background, borderColor: t.border }]}
                >
                  <Body variant="bodyMedium">
                    {item.emoji} {item.label}
                  </Body>
                  <PlatformSymbol
                    ios="chevron.right"
                    material="chevron-right"
                    tintColor={t.textMuted}
                    size={16}
                  />
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setAbandonModal(false)}
              style={[styles.modalCancelBtn, { borderColor: t.border, marginTop: spacing.lg }]}
            >
              <Caption variant="caption2" color={t.textPrimary}>
                Continue Focusing
              </Caption>
            </Pressable>
          </Card>
        </View>
      </Modal>

      {/* ─── Modal: Set Daily Target ───────────────────────── */}
      <Modal visible={targetModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalCard, { backgroundColor: t.card }]}>
            <Heading variant="title3">Daily Deep Work Target</Heading>
            <Caption variant="caption2" color={t.textMuted} style={{ marginBottom: spacing.md }}>
              Set your target minutes of distraction-free focus per day (e.g. 120 mins).
            </Caption>

            <TextInput
              keyboardType="number-pad"
              value={targetInput}
              onChangeText={setTargetInput}
              placeholder="Minutes (e.g. 120)"
              placeholderTextColor={t.textMuted}
              style={[styles.input, { color: t.textPrimary, borderColor: t.border }]}
            />

            <View style={styles.modalButtonsRow}>
              <Pressable
                onPress={() => setTargetModal(false)}
                style={[styles.modalCancelBtn, { borderColor: t.border }]}
              >
                <Caption variant="caption2" color={t.textPrimary}>
                  Cancel
                </Caption>
              </Pressable>
              <Pressable
                onPress={handleSaveDailyTarget}
                style={[styles.modalSubmitBtn, { backgroundColor: t.accent }]}
              >
                <Caption variant="caption2" color="#fff" style={{ fontWeight: "700" }}>
                  Save Target
                </Caption>
              </Pressable>
            </View>
          </Card>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  targetPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  addCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },

  // Vitals Pill Row
  vitalsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
  },
  vitalCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  vitalsDivider: {
    width: 1,
    height: 20,
  },

  // Calendar Strip
  calendarStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  calendarDayCard: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },

  // Target Banner
  targetBanner: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  targetBannerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  targetTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    marginVertical: 4,
  },
  targetFill: {
    height: "100%",
    borderRadius: 4,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  taskList: {
    gap: spacing.sm,
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.md,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  eventIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  taskTextCol: {
    flex: 1,
  },
  taskDoneText: {
    textDecorationLine: "line-through",
    opacity: 0.6,
  },
  taskSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  eventTimePill: {
    backgroundColor: "#DDD6FE",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  taskFocusPlayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
  },

  // Focus Timer Running Card (Screenshot 1)
  timerRunningCard: {
    borderRadius: radius["2xl"],
    padding: spacing.xl,
    alignItems: "center",
  },
  activeTaskBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.xl,
  },
  dialContainer: {
    width: 220,
    height: 220,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.lg,
  },
  dialCircleTrack: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 8,
  },
  dialArcFill: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 8,
    borderTopColor: "transparent",
    borderLeftColor: "transparent",
  },
  dialCenterContent: {
    alignItems: "center",
  },
  dialDigits: {
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: -1,
  },
  dialSubtitle: {
    marginTop: 4,
  },
  interruptionStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  logDistractionBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  timerControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing["2xl"],
    marginTop: spacing.xl,
  },
  controlSquareBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  controlRoundBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },

  // Duration Grid (Screenshot 1)
  durationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  durationTile: {
    width: "48%",
    paddingVertical: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  durationNumber: {
    fontSize: 32,
    fontWeight: "800",
  },
  taskInput: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: 4,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    marginRight: spacing.xs,
  },

  // Report
  reportChartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 140,
    marginTop: spacing.lg,
  },
  reportCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
  },
  reportBadgePill: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
  },
  reportTrack: {
    width: 14,
    height: 100,
    borderRadius: 7,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  reportBar: {
    width: "100%",
    borderRadius: 7,
  },
  sessionList: {
    gap: spacing.sm,
  },
  sessionCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  sessionCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  lastSessionCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
  },
  lastSessionTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  catIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  repeatButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  lastSessionBottom: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  // Bottom Floating Pill Bar (Screenshot 1 & 2)
  bottomBarWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  bottomPillBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.full,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  navTabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  navPlusBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    padding: spacing.xl,
    paddingBottom: spacing["2xl"],
  },
  typeSelectorRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeOptionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  catWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalCancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  modalSubmitBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  abandonOptionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
