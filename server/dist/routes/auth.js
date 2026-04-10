"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const database_1 = __importDefault(require("../config/database"));
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
const router = (0, express_1.Router)();
exports.authRouter = router;
// 验证 schema
const registerSchema = zod_1.z.object({
    username: zod_1.z.string().min(3).max(20),
    password: zod_1.z.string().min(6),
});
const loginSchema = zod_1.z.object({
    username: zod_1.z.string(),
    password: zod_1.z.string(),
});
// 注册
router.post('/register', async (req, res) => {
    try {
        const { username, password } = registerSchema.parse(req.body);
        // 检查用户名是否已存在
        const existingUser = await database_1.default.user.findUnique({
            where: { username },
        });
        if (existingUser) {
            return (0, response_1.errorResponse)(res, 'USERNAME_EXISTS', '用户名已存在', 409);
        }
        // 密码哈希
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        // 创建用户
        const user = await database_1.default.user.create({
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
        const token = (0, auth_1.generateToken)(user.id);
        return (0, response_1.successResponse)(res, { user, token }, 201);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        throw error;
    }
});
// 登录
router.post('/login', async (req, res) => {
    try {
        const { username, password } = loginSchema.parse(req.body);
        // 查找用户
        const user = await database_1.default.user.findUnique({
            where: { username },
        });
        if (!user) {
            return (0, response_1.errorResponse)(res, 'INVALID_CREDENTIALS', '用户名或密码错误', 401);
        }
        // 验证密码
        const isValid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!isValid) {
            return (0, response_1.errorResponse)(res, 'INVALID_CREDENTIALS', '用户名或密码错误', 401);
        }
        // 生成 token
        const token = (0, auth_1.generateToken)(user.id);
        return (0, response_1.successResponse)(res, {
            user: {
                id: user.id,
                username: user.username,
                createdAt: user.createdAt,
            },
            token,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return (0, response_1.errorResponse)(res, 'VALIDATION_ERROR', error.errors[0].message, 400);
        }
        throw error;
    }
});
// 获取当前用户
router.get('/me', auth_1.authMiddleware, async (req, res) => {
    const user = await database_1.default.user.findUnique({
        where: { id: req.userId },
        select: {
            id: true,
            username: true,
            createdAt: true,
        },
    });
    if (!user) {
        return (0, response_1.errorResponse)(res, 'USER_NOT_FOUND', '用户不存在', 404);
    }
    return (0, response_1.successResponse)(res, { user });
});
//# sourceMappingURL=auth.js.map