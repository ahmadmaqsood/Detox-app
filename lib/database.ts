import * as SQLite from "expo-sqlite";
import {
  defaultHabits,
  homeRoutineHabitsV3,
  legacyHomeHabitNames,
} from "./seed";
import type {
  AchievementUnlockRow,
  BodyWeightEntry,
  Challenge,
  ChallengeCategory,
  ChallengeCompletionRecord,
  ChallengeStats,
  DailyReset,
  DietMeal,
  DietRules,
  Entry,
  ExerciseEntry,
  Habit,
  HabitIcon,
  Intervention,
  LifeArea,
  MealQuality,
  Metrics,
  Mode,
  ModeRow,
  RelapseEvent,
  SpiritualCadence,
  SpiritualChallengeDashboard,
  TimeBlock,
  UrgeLog
} from "./types";

// ─── Singleton ───────────────────────────────────────────────
// Serialize opening: concurrent callers (e.g. React Strict Mode, parallel hooks) must not
// call openDatabaseAsync twice on web — the File System Access API only allows one sync
// access handle per file (NoModificationAllowedError on the second open).

let db: SQLite.SQLiteDatabase | null = null;
let dbOpening: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDB(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (!dbOpening) {
    dbOpening = SQLite.openDatabaseAsync("detox.db").then((d) => {
      db = d;
      return d;
    });
  }
  try {
    return await dbOpening;
  } catch (e) {
    dbOpening = null;
    db = null;
    throw e;
  }
}

let initPromise: Promise<void> | null = null;

// ─── Schema ──────────────────────────────────────────────────

export async function initDB(): Promise<void> {
  if (!initPromise) {
    initPromise = initDBOnce();
  }
  return initPromise;
}

async function initDBOnce(): Promise<void> {
  const d = await getDB();

  await d.execAsync(`PRAGMA journal_mode = WAL;`);
  await d.execAsync(`PRAGMA foreign_keys = ON;`);

  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS habits (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      icon          TEXT    NOT NULL DEFAULT '⭐',
      color         TEXT    NOT NULL DEFAULT '#4ADE80',
      mode          TEXT    NOT NULL DEFAULT 'home' CHECK(mode IN ('home','hostel')),
      targetPerDay  INTEGER NOT NULL DEFAULT 1,
      createdAt     TEXT    NOT NULL DEFAULT (date('now'))
    );
  `);

  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS entries (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      habitId   INTEGER NOT NULL,
      date      TEXT    NOT NULL DEFAULT (date('now')),
      completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
      FOREIGN KEY (habitId) REFERENCES habits(id) ON DELETE CASCADE,
      UNIQUE(habitId, date)
    );
  `);

  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS metrics (
      date        TEXT    PRIMARY KEY DEFAULT (date('now')),
      screenTime  INTEGER NOT NULL DEFAULT 0,
      riskScore   INTEGER NOT NULL DEFAULT 0,
      relapse     INTEGER NOT NULL DEFAULT 0 CHECK(relapse IN (0,1))
    );
  `);

  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS mode (
      id          INTEGER PRIMARY KEY CHECK(id = 1),
      currentMode TEXT    NOT NULL DEFAULT 'home' CHECK(currentMode IN ('home','hostel'))
    );
  `);

  await d.execAsync(`
    INSERT OR IGNORE INTO mode (id, currentMode) VALUES (1, 'hostel');
  `);

  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS challenges (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      duration    INTEGER NOT NULL DEFAULT 7,
      progress    INTEGER NOT NULL DEFAULT 0,
      startedAt   TEXT,
      completedAt TEXT
    );
  `);

  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS interventions (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      date      TEXT    NOT NULL DEFAULT (date('now')),
      action    TEXT    NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1))
    );
  `);

  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS _meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  await migrateSchema(d);

  // Seed default habits exactly once
  const seeded = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'seeded'`,
  );

  if (!seeded) {
    for (const h of defaultHabits) {
      await d.runAsync(
        `INSERT INTO habits (name, icon, color, mode, targetPerDay, lifeArea, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          h.name,
          JSON.stringify(h.icon),
          h.color,
          h.mode,
          h.targetPerDay,
          h.lifeArea,
          h.sortOrder ?? 0,
        ],
      );
    }

    const defaultChallenges = [
      {
        name: "7 Day Reset",
        description:
          "Break the cycle. Stay clean for 7 straight days to reset your baseline.",
        duration: 7,
      },
      {
        name: "30 Day Discipline",
        description:
          "Build unshakeable habits. Complete all daily habits for 30 consecutive days.",
        duration: 30,
      },
      {
        name: "180 Day Transformation",
        description:
          "Complete transformation. 90 days of consistent discipline and self-control.",
        duration: 180,
      },
    ];
    for (const c of defaultChallenges) {
      await d.runAsync(
        `INSERT INTO challenges (name, description, duration) VALUES (?, ?, ?)`,
        [c.name, c.description, c.duration],
      );
    }

    await d.runAsync(`INSERT INTO _meta (key, value) VALUES ('seeded', '1')`);
  }
}

async function migrateSchema(d: SQLite.SQLiteDatabase): Promise<void> {
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS relapse_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      occurredAt TEXT NOT NULL,
      triggerTag TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      hourOfDay INTEGER NOT NULL
    );
  `);
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS time_blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );
  `);
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS time_block_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blockId INTEGER NOT NULL,
      date TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (blockId) REFERENCES time_blocks(id) ON DELETE CASCADE,
      UNIQUE(blockId, date)
    );
  `);
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS app_open_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      openedAt TEXT NOT NULL
    );
  `);
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS focus_daily (
      date TEXT PRIMARY KEY,
      manualMinutes INTEGER NOT NULL DEFAULT 0
    );
  `);
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS achievements_unlocked (
      achievementId TEXT PRIMARY KEY,
      unlockedAt TEXT NOT NULL
    );
  `);

  const cols = await d.getAllAsync<{ name: string }>(
    "PRAGMA table_info(habits)",
  );
  if (!cols.some((c) => c.name === "lifeArea")) {
    await d.execAsync(
      `ALTER TABLE habits ADD COLUMN lifeArea TEXT NOT NULL DEFAULT 'mental'`,
    );
  }

  const backfill = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'life_area_v1'`,
  );
  if (!backfill) {
    await d.runAsync(
      `UPDATE habits SET lifeArea = 'spiritual' WHERE name LIKE '%Namaz%' OR name LIKE '%Quran%' OR name LIKE '%Surah%' OR name LIKE '%Yaseen%' OR name LIKE '%Mulk%' OR name LIKE '%Fajr%' OR name LIKE '%Zuhr%' OR name LIKE '%Asr%' OR name LIKE '%Maghrib%' OR name LIKE '%Isha%'`,
    );
    await d.runAsync(
      `UPDATE habits SET lifeArea = 'physical' WHERE name LIKE '%Exercise%' OR name LIKE '%Walk%' OR name LIKE '%Sleep%' OR name LIKE '%Light Exercise%' OR name LIKE '%Breakfast%' OR name LIKE '%Lunch%' OR name LIKE '%Dinner%' OR name LIKE '%Nap%'`,
    );
    await d.runAsync(
      `UPDATE habits SET lifeArea = 'work' WHERE name LIKE '%OFfice Work%' OR name LIKE '%Study%'`,
    );
    await d.runAsync(
      `INSERT OR REPLACE INTO _meta (key, value) VALUES ('life_area_v1', '1')`,
    );
  }

  const habitColsForSort = await d.getAllAsync<{ name: string }>(
    "PRAGMA table_info(habits)",
  );
  if (!habitColsForSort.some((c) => c.name === "sortOrder")) {
    await d.execAsync(
      `ALTER TABLE habits ADD COLUMN sortOrder INTEGER NOT NULL DEFAULT 0`,
    );
  }

  const homeV3 = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'home_routine_v3'`,
  );
  if (!homeV3) {
    const ph = legacyHomeHabitNames.map(() => "?").join(",");
    const legacyCount = await d.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) AS c FROM habits WHERE mode = 'home' AND name IN (${ph})`,
      [...legacyHomeHabitNames],
    );
    if ((legacyCount?.c ?? 0) > 0) {
      await d.runAsync(
        `DELETE FROM habits WHERE mode = 'home' AND name IN (${ph})`,
        [...legacyHomeHabitNames],
      );
      for (const h of homeRoutineHabitsV3) {
        await d.runAsync(
          `INSERT INTO habits (name, icon, color, mode, targetPerDay, lifeArea, sortOrder) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            h.name,
            JSON.stringify(h.icon),
            h.color,
            h.mode,
            h.targetPerDay,
            h.lifeArea,
            h.sortOrder,
          ],
        );
      }
    }
    await d.runAsync(
      `INSERT OR REPLACE INTO _meta (key, value) VALUES ('home_routine_v3', '1')`,
    );
  }

  await d.runAsync(
    `UPDATE habits SET name = 'No phone usage' WHERE mode = 'hostel' AND name = 'Limited Phone'`,
  );

  // Rename to a simpler, less "cheap-looking" label.
  // Existing entries are keyed by habitId, so this only updates the displayed name.
  await d.execAsync(
    `UPDATE habits SET name = 'No Explicit Content' WHERE name = 'No Porn';`,
  );

  const metricsCols = await d.getAllAsync<{ name: string }>(
    "PRAGMA table_info(metrics)",
  );
  if (!metricsCols.some((c) => c.name === "sleepMinutes")) {
    await d.execAsync(
      `ALTER TABLE metrics ADD COLUMN sleepMinutes INTEGER NOT NULL DEFAULT 0`,
    );
  }
  if (!metricsCols.some((c) => c.name === "steps")) {
    await d.execAsync(
      `ALTER TABLE metrics ADD COLUMN steps INTEGER NOT NULL DEFAULT 0`,
    );
  }

  const challengeCols = await d.getAllAsync<{ name: string }>(
    "PRAGMA table_info(challenges)",
  );
  if (!challengeCols.some((c) => c.name === "category")) {
    await d.execAsync(
      `ALTER TABLE challenges ADD COLUMN category TEXT NOT NULL DEFAULT 'discipline'`,
    );
  }
  if (!challengeCols.some((c) => c.name === "rules")) {
    await d.execAsync(
      `ALTER TABLE challenges ADD COLUMN rules TEXT NOT NULL DEFAULT ''`,
    );
  }

  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS body_weight (
      date TEXT PRIMARY KEY,
      kg REAL NOT NULL
    );
  `);
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS body_exercise (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      durationMinutes INTEGER NOT NULL DEFAULT 0
    );
  `);
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS diet_meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      slot TEXT NOT NULL DEFAULT 'meal',
      quality TEXT NOT NULL CHECK(quality IN ('healthy','junk')),
      overeating INTEGER NOT NULL DEFAULT 0 CHECK(overeating IN (0,1)),
      hour INTEGER NOT NULL DEFAULT 12
    );
  `);

  const lifeOs = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'life_os_v1'`,
  );
  if (!lifeOs) {
    const seeds: {
      name: string;
      description: string;
      duration: number;
      category: ChallengeCategory;
      rules: string;
    }[] = [
      {
        name: "No Social Media (30 days)",
        description:
          "Cut doom-scrolling. Stay off social apps except essentials.",
        duration: 30,
        category: "discipline",
        rules: "No Instagram, TikTok, X. Messaging apps OK.",
      },
      {
        name: "10k Steps Daily (7 days)",
        description: "Walk daily. Movement reduces urges and lifts energy.",
        duration: 7,
        category: "physical",
        rules: "Log steps on Body. Aim for 10,000 before midnight.",
      },
      {
        name: "No Phone After 10pm (14 days)",
        description: "Protect sleep and impulse control at night.",
        duration: 14,
        category: "mental",
        rules: "No screen use after 22:00 except alarms.",
      },
      {
        name: "Five Daily Prayers (30 days)",
        description: "Spiritual anchor — consistency over perfection.",
        duration: 30,
        category: "spiritual",
        rules: "Complete all five salahs mindfully each day.",
      },
      {
        name: "Office Work 12-9pm",
        description: "Protected focus block on weekdays.",
        duration: 21,
        category: "mental",
        rules: "2h uninterrupted work — use Focus or time blocks.",
      },
      {
        name: "50 Pushups / Day (14 days)",
        description: "Short daily strength habit.",
        duration: 14,
        category: "physical",
        rules: "Any time of day. Split sets allowed.",
      },
    ];
    for (const s of seeds) {
      const exists = await d.getFirstAsync<{ id: number }>(
        "SELECT id FROM challenges WHERE name = ?",
        [s.name],
      );
      if (!exists) {
        await d.runAsync(
          `INSERT INTO challenges (name, description, duration, category, rules) VALUES (?, ?, ?, ?, ?)`,
          [s.name, s.description, s.duration, s.category, s.rules],
        );
      }
    }
    await d.runAsync(
      `INSERT OR REPLACE INTO _meta (key, value) VALUES ('life_os_v1', '1')`,
    );
  }

  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS urge_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      loggedAt TEXT NOT NULL,
      intensity INTEGER NOT NULL CHECK(intensity BETWEEN 1 AND 10),
      triggerTag TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT ''
    );
  `);
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS urge_tool_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      startedAt TEXT NOT NULL,
      endedAt TEXT
    );
  `);
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS urge_tool_action_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId INTEGER NOT NULL,
      actionLabel TEXT NOT NULL,
      completedAt TEXT NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES urge_tool_sessions(id) ON DELETE CASCADE
    );
  `);
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS daily_reset (
      date TEXT PRIMARY KEY,
      morningPlan TEXT NOT NULL DEFAULT '',
      nightReflection TEXT NOT NULL DEFAULT '',
      morningSavedAt TEXT,
      nightSavedAt TEXT
    );
  `);

  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS challenge_completion_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sourceChallengeId INTEGER,
      name TEXT NOT NULL,
      duration INTEGER NOT NULL,
      completedAt TEXT NOT NULL,
      FOREIGN KEY (sourceChallengeId) REFERENCES challenges(id) ON DELETE SET NULL
    );
  `);
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS challenge_stats (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      totalCompleted INTEGER NOT NULL DEFAULT 0,
      totalDaysCompleted INTEGER NOT NULL DEFAULT 0
    );
  `);
  await d.runAsync(
    `INSERT OR IGNORE INTO challenge_stats (id, totalCompleted, totalDaysCompleted) VALUES (1, 0, 0)`,
  );

  const challengeHistoryMigrated = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'challenge_history_migrated_v1'`,
  );
  if (!challengeHistoryMigrated) {
    await d.runAsync(
      `INSERT INTO challenge_completion_history (sourceChallengeId, name, duration, completedAt)
       SELECT id, name, duration, completedAt FROM challenges WHERE completedAt IS NOT NULL`,
    );
    const agg = await d.getFirstAsync<{ n: number; days: number }>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(duration), 0) AS days FROM challenge_completion_history`,
    );
    await d.runAsync(
      `UPDATE challenge_stats SET totalCompleted = ?, totalDaysCompleted = ? WHERE id = 1`,
      [ Number(agg?.n ?? 0), Number(agg?.days ?? 0) ],
    );
    await d.runAsync(
      `UPDATE challenges SET progress = 0, startedAt = NULL, completedAt = NULL WHERE completedAt IS NOT NULL`,
    );
    await d.runAsync(
      `INSERT OR REPLACE INTO _meta (key, value) VALUES ('challenge_history_migrated_v1', '1')`,
    );
  }

  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS spiritual_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cadence TEXT NOT NULL CHECK(cadence IN ('daily', 'weekly')),
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS spiritual_challenge_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challengeId INTEGER NOT NULL,
      date TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 1 CHECK(completed IN (0, 1)),
      UNIQUE(challengeId, date),
      FOREIGN KEY (challengeId) REFERENCES spiritual_challenges(id) ON DELETE CASCADE
    );
  `);

  const spiritualSeeded = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'spiritual_challenges_v1'`,
  );
  if (!spiritualSeeded) {
    const seeds: {
      slug: string;
      title: string;
      description: string;
      cadence: SpiritualCadence;
      sort: number;
    }[] = [
      {
        slug: "quran_5_ruku",
        title: "Quran (5 rukū)",
        description: "Read at least five rukū today.",
        cadence: "daily",
        sort: 10,
      },
      {
        slug: "surah_yaseen",
        title: "Surah Yaseen (morning)",
        description: "Recite Surah Yaseen in the morning.",
        cadence: "daily",
        sort: 20,
      },
      {
        slug: "surah_mulk",
        title: "Surah Mulk (night)",
        description: "Recite Surah Mulk at night.",
        cadence: "daily",
        sort: 30,
      },
      {
        slug: "azkar",
        title: "Azkar",
        description: "Morning and evening adhkar.",
        cadence: "daily",
        sort: 40,
      },
      {
        slug: "quran_consistency_week",
        title: "Quran consistency challenge",
        description:
          "Stay consistent with Quran all week — log each day. Streak counts full Mon–Sun weeks.",
        cadence: "weekly",
        sort: 50,
      },
      {
        slug: "namaz_completion_week",
        title: "Namaz completion challenge",
        description:
          "Complete all five prayers every day. Streak counts full weeks with 7/7 days logged.",
        cadence: "weekly",
        sort: 60,
      },
    ];
    for (const s of seeds) {
      await d.runAsync(
        `INSERT OR IGNORE INTO spiritual_challenges (slug, title, description, cadence, sort_order)
         VALUES (?, ?, ?, ?, ?)`,
        [s.slug, s.title, s.description, s.cadence, s.sort],
      );
    }
    await d.runAsync(
      `INSERT OR REPLACE INTO _meta (key, value) VALUES ('spiritual_challenges_v1', '1')`,
    );
  }

  const spiritualTitles = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'spiritual_challenge_titles_v2'`,
  );
  if (!spiritualTitles) {
    await d.runAsync(
      `UPDATE spiritual_challenges SET title = ? WHERE slug = ?`,
      ["Surah Yaseen (morning)", "surah_yaseen"],
    );
    await d.runAsync(
      `UPDATE spiritual_challenges SET title = ? WHERE slug = ?`,
      ["Surah Mulk (night)", "surah_mulk"],
    );
    await d.runAsync(
      `UPDATE spiritual_challenges SET title = ? WHERE slug = ?`,
      ["Quran consistency challenge", "quran_consistency_week"],
    );
    await d.runAsync(
      `UPDATE spiritual_challenges SET title = ? WHERE slug = ?`,
      ["Namaz completion challenge", "namaz_completion_week"],
    );
    await d.runAsync(
      `INSERT OR REPLACE INTO _meta (key, value) VALUES ('spiritual_challenge_titles_v2', '1')`,
    );
  }

  const physicalLadder = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'physical_challenges_ladder_v1'`,
  );
  if (!physicalLadder) {
    const physical: {
      name: string;
      description: string;
      duration: number;
      category: ChallengeCategory;
      rules: string;
    }[] = [
      {
        name: "5k Steps (Beginner)",
        description:
          "Beginner: walk more every day. Hit 5,000 steps, then tap Log Day on the Challenges screen.",
        duration: 7,
        category: "physical",
        rules: "At least 5,000 steps. Log in Body or your tracker; mark the day when done.",
      },
      {
        name: "10 Pushups (Beginner)",
        description:
          "Beginner: build upper-body consistency. Complete 10 pushups, then log the day.",
        duration: 7,
        category: "physical",
        rules: "10 pushups in total any time of day. Knee pushups count. Split sets OK.",
      },
      {
        name: "10k Steps (Intermediate)",
        description:
          "Intermediate: 10,000 steps daily for two weeks. Strong cardio habit.",
        duration: 14,
        category: "physical",
        rules: "10,000+ steps before midnight. Log on Body.",
      },
      {
        name: "30 Pushups (Intermediate)",
        description:
          "Intermediate: 30 pushups every day. Strength stacks with consistency.",
        duration: 14,
        category: "physical",
        rules: "30 pushups total per day. Any style; rest as needed between sets.",
      },
      {
        name: "15 Min Workout (Intermediate)",
        description:
          "Intermediate: move intentionally — at least 15 minutes of focused exercise daily.",
        duration: 14,
        category: "physical",
        rules: "15+ minutes continuous movement (walk, strength, sport). Log exercise on Body if you track it.",
      },
      {
        name: "50 Pushups (Advanced)",
        description:
          "Advanced: 50 pushups daily for a full month. High volume, high discipline.",
        duration: 30,
        category: "physical",
        rules: "50 pushups per day. Form over speed; split across sets.",
      },
      {
        name: "30 Min Workout (Advanced)",
        description:
          "Advanced: 30 minutes of dedicated training every day for a month.",
        duration: 30,
        category: "physical",
        rules: "30+ minutes per day — strength, cardio, or sport. Count intentional training only.",
      },
    ];
    for (const p of physical) {
      const exists = await d.getFirstAsync<{ id: number }>(
        "SELECT id FROM challenges WHERE name = ?",
        [p.name],
      );
      if (!exists) {
        await d.runAsync(
          `INSERT INTO challenges (name, description, duration, category, rules) VALUES (?, ?, ?, ?, ?)`,
          [p.name, p.description, p.duration, p.category, p.rules],
        );
      }
    }
    await d.runAsync(
      `INSERT OR REPLACE INTO _meta (key, value) VALUES ('physical_challenges_ladder_v1', '1')`,
    );
  }
}

// ─── Helpers: Habits ─────────────────────────────────────────

export async function addHabit(
  habit: Pick<Habit, "name"> & {
    icon?: string | HabitIcon;
    color?: string;
    mode?: Mode;
    lifeArea?: LifeArea;
    targetPerDay?: number;
    sortOrder?: number;
  },
): Promise<number> {
  const d = await getDB();
  const iconStr =
    typeof habit.icon === "object"
      ? JSON.stringify(habit.icon)
      : (habit.icon ??
        JSON.stringify({ ios: "star.fill", android: "star", web: "star" }));

  const result = await d.runAsync(
    `INSERT INTO habits (name, icon, color, mode, targetPerDay, lifeArea, sortOrder)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      habit.name,
      iconStr,
      habit.color ?? "#4ADE80",
      habit.mode ?? "home",
      habit.targetPerDay ?? 1,
      habit.lifeArea ?? "mental",
      habit.sortOrder ?? 0,
    ],
  );
  return result.lastInsertRowId;
}

export async function getAllHabits(): Promise<Habit[]> {
  const d = await getDB();
  return d.getAllAsync<Habit>(
    "SELECT * FROM habits ORDER BY mode ASC, sortOrder ASC, createdAt DESC",
  );
}

export async function getHabitById(id: number): Promise<Habit | null> {
  const d = await getDB();
  return d.getFirstAsync<Habit>("SELECT * FROM habits WHERE id = ?", [id]);
}

export async function updateHabit(
  id: number,
  updates: Partial<
    Pick<Habit, "name" | "color" | "mode" | "targetPerDay" | "lifeArea" | "sortOrder"> & {
      icon: string | HabitIcon;
    }
  >,
): Promise<void> {
  const d = await getDB();
  const sets: string[] = [];
  const vals: (string | number)[] = [];

  if (updates.name !== undefined) {
    sets.push("name = ?");
    vals.push(updates.name);
  }
  if (updates.icon !== undefined) {
    const iconStr =
      typeof updates.icon === "object"
        ? JSON.stringify(updates.icon)
        : updates.icon;
    sets.push("icon = ?");
    vals.push(iconStr);
  }
  if (updates.color !== undefined) {
    sets.push("color = ?");
    vals.push(updates.color);
  }
  if (updates.mode !== undefined) {
    sets.push("mode = ?");
    vals.push(updates.mode);
  }
  if (updates.lifeArea !== undefined) {
    sets.push("lifeArea = ?");
    vals.push(updates.lifeArea);
  }
  if (updates.targetPerDay !== undefined) {
    sets.push("targetPerDay = ?");
    vals.push(updates.targetPerDay);
  }
  if (updates.sortOrder !== undefined) {
    sets.push("sortOrder = ?");
    vals.push(updates.sortOrder);
  }

  if (sets.length === 0) return;
  vals.push(id);
  await d.runAsync(`UPDATE habits SET ${sets.join(", ")} WHERE id = ?`, vals);
}

export async function deleteHabit(id: number): Promise<void> {
  const d = await getDB();
  await d.runAsync("DELETE FROM habits WHERE id = ?", [id]);
}

export async function getHabitHistory(
  habitId: number,
  days: number = 30,
): Promise<{ date: string; completed: number }[]> {
  const d = await getDB();
  const to = todayISO();
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  const fromISO = from.toISOString().slice(0, 10);

  return d.getAllAsync<{ date: string; completed: number }>(
    `SELECT date, completed FROM entries
     WHERE habitId = ? AND date BETWEEN ? AND ?
     ORDER BY date DESC`,
    [habitId, fromISO, to],
  );
}

export async function getHabitCompletionRate(habitId: number): Promise<number> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ total: number; done: number }>(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS done
     FROM entries WHERE habitId = ?`,
    [habitId],
  );
  if (!row || row.total === 0) return 0;
  return Math.round((row.done / row.total) * 100);
}

// ─── Helpers: Entries / Toggle ───────────────────────────────

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addCalendarDays(iso: string, deltaDays: number): string {
  const dt = new Date(iso + "T12:00:00");
  dt.setDate(dt.getDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

export async function toggleHabit(
  habitId: number,
  date?: string,
): Promise<boolean> {
  const d = await getDB();
  const day = date ?? todayISO();

  const existing = await d.getFirstAsync<Entry>(
    "SELECT * FROM entries WHERE habitId = ? AND date = ?",
    [habitId, day],
  );

  if (existing) {
    const next = existing.completed ? 0 : 1;
    await d.runAsync("UPDATE entries SET completed = ? WHERE id = ?", [
      next,
      existing.id,
    ]);
    return next === 1;
  }

  await d.runAsync(
    "INSERT INTO entries (habitId, date, completed) VALUES (?, ?, 1)",
    [habitId, day],
  );
  return true;
}

export async function getTodayHabits(
  mode?: Mode,
): Promise<(Habit & { completed: number })[]> {
  const d = await getDB();
  const day = todayISO();

  if (mode) {
    return d.getAllAsync<Habit & { completed: number }>(
      `SELECT h.*, COALESCE(e.completed, 0) AS completed
       FROM habits h
       LEFT JOIN entries e ON e.habitId = h.id AND e.date = ?
       WHERE h.mode = ?
       ORDER BY h.sortOrder ASC, h.createdAt ASC`,
      [day, mode],
    );
  }

  return d.getAllAsync<Habit & { completed: number }>(
    `SELECT h.*, COALESCE(e.completed, 0) AS completed
     FROM habits h
     LEFT JOIN entries e ON e.habitId = h.id AND e.date = ?
     ORDER BY h.sortOrder ASC, h.createdAt ASC`,
    [day],
  );
}

// ─── Helpers: Streaks ────────────────────────────────────────

export async function getStreak(habitId: number): Promise<number> {
  const d = await getDB();
  const rows = await d.getAllAsync<{ date: string }>(
    `SELECT date FROM entries
     WHERE habitId = ? AND completed = 1
     ORDER BY date DESC`,
    [habitId],
  );

  if (rows.length === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  const firstDate = new Date(rows[0].date + "T00:00:00");
  if (cursor.getTime() - firstDate.getTime() > 86_400_000) {
    return 0;
  }

  const dateSet = new Set(rows.map((r) => r.date));

  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!dateSet.has(iso)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export async function getLongestStreak(habitId: number): Promise<number> {
  const d = await getDB();
  const rows = await d.getAllAsync<{ date: string }>(
    `SELECT date FROM entries
     WHERE habitId = ? AND completed = 1
     ORDER BY date ASC`,
    [habitId],
  );

  if (rows.length === 0) return 0;

  let longest = 1;
  let current = 1;

  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].date + "T00:00:00");
    const curr = new Date(rows[i].date + "T00:00:00");
    const diff = (curr.getTime() - prev.getTime()) / 86_400_000;

    if (diff === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

// ─── Helpers: Aggregate Stats ─────────────────────────────────

export async function getGlobalStreak(): Promise<number> {
  const d = await getDB();
  const habits = await d.getAllAsync<{ id: number }>("SELECT id FROM habits");
  if (habits.length === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    const row = await d.getFirstAsync<{ total: number; done: number }>(
      `SELECT COUNT(DISTINCT h.id) AS total,
              COUNT(DISTINCT CASE WHEN e.completed = 1 THEN h.id END) AS done
       FROM habits h
       LEFT JOIN entries e ON e.habitId = h.id AND e.date = ?`,
      [iso],
    );
    if (!row || row.total === 0 || row.done / row.total < 0.5) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Consecutive days (from today backward) where ≥50% of habits for this mode were completed. */
export async function getModeStreak(mode: Mode): Promise<number> {
  const d = await getDB();
  const habitRows = await d.getAllAsync<{ id: number }>(
    `SELECT id FROM habits WHERE mode = ?`,
    [mode],
  );
  if (habitRows.length === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    const row = await d.getFirstAsync<{ total: number; done: number }>(
      `SELECT COUNT(DISTINCT h.id) AS total,
              COUNT(DISTINCT CASE WHEN e.completed = 1 THEN h.id END) AS done
       FROM habits h
       LEFT JOIN entries e ON e.habitId = h.id AND e.date = ?
       WHERE h.mode = ?`,
      [iso, mode],
    );
    if (!row || row.total === 0 || row.done / row.total < 0.5) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function getGlobalLongestStreak(): Promise<number> {
  const d = await getDB();
  const dates = await d.getAllAsync<{
    date: string;
    total: number;
    done: number;
  }>(
    `SELECT e.date,
            COUNT(DISTINCT h.id) AS total,
            COUNT(DISTINCT CASE WHEN e.completed = 1 THEN h.id END) AS done
     FROM entries e
     JOIN habits h ON h.id = e.habitId
     GROUP BY e.date
     ORDER BY e.date ASC`,
  );
  if (dates.length === 0) return 0;

  let longest = 0;
  let current = 0;
  let prevDate: Date | null = null;

  for (const row of dates) {
    const rate = row.total > 0 ? row.done / row.total : 0;
    const d = new Date(row.date + "T00:00:00");
    const consecutive = prevDate
      ? (d.getTime() - prevDate.getTime()) / 86_400_000 === 1
      : true;

    if (rate >= 0.5 && consecutive) {
      current++;
      longest = Math.max(longest, current);
    } else if (rate >= 0.5) {
      current = 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
    prevDate = d;
  }
  return longest;
}

export async function getHeatmapData(
  days: number = 49,
): Promise<{ date: string; rate: number }[]> {
  const d = await getDB();
  const to = todayISO();
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  const fromISO = from.toISOString().slice(0, 10);

  const rows = await d.getAllAsync<{
    date: string;
    total: number;
    done: number;
  }>(
    `SELECT e.date,
            COUNT(DISTINCT h.id) AS total,
            COUNT(DISTINCT CASE WHEN e.completed = 1 THEN h.id END) AS done
     FROM entries e
     JOIN habits h ON h.id = e.habitId
     WHERE e.date BETWEEN ? AND ?
     GROUP BY e.date`,
    [fromISO, to],
  );

  const map = new Map(
    rows.map((r) => [r.date, r.total > 0 ? r.done / r.total : 0]),
  );
  const result: { date: string; rate: number }[] = [];
  const cursor = new Date(fromISO + "T00:00:00");
  const end = new Date(to + "T00:00:00");

  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    result.push({ date: iso, rate: map.get(iso) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

export interface PeriodStats {
  label: string;
  total: number;
  done: number;
  rate: number;
}

export async function getWeeklyStats(
  weeks: number = 4,
): Promise<PeriodStats[]> {
  const d = await getDB();
  const result: PeriodStats[] = [];

  for (let w = 0; w < weeks; w++) {
    const end = new Date();
    end.setDate(end.getDate() - w * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    const startISO = start.toISOString().slice(0, 10);
    const endISO = end.toISOString().slice(0, 10);

    const row = await d.getFirstAsync<{ total: number; done: number }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN e.completed = 1 THEN 1 ELSE 0 END) AS done
       FROM entries e WHERE e.date BETWEEN ? AND ?`,
      [startISO, endISO],
    );

    const label = w === 0 ? "This Week" : w === 1 ? "Last Week" : `${w}w ago`;
    result.push({
      label,
      total: row?.total ?? 0,
      done: row?.done ?? 0,
      rate: row && row.total > 0 ? Math.round((row.done / row.total) * 100) : 0,
    });
  }
  return result;
}

export async function getMonthlyStats(
  months: number = 6,
): Promise<PeriodStats[]> {
  const d = await getDB();
  const result: PeriodStats[] = [];
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  for (let m = 0; m < months; m++) {
    const now = new Date();
    now.setMonth(now.getMonth() - m);
    const year = now.getFullYear();
    const month = now.getMonth();
    const startISO = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const endDate = new Date(year, month + 1, 0);
    const endISO = endDate.toISOString().slice(0, 10);

    const row = await d.getFirstAsync<{ total: number; done: number }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS done
       FROM entries WHERE date BETWEEN ? AND ?`,
      [startISO, endISO],
    );

    result.push({
      label: monthNames[month],
      total: row?.total ?? 0,
      done: row?.done ?? 0,
      rate: row && row.total > 0 ? Math.round((row.done / row.total) * 100) : 0,
    });
  }
  return result;
}

export async function getYearlyStats(): Promise<PeriodStats[]> {
  const d = await getDB();
  const rows = await d.getAllAsync<{
    year: string;
    total: number;
    done: number;
  }>(
    `SELECT strftime('%Y', date) AS year,
            COUNT(*) AS total,
            SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS done
     FROM entries
     GROUP BY year
     ORDER BY year DESC
     LIMIT 3`,
  );

  return rows.map((r) => ({
    label: r.year,
    total: r.total,
    done: r.done,
    rate: r.total > 0 ? Math.round((r.done / r.total) * 100) : 0,
  }));
}

export interface ModeComparison {
  mode: Mode;
  total: number;
  done: number;
  rate: number;
}

export async function getModeComparisonStats(): Promise<ModeComparison[]> {
  const d = await getDB();
  const rows = await d.getAllAsync<{ mode: Mode; total: number; done: number }>(
    `SELECT h.mode,
            COUNT(e.id) AS total,
            SUM(CASE WHEN e.completed = 1 THEN 1 ELSE 0 END) AS done
     FROM habits h
     JOIN entries e ON e.habitId = h.id
     GROUP BY h.mode`,
  );

  return rows.map((r) => ({
    mode: r.mode,
    total: r.total,
    done: r.done,
    rate: r.total > 0 ? Math.round((r.done / r.total) * 100) : 0,
  }));
}

/** Days logged with relapse flag in metrics (user-reported slips). */
export async function getRelapseCount(): Promise<number> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM metrics WHERE relapse = 1`,
  );
  return row?.n ?? 0;
}

/** Relapse flags in metrics for the last 30 days vs the prior 30 days (for level / trends). */
export async function getRelapseCountsLastTwoWindows(): Promise<{
  last30: number;
  prev30: number;
}> {
  const d = await getDB();
  const end = todayISO();
  const lastStart = addCalendarDays(end, -29);
  const prevEnd = addCalendarDays(end, -30);
  const prevStart = addCalendarDays(end, -59);

  const a = await d.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM metrics WHERE relapse = 1 AND date BETWEEN ? AND ?`,
    [lastStart, end],
  );
  const b = await d.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM metrics WHERE relapse = 1 AND date BETWEEN ? AND ?`,
    [prevStart, prevEnd],
  );
  return { last30: a?.n ?? 0, prev30: b?.n ?? 0 };
}

export interface WeekdayWeekendStats {
  weekdayRate: number;
  weekendRate: number;
  weekdayTotal: number;
  weekendTotal: number;
}

/** Completion % for Mon–Fri vs Sat–Sun entry rows. */
export async function getWeekdayWeekendCompletion(): Promise<WeekdayWeekendStats> {
  const d = await getDB();
  const rows = await d.getAllAsync<{
    segment: string;
    total: number;
    done: number;
  }>(
    `SELECT
       CASE WHEN CAST(strftime('%w', date) AS INTEGER) IN (0, 6) THEN 'weekend' ELSE 'weekday' END AS segment,
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END), 0) AS done
     FROM entries
     GROUP BY segment`,
  );

  let weekdayTotal = 0;
  let weekdayDone = 0;
  let weekendTotal = 0;
  let weekendDone = 0;

  for (const r of rows) {
    if (r.segment === "weekend") {
      weekendTotal = r.total;
      weekendDone = r.done;
    } else {
      weekdayTotal = r.total;
      weekdayDone = r.done;
    }
  }

  return {
    weekdayRate:
      weekdayTotal > 0 ? Math.round((weekdayDone / weekdayTotal) * 100) : 0,
    weekendRate:
      weekendTotal > 0 ? Math.round((weekendDone / weekendTotal) * 100) : 0,
    weekdayTotal,
    weekendTotal,
  };
}

export async function getMostMissedHabit(): Promise<{
  name: string;
  missed: number;
} | null> {
  const d = await getDB();
  return d.getFirstAsync<{ name: string; missed: number }>(
    `SELECT h.name AS name,
            SUM(CASE WHEN e.completed = 0 THEN 1 ELSE 0 END) AS missed
     FROM entries e
     JOIN habits h ON h.id = e.habitId
     GROUP BY h.id
     HAVING SUM(CASE WHEN e.completed = 0 THEN 1 ELSE 0 END) > 0
     ORDER BY SUM(CASE WHEN e.completed = 0 THEN 1 ELSE 0 END) DESC
     LIMIT 1`,
  );
}

export async function getEntriesCompletionSummary(): Promise<{
  total: number;
  done: number;
  rate: number;
}> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ total: number; done: number }>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END), 0) AS done
     FROM entries`,
  );
  const total = row?.total ?? 0;
  const done = row?.done ?? 0;
  return {
    total,
    done,
    rate: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

export async function getMemberSinceYear(): Promise<number | null> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ d: string }>(
    `SELECT MIN(createdAt) AS d FROM habits`,
  );
  if (!row?.d) return null;
  const y = new Date(row.d + "T12:00:00").getFullYear();
  return Number.isFinite(y) ? y : null;
}

export interface ScreenTimeDiscipline {
  date: string;
  screenTime: number;
  completionRate: number;
}

export async function getScreenTimeVsDiscipline(
  days: number = 14,
): Promise<ScreenTimeDiscipline[]> {
  const d = await getDB();
  const to = todayISO();
  const from = new Date();
  from.setDate(from.getDate() - days + 1);
  const fromISO = from.toISOString().slice(0, 10);

  return d.getAllAsync<ScreenTimeDiscipline>(
    `SELECT m.date, m.screenTime,
            COALESCE(
              ROUND(
                CAST(SUM(CASE WHEN e.completed = 1 THEN 1 ELSE 0 END) AS REAL)
                / NULLIF(COUNT(e.id), 0) * 100
              , 0), 0
            ) AS completionRate
     FROM metrics m
     LEFT JOIN entries e ON e.date = m.date
     WHERE m.date BETWEEN ? AND ?
     GROUP BY m.date
     ORDER BY m.date ASC`,
    [fromISO, to],
  );
}

/** Aggregates for the deep insights engine + smart notifications. */
export interface InsightSignals {
  metricsDaysWithData: number;
  avgScreenOnRelapseDays: number | null;
  avgScreenOnCleanDays: number | null;
  relapseDaysHighScreen: number;
  totalRelapseDays: number;
  homeRate: number;
  hostelRate: number;
  homeTotal: number;
  hostelTotal: number;
  heatmapLast7Avg: number;
  heatmapPrior7Avg: number;
  currentStreak: number;
  longestStreak: number;
  todayDone: number;
  todayTotal: number;
}

export async function getInsightSignals(): Promise<InsightSignals> {
  const d = await getDB();
  const [modeComp, streak, longest, heatmap, todayHabits] = await Promise.all([
    getModeComparisonStats(),
    getGlobalStreak(),
    getGlobalLongestStreak(),
    getHeatmapData(14),
    getTodayHabits(),
  ]);

  const home = modeComp.find((m) => m.mode === "home");
  const hostel = modeComp.find((m) => m.mode === "hostel");

  const last7 = heatmap.slice(-7);
  const prior7 = heatmap.slice(-14, -7);
  const avg7 = (a: { rate: number }[]) =>
    a.length ? a.reduce((s, x) => s + x.rate, 0) / a.length : 0;

  const [relAvg, cleanAvg, highRel, totalRel, metricsCount] = await Promise.all([
    d.getFirstAsync<{ a: number | null }>(
      `SELECT AVG(screenTime) AS a FROM metrics WHERE relapse = 1 AND screenTime > 0`,
    ),
    d.getFirstAsync<{ a: number | null }>(
      `SELECT AVG(screenTime) AS a FROM metrics WHERE relapse = 0 AND screenTime > 0`,
    ),
    d.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM metrics WHERE relapse = 1 AND screenTime >= 200`,
    ),
    d.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM metrics WHERE relapse = 1`,
    ),
    d.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM metrics WHERE screenTime > 0`,
    ),
  ]);

  const todayDone = todayHabits.filter((h) => h.completed).length;
  const todayTotal = todayHabits.length;

  return {
    metricsDaysWithData: metricsCount?.n ?? 0,
    avgScreenOnRelapseDays: relAvg?.a ?? null,
    avgScreenOnCleanDays: cleanAvg?.a ?? null,
    relapseDaysHighScreen: highRel?.n ?? 0,
    totalRelapseDays: totalRel?.n ?? 0,
    homeRate: home?.rate ?? 0,
    hostelRate: hostel?.rate ?? 0,
    homeTotal: home?.total ?? 0,
    hostelTotal: hostel?.total ?? 0,
    heatmapLast7Avg: avg7(last7),
    heatmapPrior7Avg: avg7(prior7),
    currentStreak: streak,
    longestStreak: longest,
    todayDone,
    todayTotal,
  };
}

// ─── Helpers: Metrics ────────────────────────────────────────

export async function saveMetrics(
  data: Partial<Omit<Metrics, "date">> & { date?: string },
): Promise<void> {
  const d = await getDB();
  const day = data.date ?? todayISO();
  const existing = await d.getFirstAsync<Metrics>(
    "SELECT * FROM metrics WHERE date = ?",
    [day],
  );

  const screenTime = data.screenTime ?? existing?.screenTime ?? 0;
  const riskScore = data.riskScore ?? existing?.riskScore ?? 0;
  const relapse =
    data.relapse !== undefined ? (data.relapse ? 1 : 0) : (existing?.relapse ?? 0);
  const sleepMinutes = data.sleepMinutes ?? existing?.sleepMinutes ?? 0;
  const steps = data.steps ?? existing?.steps ?? 0;

  await d.runAsync(
    `INSERT INTO metrics (date, screenTime, riskScore, relapse, sleepMinutes, steps)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       screenTime = excluded.screenTime,
       riskScore  = excluded.riskScore,
       relapse    = excluded.relapse,
       sleepMinutes = excluded.sleepMinutes,
       steps = excluded.steps`,
    [day, screenTime, riskScore, relapse, sleepMinutes, steps],
  );
}

export async function getMetrics(date?: string): Promise<Metrics | null> {
  const d = await getDB();
  return d.getFirstAsync<Metrics>("SELECT * FROM metrics WHERE date = ?", [
    date ?? todayISO(),
  ]);
}

export async function getMetricsRange(
  from: string,
  to: string,
): Promise<Metrics[]> {
  const d = await getDB();
  return d.getAllAsync<Metrics>(
    "SELECT * FROM metrics WHERE date BETWEEN ? AND ? ORDER BY date ASC",
    [from, to],
  );
}

// ─── Helpers: Mode ───────────────────────────────────────────

export async function getMode(): Promise<Mode> {
  const d = await getDB();
  const row = await d.getFirstAsync<ModeRow>(
    "SELECT currentMode FROM mode WHERE id = 1",
  );
  return row?.currentMode ?? "hostel";
}

export async function setMode(mode: Mode): Promise<void> {
  const d = await getDB();
  await d.runAsync("UPDATE mode SET currentMode = ? WHERE id = 1", [mode]);
}

// ─── Helpers: Challenges ─────────────────────────────────────

export async function addChallenge(
  challenge: Pick<Challenge, "name" | "duration"> & {
    description?: string;
    category?: ChallengeCategory;
    rules?: string;
  },
): Promise<number> {
  const d = await getDB();
  const result = await d.runAsync(
    "INSERT INTO challenges (name, description, duration, category, rules) VALUES (?, ?, ?, ?, ?)",
    [
      challenge.name,
      challenge.description ?? "",
      challenge.duration,
      challenge.category ?? "discipline",
      challenge.rules ?? "",
    ],
  );
  return result.lastInsertRowId;
}

export async function getChallenges(): Promise<Challenge[]> {
  const d = await getDB();
  return d.getAllAsync<Challenge>("SELECT * FROM challenges ORDER BY id ASC");
}

export async function getChallengeCompletionHistory(): Promise<
  ChallengeCompletionRecord[]
> {
  const d = await getDB();
  return d.getAllAsync<ChallengeCompletionRecord>(
    `SELECT id, sourceChallengeId, name, duration, completedAt
     FROM challenge_completion_history
     ORDER BY datetime(completedAt) DESC, id DESC`,
  );
}

export async function getChallengeStats(): Promise<ChallengeStats> {
  const d = await getDB();
  const row = await d.getFirstAsync<{
    totalCompleted: number;
    totalDaysCompleted: number;
  }>(
    `SELECT totalCompleted, totalDaysCompleted FROM challenge_stats WHERE id = 1`,
  );
  return {
    totalCompleted: row?.totalCompleted ?? 0,
    totalDaysCompleted: row?.totalDaysCompleted ?? 0,
  };
}

export async function updateChallengeProgress(
  id: number,
  progress: number,
): Promise<void> {
  const d = await getDB();
  await d.runAsync("UPDATE challenges SET progress = ? WHERE id = ?", [
    progress,
    id,
  ]);
}

export async function startChallenge(id: number): Promise<void> {
  const d = await getDB();
  await d.runAsync(
    "UPDATE challenges SET startedAt = ?, progress = 0, completedAt = NULL WHERE id = ?",
    [todayISO(), id],
  );
}

/** @returns true when the challenge run just finished (logged final day). */
export async function incrementChallengeProgress(
  id: number,
): Promise<boolean> {
  const d = await getDB();
  const c = await d.getFirstAsync<Challenge>(
    "SELECT * FROM challenges WHERE id = ?",
    [id],
  );
  if (!c || !c.startedAt) return false;
  if (c.progress >= c.duration) return false;

  const next = Math.min(c.progress + 1, c.duration);
  const completed = next >= c.duration;

  if (!completed) {
    await d.runAsync(`UPDATE challenges SET progress = ? WHERE id = ?`, [
      next,
      id,
    ]);
    return false;
  }

  const completedAt = todayISO();
  await d.withTransactionAsync(async () => {
    await d.runAsync(
      `INSERT INTO challenge_completion_history (sourceChallengeId, name, duration, completedAt)
       VALUES (?, ?, ?, ?)`,
      [id, c.name, c.duration, completedAt],
    );
    await d.runAsync(
      `UPDATE challenge_stats SET
         totalCompleted = totalCompleted + 1,
         totalDaysCompleted = totalDaysCompleted + ?
       WHERE id = 1`,
      [c.duration],
    );
    await d.runAsync(
      `UPDATE challenges SET progress = 0, startedAt = NULL, completedAt = NULL WHERE id = ?`,
      [id],
    );
  });
  return true;
}

export async function resetChallenge(id: number): Promise<void> {
  const d = await getDB();
  await d.runAsync(
    "UPDATE challenges SET progress = 0, startedAt = NULL, completedAt = NULL WHERE id = ?",
    [id],
  );
}

export async function deleteChallenge(id: number): Promise<void> {
  const d = await getDB();
  await d.runAsync("DELETE FROM challenges WHERE id = ?", [id]);
}

// ─── Helpers: Spiritual challenges ───────────────────────────

type SpiritualChallengeRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  cadence: SpiritualCadence;
  sort_order: number;
};

function mondayOfISOWeek(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function spiritualDailyStreakFromDates(dates: string[]): number {
  if (dates.length === 0) return 0;
  const dateSet = new Set(dates);
  const sortedDesc = [...dates].sort((a, b) => b.localeCompare(a));
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const firstDate = new Date(sortedDesc[0] + "T00:00:00");
  if (cursor.getTime() - firstDate.getTime() > 86_400_000) {
    return 0;
  }
  let streak = 0;
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    if (!dateSet.has(iso)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function spiritualWeekDaysInCurrentWeek(dates: string[], todayIso: string): number {
  const dateSet = new Set(dates);
  const mon = mondayOfISOWeek(todayIso);
  let n = 0;
  for (let i = 0; i < 7; i++) {
    if (dateSet.has(addCalendarDays(mon, i))) n++;
  }
  return n;
}

function spiritualWeeklyStreakFromDates(dates: string[]): number {
  if (dates.length === 0) return 0;
  const byWeek = new Map<string, Set<string>>();
  for (const dt of dates) {
    const m = mondayOfISOWeek(dt);
    if (!byWeek.has(m)) byWeek.set(m, new Set());
    byWeek.get(m)!.add(dt);
  }
  const fullWeekMondays: string[] = [];
  for (const [mon, days] of byWeek) {
    if (days.size >= 7) fullWeekMondays.push(mon);
  }
  fullWeekMondays.sort((a, b) => a.localeCompare(b));
  if (fullWeekMondays.length === 0) return 0;
  let streak = 1;
  for (let i = fullWeekMondays.length - 1; i > 0; i--) {
    const latest = fullWeekMondays[i];
    const before = fullWeekMondays[i - 1];
    if (addCalendarDays(before, 7) === latest) streak++;
    else break;
  }
  return streak;
}

export async function getSpiritualChallengesDashboard(
  date: string = todayISO(),
): Promise<SpiritualChallengeDashboard[]> {
  const d = await getDB();
  const challenges = await d.getAllAsync<SpiritualChallengeRow>(
    `SELECT id, slug, title, description, cadence, sort_order
     FROM spiritual_challenges
     ORDER BY sort_order ASC, id ASC`,
  );
  const completionRows = await d.getAllAsync<{ challengeId: number; date: string }>(
    `SELECT challengeId, date FROM spiritual_challenge_days WHERE completed = 1`,
  );
  const byChallenge = new Map<number, string[]>();
  for (const r of completionRows) {
    if (!byChallenge.has(r.challengeId)) {
      byChallenge.set(r.challengeId, []);
    }
    byChallenge.get(r.challengeId)!.push(r.date);
  }
  const todayRows = await d.getAllAsync<{ challengeId: number }>(
    `SELECT challengeId FROM spiritual_challenge_days WHERE date = ? AND completed = 1`,
    [date],
  );
  const todaySet = new Set(todayRows.map((r) => r.challengeId));

  return challenges.map((row) => {
    const ds = byChallenge.get(row.id) ?? [];
    const streak =
      row.cadence === "weekly"
        ? spiritualWeeklyStreakFromDates(ds)
        : spiritualDailyStreakFromDates(ds);
    const weekDaysComplete =
      row.cadence === "weekly"
        ? spiritualWeekDaysInCurrentWeek(ds, date)
        : 0;

    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      cadence: row.cadence,
      sortOrder: row.sort_order,
      completedToday: todaySet.has(row.id),
      streak,
      weekDaysComplete,
    };
  });
}

/** Toggle completion for a spiritual item on `date` (default: today). Returns new completed state. */
export async function toggleSpiritualChallengeDay(
  challengeId: number,
  date?: string,
): Promise<boolean> {
  const d = await getDB();
  const day = date ?? todayISO();
  const row = await d.getFirstAsync<{ id: number; completed: number }>(
    `SELECT id, completed FROM spiritual_challenge_days
     WHERE challengeId = ? AND date = ?`,
    [challengeId, day],
  );
  if (row) {
    const next = row.completed ? 0 : 1;
    await d.runAsync(
      `UPDATE spiritual_challenge_days SET completed = ? WHERE id = ?`,
      [next, row.id],
    );
    return next === 1;
  }
  await d.runAsync(
    `INSERT INTO spiritual_challenge_days (challengeId, date, completed) VALUES (?, ?, 1)`,
    [challengeId, day],
  );
  return true;
}

// ─── Helpers: Interventions ──────────────────────────────────

export async function addIntervention(action: string): Promise<number> {
  const d = await getDB();
  const result = await d.runAsync(
    "INSERT INTO interventions (action) VALUES (?)",
    [action],
  );
  return result.lastInsertRowId;
}

export async function completeIntervention(id: number): Promise<void> {
  const d = await getDB();
  await d.runAsync("UPDATE interventions SET completed = 1 WHERE id = ?", [id]);
}

export async function getTodayInterventions(): Promise<Intervention[]> {
  const d = await getDB();
  return d.getAllAsync<Intervention>(
    "SELECT * FROM interventions WHERE date = ? ORDER BY id DESC",
    [todayISO()],
  );
}

/** True if an intervention with this exact `action` has already been stored for today. */
export async function hasTodayInterventionAction(action: string): Promise<boolean> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM interventions WHERE date = ? AND action = ?`,
    [todayISO(), action],
  );
  return (row?.n ?? 0) > 0;
}

/** Urge tool switch turned on — recovery plan active; returns session id. */
export async function startUrgeToolSession(): Promise<number> {
  const d = await getDB();
  const now = new Date().toISOString();
  const result = await d.runAsync(
    `INSERT INTO urge_tool_sessions (startedAt) VALUES (?)`,
    [now],
  );
  return result.lastInsertRowId;
}

/** Urge tool switch turned off — closes the active session. */
export async function endUrgeToolSession(sessionId: number): Promise<void> {
  const d = await getDB();
  const now = new Date().toISOString();
  await d.runAsync(
    `UPDATE urge_tool_sessions SET endedAt = ? WHERE id = ? AND endedAt IS NULL`,
    [now, sessionId],
  );
}

/** Log one completed recovery tile during an urge session (date/time = completedAt). */
export async function recordUrgeToolActionCompletion(
  sessionId: number,
  actionLabel: string,
): Promise<void> {
  const d = await getDB();
  const now = new Date().toISOString();
  await d.runAsync(
    `INSERT INTO urge_tool_action_completions (sessionId, actionLabel, completedAt) VALUES (?, ?, ?)`,
    [sessionId, actionLabel, now],
  );
}

// ─── Helpers: Onboarding ─────────────────────────────────────

export async function isOnboardingComplete(): Promise<boolean> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'onboarding_complete'`,
  );
  return row?.value === "1";
}

export async function setOnboardingComplete(): Promise<void> {
  const d = await getDB();
  await d.runAsync(
    `INSERT OR REPLACE INTO _meta (key, value) VALUES ('onboarding_complete', '1')`,
  );
}

// ─── Helpers: Detox Mode ──────────────────────────────────────

const ESSENTIAL_HABITS = new Set([
  "No Explicit Content",
  "No Porn",
  "No phone usage",
  "Limited Phone",
  "Limited Phone Usage",
  "Namaz",
  "Quran Reading",
  "Quran",
  "Quran (morning)",
  "Exercise",
  "Light Exercise",
  "Walk",
  "Morning walk",
  "Afternoon walk",
  "Sleep Before 12",
  "Sleep before 10 pm",
  "Fajr",
  "Zuhr",
  "Asr",
  "Maghrib",
  "Isha",
  "Surah Yaseen (after Fajr)",
  "Morning Surah Yaseen",
  "Surah Mulk",
  "Office Work",
]);

export function isEssentialHabit(name: string): boolean {
  return ESSENTIAL_HABITS.has(name);
}

export async function getDetoxEnabled(): Promise<boolean> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'detox_enabled'`,
  );
  return row?.value === "1";
}

export async function setDetoxEnabled(enabled: boolean): Promise<void> {
  const d = await getDB();
  await d.runAsync(
    `INSERT OR REPLACE INTO _meta (key, value) VALUES ('detox_enabled', ?)`,
    [enabled ? "1" : "0"],
  );
  if (enabled) {
    const existing = await d.getFirstAsync<{ value: string }>(
      `SELECT value FROM _meta WHERE key = 'detox_started_at'`,
    );
    if (!existing) {
      await d.runAsync(
        `INSERT OR REPLACE INTO _meta (key, value) VALUES ('detox_started_at', ?)`,
        [todayISO()],
      );
    }
  } else {
    await d.runAsync(`DELETE FROM _meta WHERE key = 'detox_started_at'`);
  }
}

export async function getDetoxStartDate(): Promise<string | null> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'detox_started_at'`,
  );
  return row?.value ?? null;
}

export async function getDetoxStreak(): Promise<number> {
  const d = await getDB();
  const startRow = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'detox_started_at'`,
  );
  if (!startRow) return 0;

  const startDate = new Date(startRow.value + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - startDate.getTime();
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

export async function getEssentialHabitsToday(
  mode?: Mode,
): Promise<(Habit & { completed: number })[]> {
  const all = await getTodayHabits(mode);
  return all.filter((h) => ESSENTIAL_HABITS.has(h.name));
}

// ─── Relapse tracking ─────────────────────────────────────────

export async function logRelapseEvent(opts: {
  triggerTag: string;
  note?: string;
}): Promise<void> {
  const d = await getDB();
  const now = new Date();
  const iso = now.toISOString();
  const hour = now.getHours();
  await d.runAsync(
    `INSERT INTO relapse_events (occurredAt, triggerTag, note, hourOfDay) VALUES (?, ?, ?, ?)`,
    [iso, opts.triggerTag, opts.note ?? "", hour],
  );
  const day = todayISO();
  const m = await getMetrics(day);
  await saveMetrics({
    screenTime: m?.screenTime ?? 0,
    riskScore: m?.riskScore ?? 0,
    relapse: 1,
    date: day,
  });
}

export async function getRelapseEvents(limit = 50): Promise<RelapseEvent[]> {
  const d = await getDB();
  return d.getAllAsync<RelapseEvent>(
    `SELECT * FROM relapse_events ORDER BY id DESC LIMIT ?`,
    [limit],
  );
}

export async function getTopRelapseTrigger(): Promise<{
  tag: string;
  count: number;
} | null> {
  const d = await getDB();
  return d.getFirstAsync<{ tag: string; count: number }>(
    `SELECT triggerTag AS tag, COUNT(*) AS count FROM relapse_events GROUP BY triggerTag ORDER BY count DESC LIMIT 1`,
  );
}

export async function getRiskiestRelapseHour(): Promise<{
  hour: number;
  count: number;
} | null> {
  const d = await getDB();
  return d.getFirstAsync<{ hour: number; count: number }>(
    `SELECT hourOfDay AS hour, COUNT(*) AS count FROM relapse_events GROUP BY hourOfDay ORDER BY count DESC LIMIT 1`,
  );
}

// ─── Time blocks ─────────────────────────────────────────────

export async function getTimeBlocks(activeOnly = false): Promise<TimeBlock[]> {
  const d = await getDB();
  const q = activeOnly
    ? `SELECT * FROM time_blocks WHERE active = 1 ORDER BY category, sortOrder, id`
    : `SELECT * FROM time_blocks ORDER BY category, sortOrder, id`;
  return d.getAllAsync<TimeBlock>(q);
}

export async function addTimeBlock(
  b: Omit<TimeBlock, "id" | "active"> & { active?: number },
): Promise<number> {
  const d = await getDB();
  const r = await d.runAsync(
    `INSERT INTO time_blocks (category, label, startTime, endTime, sortOrder, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [b.category, b.label, b.startTime, b.endTime, b.sortOrder, b.active ?? 1],
  );
  return r.lastInsertRowId;
}

export async function updateTimeBlock(
  id: number,
  updates: Partial<
    Pick<
      TimeBlock,
      "label" | "startTime" | "endTime" | "sortOrder" | "active" | "category"
    >
  >,
): Promise<void> {
  const d = await getDB();
  const sets: string[] = [];
  const vals: (string | number)[] = [];
  if (updates.category !== undefined) {
    sets.push("category = ?");
    vals.push(updates.category);
  }
  if (updates.label !== undefined) {
    sets.push("label = ?");
    vals.push(updates.label);
  }
  if (updates.startTime !== undefined) {
    sets.push("startTime = ?");
    vals.push(updates.startTime);
  }
  if (updates.endTime !== undefined) {
    sets.push("endTime = ?");
    vals.push(updates.endTime);
  }
  if (updates.sortOrder !== undefined) {
    sets.push("sortOrder = ?");
    vals.push(updates.sortOrder);
  }
  if (updates.active !== undefined) {
    sets.push("active = ?");
    vals.push(updates.active);
  }
  if (sets.length === 0) return;
  vals.push(id);
  await d.runAsync(
    `UPDATE time_blocks SET ${sets.join(", ")} WHERE id = ?`,
    vals,
  );
}

export async function deleteTimeBlock(id: number): Promise<void> {
  const d = await getDB();
  await d.runAsync("DELETE FROM time_blocks WHERE id = ?", [id]);
}

export async function getTimeBlockLog(
  blockId: number,
  date: string,
): Promise<boolean> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ completed: number }>(
    `SELECT completed FROM time_block_logs WHERE blockId = ? AND date = ?`,
    [blockId, date],
  );
  return (row?.completed ?? 0) === 1;
}

export async function setTimeBlockLog(
  blockId: number,
  date: string,
  completed: boolean,
): Promise<void> {
  const d = await getDB();
  await d.runAsync(
    `INSERT INTO time_block_logs (blockId, date, completed) VALUES (?, ?, ?)
     ON CONFLICT(blockId, date) DO UPDATE SET completed = excluded.completed`,
    [blockId, date, completed ? 1 : 0],
  );
}

// ─── Focus / lock mode ───────────────────────────────────────

export async function getFocusLockEnabled(): Promise<boolean> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'focus_lock_enabled'`,
  );
  return row?.value === "1";
}

export async function setFocusLockEnabled(enabled: boolean): Promise<void> {
  const d = await getDB();
  await d.runAsync(
    `INSERT OR REPLACE INTO _meta (key, value) VALUES ('focus_lock_enabled', ?)`,
    [enabled ? "1" : "0"],
  );
}

export async function recordAppOpenEvent(): Promise<void> {
  const d = await getDB();
  const iso = new Date().toISOString();
  await d.runAsync(`INSERT INTO app_open_events (openedAt) VALUES (?)`, [iso]);
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  await d.runAsync(`DELETE FROM app_open_events WHERE openedAt < ?`, [cutoff]);
}

export async function getAppOpenCountSince(isoMin: string): Promise<number> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM app_open_events WHERE openedAt >= ?`,
    [isoMin],
  );
  return row?.n ?? 0;
}

export async function getFocusManualMinutes(
  date = todayISO(),
): Promise<number> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ manualMinutes: number }>(
    `SELECT manualMinutes FROM focus_daily WHERE date = ?`,
    [date],
  );
  return row?.manualMinutes ?? 0;
}

export async function setFocusManualMinutes(
  minutes: number,
  date = todayISO(),
): Promise<void> {
  const d = await getDB();
  await d.runAsync(
    `INSERT INTO focus_daily (date, manualMinutes) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET manualMinutes = excluded.manualMinutes`,
    [date, Math.max(0, minutes)],
  );
}

export async function addFocusManualMinutes(
  delta: number,
  date = todayISO(),
): Promise<number> {
  const cur = await getFocusManualMinutes(date);
  const next = Math.max(0, cur + delta);
  await setFocusManualMinutes(next, date);
  return next;
}

// ─── Life area balance ────────────────────────────────────────

export interface LifeAreaBalanceRow {
  lifeArea: LifeArea;
  total: number;
  done: number;
}

export async function getLifeAreaBalance(
  days = 7,
): Promise<LifeAreaBalanceRow[]> {
  const d = await getDB();
  const to = todayISO();
  const from = addCalendarDays(to, -days + 1);
  const rows = await d.getAllAsync<{
    lifeArea: LifeArea;
    total: number;
    done: number;
  }>(
    `SELECT h.lifeArea,
            COUNT(e.id) AS total,
            COALESCE(SUM(CASE WHEN e.completed = 1 THEN 1 ELSE 0 END), 0) AS done
     FROM habits h
     LEFT JOIN entries e ON e.habitId = h.id AND e.date BETWEEN ? AND ?
     GROUP BY h.lifeArea`,
    [from, to],
  );
  const areas: LifeArea[] = ["spiritual", "physical", "mental", "work"];
  const map = new Map(rows.map((r) => [r.lifeArea, r]));
  return areas.map(
    (lifeArea) => map.get(lifeArea) ?? { lifeArea, total: 0, done: 0 },
  );
}

// ─── Body & diet (Life OS) ───────────────────────────────────

export async function logBodyWeight(date: string, kg: number): Promise<void> {
  const d = await getDB();
  await d.runAsync(
    `INSERT INTO body_weight (date, kg) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET kg = excluded.kg`,
    [date, kg],
  );
}

export async function getBodyWeights(
  from: string,
  to: string,
): Promise<BodyWeightEntry[]> {
  const d = await getDB();
  return d.getAllAsync<BodyWeightEntry>(
    `SELECT date, kg FROM body_weight WHERE date BETWEEN ? AND ? ORDER BY date ASC`,
    [from, to],
  );
}

export async function getGoalWeightKg(): Promise<number | null> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'body_goal_kg'`,
  );
  if (!row?.value) return null;
  const n = parseFloat(row.value);
  return Number.isFinite(n) ? n : null;
}

export async function setGoalWeightKg(kg: number | null): Promise<void> {
  const d = await getDB();
  if (kg === null) {
    await d.runAsync(`DELETE FROM _meta WHERE key = 'body_goal_kg'`);
    return;
  }
  await d.runAsync(
    `INSERT OR REPLACE INTO _meta (key, value) VALUES ('body_goal_kg', ?)`,
    [String(kg)],
  );
}

export async function addExerciseEntry(
  date: string,
  type: string,
  durationMinutes: number,
): Promise<number> {
  const d = await getDB();
  const r = await d.runAsync(
    `INSERT INTO body_exercise (date, type, durationMinutes) VALUES (?, ?, ?)`,
    [date, type, Math.max(0, Math.round(durationMinutes))],
  );
  return r.lastInsertRowId;
}

export async function getExerciseEntries(
  from: string,
  to: string,
): Promise<ExerciseEntry[]> {
  const d = await getDB();
  return d.getAllAsync<ExerciseEntry>(
    `SELECT * FROM body_exercise WHERE date BETWEEN ? AND ? ORDER BY date DESC, id DESC`,
    [from, to],
  );
}

export async function getExerciseMinutesForDate(date: string): Promise<number> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ m: number }>(
    `SELECT COALESCE(SUM(durationMinutes), 0) AS m FROM body_exercise WHERE date = ?`,
    [date],
  );
  return row?.m ?? 0;
}

export async function getExerciseMinutesByDay(
  from: string,
  to: string,
): Promise<{ date: string; minutes: number }[]> {
  const d = await getDB();
  return d.getAllAsync<{ date: string; minutes: number }>(
    `SELECT date, COALESCE(SUM(durationMinutes), 0) AS minutes
     FROM body_exercise WHERE date BETWEEN ? AND ?
     GROUP BY date ORDER BY date ASC`,
    [from, to],
  );
}

export async function deleteExerciseEntry(id: number): Promise<void> {
  const d = await getDB();
  await d.runAsync(`DELETE FROM body_exercise WHERE id = ?`, [id]);
}

export async function addDietMeal(opts: {
  date: string;
  slot?: string;
  quality: MealQuality;
  overeating: boolean;
  hour: number;
}): Promise<number> {
  const d = await getDB();
  const r = await d.runAsync(
    `INSERT INTO diet_meals (date, slot, quality, overeating, hour) VALUES (?, ?, ?, ?, ?)`,
    [
      opts.date,
      opts.slot ?? "meal",
      opts.quality,
      opts.overeating ? 1 : 0,
      Math.min(23, Math.max(0, Math.round(opts.hour))),
    ],
  );
  return r.lastInsertRowId;
}

export async function getDietMealsForDate(date: string): Promise<DietMeal[]> {
  const d = await getDB();
  return d.getAllAsync<DietMeal>(
    `SELECT * FROM diet_meals WHERE date = ? ORDER BY hour ASC, id ASC`,
    [date],
  );
}

export async function getDietMealsRange(
  from: string,
  to: string,
): Promise<DietMeal[]> {
  const d = await getDB();
  return d.getAllAsync<DietMeal>(
    `SELECT * FROM diet_meals WHERE date BETWEEN ? AND ? ORDER BY date DESC, hour DESC`,
    [from, to],
  );
}

export async function deleteDietMeal(id: number): Promise<void> {
  const d = await getDB();
  await d.runAsync(`DELETE FROM diet_meals WHERE id = ?`, [id]);
}

const defaultDietRules: DietRules = {
  noLateEating: true,
  lateHour: 21,
  lightDinner: true,
  noJunkWeekdays: false,
};

export async function getDietRules(): Promise<DietRules> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'diet_rules_json'`,
  );
  if (!row?.value) return { ...defaultDietRules };
  try {
    const parsed = JSON.parse(row.value) as Partial<DietRules>;
    return {
      noLateEating: !!parsed.noLateEating,
      lateHour:
        typeof parsed.lateHour === "number" ? parsed.lateHour : defaultDietRules.lateHour,
      lightDinner: !!parsed.lightDinner,
      noJunkWeekdays: !!parsed.noJunkWeekdays,
    };
  } catch {
    return { ...defaultDietRules };
  }
}

export async function setDietRules(rules: DietRules): Promise<void> {
  const d = await getDB();
  await d.runAsync(
    `INSERT OR REPLACE INTO _meta (key, value) VALUES ('diet_rules_json', ?)`,
    [JSON.stringify(rules)],
  );
}

// ─── Life OS: hard mode, urges, daily reset, anti-laziness ─────

export async function getHardMode(): Promise<boolean> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'hard_mode'`,
  );
  return row?.value === "1";
}

export async function setHardMode(enabled: boolean): Promise<void> {
  const d = await getDB();
  await d.runAsync(
    `INSERT OR REPLACE INTO _meta (key, value) VALUES ('hard_mode', ?)`,
    [enabled ? "1" : "0"],
  );
}

export async function getHabitCompletionForDate(
  date: string,
): Promise<{ total: number; done: number }> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ total: number; done: number }>(
    `SELECT COUNT(DISTINCT h.id) AS total,
            COUNT(DISTINCT CASE WHEN e.completed = 1 THEN h.id END) AS done
     FROM habits h
     LEFT JOIN entries e ON e.habitId = h.id AND e.date = ?`,
    [date],
  );
  return { total: row?.total ?? 0, done: row?.done ?? 0 };
}

/** Consecutive days ending today where every habit is completed (only when Hard Mode is on). */
export async function getHardModeStreak(): Promise<number> {
  if (!(await getHardMode())) return 0;
  let streak = 0;
  let day = todayISO();
  for (let i = 0; i < 400; i++) {
    const r = await getHabitCompletionForDate(day);
    if (r.total === 0) break;
    if (r.done < r.total) break;
    streak++;
    day = addCalendarDays(day, -1);
  }
  return streak;
}

export async function logUrge(opts: {
  intensity: number;
  triggerTag?: string;
  note?: string;
  loggedAt?: string;
}): Promise<number> {
  const d = await getDB();
  const iso = opts.loggedAt ?? new Date().toISOString();
  const inten = Math.min(10, Math.max(1, Math.round(opts.intensity)));
  const r = await d.runAsync(
    `INSERT INTO urge_logs (loggedAt, intensity, triggerTag, note) VALUES (?, ?, ?, ?)`,
    [iso, inten, opts.triggerTag ?? "", opts.note ?? ""],
  );
  return r.lastInsertRowId;
}

export async function getUrgeLogs(limit = 300): Promise<UrgeLog[]> {
  const d = await getDB();
  return d.getAllAsync<UrgeLog>(
    `SELECT * FROM urge_logs ORDER BY id DESC LIMIT ?`,
    [limit],
  );
}

export async function deleteUrgeLog(id: number): Promise<void> {
  const d = await getDB();
  await d.runAsync(`DELETE FROM urge_logs WHERE id = ?`, [id]);
}

export async function getDailyReset(date = todayISO()): Promise<DailyReset | null> {
  const d = await getDB();
  return d.getFirstAsync<DailyReset>(
    `SELECT * FROM daily_reset WHERE date = ?`,
    [date],
  );
}

export async function saveDailyMorning(
  date: string,
  plan: string,
): Promise<void> {
  const d = await getDB();
  const iso = new Date().toISOString();
  const existing = await getDailyReset(date);
  await d.runAsync(
    `INSERT INTO daily_reset (date, morningPlan, nightReflection, morningSavedAt, nightSavedAt)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       morningPlan = excluded.morningPlan,
       morningSavedAt = excluded.morningSavedAt`,
    [
      date,
      plan,
      existing?.nightReflection ?? "",
      iso,
      existing?.nightSavedAt ?? null,
    ],
  );
}

export async function saveDailyNight(
  date: string,
  reflection: string,
): Promise<void> {
  const d = await getDB();
  const iso = new Date().toISOString();
  const existing = await getDailyReset(date);
  await d.runAsync(
    `INSERT INTO daily_reset (date, morningPlan, nightReflection, morningSavedAt, nightSavedAt)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       nightReflection = excluded.nightReflection,
       nightSavedAt = excluded.nightSavedAt`,
    [
      date,
      existing?.morningPlan ?? "",
      reflection,
      existing?.morningSavedAt ?? null,
      iso,
    ],
  );
}

export async function recordLastActiveNow(): Promise<void> {
  const d = await getDB();
  const iso = new Date().toISOString();
  await d.runAsync(
    `INSERT OR REPLACE INTO _meta (key, value) VALUES ('last_active_iso', ?)`,
    [iso],
  );
}

export async function getLastActiveIso(): Promise<string | null> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'last_active_iso'`,
  );
  return row?.value ?? null;
}

export async function getAntiLazinessEnabled(): Promise<boolean> {
  const d = await getDB();
  const row = await d.getFirstAsync<{ value: string }>(
    `SELECT value FROM _meta WHERE key = 'anti_laziness'`,
  );
  return row?.value === "1";
}

export async function setAntiLazinessEnabled(enabled: boolean): Promise<void> {
  const d = await getDB();
  await d.runAsync(
    `INSERT OR REPLACE INTO _meta (key, value) VALUES ('anti_laziness', ?)`,
    [enabled ? "1" : "0"],
  );
}

// ─── Achievements (storage) ───────────────────────────────────

export async function getUnlockedAchievementIds(): Promise<
  AchievementUnlockRow[]
> {
  const d = await getDB();
  return d.getAllAsync<AchievementUnlockRow>(
    `SELECT achievementId, unlockedAt FROM achievements_unlocked ORDER BY unlockedAt ASC`,
  );
}

export async function unlockAchievement(id: string): Promise<void> {
  const d = await getDB();
  const iso = new Date().toISOString();
  await d.runAsync(
    `INSERT OR IGNORE INTO achievements_unlocked (achievementId, unlockedAt) VALUES (?, ?)`,
    [id, iso],
  );
}
