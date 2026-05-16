"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.practiceRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const practice_service_1 = require("../services/practice-service");
const word_mastery_service_1 = require("../services/word-mastery-service");
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
exports.practiceRouter = router;
// ===== Practice Records =====
// POST /api/practice - 创建练习记录
const createPracticeSchema = zod_1.z.object({
    questionsJson: zod_1.z.string().min(1),
    wordIds: zod_1.z.array(zod_1.z.string()),
    questionCount: zod_1.z.number().int().min(1),
});
router.post('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const data = createPracticeSchema.parse(req.body);
        const record = await practice_service_1.PracticeService.createPractice(req.userId, {
            questionsJson: data.questionsJson,
            wordIds: data.wordIds,
            questionCount: data.questionCount,
        });
        return (0, response_1.successResponse)(res, record);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'PRACTICE_ERROR', error.message, 500);
        }
        throw error;
    }
});
// GET /api/practice - 获取练习历史列表
router.get('/', auth_1.authMiddleware, async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
        const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
        const records = await practice_service_1.PracticeService.listPractices(req.userId, limit, offset);
        return (0, response_1.successResponse)(res, { records });
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'PRACTICE_ERROR', error.message, 500);
        }
        throw error;
    }
});
// GET /api/practice/:id - 获取单次练习详情
router.get('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const id = String(req.params.id);
        const record = await practice_service_1.PracticeService.getPracticeById(req.userId, id);
        if (!record) {
            return (0, response_1.errorResponse)(res, 'NOT_FOUND', 'Practice record not found', 404);
        }
        return (0, response_1.successResponse)(res, record);
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'PRACTICE_ERROR', error.message, 500);
        }
        throw error;
    }
});
// POST /api/practice/:id/submit - 提交答题结果
const submitAnswerSchema = zod_1.z.object({
    answers: zod_1.z.array(zod_1.z.object({
        questionIndex: zod_1.z.number().int().min(0),
        questionType: zod_1.z.string(),
        word: zod_1.z.string(),
        promptEn: zod_1.z.string(),
        userAnswer: zod_1.z.string().nullable(),
        correctAnswer: zod_1.z.string().nullable(),
        isCorrect: zod_1.z.boolean(),
    })),
    correctCount: zod_1.z.number().int().min(0),
    totalCount: zod_1.z.number().int().min(1),
    wordResults: zod_1.z.array(zod_1.z.object({
        wordId: zod_1.z.string(),
        isCorrect: zod_1.z.boolean(),
    })).optional(),
});
router.post('/:id/submit', auth_1.authMiddleware, async (req, res) => {
    try {
        const id = String(req.params.id);
        const data = submitAnswerSchema.parse(req.body);
        const record = await practice_service_1.PracticeService.submitPractice(req.userId, id, data.answers, data.correctCount, data.totalCount);
        // Update word mastery stats if wordResults provided
        if (data.wordResults && data.wordResults.length > 0) {
            for (const wr of data.wordResults) {
                await word_mastery_service_1.WordMasteryService.recordAnswer(req.userId, {
                    wordId: wr.wordId,
                    isCorrect: wr.isCorrect,
                });
            }
        }
        return (0, response_1.successResponse)(res, record);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'PRACTICE_ERROR', error.message, 500);
        }
        throw error;
    }
});
// DELETE /api/practice/:id - 删除练习记录
router.delete('/:id', auth_1.authMiddleware, async (req, res) => {
    try {
        const id = String(req.params.id);
        const result = await practice_service_1.PracticeService.deletePractice(req.userId, id);
        return (0, response_1.successResponse)(res, result);
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'PRACTICE_ERROR', error.message, 500);
        }
        throw error;
    }
});
//# sourceMappingURL=practice.js.map