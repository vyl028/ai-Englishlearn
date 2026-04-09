import { Router } from 'express';
import { z } from 'zod';
import { WordService } from '../services/word-service';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

// 验证 schema
const wordCreateSchema = z.object({
  word: z.string().min(1),
  partOfSpeech: z.string().min(1),
  definition: z.string().min(1),
  enrichment: z.record(z.any()).optional(),
  groupId: z.string().optional(),
  photoData: z.string().optional(),
});

const wordUpdateSchema = z.object({
  word: z.string().min(1).optional(),
  partOfSpeech: z.string().min(1).optional(),
  definition: z.string().min(1).optional(),
  enrichment: z.record(z.any()).optional(),
  groupId: z.string().nullable().optional(),
  isMastered: z.boolean().optional(),
});

const batchCreateSchema = z.object({
  items: z.array(wordCreateSchema).min(1).max(50),
});

const batchDeleteSchema = z.object({
  ids: z.array(z.string()).min(1),
});

// 获取单词列表
router.get('/', async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const filters = {
    search: req.query.search as string | undefined,
    groupId: req.query.groupId as string | undefined,
    isMastered: req.query.isMastered === 'true' ? true :
                req.query.isMastered === 'false' ? false : undefined,
    page: req.query.page ? parseInt(req.query.page as string) : 1,
    limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
  };

  const result = await WordService.findMany(userId, filters);
  return successResponse(res, result);
});

// 创建单词
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const data = wordCreateSchema.parse(req.body);

    const word = await WordService.create(userId, data);
    return successResponse(res, word, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    throw error;
  }
});

// 批量创建
router.post('/batch', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { items } = batchCreateSchema.parse(req.body);

    const result = await WordService.createBatch(userId, items);
    return successResponse(res, result, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    throw error;
  }
});

// 获取单个单词
router.get('/:id', async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const word = await WordService.findById(userId, id);

  if (!word) {
    return errorResponse(res, 'WORD_NOT_FOUND', '单词不存在', 404);
  }

  return successResponse(res, word);
});

// 更新单词
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const data = wordUpdateSchema.parse(req.body);

    const word = await WordService.update(userId, id, data);
    return successResponse(res, word);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    throw error;
  }
});

// 删除单词
router.delete('/:id', async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  await WordService.delete(userId, id);
  return successResponse(res, { success: true });
});

// 批量删除
router.post('/batch-delete', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { ids } = batchDeleteSchema.parse(req.body);

    const result = await WordService.deleteBatch(userId, ids);
    return successResponse(res, result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    throw error;
  }
});

export { router as wordsRouter };
