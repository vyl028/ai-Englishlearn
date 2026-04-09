import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { authRouter } from './routes/auth';
import { wordsRouter } from './routes/words';
import { groupsRouter } from './routes/groups';
import { aiRouter } from './routes/ai';
import { authMiddleware } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { errorResponse } from './utils/response';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// 中间件
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:9002',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 公开路由
app.use('/api/auth', authRouter);

// 需要认证的路由
app.use('/api/words', authMiddleware, wordsRouter);
app.use('/api/groups', authMiddleware, groupsRouter);
app.use('/api/ai', authMiddleware, aiRouter);

// 404 处理
app.use((req, res) => {
  return errorResponse(res, 'NOT_FOUND', '接口不存在', 404);
});

// 错误处理
app.use(errorHandler);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] API server running on http://0.0.0.0:${PORT}`);
  console.log(`[Server] Health check: http://0.0.0.0:${PORT}/health`);
});
