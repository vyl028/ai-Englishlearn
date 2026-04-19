import { Router } from 'express';
import { z } from 'zod';
import { WordMasteryService } from '../services/word-mastery-service';
import { authMiddleware } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

// GET /api/word-mastery - 获取单词掌握度列表
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const minScore = req.query.minScore ? parseInt(req.query.minScore as string, 10) : undefined;
    const maxScore = req.query.maxScore ? parseInt(req.query.maxScore as string, 10) : undefined;
    const onlyAutoMastered = req.query.onlyAutoMastered === 'true';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const stats = await WordMasteryService.listMasteryStats(req.userId!, {
      minScore,
      maxScore,
      onlyAutoMastered,
      limit,
      offset,
    });

    return successResponse(res, { stats });
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'MASTERY_ERROR', error.message, 500);
    }
    throw error;
  }
});

// GET /api/word-mastery/:wordId - 获取单个单词掌握度
router.get('/:wordId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const wordId = String(req.params.wordId);
    const stats = await WordMasteryService.getMasteryStats(req.userId!, wordId);

    if (!stats) {
      return successResponse(res, null);
    }

    return successResponse(res, stats);
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'MASTERY_ERROR', error.message, 500);
    }
    throw error;
  }
});

// POST /api/word-mastery/recalculate - 重新计算所有单词掌握度
router.post('/recalculate', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const results = await WordMasteryService.recalculateAll(req.userId!);
    return successResponse(res, { recalculated: results.length });
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'MASTERY_ERROR', error.message, 500);
    }
    throw error;
  }
});

// POST /api/word-mastery/:wordId/recalculate - 重新计算单个单词掌握度
router.post('/:wordId/recalculate', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const wordId = String(req.params.wordId);
    const stats = await WordMasteryService.recalculateMastery(req.userId!, wordId);

    if (!stats) {
      return errorResponse(res, 'NOT_FOUND', 'Word mastery stats not found', 404);
    }

    return successResponse(res, stats);
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'MASTERY_ERROR', error.message, 500);
    }
    throw error;
  }
});

// DELETE /api/word-mastery/:wordId - 重置单个单词掌握度
router.delete('/:wordId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const wordId = String(req.params.wordId);
    const result = await WordMasteryService.resetStats(req.userId!, wordId);
    return successResponse(res, result);
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'MASTERY_ERROR', error.message, 500);
    }
    throw error;
  }
});

// DELETE /api/word-mastery - 重置所有单词掌握度
router.delete('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await WordMasteryService.resetStats(req.userId!);
    return successResponse(res, result);
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'MASTERY_ERROR', error.message, 500);
    }
    throw error;
  }
});

export { router as wordMasteryRouter };
