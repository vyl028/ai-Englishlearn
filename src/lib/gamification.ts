"use client";

import type { CapturedWord } from "@/lib/types";

export const GAMIFICATION_STORAGE_KEY = "lexi-capture-gamification";

export type BadgeId = "streak_3" | "streak_7" | "streak_14" | "mastered_10" | "mastered_100";

export type GamificationDayStats = {
  xpEarned: number;
  wordsAdded: number;
  practiceCompleted: number;
  storiesGenerated: number;
};

export type GamificationState = {
  version: 1;
  xp: number;
  unlockedBadges: BadgeId[];
  streak: {
    current: number;
    longest: number;
    lastActiveDate?: string; // yyyy-MM-dd
  };
  totals: {
    wordsAdded: number;
    practiceCompleted: number;
    storiesGenerated: number;
    masteredMarked: number;
  };
  daily: Record<string, GamificationDayStats>;
};

export type LearningEvent =
  | { type: "words_added"; count: number; at?: Date }
  | { type: "practice_completed"; correctCount: number; totalCount: number; at?: Date }
  | { type: "story_generated"; at?: Date }
  | { type: "mastery_marked"; termKey: string; at?: Date };

const ALL_BADGES: readonly BadgeId[] = ["streak_3", "streak_7", "streak_14", "mastered_10", "mastered_100"] as const;

const XP_RULES = {
  dailyCheckIn: 10,
  perWordAdded: 5,
  practiceBase: 30,
  practicePerCorrect: 2,
  storyGenerated: 20,
  masteryMarked: 10,
} as const;

const MAX_DAILY_DAYS = 400;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function toSafeInt(v: unknown, fallback: number) {
  if (typeof v !== "number") return fallback;
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.floor(v));
}

function isBadgeId(v: unknown): v is BadgeId {
  return typeof v === "string" && (ALL_BADGES as readonly string[]).includes(v);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function addDaysLocal(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function getRecentDateKeys(days: number, endDate = new Date()) {
  const safeDays = Math.max(1, Math.min(120, Math.floor(days)));
  const keys: string[] = [];
  for (let i = safeDays - 1; i >= 0; i--) {
    keys.push(formatDateKey(addDaysLocal(endDate, -i)));
  }
  return keys;
}

export function normalizeTermKey(raw: string) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s"'“”‘’()[\]{}<>.,!?;:]+|[\s"'“”‘’()[\]{}<>.,!?;:]+$/g, "");
}

export function computeWordStats(words: CapturedWord[]) {
  const unique = new Set<string>();
  const mastered = new Set<string>();

  for (const w of words) {
    const key = normalizeTermKey(w.word);
    if (!key) continue;
    unique.add(key);
    if (w.mastered === true) mastered.add(key);
  }

  return { uniqueCount: unique.size, masteredCount: mastered.size };
}

export function createDefaultGamificationState(): GamificationState {
  return {
    version: 1,
    xp: 0,
    unlockedBadges: [],
    streak: { current: 0, longest: 0, lastActiveDate: undefined },
    totals: { wordsAdded: 0, practiceCompleted: 0, storiesGenerated: 0, masteredMarked: 0 },
    daily: {},
  };
}

export function normalizeGamificationState(raw: unknown): GamificationState {
  const base = createDefaultGamificationState();
  if (!isRecord(raw)) return base;
  const version = raw.version === 1 ? 1 : 1;

  const streakRaw = isRecord(raw.streak) ? raw.streak : {};
  const totalsRaw = isRecord(raw.totals) ? raw.totals : {};
  const dailyRaw = isRecord(raw.daily) ? raw.daily : {};

  const unlocked = Array.isArray(raw.unlockedBadges) ? raw.unlockedBadges.filter(isBadgeId) : [];

  const daily: Record<string, GamificationDayStats> = {};
  for (const [k, v] of Object.entries(dailyRaw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    if (!isRecord(v)) continue;
    daily[k] = {
      xpEarned: toSafeInt(v.xpEarned, 0),
      wordsAdded: toSafeInt(v.wordsAdded, 0),
      practiceCompleted: toSafeInt(v.practiceCompleted, 0),
      storiesGenerated: toSafeInt(v.storiesGenerated, 0),
    };
  }

  return pruneDaily({
    version,
    xp: toSafeInt(raw.xp, 0),
    unlockedBadges: unlocked,
    streak: {
      current: toSafeInt(streakRaw.current, 0),
      longest: toSafeInt(streakRaw.longest, 0),
      lastActiveDate: typeof streakRaw.lastActiveDate === "string" ? streakRaw.lastActiveDate : undefined,
    },
    totals: {
      wordsAdded: toSafeInt(totalsRaw.wordsAdded, 0),
      practiceCompleted: toSafeInt(totalsRaw.practiceCompleted, 0),
      storiesGenerated: toSafeInt(totalsRaw.storiesGenerated, 0),
      masteredMarked: toSafeInt(totalsRaw.masteredMarked, 0),
    },
    daily,
  });
}

function ensureDay(state: GamificationState, dateKey: string) {
  const existing = state.daily[dateKey];
  if (existing) return existing;
  return { xpEarned: 0, wordsAdded: 0, practiceCompleted: 0, storiesGenerated: 0 } satisfies GamificationDayStats;
}

function addXp(state: GamificationState, dateKey: string, amount: number): GamificationState {
  const safe = Math.max(0, Math.floor(amount));
  if (safe === 0) return state;
  const day = ensureDay(state, dateKey);
  return {
    ...state,
    xp: state.xp + safe,
    daily: {
      ...state.daily,
      [dateKey]: { ...day, xpEarned: day.xpEarned + safe },
    },
  };
}

function addDayStat(
  state: GamificationState,
  dateKey: string,
  patch: Partial<Omit<GamificationDayStats, "xpEarned">>
): GamificationState {
  const day = ensureDay(state, dateKey);
  return {
    ...state,
    daily: {
      ...state.daily,
      [dateKey]: {
        ...day,
        wordsAdded: day.wordsAdded + (patch.wordsAdded || 0),
        practiceCompleted: day.practiceCompleted + (patch.practiceCompleted || 0),
        storiesGenerated: day.storiesGenerated + (patch.storiesGenerated || 0),
      },
    },
  };
}

function checkInIfNeeded(state: GamificationState, dateKey: string, at: Date): GamificationState {
  if (state.streak.lastActiveDate === dateKey) return state;

  const yesterdayKey = formatDateKey(addDaysLocal(at, -1));
  const nextCurrent = state.streak.lastActiveDate === yesterdayKey ? state.streak.current + 1 : 1;
  const nextLongest = Math.max(state.streak.longest, nextCurrent);

  const withStreak: GamificationState = {
    ...state,
    streak: {
      ...state.streak,
      current: nextCurrent,
      longest: nextLongest,
      lastActiveDate: dateKey,
    },
  };

  return addXp(withStreak, dateKey, XP_RULES.dailyCheckIn);
}

function unlockBadges(state: GamificationState, patch: Partial<Record<BadgeId, boolean>>): GamificationState {
  const next = new Set(state.unlockedBadges);
  for (const [k, v] of Object.entries(patch)) {
    if (v !== true) continue;
    if (isBadgeId(k)) next.add(k);
  }
  const nextArr = Array.from(next);
  if (nextArr.length === state.unlockedBadges.length) return state;
  return { ...state, unlockedBadges: nextArr };
}

function unlockBadgesFromStreak(state: GamificationState): GamificationState {
  const longest = state.streak.longest;
  return unlockBadges(state, {
    streak_3: longest >= 3,
    streak_7: longest >= 7,
    streak_14: longest >= 14,
  });
}

function unlockBadgesFromMastery(state: GamificationState, masteredCount: number): GamificationState {
  return unlockBadges(state, {
    mastered_10: masteredCount >= 10,
    mastered_100: masteredCount >= 100,
  });
}

function pruneDaily(state: GamificationState): GamificationState {
  const keys = Object.keys(state.daily);
  if (keys.length <= MAX_DAILY_DAYS) return state;
  const sorted = keys.sort(); // yyyy-MM-dd sorts lexicographically
  const removeCount = sorted.length - MAX_DAILY_DAYS;
  const nextDaily: Record<string, GamificationDayStats> = { ...state.daily };
  for (let i = 0; i < removeCount; i++) {
    delete nextDaily[sorted[i]];
  }
  return { ...state, daily: nextDaily };
}

export function applyLearningEvent(prev: GamificationState, event: LearningEvent): GamificationState {
  const at = event.at ?? new Date();
  const dateKey = formatDateKey(at);

  let next = checkInIfNeeded(prev, dateKey, at);

  switch (event.type) {
    case "words_added": {
      const count = Math.max(0, Math.floor(event.count));
      if (count <= 0) break;
      next = addDayStat(next, dateKey, { wordsAdded: count });
      next = {
        ...next,
        totals: { ...next.totals, wordsAdded: next.totals.wordsAdded + count },
      };
      next = addXp(next, dateKey, count * XP_RULES.perWordAdded);
      break;
    }
    case "practice_completed": {
      next = addDayStat(next, dateKey, { practiceCompleted: 1 });
      next = {
        ...next,
        totals: { ...next.totals, practiceCompleted: next.totals.practiceCompleted + 1 },
      };
      const correct = Math.max(0, Math.floor(event.correctCount));
      const base = XP_RULES.practiceBase + correct * XP_RULES.practicePerCorrect;
      next = addXp(next, dateKey, base);
      break;
    }
    case "story_generated": {
      next = addDayStat(next, dateKey, { storiesGenerated: 1 });
      next = {
        ...next,
        totals: { ...next.totals, storiesGenerated: next.totals.storiesGenerated + 1 },
      };
      next = addXp(next, dateKey, XP_RULES.storyGenerated);
      break;
    }
    case "mastery_marked": {
      next = {
        ...next,
        totals: { ...next.totals, masteredMarked: next.totals.masteredMarked + 1 },
      };
      next = addXp(next, dateKey, XP_RULES.masteryMarked);
      break;
    }
    default:
      break;
  }

  next = unlockBadgesFromStreak(next);
  return pruneDaily(next);
}

export function syncBadgesWithWords(prev: GamificationState, words: CapturedWord[]): GamificationState {
  const { masteredCount } = computeWordStats(words);
  const next = unlockBadgesFromMastery(prev, masteredCount);
  return next;
}

export function getLevelInfo(xp: number) {
  const safeXp = Math.max(0, Math.floor(xp));

  const totalXpForLevel = (level: number) => {
    const l = Math.max(1, Math.floor(level));
    return (100 * (l - 1) * l) / 2;
  };

  let level = 1;
  while (safeXp >= totalXpForLevel(level + 1)) level += 1;

  const levelStart = totalXpForLevel(level);
  const nextStart = totalXpForLevel(level + 1);
  const into = safeXp - levelStart;
  const need = nextStart - levelStart;
  const progress = need > 0 ? into / need : 1;

  return {
    level,
    xp: safeXp,
    xpIntoLevel: into,
    xpForNextLevel: need,
    xpToNextLevel: Math.max(0, need - into),
    progress: Math.max(0, Math.min(1, progress)),
  };
}

