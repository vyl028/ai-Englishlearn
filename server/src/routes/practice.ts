import { Router } from 'express';
import { z } from 'zod';
import { PracticeService } from '../services/practice-service';
import { WordMasteryService } from '../services/word-mastery-service';
import { authMiddleware } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

// ===== Practice Records =====

// POST /api/practice - 创建练习记录
const createPracticeSchema = z.object({
  questionsJson: z.string().min(1),
  wordIds: z.array(z.string()),
  questionCount: z.number().int().min(1),
});

router.post('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = createPracticeSchema.parse(req.body);
    const record = await PracticeService.createPractice(req.userId!, {
      questionsJson: data.questionsJson,
      wordIds: data.wordIds,
      questionCount: data.questionCount,
    });
    return successResponse(res, record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'PRACTICE_ERROR', error.message, 500);
    }
    throw error;
  }
});

// GET /api/practice - 获取练习历史列表
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const records = await PracticeService.listPractices(req.userId!, limit, offset);
    return successResponse(res, { records });
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'PRACTICE_ERROR', error.message, 500);
    }
    throw error;
  }
});

// GET /api/practice/:id - 获取单次练习详情
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const record = await PracticeService.getPracticeById(req.userId!, id);
    if (!record) {
      return errorResponse(res, 'NOT_FOUND', 'Practice record not found', 404);
    }
    return successResponse(res, record);
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'PRACTICE_ERROR', error.message, 500);
    }
    throw error;
  }
});

// POST /api/practice/:id/submit - 提交答题结果
const submitAnswerSchema = z.object({
  answers: z.array(z.object({
    questionIndex: z.number().int().min(0),
    questionType: z.string(),
    word: z.string(),
    promptEn: z.string(),
    userAnswer: z.string().nullable(),
    correctAnswer: z.string().nullable(),
    isCorrect: z.boolean(),
  })),
  correctCount: z.number().int().min(0),
  totalCount: z.number().int().min(1),
  wordResults: z.array(z.object({
    wordId: z.string(),
    isCorrect: z.boolean(),
  })).optional(),
});

router.post('/:id/submit', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const data = submitAnswerSchema.parse(req.body);

    const record = await PracticeService.submitPractice(
      req.userId!,
      id,
      data.answers,
      data.correctCount,
      data.totalCount
    );

    // Update word mastery stats if wordResults provided
    if (data.wordResults && data.wordResults.length > 0) {
      for (const wr of data.wordResults) {
        await WordMasteryService.recordAnswer(req.userId!, {
          wordId: wr.wordId,
          isCorrect: wr.isCorrect,
        });
      }
    }

    return successResponse(res, record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'PRACTICE_ERROR', error.message, 500);
    }
    throw error;
  }
});

// DELETE /api/practice/:id - 删除练习记录
router.delete('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = String(req.params.id);
    const result = await PracticeService.deletePractice(req.userId!, id);
    return successResponse(res, result);
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'PRACTICE_ERROR', error.message, 500);
    }
    throw error;
  }
});

export { router as practiceRouter };
