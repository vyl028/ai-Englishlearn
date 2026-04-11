"use client";

import { useCallback, useEffect, useState } from "react";
import { userStatsApi, type GamificationState, type GrowthGoals, type LearningEvent } from "@/lib/api-client";

// Fallback to localStorage if API fails
const GAMIFICATION_STORAGE_KEY = "lexi-capture-gamification";
const GROWTH_GOALS_STORAGE_KEY = "lexi-capture-growth-goals-v1";
const LEARNING_EVENTS_STORAGE_KEY = "lexi-capture-learning-events-v1";
const SPEAKING_STATS_STORAGE_KEY = "lexi-capture-speaking-training-stats-v1";

// Safe localStorage helpers
function safeGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeRemoveItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function safeGetKey(index: number): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.key(index);
  } catch {
    return null;
  }
}

function safeGetLength(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return localStorage.length;
  } catch {
    return 0;
  }
}

export type BadgeId = "streak_3" | "streak_7" | "streak_14" | "mastered_10" | "mastered_100";

function createDefaultGamificationState(): GamificationState {
  return {
    version: 1,
    xp: 0,
    unlockedBadges: [],
    streak: { current: 0, longest: 0, lastActiveDate: undefined },
    totals: { wordsAdded: 0, practiceCompleted: 0, storiesGenerated: 0, masteredMarked: 0 },
    daily: {},
  };
}

function createDefaultGrowthGoals(): GrowthGoals {
  return { weeklyXpGoal: 200, weeklyWordsGoal: 20 };
}

// ===== Gamification Hook =====
export function useGamification() {
  const [stats, setStats] = useState<GamificationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load from API on mount
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const result = await userStatsApi.getLearningStats();
        if (result.success && result.data && mounted) {
          setStats(result.data);
        } else {
          // Fallback to localStorage
          const raw = safeGetItem(GAMIFICATION_STORAGE_KEY);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (mounted) setStats(parsed);
            } catch {
              if (mounted) setStats(createDefaultGamificationState());
            }
          } else {
            if (mounted) setStats(createDefaultGamificationState());
          }
        }
      } catch (e) {
        // Fallback to localStorage
        const raw = safeGetItem(GAMIFICATION_STORAGE_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (mounted) setStats(parsed);
          } catch {
            if (mounted) setStats(createDefaultGamificationState());
          }
        } else {
          if (mounted) setStats(createDefaultGamificationState());
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  // Save to API and localStorage
  const saveStats = useCallback(async (newStats: GamificationState) => {
    setStats(newStats);
    // Always save to localStorage as backup
    safeSetItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(newStats));
    // Try to save to API
    try {
      await userStatsApi.updateLearningStats(newStats);
    } catch (e) {
      console.error("Failed to save stats to API:", e);
    }
  }, []);

  // Record event
  const recordEvent = useCallback(async (event: { type: 'words_added'; count: number; at?: Date } | { type: 'practice_completed'; correctCount: number; totalCount: number; at?: Date } | { type: 'story_generated'; wordCount?: number; at?: Date } | { type: 'mastery_marked'; termKey?: string; at?: Date }) => {
    const apiEvent: any = {
      type: event.type,
      at: event.at ? event.at.toISOString() : new Date().toISOString(),
    };
    if (event.type === 'words_added') {
      apiEvent.count = event.count;
    } else if (event.type === 'practice_completed') {
      apiEvent.correctCount = event.correctCount;
      apiEvent.totalCount = event.totalCount;
    } else if (event.type === 'story_generated') {
      apiEvent.wordCount = event.wordCount;
    } else if (event.type === 'mastery_marked') {
      apiEvent.termKey = event.termKey;
    }

    try {
      const result = await userStatsApi.recordEvent(apiEvent);
      if (result.success && result.data) {
        setStats(result.data);
        safeSetItem(GAMIFICATION_STORAGE_KEY, JSON.stringify(result.data));
        return result.data;
      }
    } catch (e) {
      console.error("Failed to record event to API:", e);
    }
    return stats;
  }, [stats]);

  return { stats: stats || createDefaultGamificationState(), loading, error, saveStats, recordEvent };
}

// ===== Growth Goals Hook =====
export function useGrowthGoals() {
  const [goals, setGoals] = useState<GrowthGoals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const result = await userStatsApi.getGoals();
        if (result.success && result.data && mounted) {
          setGoals(result.data);
        } else {
          const raw = safeGetItem(GROWTH_GOALS_STORAGE_KEY);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (mounted) setGoals({ weeklyXpGoal: parsed.weeklyXpGoal ?? 200, weeklyWordsGoal: parsed.weeklyWordsGoal ?? 20 });
            } catch {
              if (mounted) setGoals(createDefaultGrowthGoals());
            }
          } else {
            if (mounted) setGoals(createDefaultGrowthGoals());
          }
        }
      } catch (e) {
        const raw = safeGetItem(GROWTH_GOALS_STORAGE_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (mounted) setGoals({ weeklyXpGoal: parsed.weeklyXpGoal ?? 200, weeklyWordsGoal: parsed.weeklyWordsGoal ?? 20 });
          } catch {
            if (mounted) setGoals(createDefaultGrowthGoals());
          }
        } else {
          if (mounted) setGoals(createDefaultGrowthGoals());
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const updateGoals = useCallback(async (newGoals: GrowthGoals) => {
    setGoals(newGoals);
    safeSetItem(GROWTH_GOALS_STORAGE_KEY, JSON.stringify({ ...newGoals, version: 1 }));
    try {
      await userStatsApi.updateGoals(newGoals);
    } catch (e) {
      console.error("Failed to update goals:", e);
    }
  }, []);

  return { goals: goals || createDefaultGrowthGoals(), loading, updateGoals };
}

// ===== Reading Stats Hook =====
export function useReadingStats(articleKey: string | null) {
  const [stats, setStats] = useState<{ attempts: number; best: number; last: number; total: number; bestAt?: number; lastAt?: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!articleKey) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const key = articleKey; // capture for TypeScript
    async function load() {
      try {
        const result = await userStatsApi.getReadingStats(key);
        if (mounted) {
          if (result.success && result.data) {
            setStats(result.data);
          } else {
            setStats(null);
          }
        }
      } catch (e) {
        // Fallback to localStorage with prefixed key
        const storageKey = `lexi-capture-reading-question-stats-v1-${key}`;
        const raw = localStorage.getItem(storageKey);
        if (raw && mounted) {
          try {
            const parsed = JSON.parse(raw);
            if (mounted) setStats(parsed);
          } catch {
            if (mounted) setStats(null);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [articleKey]);

  const updateStats = useCallback(async (score: number, total: number) => {
    if (!articleKey) return;
    const now = Date.now();
    setStats(prev => {
      const newStats = prev
        ? { ...prev, attempts: prev.attempts + 1, last: score, total, lastAt: now, best: Math.max(prev.best, score), bestAt: score > prev.best ? now : prev.bestAt }
        : { attempts: 1, best: score, last: score, total, bestAt: now, lastAt: now };
      // Save to localStorage as backup
      const storageKey = `lexi-capture-reading-question-stats-v1-${articleKey}`;
      localStorage.setItem(storageKey, JSON.stringify(newStats));
      return newStats;
    });
    try {
      await userStatsApi.updateReadingStats({ articleKey, score, total });
    } catch (e) {
      console.error("Failed to update reading stats:", e);
    }
  }, [articleKey]);

  return { stats, loading, updateStats };
}

// ===== Speaking Stats Hook =====
export function useSpeakingStats() {
  const [stats, setStats] = useState<{ days: Record<string, { attempts: number; scoreSum: number; best: number; last: number; lastAt?: number }> }>({ days: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const result = await userStatsApi.getSpeakingStats();
        if (result.success && result.data && mounted) {
          if ('days' in result.data) {
            setStats(result.data as { days: Record<string, { attempts: number; scoreSum: number; best: number; last: number; lastAt?: number }> });
          }
        } else {
          const raw = safeGetItem(SPEAKING_STATS_STORAGE_KEY);
          if (raw && mounted) {
            try {
              const parsed = JSON.parse(raw);
              if (mounted) setStats(parsed);
            } catch {
              if (mounted) setStats({ days: {} });
            }
          }
        }
      } catch (e) {
        const raw = safeGetItem(SPEAKING_STATS_STORAGE_KEY);
        if (raw && mounted) {
          try {
            const parsed = JSON.parse(raw);
            if (mounted) setStats(parsed);
          } catch {
            if (mounted) setStats({ days: {} });
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const recordAttempt = useCallback(async (dateKey: string, score: number, at?: Date) => {
    const timestamp = at?.getTime() || Date.now();
    setStats(prev => {
      const prevDay = prev.days[dateKey] || { attempts: 0, scoreSum: 0, best: 0, last: 0 };
      const newDay = {
        attempts: prevDay.attempts + 1,
        scoreSum: prevDay.scoreSum + score,
        best: Math.max(prevDay.best, score),
        last: score,
        lastAt: timestamp,
      };
      const newStats = { ...prev, days: { ...prev.days, [dateKey]: newDay } };
      safeSetItem(SPEAKING_STATS_STORAGE_KEY, JSON.stringify(newStats));
      return newStats;
    });
    try {
      await userStatsApi.updateSpeakingStats({ dateKey, score, at: new Date(timestamp).toISOString() });
    } catch (e) {
      console.error("Failed to update speaking stats:", e);
    }
  }, []);

  return { stats, loading, recordAttempt };
}

// ===== Learning Events Hook =====
export function useLearningEvents(limit = 120) {
  const [events, setEvents] = useState<LearningEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const result = await userStatsApi.getEvents(limit);
        if (result.success && result.data && mounted) {
          setEvents(result.data.events);
        } else {
          const raw = safeGetItem(LEARNING_EVENTS_STORAGE_KEY);
          if (raw && mounted) {
            try {
              const parsed = JSON.parse(raw);
              if (mounted) setEvents(parsed.events || []);
            } catch {
              if (mounted) setEvents([]);
            }
          }
        }
      } catch (e) {
        const raw = safeGetItem(LEARNING_EVENTS_STORAGE_KEY);
        if (raw && mounted) {
          try {
            const parsed = JSON.parse(raw);
            if (mounted) setEvents(parsed.events || []);
          } catch {
            if (mounted) setEvents([]);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [limit]);

  const addEvent = useCallback(async (event: { type: 'words_added'; count: number; at?: Date } | { type: 'practice_completed'; correctCount: number; totalCount: number; at?: Date } | { type: 'story_generated'; wordCount?: number; at?: Date }) => {
    const apiEvent: any = {
      type: event.type,
      at: event.at ? event.at.toISOString() : new Date().toISOString(),
    };
    if (event.type === 'words_added') {
      apiEvent.count = event.count;
    } else if (event.type === 'practice_completed') {
      apiEvent.correctCount = event.correctCount;
      apiEvent.totalCount = event.totalCount;
    } else if (event.type === 'story_generated') {
      apiEvent.wordCount = event.wordCount;
    }

    try {
      const result = await userStatsApi.addEvent(apiEvent);
      if (result.success && result.data) {
        setEvents(result.data.events);
      }
    } catch (e) {
      console.error("Failed to add event:", e);
    }
  }, []);

  const clearEvents = useCallback(async () => {
    try {
      await userStatsApi.clearEvents();
      setEvents([]);
    } catch (e) {
      console.error("Failed to clear events:", e);
    }
  }, []);

  return { events, loading, addEvent, clearEvents };
}

// ===== Reset All Hook =====
export function useResetAllStats() {
  const reset = useCallback(async () => {
    try {
      await userStatsApi.resetAll();
    } catch (e) {
      console.error("Failed to reset stats:", e);
    }
    // Clear localStorage
    safeRemoveItem(GAMIFICATION_STORAGE_KEY);
    safeRemoveItem(GROWTH_GOALS_STORAGE_KEY);
    safeRemoveItem(LEARNING_EVENTS_STORAGE_KEY);
    safeRemoveItem(SPEAKING_STATS_STORAGE_KEY);
    // Clear reading stats
    for (let i = safeGetLength() - 1; i >= 0; i--) {
      const key = safeGetKey(i);
      if (key && key.startsWith('lexi-capture-reading-question-stats-v1-')) {
        safeRemoveItem(key);
      }
    }
  }, []);

  return { reset };
}
