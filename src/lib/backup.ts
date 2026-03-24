"use client";

import { GAMIFICATION_STORAGE_KEY, normalizeGamificationState } from "@/lib/gamification";
import { GROWTH_GOALS_STORAGE_KEY, normalizeGrowthGoals } from "@/lib/growth-goals";
import { LEARNING_EVENTS_STORAGE_KEY, normalizeLearningEventsStore, type LearningEvent } from "@/lib/learning-events";
import { SPEAKING_TRAINING_STATS_STORAGE_KEY, normalizeSpeakingTrainingStatsStore, type SpeakingTrainingDayStats } from "@/lib/speaking-training-stats";

export const BACKUP_SCHEMA_V1 = "lexi-capture-backup-v1";
export const BACKUP_STORAGE_VERSION = 1 as const;

const WORDS_STORAGE_KEY = "lexi-capture-words";
const GROUPS_STORAGE_KEY = "lexi-capture-groups";
const SELECTED_GROUP_STORAGE_KEY = "lexi-capture-selected-group";
const LAST_VIEW_STORAGE_KEY = "lexi-capture-last-view";
const THEME_STORAGE_KEY = "lexi-theme";

const ESSAY_REVIEW_DRAFT_STORAGE_KEY = "lexi-capture-essay-review-draft-v1";
const ESSAY_REVIEW_LAST_STORAGE_KEY = "lexi-capture-essay-review-last-v1";
const ESSAY_REVIEW_HISTORY_STORAGE_KEY = "lexi-capture-essay-review-history-v1";

const READING_QUESTION_STATS_STORAGE_KEY = "lexi-capture-reading-question-stats-v1";
const SPEAKING_SETTINGS_STORAGE_KEY = "lexi-capture-speaking-settings-v1";

export type BackupScope = "full" | "words" | "growth";
export type ImportStrategy = "overwrite" | "merge";

type PersistedCapturedWord = {
  id: string;
  word: string;
  partOfSpeech: string;
  definition: string;
  capturedAt: string;
  groupId?: string;
  mastered?: boolean;
  enrichment?: unknown;
  photoDataUri?: string;
};

type WordGroup = { id: string; name: string };

type ReadingQuestionStatsEntry = {
  attempts: number;
  best: number;
  last: number;
  total: number;
  bestAt?: number;
  lastAt?: number;
};

export type BackupDataV1 = Partial<{
  words: PersistedCapturedWord[];
  groups: WordGroup[];
  selectedGroupId: string;
  lastView: string;
  theme: string;
  gamification: unknown;
  growthGoals: unknown;
  learningEvents: unknown;
  speakingTrainingStats: unknown;
  speakingSettings: unknown;
  essayReviewDraft: unknown;
  essayReviewLast: unknown;
  essayReviewHistory: unknown;
  readingQuestionStats: unknown;
}>;

export type LexiCaptureBackupV1 = {
  schema: typeof BACKUP_SCHEMA_V1;
  storageVersion: typeof BACKUP_STORAGE_VERSION;
  scope: BackupScope;
  exportedAt: string;
  data: BackupDataV1;
};

type GrowthExportV1 = {
  schema: "lexi-capture-growth-export-v1";
  exportedAt?: unknown;
  gamification?: unknown;
  growthGoals?: unknown;
  learningEvents?: unknown;
  speakingTrainingStats?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function safeParseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function tryRepairJsonText(raw: string): string | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // continue
  }

  const candidates: string[] = [];
  const firstObj = trimmed.indexOf("{");
  const lastObj = trimmed.lastIndexOf("}");
  if (firstObj >= 0 && lastObj > firstObj) candidates.push(trimmed.slice(firstObj, lastObj + 1));
  const firstArr = trimmed.indexOf("[");
  const lastArr = trimmed.lastIndexOf("]");
  if (firstArr >= 0 && lastArr > firstArr) candidates.push(trimmed.slice(firstArr, lastArr + 1));

  for (const c of candidates) {
    try {
      JSON.parse(c);
      return c;
    } catch {
      // ignore
    }
  }
  return null;
}

function readLocalStorageString(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalStorageString(key: string, value: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
}

function removeLocalStorageKey(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

function toSafeInt(v: unknown, fallback: number, min = 0, max = 999999) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function normalizeWords(raw: unknown): PersistedCapturedWord[] {
  if (!Array.isArray(raw)) return [];
  const out: PersistedCapturedWord[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const word = typeof item.word === "string" ? item.word : "";
    const partOfSpeech = typeof item.partOfSpeech === "string" ? item.partOfSpeech : "";
    const definition = typeof item.definition === "string" ? item.definition : "";
    const capturedAtRaw = typeof item.capturedAt === "string" ? item.capturedAt : "";
    if (!id || !word || !partOfSpeech || !definition) continue;
    const capturedAt = Number.isNaN(new Date(capturedAtRaw).getTime()) ? new Date().toISOString() : capturedAtRaw;
    const groupId = typeof item.groupId === "string" && item.groupId.trim() ? item.groupId : undefined;
    const mastered = typeof item.mastered === "boolean" ? item.mastered : undefined;
    const photoDataUri = typeof item.photoDataUri === "string" && item.photoDataUri ? item.photoDataUri : undefined;
    out.push({
      id,
      word,
      partOfSpeech,
      definition,
      capturedAt,
      groupId,
      mastered,
      enrichment: item.enrichment,
      photoDataUri,
    });
  }
  return out;
}

function normalizeGroups(raw: unknown): WordGroup[] {
  if (!Array.isArray(raw)) return [];
  const out: WordGroup[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!id || !name) continue;
    out.push({ id, name });
  }
  return out;
}

function normalizeReadingQuestionStats(raw: unknown): Record<string, ReadingQuestionStatsEntry> {
  if (!isRecord(raw)) return {};
  const out: Record<string, ReadingQuestionStatsEntry> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!k) continue;
    if (!isRecord(v)) continue;
    const attempts = toSafeInt(v.attempts, 0, 0, 999999);
    const best = toSafeInt(v.best, 0, 0, 999999);
    const last = toSafeInt(v.last, 0, 0, 999999);
    const total = toSafeInt(v.total, 0, 0, 999999);
    const bestAt = typeof v.bestAt === "number" && Number.isFinite(v.bestAt) ? Math.max(0, Math.floor(v.bestAt)) : undefined;
    const lastAt = typeof v.lastAt === "number" && Number.isFinite(v.lastAt) ? Math.max(0, Math.floor(v.lastAt)) : undefined;
    if (total <= 0) continue;
    out[k] = { attempts, best, last, total, bestAt, lastAt };
  }
  return out;
}

function mergeWordLists(existing: PersistedCapturedWord[], incoming: PersistedCapturedWord[]) {
  const byId = new Map<string, PersistedCapturedWord>();
  for (const w of existing) byId.set(w.id, w);
  for (const w of incoming) {
    if (!byId.has(w.id)) byId.set(w.id, w);
  }
  return Array.from(byId.values());
}

function mergeGroups(existing: WordGroup[], incoming: WordGroup[]) {
  const ids = new Set(existing.map((g) => g.id));
  const next = [...existing];
  for (const g of incoming) {
    if (ids.has(g.id)) continue;
    ids.add(g.id);
    next.push(g);
  }
  return next;
}

function mergeLearningEvents(existing: LearningEvent[], incoming: LearningEvent[]) {
  const byId = new Map<string, LearningEvent>();
  for (const e of existing) byId.set(e.id, e);
  for (const e of incoming) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  const merged = Array.from(byId.values());
  merged.sort((a, b) => (b.at || 0) - (a.at || 0));
  return merged;
}

function mergeSpeakingTrainingDayStats(a: SpeakingTrainingDayStats | undefined, b: SpeakingTrainingDayStats | undefined): SpeakingTrainingDayStats | undefined {
  if (!a && !b) return undefined;
  const base = a || { attempts: 0, scoreSum: 0, best: 0, last: 0, lastAt: undefined };
  const inc = b || { attempts: 0, scoreSum: 0, best: 0, last: 0, lastAt: undefined };
  const lastAt = Math.max(base.lastAt || 0, inc.lastAt || 0) || undefined;
  const preferIncomingLast = (inc.lastAt || 0) >= (base.lastAt || 0);
  return {
    attempts: Math.max(base.attempts || 0, inc.attempts || 0),
    scoreSum: Math.max(base.scoreSum || 0, inc.scoreSum || 0),
    best: Math.max(base.best || 0, inc.best || 0),
    last: preferIncomingLast ? (inc.last || 0) : (base.last || 0),
    lastAt,
  };
}

function mergeSpeakingTrainingStats(existingRaw: unknown, incomingRaw: unknown) {
  const a = normalizeSpeakingTrainingStatsStore(existingRaw);
  const b = normalizeSpeakingTrainingStatsStore(incomingRaw);
  const keys = new Set([...Object.keys(a.days), ...Object.keys(b.days)]);
  const days: Record<string, SpeakingTrainingDayStats> = {};
  for (const k of keys) {
    const merged = mergeSpeakingTrainingDayStats(a.days[k], b.days[k]);
    if (!merged) continue;
    days[k] = merged;
  }
  return normalizeSpeakingTrainingStatsStore({ version: 1, days });
}

function mergeGamification(existingRaw: unknown, incomingRaw: unknown) {
  const a = normalizeGamificationState(existingRaw);
  const b = normalizeGamificationState(incomingRaw);

  const keys = new Set([...Object.keys(a.daily), ...Object.keys(b.daily)]);
  const daily: Record<string, any> = {};
  for (const k of keys) {
    const da = a.daily[k] || { xpEarned: 0, wordsAdded: 0, practiceCompleted: 0, storiesGenerated: 0 };
    const db = b.daily[k] || { xpEarned: 0, wordsAdded: 0, practiceCompleted: 0, storiesGenerated: 0 };
    daily[k] = {
      xpEarned: Math.max(da.xpEarned || 0, db.xpEarned || 0),
      wordsAdded: Math.max(da.wordsAdded || 0, db.wordsAdded || 0),
      practiceCompleted: Math.max(da.practiceCompleted || 0, db.practiceCompleted || 0),
      storiesGenerated: Math.max(da.storiesGenerated || 0, db.storiesGenerated || 0),
    };
  }

  const unlockedBadges = Array.from(new Set([...(a.unlockedBadges || []), ...(b.unlockedBadges || [])]));

  const lastActiveA = a.streak.lastActiveDate || "";
  const lastActiveB = b.streak.lastActiveDate || "";
  const pickB = lastActiveB > lastActiveA;
  const picked = pickB ? b : a;

  return normalizeGamificationState({
    version: 1,
    xp: Math.max(a.xp || 0, b.xp || 0),
    unlockedBadges,
    streak: {
      current: Math.max(picked.streak.current || 0, (a.streak.lastActiveDate === b.streak.lastActiveDate ? Math.max(a.streak.current || 0, b.streak.current || 0) : picked.streak.current || 0)),
      longest: Math.max(a.streak.longest || 0, b.streak.longest || 0),
      lastActiveDate: pickB ? b.streak.lastActiveDate : a.streak.lastActiveDate,
    },
    totals: {
      wordsAdded: Math.max(a.totals.wordsAdded || 0, b.totals.wordsAdded || 0),
      practiceCompleted: Math.max(a.totals.practiceCompleted || 0, b.totals.practiceCompleted || 0),
      storiesGenerated: Math.max(a.totals.storiesGenerated || 0, b.totals.storiesGenerated || 0),
      masteredMarked: Math.max(a.totals.masteredMarked || 0, b.totals.masteredMarked || 0),
    },
    daily,
  });
}

function mergeReadingQuestionStats(existingRaw: unknown, incomingRaw: unknown) {
  const a = normalizeReadingQuestionStats(existingRaw);
  const b = normalizeReadingQuestionStats(incomingRaw);
  const out: Record<string, ReadingQuestionStatsEntry> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const prev = out[k];
    if (!prev) {
      out[k] = v;
      continue;
    }
    const nextLastAt = Math.max(prev.lastAt || 0, v.lastAt || 0) || undefined;
    const preferIncomingLast = (v.lastAt || 0) >= (prev.lastAt || 0);
    out[k] = {
      attempts: Math.max(prev.attempts || 0, v.attempts || 0),
      best: Math.max(prev.best || 0, v.best || 0),
      last: preferIncomingLast ? v.last : prev.last,
      total: Math.max(prev.total || 0, v.total || 0),
      bestAt: Math.max(prev.bestAt || 0, v.bestAt || 0) || undefined,
      lastAt: nextLastAt,
    };
  }
  return out;
}

export function createBackup(scope: BackupScope): { backup: LexiCaptureBackupV1; warnings: string[] } {
  const warnings: string[] = [];
  const data: BackupDataV1 = {};

  const exportedAt = new Date().toISOString();

  const includeWords = scope === "full" || scope === "words";
  const includeGrowth = scope === "full" || scope === "growth";

  if (includeWords) {
    const wordsRaw = readLocalStorageString(WORDS_STORAGE_KEY);
    if (wordsRaw) {
      const repaired = tryRepairJsonText(wordsRaw) ?? wordsRaw;
      const parsed = safeParseJson(repaired);
      const normalized = normalizeWords(parsed);
      if (normalized.length > 0 || Array.isArray(parsed)) data.words = normalized;
      else warnings.push("单词本数据解析失败，已跳过（可在“数据修复”中导出原始文本）。");
    }

    const groupsRaw = readLocalStorageString(GROUPS_STORAGE_KEY);
    if (groupsRaw) {
      const repaired = tryRepairJsonText(groupsRaw) ?? groupsRaw;
      const parsed = safeParseJson(repaired);
      const normalized = normalizeGroups(parsed);
      if (normalized.length > 0 || Array.isArray(parsed)) data.groups = normalized;
      else warnings.push("分组数据解析失败，已跳过（可在“数据修复”中导出原始文本）。");
    }

    const selectedGroupId = readLocalStorageString(SELECTED_GROUP_STORAGE_KEY);
    if (selectedGroupId) data.selectedGroupId = selectedGroupId;
  }

  if (includeGrowth) {
    const rawGamification = safeParseJson(readLocalStorageString(GAMIFICATION_STORAGE_KEY));
    if (rawGamification) data.gamification = normalizeGamificationState(rawGamification);

    const rawGrowthGoals = safeParseJson(readLocalStorageString(GROWTH_GOALS_STORAGE_KEY));
    if (rawGrowthGoals) data.growthGoals = normalizeGrowthGoals(rawGrowthGoals);

    const rawLearningEvents = safeParseJson(readLocalStorageString(LEARNING_EVENTS_STORAGE_KEY));
    if (rawLearningEvents) data.learningEvents = normalizeLearningEventsStore(rawLearningEvents);

    const rawSpeakingStats = safeParseJson(readLocalStorageString(SPEAKING_TRAINING_STATS_STORAGE_KEY));
    if (rawSpeakingStats) data.speakingTrainingStats = normalizeSpeakingTrainingStatsStore(rawSpeakingStats);

    const speakingSettingsRaw = safeParseJson(readLocalStorageString(SPEAKING_SETTINGS_STORAGE_KEY));
    if (speakingSettingsRaw) data.speakingSettings = speakingSettingsRaw;
  }

  if (scope === "full") {
    const lastView = readLocalStorageString(LAST_VIEW_STORAGE_KEY);
    if (lastView) data.lastView = lastView;

    const theme = readLocalStorageString(THEME_STORAGE_KEY);
    if (theme) data.theme = theme;

    const essayDraftRaw = safeParseJson(readLocalStorageString(ESSAY_REVIEW_DRAFT_STORAGE_KEY));
    if (essayDraftRaw) data.essayReviewDraft = essayDraftRaw;

    const essayLastRaw = safeParseJson(readLocalStorageString(ESSAY_REVIEW_LAST_STORAGE_KEY));
    if (essayLastRaw) data.essayReviewLast = essayLastRaw;

    const essayHistoryRaw = safeParseJson(readLocalStorageString(ESSAY_REVIEW_HISTORY_STORAGE_KEY));
    if (essayHistoryRaw) data.essayReviewHistory = essayHistoryRaw;

    const readingStatsRaw = safeParseJson(readLocalStorageString(READING_QUESTION_STATS_STORAGE_KEY));
    if (readingStatsRaw) data.readingQuestionStats = normalizeReadingQuestionStats(readingStatsRaw);
  }

  return { backup: { schema: BACKUP_SCHEMA_V1, storageVersion: BACKUP_STORAGE_VERSION, scope, exportedAt, data }, warnings };
}

export function normalizeBackupPayload(raw: unknown): { ok: true; backup: LexiCaptureBackupV1; warnings: string[] } | { ok: false; error: string } {
  if (!isRecord(raw)) return { ok: false, error: "备份文件不是合法 JSON 对象。" };

  const schema = typeof raw.schema === "string" ? raw.schema : "";
  if (schema === BACKUP_SCHEMA_V1) {
    const storageVersion = raw.storageVersion === BACKUP_STORAGE_VERSION ? BACKUP_STORAGE_VERSION : null;
    if (storageVersion === null) return { ok: false, error: "不支持的备份版本（storageVersion）。" };
    const scope = raw.scope === "full" || raw.scope === "words" || raw.scope === "growth" ? raw.scope : null;
    if (!scope) return { ok: false, error: "备份文件缺少 scope 或 scope 不合法。" };
    const exportedAt = typeof raw.exportedAt === "string" && raw.exportedAt ? raw.exportedAt : new Date().toISOString();
    const data = isRecord(raw.data) ? (raw.data as BackupDataV1) : {};
    return {
      ok: true,
      warnings: [],
      backup: { schema: BACKUP_SCHEMA_V1, storageVersion: BACKUP_STORAGE_VERSION, scope, exportedAt, data },
    };
  }

  if (schema === "lexi-capture-growth-export-v1") {
    const growth = raw as GrowthExportV1;
    const exportedAt = typeof growth.exportedAt === "string" && growth.exportedAt ? growth.exportedAt : new Date().toISOString();
    return {
      ok: true,
      warnings: ["检测到成长导出文件，将按“仅成长”备份导入。"],
      backup: {
        schema: BACKUP_SCHEMA_V1,
        storageVersion: BACKUP_STORAGE_VERSION,
        scope: "growth",
        exportedAt,
        data: {
          gamification: growth.gamification,
          growthGoals: growth.growthGoals,
          learningEvents: growth.learningEvents,
          speakingTrainingStats: growth.speakingTrainingStats,
        },
      },
    };
  }

  return { ok: false, error: "不支持的备份格式（schema）。" };
}

function keysForScope(scope: BackupScope) {
  const wordsKeys = [WORDS_STORAGE_KEY, GROUPS_STORAGE_KEY, SELECTED_GROUP_STORAGE_KEY];
  const growthKeys = [
    GAMIFICATION_STORAGE_KEY,
    GROWTH_GOALS_STORAGE_KEY,
    LEARNING_EVENTS_STORAGE_KEY,
    SPEAKING_TRAINING_STATS_STORAGE_KEY,
    SPEAKING_SETTINGS_STORAGE_KEY,
  ];
  const fullExtra = [
    LAST_VIEW_STORAGE_KEY,
    THEME_STORAGE_KEY,
    ESSAY_REVIEW_DRAFT_STORAGE_KEY,
    ESSAY_REVIEW_LAST_STORAGE_KEY,
    ESSAY_REVIEW_HISTORY_STORAGE_KEY,
    READING_QUESTION_STATS_STORAGE_KEY,
  ];

  if (scope === "words") return wordsKeys;
  if (scope === "growth") return growthKeys;
  return [...wordsKeys, ...growthKeys, ...fullExtra];
}

export function applyBackup(params: { backup: LexiCaptureBackupV1; strategy: ImportStrategy }): { writtenKeys: string[]; warnings: string[] } {
  const { backup, strategy } = params;
  const warnings: string[] = [];
  const writtenKeys: string[] = [];

  const targetKeys = keysForScope(backup.scope);

  if (strategy === "overwrite") {
    for (const k of targetKeys) {
      try {
        removeLocalStorageKey(k);
      } catch {
        // ignore
      }
    }
  }

  const includeWords = backup.scope === "full" || backup.scope === "words";
  const includeGrowth = backup.scope === "full" || backup.scope === "growth";

  if (includeWords) {
    const incomingWords = normalizeWords(backup.data.words);
    if (strategy === "merge") {
      const existingWords = normalizeWords(safeParseJson(readLocalStorageString(WORDS_STORAGE_KEY)));
      const merged = mergeWordLists(existingWords, incomingWords);
      writeLocalStorageString(WORDS_STORAGE_KEY, JSON.stringify(merged));
      writtenKeys.push(WORDS_STORAGE_KEY);
    } else if (incomingWords.length > 0 || Array.isArray(backup.data.words)) {
      writeLocalStorageString(WORDS_STORAGE_KEY, JSON.stringify(incomingWords));
      writtenKeys.push(WORDS_STORAGE_KEY);
    }

    const incomingGroups = normalizeGroups(backup.data.groups);
    if (strategy === "merge") {
      const existingGroups = normalizeGroups(safeParseJson(readLocalStorageString(GROUPS_STORAGE_KEY)));
      const merged = mergeGroups(existingGroups, incomingGroups);
      writeLocalStorageString(GROUPS_STORAGE_KEY, JSON.stringify(merged));
      writtenKeys.push(GROUPS_STORAGE_KEY);
    } else if (incomingGroups.length > 0 || Array.isArray(backup.data.groups)) {
      writeLocalStorageString(GROUPS_STORAGE_KEY, JSON.stringify(incomingGroups));
      writtenKeys.push(GROUPS_STORAGE_KEY);
    }

    if (strategy === "overwrite") {
      const selectedGroupId = typeof backup.data.selectedGroupId === "string" ? backup.data.selectedGroupId : null;
      if (selectedGroupId) {
        writeLocalStorageString(SELECTED_GROUP_STORAGE_KEY, selectedGroupId);
        writtenKeys.push(SELECTED_GROUP_STORAGE_KEY);
      }
    } else {
      const hasSelected = readLocalStorageString(SELECTED_GROUP_STORAGE_KEY);
      const selectedGroupId = typeof backup.data.selectedGroupId === "string" ? backup.data.selectedGroupId : null;
      if (!hasSelected && selectedGroupId) {
        writeLocalStorageString(SELECTED_GROUP_STORAGE_KEY, selectedGroupId);
        writtenKeys.push(SELECTED_GROUP_STORAGE_KEY);
      }
    }
  }

  if (includeGrowth) {
    const incomingGamification = backup.data.gamification;
    if (incomingGamification) {
      if (strategy === "merge") {
        const existing = safeParseJson(readLocalStorageString(GAMIFICATION_STORAGE_KEY));
        const merged = mergeGamification(existing, incomingGamification);
        writeLocalStorageString(GAMIFICATION_STORAGE_KEY, JSON.stringify(merged));
        writtenKeys.push(GAMIFICATION_STORAGE_KEY);
      } else {
        const normalized = normalizeGamificationState(incomingGamification);
        writeLocalStorageString(GAMIFICATION_STORAGE_KEY, JSON.stringify(normalized));
        writtenKeys.push(GAMIFICATION_STORAGE_KEY);
      }
    }

    const incomingGrowthGoals = backup.data.growthGoals;
    if (incomingGrowthGoals) {
      if (strategy === "merge") {
        const has = readLocalStorageString(GROWTH_GOALS_STORAGE_KEY);
        if (!has) {
          writeLocalStorageString(GROWTH_GOALS_STORAGE_KEY, JSON.stringify(normalizeGrowthGoals(incomingGrowthGoals)));
          writtenKeys.push(GROWTH_GOALS_STORAGE_KEY);
        }
      } else {
        writeLocalStorageString(GROWTH_GOALS_STORAGE_KEY, JSON.stringify(normalizeGrowthGoals(incomingGrowthGoals)));
        writtenKeys.push(GROWTH_GOALS_STORAGE_KEY);
      }
    }

    const incomingLearningEvents = backup.data.learningEvents;
    if (incomingLearningEvents) {
      const normalizedIncoming = normalizeLearningEventsStore(incomingLearningEvents);
      if (strategy === "merge") {
        const existingStore = normalizeLearningEventsStore(safeParseJson(readLocalStorageString(LEARNING_EVENTS_STORAGE_KEY)));
        const mergedEvents = mergeLearningEvents(existingStore.events, normalizedIncoming.events).slice(0, 120);
        writeLocalStorageString(LEARNING_EVENTS_STORAGE_KEY, JSON.stringify({ version: 1, events: mergedEvents }));
        writtenKeys.push(LEARNING_EVENTS_STORAGE_KEY);
      } else {
        writeLocalStorageString(LEARNING_EVENTS_STORAGE_KEY, JSON.stringify(normalizedIncoming));
        writtenKeys.push(LEARNING_EVENTS_STORAGE_KEY);
      }
    }

    const incomingSpeakingStats = backup.data.speakingTrainingStats;
    if (incomingSpeakingStats) {
      if (strategy === "merge") {
        const existing = safeParseJson(readLocalStorageString(SPEAKING_TRAINING_STATS_STORAGE_KEY));
        const merged = mergeSpeakingTrainingStats(existing, incomingSpeakingStats);
        writeLocalStorageString(SPEAKING_TRAINING_STATS_STORAGE_KEY, JSON.stringify(merged));
        writtenKeys.push(SPEAKING_TRAINING_STATS_STORAGE_KEY);
      } else {
        writeLocalStorageString(
          SPEAKING_TRAINING_STATS_STORAGE_KEY,
          JSON.stringify(normalizeSpeakingTrainingStatsStore(incomingSpeakingStats))
        );
        writtenKeys.push(SPEAKING_TRAINING_STATS_STORAGE_KEY);
      }
    }

    const incomingSpeakingSettings = backup.data.speakingSettings;
    if (incomingSpeakingSettings && isRecord(incomingSpeakingSettings)) {
      if (strategy === "merge") {
        const has = readLocalStorageString(SPEAKING_SETTINGS_STORAGE_KEY);
        if (!has) {
          writeLocalStorageString(SPEAKING_SETTINGS_STORAGE_KEY, JSON.stringify(incomingSpeakingSettings));
          writtenKeys.push(SPEAKING_SETTINGS_STORAGE_KEY);
        }
      } else {
        writeLocalStorageString(SPEAKING_SETTINGS_STORAGE_KEY, JSON.stringify(incomingSpeakingSettings));
        writtenKeys.push(SPEAKING_SETTINGS_STORAGE_KEY);
      }
    }
  }

  if (backup.scope === "full") {
    if (strategy === "overwrite") {
      const lastView = typeof backup.data.lastView === "string" ? backup.data.lastView : null;
      if (lastView) {
        writeLocalStorageString(LAST_VIEW_STORAGE_KEY, lastView);
        writtenKeys.push(LAST_VIEW_STORAGE_KEY);
      }
      const theme = typeof backup.data.theme === "string" ? backup.data.theme : null;
      if (theme) {
        writeLocalStorageString(THEME_STORAGE_KEY, theme);
        writtenKeys.push(THEME_STORAGE_KEY);
      }
    } else {
      const hasLastView = readLocalStorageString(LAST_VIEW_STORAGE_KEY);
      const lastView = typeof backup.data.lastView === "string" ? backup.data.lastView : null;
      if (!hasLastView && lastView) {
        writeLocalStorageString(LAST_VIEW_STORAGE_KEY, lastView);
        writtenKeys.push(LAST_VIEW_STORAGE_KEY);
      }
      const hasTheme = readLocalStorageString(THEME_STORAGE_KEY);
      const theme = typeof backup.data.theme === "string" ? backup.data.theme : null;
      if (!hasTheme && theme) {
        writeLocalStorageString(THEME_STORAGE_KEY, theme);
        writtenKeys.push(THEME_STORAGE_KEY);
      }
    }

    const draft = backup.data.essayReviewDraft;
    if (draft && isRecord(draft)) {
      if (strategy === "merge") {
        const has = readLocalStorageString(ESSAY_REVIEW_DRAFT_STORAGE_KEY);
        if (!has) {
          writeLocalStorageString(ESSAY_REVIEW_DRAFT_STORAGE_KEY, JSON.stringify(draft));
          writtenKeys.push(ESSAY_REVIEW_DRAFT_STORAGE_KEY);
        }
      } else {
        writeLocalStorageString(ESSAY_REVIEW_DRAFT_STORAGE_KEY, JSON.stringify(draft));
        writtenKeys.push(ESSAY_REVIEW_DRAFT_STORAGE_KEY);
      }
    }

    const last = backup.data.essayReviewLast;
    if (last && isRecord(last)) {
      if (strategy === "merge") {
        const has = readLocalStorageString(ESSAY_REVIEW_LAST_STORAGE_KEY);
        if (!has) {
          writeLocalStorageString(ESSAY_REVIEW_LAST_STORAGE_KEY, JSON.stringify(last));
          writtenKeys.push(ESSAY_REVIEW_LAST_STORAGE_KEY);
        }
      } else {
        writeLocalStorageString(ESSAY_REVIEW_LAST_STORAGE_KEY, JSON.stringify(last));
        writtenKeys.push(ESSAY_REVIEW_LAST_STORAGE_KEY);
      }
    }

    const history = backup.data.essayReviewHistory;
    if (history && Array.isArray(history)) {
      if (strategy === "merge") {
        const existing = safeParseJson(readLocalStorageString(ESSAY_REVIEW_HISTORY_STORAGE_KEY));
        const existingArr = Array.isArray(existing) ? existing : [];
        const existingById = new Map<string, any>();
        for (const it of existingArr) {
          if (!isRecord(it)) continue;
          const id = typeof it.id === "string" && it.id ? it.id : "";
          if (!id) continue;
          existingById.set(id, it);
        }
        for (const it of history) {
          if (!isRecord(it)) continue;
          const id = typeof it.id === "string" && it.id ? it.id : "";
          if (!id) continue;
          if (!existingById.has(id)) existingById.set(id, it);
        }
        const merged = Array.from(existingById.values());
        merged.sort((a, b) => toSafeInt((b as any).savedAt, 0) - toSafeInt((a as any).savedAt, 0));
        writeLocalStorageString(ESSAY_REVIEW_HISTORY_STORAGE_KEY, JSON.stringify(merged.slice(0, 10)));
        writtenKeys.push(ESSAY_REVIEW_HISTORY_STORAGE_KEY);
      } else {
        writeLocalStorageString(ESSAY_REVIEW_HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 10)));
        writtenKeys.push(ESSAY_REVIEW_HISTORY_STORAGE_KEY);
      }
    }

    const incomingReadingStats = backup.data.readingQuestionStats;
    if (incomingReadingStats && isRecord(incomingReadingStats)) {
      if (strategy === "merge") {
        const existing = safeParseJson(readLocalStorageString(READING_QUESTION_STATS_STORAGE_KEY));
        const merged = mergeReadingQuestionStats(existing, incomingReadingStats);
        writeLocalStorageString(READING_QUESTION_STATS_STORAGE_KEY, JSON.stringify(merged));
        writtenKeys.push(READING_QUESTION_STATS_STORAGE_KEY);
      } else {
        const normalized = normalizeReadingQuestionStats(incomingReadingStats);
        writeLocalStorageString(READING_QUESTION_STATS_STORAGE_KEY, JSON.stringify(normalized));
        writtenKeys.push(READING_QUESTION_STATS_STORAGE_KEY);
      }
    }
  }

  if (writtenKeys.length === 0) warnings.push("备份中没有可导入的数据，未写入任何 key。");

  return { writtenKeys, warnings };
}

export function getLocalStorageUsageEstimate() {
  if (typeof window === "undefined") return { totalBytes: 0, itemCount: 0, topKeys: [] as Array<{ key: string; bytes: number }> };
  let totalBytes = 0;
  const topKeys: Array<{ key: string; bytes: number }> = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    const value = window.localStorage.getItem(key) ?? "";
    const bytes = (key.length + value.length) * 2;
    totalBytes += bytes;
    topKeys.push({ key, bytes });
  }
  topKeys.sort((a, b) => b.bytes - a.bytes);
  return { totalBytes, itemCount: topKeys.length, topKeys: topKeys.slice(0, 6) };
}

export function scanKnownStorageIssues() {
  const issues: Array<{ key: string; reason: string; raw: string }> = [];
  if (typeof window === "undefined") return issues;

  const jsonKeys = [
    WORDS_STORAGE_KEY,
    GROUPS_STORAGE_KEY,
    GAMIFICATION_STORAGE_KEY,
    GROWTH_GOALS_STORAGE_KEY,
    LEARNING_EVENTS_STORAGE_KEY,
    SPEAKING_TRAINING_STATS_STORAGE_KEY,
    SPEAKING_SETTINGS_STORAGE_KEY,
    ESSAY_REVIEW_DRAFT_STORAGE_KEY,
    ESSAY_REVIEW_LAST_STORAGE_KEY,
    ESSAY_REVIEW_HISTORY_STORAGE_KEY,
    READING_QUESTION_STATS_STORAGE_KEY,
  ];

  for (const key of jsonKeys) {
    const raw = readLocalStorageString(key);
    if (raw === null) continue;
    const repaired = tryRepairJsonText(raw) ?? raw;
    try {
      const parsed = JSON.parse(repaired);
      if (parsed === null || parsed === undefined) {
        issues.push({ key, reason: "JSON 为空", raw });
      }
    } catch (error: any) {
      issues.push({ key, reason: error?.message || "JSON 解析失败", raw });
    }
  }

  return issues;
}

export function tryRepairKnownStorageIssues() {
  const issues = scanKnownStorageIssues();
  let repairedCount = 0;
  let failedCount = 0;

  for (const it of issues) {
    const repaired = tryRepairJsonText(it.raw);
    if (!repaired) {
      failedCount++;
      continue;
    }
    try {
      const parsed = JSON.parse(repaired);
      writeLocalStorageString(it.key, JSON.stringify(parsed));
      repairedCount++;
    } catch {
      failedCount++;
    }
  }

  return { repairedCount, failedCount };
}

