import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../config/database';
import { authMiddleware, generateToken } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

// 验证 schema
const registerSchema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(6),
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password } = registerSchema.parse(req.body);

    // 检查用户名是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return errorResponse(res, 'USERNAME_EXISTS', '用户名已存在', 409);
    }

    // 密码哈希
    const passwordHash = await bcrypt.hash(password, 10);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        username,
        passwordHash,
        learningStats: {
          create: {},
        },
      },
      select: {
        id: true,
        username: true,
        createdAt: true,
      },
    });

    // 生成 token
    const token = generateToken(user.id);

    return successResponse(res, { user, token }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    throw error;
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return errorResponse(res, 'INVALID_CREDENTIALS', '用户名或密码错误', 401);
    }

    // 验证密码
    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      return errorResponse(res, 'INVALID_CREDENTIALS', '用户名或密码错误', 401);
    }

    // 生成 token
    const token = generateToken(user.id);

    return successResponse(res, {
      user: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
    }
    throw error;
  }
});

// 获取当前用户
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      username: true,
      createdAt: true,
    },
  });

  if (!user) {
    return errorResponse(res, 'USER_NOT_FOUND', '用户不存在', 404);
  }

  return successResponse(res, { user });
});

export { router as authRouter };
