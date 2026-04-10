"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = require("./routes/auth");
const words_1 = require("./routes/words");
const groups_1 = require("./routes/groups");
const ai_1 = require("./routes/ai");
const auth_2 = require("./middleware/auth");
const error_1 = require("./middleware/error");
const response_1 = require("./utils/response");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// 中间件
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: process.env.CLIENT_URL || 'http://localhost:9002',
    credentials: true,
}));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json({ limit: '10mb' }));
// 健康检查
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
// 公开路由
app.use('/api/auth', auth_1.authRouter);
// 需要认证的路由
app.use('/api/words', auth_2.authMiddleware, words_1.wordsRouter);
app.use('/api/groups', auth_2.authMiddleware, groups_1.groupsRouter);
app.use('/api/ai', auth_2.authMiddleware, ai_1.aiRouter);
// 404 处理
app.use((req, res) => {
    return (0, response_1.errorResponse)(res, 'NOT_FOUND', '接口不存在', 404);
});
// 错误处理
app.use(error_1.errorHandler);
const portNumber = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
app.listen(portNumber, '0.0.0.0', () => {
    console.log(`[Server] API server running on http://0.0.0.0:${portNumber}`);
    console.log(`[Server] Health check: http://0.0.0.0:${portNumber}/health`);
});
//# sourceMappingURL=index.js.map