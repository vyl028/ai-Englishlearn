"use client";

import { formatDateKey } from "@/lib/gamification";

export const SPEAKING_TRAINING_STATS_STORAGE_KEY = "lexi-capture-speaking-training-stats-v1";

export type SpeakingTrainingDayStats = {
  attempts: number;
  scoreSum: number;
  best: number;
  last: number;
  lastAt?: number;
};

export type SpeakingTrainingStatsStore = {
  version: 1;
  days: Record<string, SpeakingTrainingDayStats>;
};

const MAX_DAYS = 400;

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

function toSafeInt(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function toSafeScore(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function createDefaultSpeakingTrainingStatsStore(): SpeakingTrainingStatsStore {
  return { version: 1, days: {} };
}

export function normalizeSpeakingTrainingStatsStore(raw: unknown): SpeakingTrainingStatsStore {
  const base = createDefaultSpeakingTrainingStatsStore();
  if (!isRecord(raw)) return base;

  const daysRaw = isRecord(raw.days) ? raw.days : {};
  const days: Record<string, SpeakingTrainingDayStats> = {};
  for (const [k, v] of Object.entries(daysRaw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
    if (!isRecord(v)) continue;
    const attempts = toSafeInt(v.attempts, 0);
    const scoreSum = toSafeInt(v.scoreSum, 0);
    const best = toSafeScore(v.best, 0);
    const last = toSafeScore(v.last, 0);
    const lastAt = typeof v.lastAt === "number" && Number.isFinite(v.lastAt) ? v.lastAt : undefined;
    if (attempts <= 0 && scoreSum <= 0 && best <= 0 && last <= 0 && !lastAt) continue;
    days[k] = { attempts, scoreSum, best, last, lastAt };
  }

  return pruneDays({ version: 1, days });
}

function pruneDays(store: SpeakingTrainingStatsStore): SpeakingTrainingStatsStore {
  const keys = Object.keys(store.days).sort(); // yyyy-MM-dd
  if (keys.length <= MAX_DAYS) return store;
  const keep = new Set(keys.slice(keys.length - MAX_DAYS));
  const nextDays: Record<string, SpeakingTrainingDayStats> = {};
  for (const k of keys) {
    if (!keep.has(k)) continue;
    nextDays[k] = store.days[k]!;
  }
  return { ...store, days: nextDays };
}

export function readSpeakingTrainingStatsStore(): SpeakingTrainingStatsStore {
  if (typeof window === "undefined") return createDefaultSpeakingTrainingStatsStore();
  try {
    const raw = safeParseJson(window.localStorage.getItem(SPEAKING_TRAINING_STATS_STORAGE_KEY));
    return normalizeSpeakingTrainingStatsStore(raw);
  } catch {
    return createDefaultSpeakingTrainingStatsStore();
  }
}

export function writeSpeakingTrainingStatsStore(store: SpeakingTrainingStatsStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SPEAKING_TRAINING_STATS_STORAGE_KEY, JSON.stringify({ ...store, version: 1 }));
  } catch {
    // ignore
  }
}

export function recordSpeakingTrainingAttempt(params: { score: number; at?: Date }) {
  const at = params.at || new Date();
  const score = toSafeScore(params.score, 0);
  const dateKey = formatDateKey(at);

  const store = readSpeakingTrainingStatsStore();
  const prev = store.days[dateKey] || { attempts: 0, scoreSum: 0, best: 0, last: 0, lastAt: undefined };
  const nextDay: SpeakingTrainingDayStats = {
    attempts: prev.attempts + 1,
    scoreSum: prev.scoreSum + score,
    best: Math.max(prev.best || 0, score),
    last: score,
    lastAt: at.getTime(),
  };

  const nextStore = pruneDays({ ...store, days: { ...store.days, [dateKey]: nextDay } });
  writeSpeakingTrainingStatsStore(nextStore);
  return nextStore;
}

