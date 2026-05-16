"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.learningPlanRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const learning_plan_service_1 = require("../services/learning-plan-service");
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
exports.learningPlanRouter = router;
// GET /api/learning-plan/evaluation - 获取学习效果评价报告
router.get('/evaluation', auth_1.authMiddleware, async (req, res) => {
    try {
        const report = await learning_plan_service_1.LearningPlanService.generateEvaluation(req.userId);
        return (0, response_1.successResponse)(res, report);
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'EVALUATION_ERROR', error.message, 500);
        }
        throw error;
    }
});
// GET /api/learning-plan/today - 获取今日学习计划（不存在则自动生成）
router.get('/today', auth_1.authMiddleware, async (req, res) => {
    try {
        const plan = await learning_plan_service_1.LearningPlanService.getOrCreateTodayPlan(req.userId);
        return (0, response_1.successResponse)(res, plan);
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'PLAN_ERROR', error.message, 500);
        }
        throw error;
    }
});
// POST /api/learning-plan/generate - 手动触发生成计划
const generatePlanSchema = zod_1.z.object({
    planType: zod_1.z.enum(['daily', 'weekly']).optional().default('daily'),
});
router.post('/generate', auth_1.authMiddleware, async (req, res) => {
    try {
        const data = generatePlanSchema.parse(req.body);
        let plan;
        if (data.planType === 'daily') {
            plan = await learning_plan_service_1.LearningPlanService.generateDailyPlan(req.userId);
        }
        else {
            // For now, weekly plan falls back to daily; can be extended later
            plan = await learning_plan_service_1.LearningPlanService.generateDailyPlan(req.userId);
        }
        return (0, response_1.successResponse)(res, plan);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'PLAN_ERROR', error.message, 500);
        }
        throw error;
    }
});
// PUT /api/learning-plan/:id/status - 更新计划状态
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['pending', 'in_progress', 'completed', 'skipped']),
});
router.put('/:id/status', auth_1.authMiddleware, async (req, res) => {
    try {
        const id = req.params.id;
        const data = updateStatusSchema.parse(req.body);
        const plan = await learning_plan_service_1.LearningPlanService.updatePlanStatus(req.userId, id, data.status);
        return (0, response_1.successResponse)(res, plan);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        if (error instanceof Error) {
            if (error.message === 'PLAN_NOT_FOUND') {
                return (0, response_1.errorResponse)(res, 'NOT_FOUND', '计划不存在', 404);
            }
            return (0, response_1.errorResponse)(res, 'PLAN_ERROR', error.message, 500);
        }
        throw error;
    }
});
// GET /api/learning-plan/history - 历史计划列表
router.get('/history', auth_1.authMiddleware, async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 30;
        const history = await learning_plan_service_1.LearningPlanService.listPlanHistory(req.userId, limit);
        return (0, response_1.successResponse)(res, { history });
    }
    catch (error) {
        if (error instanceof Error) {
            return (0, response_1.errorResponse)(res, 'HISTORY_ERROR', error.message, 500);
        }
        throw error;
    }
});
//# sourceMappingURL=learning-plan.js.map