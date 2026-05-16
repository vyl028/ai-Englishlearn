"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userStatsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const user_stats_service_1 = require("../services/user-stats-service");
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
exports.userStatsRouter = router;
// ===== Learning Stats =====
// GET /api/user/stats - 获取学习统计
router.get('/stats', auth_1.authMiddleware, async (req, res) => {
    try {
        const stats = await user_stats_service_1.UserStatsService.getLearningStats(req.userId);
        return (0, response_1.successResponse)(res, stats);
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'STATS_ERROR', error.message, 500);
        }
        throw error;
    }
});
// PUT /api/user/stats - 更新学习统计
const updateStatsSchema = zod_1.z.object({
    xp: zod_1.z.number().int().min(0).optional(),
    unlockedBadges: zod_1.z.array(zod_1.z.string()).optional(),
    streak: zod_1.z.object({
        current: zod_1.z.number().int().min(0),
        longest: zod_1.z.number().int().min(0),
        lastActiveDate: zod_1.z.string().optional(),
    }).optional(),
    totals: zod_1.z.object({
        wordsAdded: zod_1.z.number().int().min(0),
        practiceCompleted: zod_1.z.number().int().min(0),
        storiesGenerated: zod_1.z.number().int().min(0),
        masteredMarked: zod_1.z.number().int().min(0),
    }).optional(),
    daily: zod_1.z.record(zod_1.z.object({
        xpEarned: zod_1.z.number().int().min(0),
        wordsAdded: zod_1.z.number().int().min(0),
        practiceCompleted: zod_1.z.number().int().min(0),
        storiesGenerated: zod_1.z.number().int().min(0),
    })).optional(),
});
router.put('/stats', auth_1.authMiddleware, async (req, res) => {
    try {
        const data = updateStatsSchema.parse(req.body);
        const current = await user_stats_service_1.UserStatsService.getLearningStats(req.userId);
        const updated = {
            ...current,
            ...data,
            streak: data.streak ? { ...current.streak, ...data.streak } : current.streak,
            totals: data.totals ? { ...current.totals, ...data.totals } : current.totals,
            daily: data.daily || current.daily,
        };
        await user_stats_service_1.UserStatsService.updateLearningStats(req.userId, updated);
        return (0, response_1.successResponse)(res, updated);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'STATS_ERROR', error.message, 500);
        }
        throw error;
    }
});
// POST /api/user/stats/events - 记录学习事件
const recordEventSchema = zod_1.z.discriminatedUnion('type', [
    zod_1.z.object({
        type: zod_1.z.literal('words_added'),
        count: zod_1.z.number().int().min(1),
        at: zod_1.z.string().datetime().optional(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('practice_completed'),
        correctCount: zod_1.z.number().int().min(0),
        totalCount: zod_1.z.number().int().min(1),
        at: zod_1.z.string().datetime().optional(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('story_generated'),
        wordCount: zod_1.z.number().int().min(0).optional(),
        at: zod_1.z.string().datetime().optional(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('mastery_marked'),
        termKey: zod_1.z.string().optional(),
        at: zod_1.z.string().datetime().optional(),
    }),
]);
router.post('/stats/events', auth_1.authMiddleware, async (req, res) => {
    try {
        const data = recordEventSchema.parse(req.body);
        const event = {
            type: data.type,
            at: data.at ? new Date(data.at) : new Date(),
        };
        if (data.type === 'words_added') {
            event.count = data.count;
        }
        else if (data.type === 'practice_completed') {
            event.correctCount = data.correctCount;
            event.totalCount = data.totalCount;
        }
        else if (data.type === 'story_generated') {
            event.wordCount = data.wordCount;
        }
        else if (data.type === 'mastery_marked') {
            event.termKey = data.termKey;
        }
        const stats = await user_stats_service_1.UserStatsService.recordLearningEvent(req.userId, event);
        return (0, response_1.successResponse)(res, stats);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'EVENT_ERROR', error.message, 500);
        }
        throw error;
    }
});
// ===== Growth Goals =====
// GET /api/user/goals - 获取学习目标
router.get('/goals', auth_1.authMiddleware, async (req, res) => {
    try {
        const goals = await user_stats_service_1.UserStatsService.getGrowthGoals(req.userId);
        return (0, response_1.successResponse)(res, goals);
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'GOALS_ERROR', error.message, 500);
        }
        throw error;
    }
});
// PUT /api/user/goals - 更新学习目标
const updateGoalsSchema = zod_1.z.object({
    weeklyXpGoal: zod_1.z.number().int().min(0).max(999999),
    weeklyWordsGoal: zod_1.z.number().int().min(0).max(999999),
});
router.put('/goals', auth_1.authMiddleware, async (req, res) => {
    try {
        const data = updateGoalsSchema.parse(req.body);
        await user_stats_service_1.UserStatsService.updateGrowthGoals(req.userId, data);
        return (0, response_1.successResponse)(res, data);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'GOALS_ERROR', error.message, 500);
        }
        throw error;
    }
});
// ===== Reading Question Stats =====
// GET /api/user/reading-stats - 获取阅读题统计
router.get('/reading-stats', auth_1.authMiddleware, async (req, res) => {
    try {
        const { articleKey } = req.query;
        if (!articleKey || typeof articleKey !== 'string') {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', 'articleKey is required', 400);
        }
        const stats = await user_stats_service_1.UserStatsService.getReadingStats(req.userId, articleKey);
        return (0, response_1.successResponse)(res, stats);
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'READING_STATS_ERROR', error.message, 500);
        }
        throw error;
    }
});
// PUT /api/user/reading-stats - 更新阅读题统计
const updateReadingStatsSchema = zod_1.z.object({
    articleKey: zod_1.z.string().min(1),
    score: zod_1.z.number().int().min(0),
    total: zod_1.z.number().int().min(1),
});
router.put('/reading-stats', auth_1.authMiddleware, async (req, res) => {
    try {
        const data = updateReadingStatsSchema.parse(req.body);
        await user_stats_service_1.UserStatsService.updateReadingStats(req.userId, data.articleKey, data.score, data.total);
        const stats = await user_stats_service_1.UserStatsService.getReadingStats(req.userId, data.articleKey);
        return (0, response_1.successResponse)(res, stats);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'READING_STATS_ERROR', error.message, 500);
        }
        throw error;
    }
});
// ===== Speaking Training Stats =====
// GET /api/user/speaking-stats - 获取听说训练统计
router.get('/speaking-stats', auth_1.authMiddleware, async (req, res) => {
    try {
        const { dateKey } = req.query;
        if (dateKey && typeof dateKey === 'string') {
            const stats = await user_stats_service_1.UserStatsService.getSpeakingStats(req.userId, dateKey);
            return (0, response_1.successResponse)(res, stats);
        }
        // Return all stats if no dateKey
        const stats = await user_stats_service_1.UserStatsService.getAllSpeakingStats(req.userId);
        return (0, response_1.successResponse)(res, stats);
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'SPEAKING_STATS_ERROR', error.message, 500);
        }
        throw error;
    }
});
// PUT /api/user/speaking-stats - 更新听说训练统计
const updateSpeakingStatsSchema = zod_1.z.object({
    dateKey: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    score: zod_1.z.number().int().min(0).max(100),
    at: zod_1.z.string().datetime().optional(),
});
router.put('/speaking-stats', auth_1.authMiddleware, async (req, res) => {
    try {
        const data = updateSpeakingStatsSchema.parse(req.body);
        await user_stats_service_1.UserStatsService.recordSpeakingAttempt(req.userId, data.dateKey, data.score, data.at ? new Date(data.at) : new Date());
        const stats = await user_stats_service_1.UserStatsService.getSpeakingStats(req.userId, data.dateKey);
        return (0, response_1.successResponse)(res, stats);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'SPEAKING_STATS_ERROR', error.message, 500);
        }
        throw error;
    }
});
// ===== Learning Events =====
// GET /api/user/events - 获取学习事件
router.get('/events', auth_1.authMiddleware, async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 120;
        const events = await user_stats_service_1.UserStatsService.getLearningEvents(req.userId, limit);
        return (0, response_1.successResponse)(res, { events });
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'EVENTS_ERROR', error.message, 500);
        }
        throw error;
    }
});
// POST /api/user/events - 添加学习事件
const addEventSchema = zod_1.z.discriminatedUnion('type', [
    zod_1.z.object({
        type: zod_1.z.literal('words_added'),
        count: zod_1.z.number().int().min(1),
        at: zod_1.z.string().datetime().optional(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('practice_completed'),
        correctCount: zod_1.z.number().int().min(0),
        totalCount: zod_1.z.number().int().min(1),
        at: zod_1.z.string().datetime().optional(),
    }),
    zod_1.z.object({
        type: zod_1.z.literal('story_generated'),
        wordCount: zod_1.z.number().int().min(0).optional(),
        at: zod_1.z.string().datetime().optional(),
    }),
]);
router.post('/events', auth_1.authMiddleware, async (req, res) => {
    try {
        const data = addEventSchema.parse(req.body);
        const event = {
            type: data.type,
            at: data.at ? new Date(data.at) : new Date(),
        };
        if (data.type === 'words_added') {
            event.count = data.count;
        }
        else if (data.type === 'practice_completed') {
            event.correctCount = data.correctCount;
            event.totalCount = data.totalCount;
        }
        else if (data.type === 'story_generated') {
            event.wordCount = data.wordCount;
        }
        await user_stats_service_1.UserStatsService.addLearningEvent(req.userId, event);
        const events = await user_stats_service_1.UserStatsService.getLearningEvents(req.userId, 120);
        return (0, response_1.successResponse)(res, { events });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'EVENTS_ERROR', error.message, 500);
        }
        throw error;
    }
});
// DELETE /api/user/events - 清空学习事件
router.delete('/events', auth_1.authMiddleware, async (req, res) => {
    try {
        await user_stats_service_1.UserStatsService.clearLearningEvents(req.userId);
        return (0, response_1.successResponse)(res, { cleared: true });
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'EVENTS_ERROR', error.message, 500);
        }
        throw error;
    }
});
// ===== Reset All Stats =====
// POST /api/user/reset - 重置所有统计数据
router.post('/reset', auth_1.authMiddleware, async (req, res) => {
    try {
        await user_stats_service_1.UserStatsService.resetAllStats(req.userId);
        return (0, response_1.successResponse)(res, { reset: true });
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'RESET_ERROR', error.message, 500);
        }
        throw error;
    }
});
//# sourceMappingURL=user-stats.js.map