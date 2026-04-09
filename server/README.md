# LexiCapture 后端 API

基于 Express + Prisma + SQLite 的 RESTful API 服务。

## 目录结构

```
server/
├── src/
│   ├── config/
│   │   └── database.ts      # Prisma 客户端配置
│   ├── middleware/
│   │   ├── auth.ts          # JWT 认证中间件
│   │   └── error.ts         # 错误处理中间件
│   ├── routes/
│   │   ├── auth.ts          # 认证路由
│   │   ├── words.ts         # 单词路由
│   │   ├── groups.ts        # 分组路由
│   │   └── ai.ts            # AI 路由
│   ├── services/
│   │   ├── word-service.ts  # 单词业务逻辑
│   │   ├── group-service.ts # 分组业务逻辑
│   │   └── ai-service.ts    # AI 调用逻辑
│   ├── types/
│   │   └── index.ts         # TypeScript 类型定义
│   ├── utils/
│   │   └── response.ts      # 响应工具函数
│   └── index.ts             # 入口文件
├── prisma/
│   └── schema.prisma        # 数据库模型定义
├── .env.example             # 环境变量示例
├── package.json
└── tsconfig.json
```

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，配置 AI 密钥等
```

### 3. 初始化数据库

```bash
npm run db:push
```

### 4. 启动服务

```bash
# 开发模式（热重载）
npm run dev

# 生产模式
npm run build
npm start
```

服务将启动在 `http://localhost:4000`

## API 文档

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 `{username, password}` |
| POST | `/api/auth/login` | 登录 `{username, password}` |
| GET | `/api/auth/me` | 获取当前用户信息 |

### 单词（需要认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/words` | 获取单词列表 `?search=&groupId=&isMastered=&page=&limit=` |
| POST | `/api/words` | 创建单词 |
| POST | `/api/words/batch` | 批量创建 |
| GET | `/api/words/:id` | 获取单个单词 |
| PUT | `/api/words/:id` | 更新单词 |
| DELETE | `/api/words/:id` | 删除单词 |
| POST | `/api/words/batch-delete` | 批量删除 `{ids: []}` |

### 分组（需要认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/groups` | 获取分组列表 |
| POST | `/api/groups` | 创建分组 `{name}` |
| GET | `/api/groups/:id` | 获取单个分组 |
| PUT | `/api/groups/:id` | 更新分组 |
| DELETE | `/api/groups/:id` | 删除分组 |
| PUT | `/api/groups/reorder` | 重新排序 `{groupIds: []}` |

### AI（需要认证）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/define` | 生成单词释义 `{term}` |
| POST | `/api/ai/extract` | 图片识别单词 `{imageBase64}` |
| POST | `/api/ai/practice` | 生成练习题 `{wordIds, questionCount, allowedTypes}` |
| POST | `/api/ai/story` | 生成故事 `{wordIds}` |
| POST | `/api/ai/review-essay` | 作文批改 `{title?, essay}` |
| POST | `/api/ai/study-article` | 文章分析 `{article, generateQuestions?}` |

## 认证方式

所有需要认证的接口需要在请求头中携带 JWT Token：

```
Authorization: Bearer <token>
```

Token 在登录或注册时返回。

## 响应格式

### 成功响应

```json
{
  "success": true,
  "data": { ... }
}
```

### 错误响应

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述"
  }
}
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| PORT | 服务器端口 | 4000 |
| CLIENT_URL | 前端地址（CORS） | http://localhost:9002 |
| DATABASE_URL | SQLite 文件路径 | file:./dev.db |
| JWT_SECRET | JWT 签名密钥 | - |
| OPENAI_API_KEY | AI API 密钥 | - |
| OPENAI_BASE_URL | AI API 基础地址 | https://api.kimi.com/coding/ |
| OPENAI_MODEL | AI 模型 | kimi-k2.5 |

## 数据库管理

```bash
# 查看数据库（GUI）
npm run db:studio

# 创建迁移
npm run db:migrate

# 同步 schema 到数据库
npm run db:push
```
