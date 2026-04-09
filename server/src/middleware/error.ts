import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { errorResponse } from '../utils/response';

export function errorHandler(
  err: Error,
  req: Request | AuthRequest,
  res: Response,
  next: NextFunction
) {
  console.error('[Error]', err);

  // Prisma 错误
  if (err.name === 'PrismaClientKnownRequestError') {
    // @ts-ignore
    if (err.code === 'P2002') {
      return errorResponse(res, 'DUPLICATE_ENTRY', '数据已存在', 409);
    }
    // @ts-ignore
    if (err.code === 'P2025') {
      return errorResponse(res, 'NOT_FOUND', '记录不存在', 404);
    }
    return errorResponse(res, 'DATABASE_ERROR', '数据库错误', 500);
  }

  // Zod 验证错误
  if (err.name === 'ZodError') {
    return errorResponse(res, 'VALIDATION_ERROR', err.message, 400);
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    return errorResponse(res, 'INVALID_TOKEN', '无效的令牌', 401);
  }

  if (err.name === 'TokenExpiredError') {
    return errorResponse(res, 'TOKEN_EXPIRED', '令牌已过期', 401);
  }

  // 默认错误
  return errorResponse(res, 'INTERNAL_ERROR', '服务器内部错误', 500);
}
