"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wordMasteryRouter = void 0;
const express_1 = require("express");
const word_mastery_service_1 = require("../services/word-mastery-service");
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
exports.wordMasteryRouter = router;
// GET /api/word-mastery - 获取单词掌握度列表
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const minScore = req.query.minScore ? parseInt(req.query.minScore, 10) : undefined;
        const maxScore = req.query.maxScore ? parseInt(req.query.maxScore, 10) : undefined;
        const onlyAutoMastered = req.query.onlyAutoMastered === 'true';
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
        const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
        const stats = await word_mastery_service_1.WordMasteryService.listMasteryStats(req.userId, {
            minScore,
            maxScore,
            onlyAutoMastered,
            limit,
            offset,
        });
        return (0, response_1.successResponse)(res, { stats });
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'MASTERY_ERROR', error.message, 500);
        }
        throw error;
    }
});
// GET /api/word-mastery/:wordId - 获取单个单词掌握度
router.get('/:wordId', auth_1.authMiddleware, async (req, res) => {
    try {
        const wordId = String(req.params.wordId);
        const stats = await word_mastery_service_1.WordMasteryService.getMasteryStats(req.userId, wordId);
        if (!stats) {
            return (0, response_1.successResponse)(res, null);
        }
        return (0, response_1.successResponse)(res, stats);
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'MASTERY_ERROR', error.message, 500);
        }
        throw error;
    }
});
// POST /api/word-mastery/recalculate - 重新计算所有单词掌握度
router.post('/recalculate', auth_1.authMiddleware, async (req, res) => {
    try {
        const results = await word_mastery_service_1.WordMasteryService.recalculateAll(req.userId);
        return (0, response_1.successResponse)(res, { recalculated: results.length });
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'MASTERY_ERROR', error.message, 500);
        }
        throw error;
    }
});
// POST /api/word-mastery/:wordId/recalculate - 重新计算单个单词掌握度
router.post('/:wordId/recalculate', auth_1.authMiddleware, async (req, res) => {
    try {
        const wordId = String(req.params.wordId);
        const stats = await word_mastery_service_1.WordMasteryService.recalculateMastery(req.userId, wordId);
        if (!stats) {
            return (0, response_1.errorResponse)(res, 'NOT_FOUND', 'Word mastery stats not found', 404);
        }
        return (0, response_1.successResponse)(res, stats);
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'MASTERY_ERROR', error.message, 500);
        }
        throw error;
    }
});
// DELETE /api/word-mastery/:wordId - 重置单个单词掌握度
router.delete('/:wordId', auth_1.authMiddleware, async (req, res) => {
    try {
        const wordId = String(req.params.wordId);
        const result = await word_mastery_service_1.WordMasteryService.resetStats(req.userId, wordId);
        return (0, response_1.successResponse)(res, result);
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'MASTERY_ERROR', error.message, 500);
        }
        throw error;
    }
});
// DELETE /api/word-mastery - 重置所有单词掌握度
router.delete('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const result = await word_mastery_service_1.WordMasteryService.resetStats(req.userId);
        return (0, response_1.successResponse)(res, result);
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'MASTERY_ERROR', error.message, 500);
        }
        throw error;
    }
});
//# sourceMappingURL=word-mastery.js.map