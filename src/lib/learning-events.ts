"use client";

import { generateId } from "@/lib/utils";

export const LEARNING_EVENTS_STORAGE_KEY = "lexi-capture-learning-events-v1";

export type LearningEvent =
  | {
      id: string;
      type: "words_added";
      count: number;
      at: number;
    }
  | {
      id: string;
      type: "practice_completed";
      correctCount: number;
      totalCount: number;
      at: number;
    }
  | {
      id: string;
      type: "story_generated";
      wordCount: number;
      at: number;
    };

export type LearningEventsStore = {
  version: 1;
  events: LearningEvent[];
};

const MAX_EVENTS = 120;

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

function toSafeInt(v: unknown, fallback: number, min = 0, max = 999999) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function toSafeAt(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

export function createDefaultLearningEventsStore(): LearningEventsStore {
  return { version: 1, events: [] };
}

export function normalizeLearningEventsStore(raw: unknown): LearningEventsStore {
  const base = createDefaultLearningEventsStore();
  if (!isRecord(raw)) return base;
  const list = Array.isArray(raw.events) ? raw.events : [];

  const events: LearningEvent[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const type = typeof item.type === "string" ? item.type : "";
    const at = toSafeAt(item.at, 0);
    const id = typeof item.id === "string" && item.id.trim() ? item.id : generateId();

    if (type === "words_added") {
      const count = toSafeInt(item.count, 0);
      if (count <= 0) continue;
      events.push({ id, type: "words_added", count, at });
      continue;
    }

    if (type === "practice_completed") {
      const correctCount = toSafeInt(item.correctCount, 0, 0, 2000);
      const totalCount = toSafeInt(item.totalCount, 0, 0, 2000);
      if (totalCount <= 0) continue;
      events.push({ id, type: "practice_completed", correctCount, totalCount, at });
      continue;
    }

    if (type === "story_generated") {
      const wordCount = toSafeInt(item.wordCount, 0, 0, 20000);
      events.push({ id, type: "story_generated", wordCount, at });
      continue;
    }
  }

  events.sort((a, b) => (b.at || 0) - (a.at || 0));
  return { version: 1, events: events.slice(0, MAX_EVENTS) };
}

export function readLearningEventsStore(): LearningEventsStore {
  if (typeof window === "undefined") return createDefaultLearningEventsStore();
  try {
    const raw = safeParseJson(window.localStorage.getItem(LEARNING_EVENTS_STORAGE_KEY));
    return normalizeLearningEventsStore(raw);
  } catch {
    return createDefaultLearningEventsStore();
  }
}

export function writeLearningEventsStore(store: LearningEventsStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LEARNING_EVENTS_STORAGE_KEY, JSON.stringify({ ...store, version: 1 }));
  } catch {
    // ignore
  }
}

export type LearningEventInput =
  | { type: "words_added"; count: number; at?: Date }
  | { type: "practice_completed"; correctCount: number; totalCount: number; at?: Date }
  | { type: "story_generated"; wordCount: number; at?: Date };

export function recordLearningEvent(input: LearningEventInput) {
  const at = input.at ? input.at.getTime() : Date.now();
  const store = readLearningEventsStore();
  const id = generateId();

  let event: LearningEvent | null = null;
  if (input.type === "words_added") {
    const count = toSafeInt(input.count, 0);
    if (count > 0) event = { id, type: "words_added", count, at };
  } else if (input.type === "practice_completed") {
    const correctCount = toSafeInt(input.correctCount, 0, 0, 2000);
    const totalCount = toSafeInt(input.totalCount, 0, 0, 2000);
    if (totalCount > 0) event = { id, type: "practice_completed", correctCount, totalCount, at };
  } else if (input.type === "story_generated") {
    const wordCount = toSafeInt(input.wordCount, 0, 0, 20000);
    event = { id, type: "story_generated", wordCount, at };
  }

  if (!event) return store;
  const next = { ...store, events: [event, ...store.events].slice(0, MAX_EVENTS) } satisfies LearningEventsStore;
  writeLearningEventsStore(next);
  return next;
}

export function clearLearningEvents() {
  writeLearningEventsStore(createDefaultLearningEventsStore());
}

