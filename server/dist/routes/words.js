"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wordsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const word_service_1 = require("../services/word-service");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
exports.wordsRouter = router;
// 验证 schema
const wordCreateSchema = zod_1.z.object({
    word: zod_1.z.string().min(1),
    partOfSpeech: zod_1.z.string().min(1),
    definition: zod_1.z.string().min(1),
    enrichment: zod_1.z.record(zod_1.z.any()).optional(),
    groupId: zod_1.z.string().optional(),
    photoData: zod_1.z.string().optional(),
});
const wordUpdateSchema = zod_1.z.object({
    word: zod_1.z.string().min(1).optional(),
    partOfSpeech: zod_1.z.string().min(1).optional(),
    definition: zod_1.z.string().min(1).optional(),
    enrichment: zod_1.z.record(zod_1.z.any()).optional(),
    groupId: zod_1.z.string().nullable().optional(),
    isMastered: zod_1.z.boolean().optional(),
});
const batchCreateSchema = zod_1.z.object({
    items: zod_1.z.array(wordCreateSchema).min(1).max(50),
});
const batchDeleteSchema = zod_1.z.object({
    ids: zod_1.z.array(zod_1.z.string()).min(1),
});
// 获取单词列表
router.get('/', async (req, res) => {
    const userId = req.userId;
    const filters = {
        search: req.query.search,
        groupId: req.query.groupId,
        isMastered: req.query.isMastered === 'true' ? true :
            req.query.isMastered === 'false' ? false : undefined,
        page: req.query.page ? parseInt(req.query.page) : 1,
        limit: req.query.limit ? parseInt(req.query.limit) : 50,
    };
    const result = await word_service_1.WordService.findMany(userId, filters);
    return (0, response_1.successResponse)(res, result);
});
// 创建单词
router.post('/', async (req, res) => {
    try {
        const userId = req.userId;
        const data = wordCreateSchema.parse(req.body);
        const word = await word_service_1.WordService.create(userId, data);
        return (0, response_1.successResponse)(res, word, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        throw error;
    }
});
// 批量创建
router.post('/batch', async (req, res) => {
    try {
        const userId = req.userId;
        const { items } = batchCreateSchema.parse(req.body);
        const result = await word_service_1.WordService.createBatch(userId, items);
        return (0, response_1.successResponse)(res, result, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        throw error;
    }
});
// 获取单个单词
router.get('/:id', async (req, res) => {
    const userId = req.userId;
    const id = req.params.id;
    const word = await word_service_1.WordService.findById(userId, id);
    if (!word) {
        return (0, response_1.errorResponse)(res, 'WORD_NOT_FOUND', '单词不存在', 404);
    }
    return (0, response_1.successResponse)(res, word);
});
// 更新单词
router.put('/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        const data = wordUpdateSchema.parse(req.body);
        const word = await word_service_1.WordService.update(userId, id, data);
        return (0, response_1.successResponse)(res, word);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        throw error;
    }
});
// 删除单词
router.delete('/:id', async (req, res) => {
    const userId = req.userId;
    const id = req.params.id;
    await word_service_1.WordService.delete(userId, id);
    return (0, response_1.successResponse)(res, { success: true });
});
// 批量删除
router.post('/batch-delete', async (req, res) => {
    try {
        const userId = req.userId;
        const { ids } = batchDeleteSchema.parse(req.body);
        const result = await word_service_1.WordService.deleteBatch(userId, ids);
        return (0, response_1.successResponse)(res, result);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        throw error;
    }
});
//# sourceMappingURL=words.js.map