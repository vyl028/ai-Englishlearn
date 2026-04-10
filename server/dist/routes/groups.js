"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.groupsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const group_service_1 = require("../services/group-service");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
exports.groupsRouter = router;
const groupCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(50),
    order: zod_1.z.number().optional(),
});
const groupUpdateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(50).optional(),
    order: zod_1.z.number().optional(),
});
const reorderSchema = zod_1.z.object({
    groupIds: zod_1.z.array(zod_1.z.string()),
});
// 获取分组列表
router.get('/', async (req, res) => {
    const userId = req.userId;
    const groups = await group_service_1.GroupService.findMany(userId);
    return (0, response_1.successResponse)(res, groups);
});
// 创建分组
router.post('/', async (req, res) => {
    try {
        const userId = req.userId;
        const data = groupCreateSchema.parse(req.body);
        const group = await group_service_1.GroupService.create(userId, data);
        return (0, response_1.successResponse)(res, group, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        throw error;
    }
});
// 获取单个分组
router.get('/:id', async (req, res) => {
    const userId = req.userId;
    const id = req.params.id;
    const group = await group_service_1.GroupService.findById(userId, id);
    if (!group) {
        return (0, response_1.errorResponse)(res, 'GROUP_NOT_FOUND', '分组不存在', 404);
    }
    return (0, response_1.successResponse)(res, group);
});
// 更新分组
router.put('/:id', async (req, res) => {
    try {
        const userId = req.userId;
        const id = req.params.id;
        const data = groupUpdateSchema.parse(req.body);
        const group = await group_service_1.GroupService.update(userId, id, data);
        return (0, response_1.successResponse)(res, group);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        throw error;
    }
});
// 删除分组
router.delete('/:id', async (req, res) => {
    const userId = req.userId;
    const id = req.params.id;
    await group_service_1.GroupService.delete(userId, id);
    return (0, response_1.successResponse)(res, { success: true });
});
// 重新排序
router.put('/reorder', async (req, res) => {
    try {
        const userId = req.userId;
        const { groupIds } = reorderSchema.parse(req.body);
        await group_service_1.GroupService.reorder(userId, groupIds);
        return (0, response_1.successResponse)(res, { success: true });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        throw error;
    }
});
//# sourceMappingURL=groups.js.map