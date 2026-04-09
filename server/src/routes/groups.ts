import { Router } from 'express';
import { z } from 'zod';
import { GroupService } from '../services/group-service';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

const groupCreateSchema = z.object({
  name: z.string().min(1).max(50),
  order: z.number().optional(),
});

const groupUpdateSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  order: z.number().optional(),
});

const reorderSchema = z.object({
  groupIds: z.array(z.string()),
});

// 获取分组列表
router.get('/', async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const groups = await GroupService.findMany(userId);
  return successResponse(res, groups);
});

// 创建分组
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const data = groupCreateSchema.parse(req.body);

    const group = await GroupService.create(userId, data);
    return successResponse(res, group, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    throw error;
  }
});

// 获取单个分组
router.get('/:id', async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  const group = await GroupService.findById(userId, id);

  if (!group) {
    return errorResponse(res, 'GROUP_NOT_FOUND', '分组不存在', 404);
  }

  return successResponse(res, group);
});

// 更新分组
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const data = groupUpdateSchema.parse(req.body);

    const group = await GroupService.update(userId, id, data);
    return successResponse(res, group);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    throw error;
  }
});

// 删除分组
router.delete('/:id', async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const { id } = req.params;

  await GroupService.delete(userId, id);
  return successResponse(res, { success: true });
});

// 重新排序
router.put('/reorder', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { groupIds } = reorderSchema.parse(req.body);

    await GroupService.reorder(userId, groupIds);
    return successResponse(res, { success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    throw error;
  }
});

export { router as groupsRouter };
