"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const ai_service_1 = require("../services/ai-service");
const database_1 = __importDefault(require("../config/database"));
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
exports.aiRouter = router;
// 验证 schema
const defineSchema = zod_1.z.object({
    term: zod_1.z.string().min(1).max(100),
});
const extractSchema = zod_1.z.object({
    imageBase64: zod_1.z.string().min(1),
});
const practiceSchema = zod_1.z.object({
    wordIds: zod_1.z.array(zod_1.z.string()).min(1).max(50),
    questionCount: zod_1.z.number().min(1).max(30).optional().default(10),
    allowedTypes: zod_1.z.array(zod_1.z.enum(['mcq', 'fill_blank', 'reorder'])).optional().default(['mcq', 'fill_blank', 'reorder']),
});
const storySchema = zod_1.z.object({
    wordIds: zod_1.z.array(zod_1.z.string()).min(1).max(100),
});
const essaySchema = zod_1.z.object({
    title: zod_1.z.string().optional(),
    essay: zod_1.z.string().min(10).max(20000),
});
const articleSchema = zod_1.z.object({
    article: zod_1.z.string().min(10).max(50000),
    generateQuestions: zod_1.z.boolean().optional().default(false),
});
// 生成单词释义
router.post('/define', async (req, res) => {
    try {
        const { term } = defineSchema.parse(req.body);
        const result = await ai_service_1.AIService.defineWord(term);
        return (0, response_1.successResponse)(res, result);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'AI_ERROR', error.message, 500);
        }
        throw error;
    }
});
// 图片识别单词
router.post('/extract', async (req, res) => {
    try {
        const { imageBase64 } = extractSchema.parse(req.body);
        const result = await ai_service_1.AIService.extractWordsFromImage(imageBase64);
        return (0, response_1.successResponse)(res, result);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'AI_ERROR', error.message, 500);
        }
        throw error;
    }
});
// 生成练习题
router.post('/practice', async (req, res) => {
    try {
        const userId = req.userId;
        const { wordIds, questionCount, allowedTypes } = practiceSchema.parse(req.body);
        // 获取单词详情
        const words = await database_1.default.word.findMany({
            where: { id: { in: wordIds }, userId },
            select: { word: true, definition: true, partOfSpeech: true },
        });
        if (words.length === 0) {
            return (0, response_1.errorResponse)(res, 'WORDS_NOT_FOUND', '未找到指定单词', 404);
        }
        const result = await ai_service_1.AIService.generatePractice(words, questionCount, allowedTypes);
        console.log('[API] Practice generated, questions count:', result.questions?.length);
        if (result.questions?.length > 0) {
            const firstQ = result.questions[0];
            console.log('[API] First question type:', firstQ.type, 'has parts:', !!firstQ.parts, 'has acceptableAnswers:', !!firstQ.acceptableAnswers);
        }
        return (0, response_1.successResponse)(res, result);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'AI_ERROR', error.message, 500);
        }
        throw error;
    }
});
// 生成故事
router.post('/story', async (req, res) => {
    try {
        const userId = req.userId;
        const { wordIds } = storySchema.parse(req.body);
        // 获取单词详情
        const words = await database_1.default.word.findMany({
            where: { id: { in: wordIds }, userId },
            select: { word: true, definition: true },
        });
        if (words.length === 0) {
            return (0, response_1.errorResponse)(res, 'WORDS_NOT_FOUND', '未找到指定单词', 404);
        }
        const result = await ai_service_1.AIService.generateStory(words);
        return (0, response_1.successResponse)(res, result);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'AI_ERROR', error.message, 500);
        }
        throw error;
    }
});
// 作文批改
router.post('/review-essay', async (req, res) => {
    try {
        const { title, essay } = essaySchema.parse(req.body);
        console.log('[API] Received essay review request, title:', title ? 'provided' : 'empty', 'essay length:', essay?.length);
        const result = await ai_service_1.AIService.reviewEssay(title, essay);
        console.log('[API] Sending essay review response:', JSON.stringify({
            success: true,
            hasOverallBand: !!result.overallBand,
            overallBand: result.overallBand,
            hasScores: !!result.scores,
            scores: result.scores,
            issuesCount: result.issues?.length || 0,
            beforeAfterCount: result.beforeAfter?.length || 0,
            firstIssue: result.issues?.[0] || null,
        }, null, 2));
        return (0, response_1.successResponse)(res, result);
    }
    catch (error) {
        console.error('[API] Essay review error:', error);
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'AI_ERROR', error.message, 500);
        }
        throw error;
    }
});
// 文章分析
router.post('/study-article', async (req, res) => {
    try {
        const { article, generateQuestions } = articleSchema.parse(req.body);
        console.log('[API] Received article study request, length:', article?.length, 'generateQuestions:', generateQuestions);
        const result = await ai_service_1.AIService.studyArticle(article, generateQuestions);
        console.log('[API] Sending article study response:', JSON.stringify({
            success: true,
            kind: result.kind,
            hasStructure: !!result.structure,
            hasSyntax: !!result.syntax,
            hardSentencesCount: result.hardSentences?.length || 0,
            keywordsCount: result.keywords?.length || 0,
        }, null, 2));
        return (0, response_1.successResponse)(res, result);
    }
    catch (error) {
        console.error('[API] Article study error:', error);
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'AI_ERROR', error.message, 500);
        }
        throw error;
    }
});
// 口语对话
const speakingChatSchema = zod_1.z.object({
    scenario: zod_1.z.string().max(120).optional(),
    userTextEn: zod_1.z.string().min(1).max(600),
    history: zod_1.z.array(zod_1.z.object({
        role: zod_1.z.enum(['user', 'assistant']),
        contentEn: zod_1.z.string().min(1),
    })).max(20).optional(),
    targetLevel: zod_1.z.enum(['A2', 'B1', 'B2', 'C1']).optional(),
});
router.post('/speaking-chat', async (req, res) => {
    try {
        const { scenario, userTextEn, history, targetLevel } = speakingChatSchema.parse(req.body);
        const result = await ai_service_1.AIService.speakingChat({
            scenario,
            userTextEn,
            history,
            targetLevel,
        });
        return (0, response_1.successResponse)(res, result);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'AI_ERROR', error.message, 500);
        }
        throw error;
    }
});
//# sourceMappingURL=ai.js.map