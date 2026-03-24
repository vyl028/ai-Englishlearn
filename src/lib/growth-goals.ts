"use client";

export const GROWTH_GOALS_STORAGE_KEY = "lexi-capture-growth-goals-v1";

export type GrowthGoals = {
  version: 1;
  weeklyXpGoal: number; // 0 means disabled
  weeklyWordsGoal: number; // 0 means disabled
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function safeParseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function toSafeInt(v: unknown, fallback: number, min = 0, max = 50000) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export function createDefaultGrowthGoals(): GrowthGoals {
  return { version: 1, weeklyXpGoal: 200, weeklyWordsGoal: 20 };
}

export function normalizeGrowthGoals(raw: unknown): GrowthGoals {
  const base = createDefaultGrowthGoals();
  if (!isRecord(raw)) return base;
  return {
    version: 1,
    weeklyXpGoal: toSafeInt(raw.weeklyXpGoal, base.weeklyXpGoal, 0, 999999),
    weeklyWordsGoal: toSafeInt(raw.weeklyWordsGoal, base.weeklyWordsGoal, 0, 999999),
  };
}

export function readGrowthGoals(): GrowthGoals {
  if (typeof window === "undefined") return createDefaultGrowthGoals();
  const raw = safeParseJson(window.localStorage.getItem(GROWTH_GOALS_STORAGE_KEY));
  return normalizeGrowthGoals(raw);
}

export function writeGrowthGoals(goals: GrowthGoals) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GROWTH_GOALS_STORAGE_KEY, JSON.stringify({ ...goals, version: 1 }));
  } catch {
    // ignore
  }
}

