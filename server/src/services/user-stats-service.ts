import prisma from '../config/database';

// ========== LearningStats Types & Service ==========
export type GamificationDayStats = {
  xpEarned: number;
  wordsAdded: number;
  practiceCompleted: number;
  storiesGenerated: number;
};

export type GamificationState = {
  version: 1;
  xp: number;
  unlockedBadges: string[];
  streak: {
    current: number;
    longest: number;
    lastActiveDate?: string;
  };
  totals: {
    wordsAdded: number;
    practiceCompleted: number;
    storiesGenerated: number;
    masteredMarked: number;
  };
  daily: Record<string, GamificationDayStats>;
};

export type LearningEventInput =
  | { type: 'words_added'; count: number; at?: Date }
  | { type: 'practice_completed'; correctCount: number; totalCount: number; at?: Date }
  | { type: 'story_generated'; wordCount?: number; at?: Date }
  | { type: 'mastery_marked'; termKey?: string; at?: Date };

const XP_RULES = {
  dailyCheckIn: 10,
  perWordAdded: 5,
  practiceBase: 30,
  practicePerCorrect: 2,
  storyGenerated: 20,
  masteryMarked: 10,
} as const;

function formatDateKey(date: Date): string {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addDaysLocal(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

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

export class UserStatsService {
  // ========== LearningStats ==========
  static async getLearningStats(userId: string): Promise<GamificationState> {
    const stats = await prisma.learningStats.findUnique({
      where: { userId },
    });

    if (!stats) {
      // Create default stats if not exists
      await prisma.learningStats.create({
        data: { userId },
      });
      return createDefaultGamificationState();
    }

    return {
      version: 1,
      xp: stats.totalXp,
      unlockedBadges: JSON.parse(stats.unlockedBadges || '[]'),
      streak: {
        current: stats.streakDays,
        longest: stats.longestStreak,
        lastActiveDate: stats.lastActiveDate ? formatDateKey(stats.lastActiveDate) : undefined,
      },
      totals: {
        wordsAdded: stats.totalWords,
        practiceCompleted: stats.practiceCompleted,
        storiesGenerated: stats.storiesGenerated,
        masteredMarked: stats.masteredMarked,
      },
      daily: JSON.parse(stats.dailyStats || '{}'),
    };
  }

  static async updateLearningStats(userId: string, state: GamificationState): Promise<void> {
    await prisma.learningStats.upsert({
      where: { userId },
      create: {
        userId,
        totalXp: state.xp,
        unlockedBadges: JSON.stringify(state.unlockedBadges),
        streakDays: state.streak.current,
        longestStreak: state.streak.longest,
        lastActiveDate: state.streak.lastActiveDate,
        totalWords: state.totals.wordsAdded,
        practiceCompleted: state.totals.practiceCompleted,
        storiesGenerated: state.totals.storiesGenerated,
        masteredMarked: state.totals.masteredMarked,
        dailyStats: JSON.stringify(state.daily),
      },
      update: {
        totalXp: state.xp,
        unlockedBadges: JSON.stringify(state.unlockedBadges),
        streakDays: state.streak.current,
        longestStreak: state.streak.longest,
        lastActiveDate: state.streak.lastActiveDate,
        totalWords: state.totals.wordsAdded,
        practiceCompleted: state.totals.practiceCompleted,
        storiesGenerated: state.totals.storiesGenerated,
        masteredMarked: state.totals.masteredMarked,
        dailyStats: JSON.stringify(state.daily),
      },
    });
  }

  static async recordLearningEvent(userId: string, event: LearningEventInput): Promise<GamificationState> {
    const stats = await this.getLearningStats(userId);
    const at = event.at || new Date();
    const dateKey = formatDateKey(at);

    // Check-in logic
    let next = { ...stats };
    if (next.streak.lastActiveDate !== dateKey) {
      const yesterdayKey = formatDateKey(addDaysLocal(at, -1));
      const nextCurrent = next.streak.lastActiveDate === yesterdayKey ? next.streak.current + 1 : 1;
      const nextLongest = Math.max(next.streak.longest, nextCurrent);
      next.streak = {
        current: nextCurrent,
        longest: nextLongest,
        lastActiveDate: dateKey,
      };
      // Add check-in XP
      next = this.addXp(next, dateKey, XP_RULES.dailyCheckIn);
    }

    // Apply event
    switch (event.type) {
      case 'words_added': {
        const count = Math.max(0, Math.floor(event.count));
        if (count > 0) {
          next = this.addDayStat(next, dateKey, { wordsAdded: count });
          next.totals = { ...next.totals, wordsAdded: next.totals.wordsAdded + count };
          next = this.addXp(next, dateKey, count * XP_RULES.perWordAdded);
        }
        break;
      }
      case 'practice_completed': {
        next = this.addDayStat(next, dateKey, { practiceCompleted: 1 });
        next.totals = { ...next.totals, practiceCompleted: next.totals.practiceCompleted + 1 };
        const correct = Math.max(0, Math.floor(event.correctCount));
        const base = XP_RULES.practiceBase + correct * XP_RULES.practicePerCorrect;
        next = this.addXp(next, dateKey, base);
        break;
      }
      case 'story_generated': {
        next = this.addDayStat(next, dateKey, { storiesGenerated: 1 });
        next.totals = { ...next.totals, storiesGenerated: next.totals.storiesGenerated + 1 };
        next = this.addXp(next, dateKey, XP_RULES.storyGenerated);
        break;
      }
      case 'mastery_marked': {
        next.totals = { ...next.totals, masteredMarked: next.totals.masteredMarked + 1 };
        next = this.addXp(next, dateKey, XP_RULES.masteryMarked);
        break;
      }
    }

    // Prune daily stats (keep last 400 days)
    next = this.pruneDaily(next);

    await this.updateLearningStats(userId, next);
    return next;
  }

  private static addXp(state: GamificationState, dateKey: string, amount: number): GamificationState {
    const safe = Math.max(0, Math.floor(amount));
    if (safe === 0) return state;
    const day = state.daily[dateKey] || { xpEarned: 0, wordsAdded: 0, practiceCompleted: 0, storiesGenerated: 0 };
    return {
      ...state,
      xp: state.xp + safe,
      daily: {
        ...state.daily,
        [dateKey]: { ...day, xpEarned: day.xpEarned + safe },
      },
    };
  }

  private static addDayStat(
    state: GamificationState,
    dateKey: string,
    patch: Partial<Omit<GamificationDayStats, 'xpEarned'>>
  ): GamificationState {
    const day = state.daily[dateKey] || { xpEarned: 0, wordsAdded: 0, practiceCompleted: 0, storiesGenerated: 0 };
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

  private static pruneDaily(state: GamificationState): GamificationState {
    const MAX_DAILY_DAYS = 400;
    const keys = Object.keys(state.daily);
    if (keys.length <= MAX_DAILY_DAYS) return state;
    const sorted = keys.sort();
    const removeCount = sorted.length - MAX_DAILY_DAYS;
    const nextDaily: Record<string, GamificationDayStats> = { ...state.daily };
    for (let i = 0; i < removeCount; i++) {
      delete nextDaily[sorted[i]];
    }
    return { ...state, daily: nextDaily };
  }

  // ========== GrowthGoals ==========
  static async getGrowthGoals(userId: string) {
    const goals = await prisma.growthGoals.findUnique({
      where: { userId },
    });

    if (!goals) {
      await prisma.growthGoals.create({
        data: { userId },
      });
      return { weeklyXpGoal: 200, weeklyWordsGoal: 20 };
    }

    return {
      weeklyXpGoal: goals.weeklyXpGoal,
      weeklyWordsGoal: goals.weeklyWordsGoal,
    };
  }

  static async updateGrowthGoals(userId: string, goals: { weeklyXpGoal: number; weeklyWordsGoal: number }) {
    await prisma.growthGoals.upsert({
      where: { userId },
      create: {
        userId,
        weeklyXpGoal: Math.max(0, Math.min(999999, goals.weeklyXpGoal)),
        weeklyWordsGoal: Math.max(0, Math.min(999999, goals.weeklyWordsGoal)),
      },
      update: {
        weeklyXpGoal: Math.max(0, Math.min(999999, goals.weeklyXpGoal)),
        weeklyWordsGoal: Math.max(0, Math.min(999999, goals.weeklyWordsGoal)),
      },
    });
  }

  // ========== ReadingQuestionStats ==========
  static async getReadingStats(userId: string, articleKey: string) {
    const stats = await prisma.readingQuestionStats.findUnique({
      where: { userId_articleKey: { userId, articleKey } },
    });

    if (!stats) return null;

    return {
      attempts: stats.attempts,
      best: stats.best,
      last: stats.last,
      total: stats.total,
      bestAt: stats.bestAt?.getTime(),
      lastAt: stats.lastAt?.getTime(),
    };
  }

  static async updateReadingStats(userId: string, articleKey: string, score: number, total: number) {
    const now = new Date();
    const existing = await prisma.readingQuestionStats.findUnique({
      where: { userId_articleKey: { userId, articleKey } },
    });

    if (existing) {
      const newBest = Math.max(existing.best, score);
      await prisma.readingQuestionStats.update({
        where: { id: existing.id },
        data: {
          attempts: existing.attempts + 1,
          best: newBest,
          last: score,
          total,
          bestAt: newBest > existing.best ? now : existing.bestAt,
          lastAt: now,
        },
      });
    } else {
      await prisma.readingQuestionStats.create({
        data: {
          userId,
          articleKey,
          attempts: 1,
          best: score,
          last: score,
          total,
          bestAt: now,
          lastAt: now,
        },
      });
    }
  }

  // ========== SpeakingTrainingStats ==========
  static async getSpeakingStats(userId: string, dateKey: string) {
    const stats = await prisma.speakingTrainingStats.findUnique({
      where: { userId_dateKey: { userId, dateKey } },
    });

    if (!stats) return null;

    return {
      attempts: stats.attempts,
      scoreSum: stats.scoreSum,
      best: stats.best,
      last: stats.last,
      lastAt: stats.lastAt?.getTime(),
    };
  }

  static async getAllSpeakingStats(userId: string) {
    const stats = await prisma.speakingTrainingStats.findMany({
      where: { userId },
      orderBy: { dateKey: 'asc' },
    });

    const days: Record<string, { attempts: number; scoreSum: number; best: number; last: number; lastAt?: number }> = {};
    for (const s of stats) {
      days[s.dateKey] = {
        attempts: s.attempts,
        scoreSum: s.scoreSum,
        best: s.best,
        last: s.last,
        lastAt: s.lastAt?.getTime(),
      };
    }
    return { days };
  }

  static async recordSpeakingAttempt(userId: string, dateKey: string, score: number, at?: Date) {
    const timestamp = at?.getTime() || Date.now();
    const safeScore = Math.max(0, Math.min(100, Math.round(score)));

    const existing = await prisma.speakingTrainingStats.findUnique({
      where: { userId_dateKey: { userId, dateKey } },
    });

    if (existing) {
      await prisma.speakingTrainingStats.update({
        where: { id: existing.id },
        data: {
          attempts: existing.attempts + 1,
          scoreSum: existing.scoreSum + safeScore,
          best: Math.max(existing.best, safeScore),
          last: safeScore,
          lastAt: new Date(timestamp),
        },
      });
    } else {
      await prisma.speakingTrainingStats.create({
        data: {
          userId,
          dateKey,
          attempts: 1,
          scoreSum: safeScore,
          best: safeScore,
          last: safeScore,
          lastAt: new Date(timestamp),
        },
      });
    }
  }

  // ========== LearningEvents ==========
  static async getLearningEvents(userId: string, limit = 120) {
    const events = await prisma.learningEvent.findMany({
      where: { userId },
      orderBy: { at: 'desc' },
      take: limit,
    });

    return events.map((e) => ({
      id: e.id,
      type: e.type,
      count: e.count,
      correctCount: e.correctCount,
      totalCount: e.totalCount,
      wordCount: e.wordCount,
      at: e.at.getTime(),
    }));
  }

  static async addLearningEvent(userId: string, event: LearningEventInput) {
    const at = event.at || new Date();

    let data: any = {
      userId,
      type: event.type,
      at,
    };

    if (event.type === 'words_added') {
      data.count = Math.max(0, Math.floor(event.count));
    } else if (event.type === 'practice_completed') {
      data.correctCount = Math.max(0, Math.floor(event.correctCount));
      data.totalCount = Math.max(0, Math.floor(event.totalCount));
    } else if (event.type === 'story_generated') {
      data.wordCount = event.wordCount ? Math.max(0, Math.floor(event.wordCount)) : null;
    } else if (event.type === 'mastery_marked') {
      data.termKey = event.termKey || null;
    }

    await prisma.learningEvent.create({ data });

    // Also update gamification stats
    await this.recordLearningEvent(userId, event);
  }

  static async clearLearningEvents(userId: string) {
    await prisma.learningEvent.deleteMany({
      where: { userId },
    });
  }

  // ========== Reset All User Stats ==========
  static async resetAllStats(userId: string) {
    await prisma.$transaction([
      prisma.learningStats.update({
        where: { userId },
        data: {
          totalXp: 0,
          streakDays: 0,
          longestStreak: 0,
          lastActiveDate: null,
          totalWords: 0,
          practiceCompleted: 0,
          storiesGenerated: 0,
          masteredMarked: 0,
          unlockedBadges: '[]',
          dailyStats: '{}',
        },
      }),
      prisma.readingQuestionStats.deleteMany({ where: { userId } }),
      prisma.speakingTrainingStats.deleteMany({ where: { userId } }),
      prisma.learningEvent.deleteMany({ where: { userId } }),
      // Don't delete growth goals, just reset to defaults
      prisma.growthGoals.update({
        where: { userId },
        data: { weeklyXpGoal: 200, weeklyWordsGoal: 20 },
      }),
    ]);
  }
}
