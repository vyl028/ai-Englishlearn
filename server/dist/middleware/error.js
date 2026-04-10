"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const response_1 = require("../utils/response");
function errorHandler(err, req, res, next) {
    console.error('[Error]', err);
    // Prisma 错误
    if (err.name === 'PrismaClientKnownRequestError') {
        // @ts-ignore
        if (err.code === 'P2002') {
            return (0, response_1.errorResponse)(res, 'DUPLICATE_ENTRY', '数据已存在', 409);
        }
        // @ts-ignore
        if (err.code === 'P2025') {
            return (0, response_1.errorResponse)(res, 'NOT_FOUND', '记录不存在', 404);
        }
        return (0, response_1.errorResponse)(res, 'DATABASE_ERROR', '数据库错误', 500);
    }
    // Zod 验证错误
    if (err.name === 'ZodError') {
        return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', err.message, 400);
    }
    // JWT 错误
    if (err.name === 'JsonWebTokenError') {
        return (0, response_1.errorResponse)(res, 'INVALID_TOKEN', '无效的令牌', 401);
    }
    if (err.name === 'TokenExpiredError') {
        return (0, response_1.errorResponse)(res, 'TOKEN_EXPIRED', '令牌已过期', 401);
    }
    // 默认错误
    return (0, response_1.errorResponse)(res, 'INTERNAL_ERROR', '服务器内部错误', 500);
}
//# sourceMappingURL=error.js.map