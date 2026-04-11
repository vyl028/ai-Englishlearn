import { Router } from 'express';
import { z } from 'zod';
import { UserStatsService } from '../services/user-stats-service';
import { authMiddleware } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

// ===== Learning Stats =====

// GET /api/user/stats - 获取学习统计
router.get('/stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const stats = await UserStatsService.getLearningStats(req.userId!);
    return successResponse(res, stats);
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'STATS_ERROR', error.message, 500);
    }
    throw error;
  }
});

// PUT /api/user/stats - 更新学习统计
const updateStatsSchema = z.object({
  xp: z.number().int().min(0).optional(),
  unlockedBadges: z.array(z.string()).optional(),
  streak: z.object({
    current: z.number().int().min(0),
    longest: z.number().int().min(0),
    lastActiveDate: z.string().optional(),
  }).optional(),
  totals: z.object({
    wordsAdded: z.number().int().min(0),
    practiceCompleted: z.number().int().min(0),
    storiesGenerated: z.number().int().min(0),
    masteredMarked: z.number().int().min(0),
  }).optional(),
  daily: z.record(z.object({
    xpEarned: z.number().int().min(0),
    wordsAdded: z.number().int().min(0),
    practiceCompleted: z.number().int().min(0),
    storiesGenerated: z.number().int().min(0),
  })).optional(),
});

router.put('/stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = updateStatsSchema.parse(req.body);
    const current = await UserStatsService.getLearningStats(req.userId!);

    const updated = {
      ...current,
      ...data,
      streak: data.streak ? { ...current.streak, ...data.streak } : current.streak,
      totals: data.totals ? { ...current.totals, ...data.totals } : current.totals,
      daily: data.daily || current.daily,
    };

    await UserStatsService.updateLearningStats(req.userId!, updated);
    return successResponse(res, updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'STATS_ERROR', error.message, 500);
    }
    throw error;
  }
});

// POST /api/user/stats/events - 记录学习事件
const recordEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('words_added'),
    count: z.number().int().min(1),
    at: z.string().datetime().optional(),
  }),
  z.object({
    type: z.literal('practice_completed'),
    correctCount: z.number().int().min(0),
    totalCount: z.number().int().min(1),
    at: z.string().datetime().optional(),
  }),
  z.object({
    type: z.literal('story_generated'),
    wordCount: z.number().int().min(0).optional(),
    at: z.string().datetime().optional(),
  }),
  z.object({
    type: z.literal('mastery_marked'),
    termKey: z.string().optional(),
    at: z.string().datetime().optional(),
  }),
]);

router.post('/stats/events', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = recordEventSchema.parse(req.body);
    const event: any = {
      type: data.type,
      at: data.at ? new Date(data.at) : new Date(),
    };

    if (data.type === 'words_added') {
      event.count = data.count;
    } else if (data.type === 'practice_completed') {
      event.correctCount = data.correctCount;
      event.totalCount = data.totalCount;
    } else if (data.type === 'story_generated') {
      event.wordCount = data.wordCount;
    } else if (data.type === 'mastery_marked') {
      event.termKey = data.termKey;
    }

    const stats = await UserStatsService.recordLearningEvent(req.userId!, event);
    return successResponse(res, stats);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'EVENT_ERROR', error.message, 500);
    }
    throw error;
  }
});

// ===== Growth Goals =====

// GET /api/user/goals - 获取学习目标
router.get('/goals', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const goals = await UserStatsService.getGrowthGoals(req.userId!);
    return successResponse(res, goals);
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'GOALS_ERROR', error.message, 500);
    }
    throw error;
  }
});

// PUT /api/user/goals - 更新学习目标
const updateGoalsSchema = z.object({
  weeklyXpGoal: z.number().int().min(0).max(999999),
  weeklyWordsGoal: z.number().int().min(0).max(999999),
});

router.put('/goals', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = updateGoalsSchema.parse(req.body);
    await UserStatsService.updateGrowthGoals(req.userId!, data);
    return successResponse(res, data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'GOALS_ERROR', error.message, 500);
    }
    throw error;
  }
});

// ===== Reading Question Stats =====

// GET /api/user/reading-stats - 获取阅读题统计
router.get('/reading-stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { articleKey } = req.query;
    if (!articleKey || typeof articleKey !== 'string') {
      return errorResponse(res, 'VALIDATION_ERROR', 'articleKey is required', 400);
    }

    const stats = await UserStatsService.getReadingStats(req.userId!, articleKey);
    return successResponse(res, stats);
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'READING_STATS_ERROR', error.message, 500);
    }
    throw error;
  }
});

// PUT /api/user/reading-stats - 更新阅读题统计
const updateReadingStatsSchema = z.object({
  articleKey: z.string().min(1),
  score: z.number().int().min(0),
  total: z.number().int().min(1),
});

router.put('/reading-stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = updateReadingStatsSchema.parse(req.body);
    await UserStatsService.updateReadingStats(req.userId!, data.articleKey, data.score, data.total);
    const stats = await UserStatsService.getReadingStats(req.userId!, data.articleKey);
    return successResponse(res, stats);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'READING_STATS_ERROR', error.message, 500);
    }
    throw error;
  }
});

// ===== Speaking Training Stats =====

// GET /api/user/speaking-stats - 获取听说训练统计
router.get('/speaking-stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { dateKey } = req.query;
    if (dateKey && typeof dateKey === 'string') {
      const stats = await UserStatsService.getSpeakingStats(req.userId!, dateKey);
      return successResponse(res, stats);
    }

    // Return all stats if no dateKey
    const stats = await UserStatsService.getAllSpeakingStats(req.userId!);
    return successResponse(res, stats);
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'SPEAKING_STATS_ERROR', error.message, 500);
    }
    throw error;
  }
});

// PUT /api/user/speaking-stats - 更新听说训练统计
const updateSpeakingStatsSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  score: z.number().int().min(0).max(100),
  at: z.string().datetime().optional(),
});

router.put('/speaking-stats', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = updateSpeakingStatsSchema.parse(req.body);
    await UserStatsService.recordSpeakingAttempt(
      req.userId!,
      data.dateKey,
      data.score,
      data.at ? new Date(data.at) : new Date()
    );
    const stats = await UserStatsService.getSpeakingStats(req.userId!, data.dateKey);
    return successResponse(res, stats);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'SPEAKING_STATS_ERROR', error.message, 500);
    }
    throw error;
  }
});

// ===== Learning Events =====

// GET /api/user/events - 获取学习事件
router.get('/events', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 120;
    const events = await UserStatsService.getLearningEvents(req.userId!, limit);
    return successResponse(res, { events });
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'EVENTS_ERROR', error.message, 500);
    }
    throw error;
  }
});

// POST /api/user/events - 添加学习事件
const addEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('words_added'),
    count: z.number().int().min(1),
    at: z.string().datetime().optional(),
  }),
  z.object({
    type: z.literal('practice_completed'),
    correctCount: z.number().int().min(0),
    totalCount: z.number().int().min(1),
    at: z.string().datetime().optional(),
  }),
  z.object({
    type: z.literal('story_generated'),
    wordCount: z.number().int().min(0).optional(),
    at: z.string().datetime().optional(),
  }),
]);

router.post('/events', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = addEventSchema.parse(req.body);
    const event: any = {
      type: data.type,
      at: data.at ? new Date(data.at) : new Date(),
    };

    if (data.type === 'words_added') {
      event.count = data.count;
    } else if (data.type === 'practice_completed') {
      event.correctCount = data.correctCount;
      event.totalCount = data.totalCount;
    } else if (data.type === 'story_generated') {
      event.wordCount = data.wordCount;
    }

    await UserStatsService.addLearningEvent(req.userId!, event);
    const events = await UserStatsService.getLearningEvents(req.userId!, 120);
    return successResponse(res, { events });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'EVENTS_ERROR', error.message, 500);
    }
    throw error;
  }
});

// DELETE /api/user/events - 清空学习事件
router.delete('/events', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await UserStatsService.clearLearningEvents(req.userId!);
    return successResponse(res, { cleared: true });
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'EVENTS_ERROR', error.message, 500);
    }
    throw error;
  }
});

// ===== Reset All Stats =====

// POST /api/user/reset - 重置所有统计数据
router.post('/reset', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await UserStatsService.resetAllStats(req.userId!);
    return successResponse(res, { reset: true });
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'RESET_ERROR', error.message, 500);
    }
    throw error;
  }
});

export { router as userStatsRouter };
