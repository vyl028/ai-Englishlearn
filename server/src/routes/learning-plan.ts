import { Router } from 'express';
import { z } from 'zod';
import { LearningPlanService } from '../services/learning-plan-service';
import { authMiddleware } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

// GET /api/learning-plan/evaluation - 获取学习效果评价报告
router.get('/evaluation', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const report = await LearningPlanService.generateEvaluation(req.userId!);
    return successResponse(res, report);
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'EVALUATION_ERROR', error.message, 500);
    }
    throw error;
  }
});

// GET /api/learning-plan/today - 获取今日学习计划（不存在则自动生成）
router.get('/today', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const plan = await LearningPlanService.getOrCreateTodayPlan(req.userId!);
    return successResponse(res, plan);
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'PLAN_ERROR', error.message, 500);
    }
    throw error;
  }
});

// POST /api/learning-plan/generate - 手动触发生成计划
const generatePlanSchema = z.object({
  planType: z.enum(['daily', 'weekly']).optional().default('daily'),
});

router.post('/generate', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const data = generatePlanSchema.parse(req.body);
    let plan;
    if (data.planType === 'daily') {
      plan = await LearningPlanService.generateDailyPlan(req.userId!);
    } else {
      // For now, weekly plan falls back to daily; can be extended later
      plan = await LearningPlanService.generateDailyPlan(req.userId!);
    }
    return successResponse(res, plan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      return errorResponse(res, 'PLAN_ERROR', error.message, 500);
    }
    throw error;
  }
});

// PUT /api/learning-plan/:id/status - 更新计划状态
const updateStatusSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped']),
});

router.put('/:id/status', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const data = updateStatusSchema.parse(req.body);
    const plan = await LearningPlanService.updatePlanStatus(req.userId!, id, data.status);
    return successResponse(res, plan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    if (error instanceof Error) {
      if (error.message === 'PLAN_NOT_FOUND') {
        return errorResponse(res, 'NOT_FOUND', '计划不存在', 404);
      }
      return errorResponse(res, 'PLAN_ERROR', error.message, 500);
    }
    throw error;
  }
});

// GET /api/learning-plan/history - 历史计划列表
router.get('/history', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
    const history = await LearningPlanService.listPlanHistory(req.userId!, limit);
    return successResponse(res, { history });
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(res, 'HISTORY_ERROR', error.message, 500);
    }
    throw error;
  }
});

export { router as learningPlanRouter };
