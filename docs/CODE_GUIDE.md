# LexiCapture 项目代码详解文档

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [项目结构](#3-项目结构)
4. [后端详解](#4-后端详解)
5. [前端详解](#5-前端详解)
6. [数据流](#6-数据流)
7. [关键流程图解](#7-关键流程图解)
8. [如何添加新功能](#8-如何添加新功能)
9. [常见问题排查](#9-常见问题排查)

---

## 1. 项目概述

LexiCapture 是一个英语学习辅助应用，主要功能包括：

- **单词采集**：通过拍照或手动输入记录单词
- **AI 释义**：使用 Kimi AI 自动生成中文释义和拓展信息
- **练习生成**：基于单词生成选择题、填空题、句子重组题
- **故事生成**：用单词编写故事帮助记忆
- **作文批改**：IELTS 写作 Task 2 批改
- **文章学习**：深度分析英文文章
- **听说训练**：口语对话练习

### 架构模式

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器                            │
│                   (Next.js 前端应用)                         │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP 请求
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express 后端服务器                         │
│                     (port 4000)                              │
│  ┌──────────────┬──────────────┬─────────────────────────┐  │
│  │  REST API    │   认证中间件  │      AI 服务            │  │
│  │   路由       │  (JWT验证)   │   (调用 Kimi API)      │  │
│  └──────────────┴──────────────┴─────────────────────────┘  │
│                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              SQLite 数据库 (Prisma ORM)                     │
│  ┌────────────┬────────────┬─────────────────────────────┐  │
│  │   User     │    Word    │           Group             │  │
│  │  (用户)    │   (单词)   │          (分组)              │  │
│  └────────────┴────────────┴─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 技术栈

### 后端 (server/)

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | 18+ | 运行环境 |
| Express | 5.1.0 | Web 框架 |
| TypeScript | 5.8.3 | 类型安全 |
| Prisma | 6.5.0 | ORM 数据库操作 |
| SQLite | - | 数据存储 |
| JWT | 9.0.2 | 用户认证 |
| bcryptjs | 3.0.2 | 密码加密 |
| Zod | 3.24.2 | 数据验证 |

### 前端 (src/)

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 15.x | React 框架 |
| React | 19.x | UI 库 |
| TypeScript | 5.x | 类型安全 |
| Tailwind CSS | 4.x | 样式 |
| Radix UI | 1.x | UI 组件库 |
| Lucide React | - | 图标 |

---

## 3. 项目结构

```
studio/                          # 项目根目录
├── server/                      # 后端代码
│   ├── prisma/
│   │   ├── schema.prisma        # 数据库模型定义
│   │   └── dev.db               # SQLite 数据库文件
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts      # 数据库连接配置
│   │   ├── middleware/
│   │   │   └── auth.ts          # JWT 认证中间件
│   │   ├── routes/
│   │   │   ├── auth.ts          # 认证相关路由 (登录/注册)
│   │   │   ├── words.ts         # 单词 CRUD 路由
│   │   │   ├── groups.ts        # 分组管理路由
│   │   │   └── ai.ts            # AI 功能路由
│   │   ├── services/
│   │   │   ├── ai-service.ts    # AI 调用逻辑 (Kimi API)
│   │   │   ├── word-service.ts  # 单词业务逻辑
│   │   │   └── group-service.ts # 分组业务逻辑
│   │   ├── types/
│   │   │   └── index.ts         # TypeScript 类型定义
│   │   ├── utils/
│   │   │   └── response.ts      # 响应格式化工具
│   │   └── index.ts             # 服务器入口
│   ├── .env                     # 后端环境变量
│   └── package.json
│
├── src/                         # 前端代码 (Next.js)
│   ├── app/                     # Next.js App Router
│   │   ├── actions.ts           # Server Actions (调用后端 API)
│   │   ├── layout.tsx           # 根布局
│   │   ├── page.tsx             # 首页主组件
│   │   ├── login/
│   │   │   └── page.tsx         # 登录页
│   │   └── register/
│   │       └── page.tsx         # 注册页
│   ├── components/              # React 组件
│   │   ├── ui/                  # 基础 UI 组件 (Radix UI)
│   │   ├── word-capture-form.tsx    # 单词采集表单
│   │   ├── word-review-list.tsx     # 单词列表/复习
│   │   ├── practice-view.tsx        # 练习页面
│   │   ├── story-view.tsx           # 故事展示
│   │   ├── essay-review-view.tsx    # 作文批改
│   │   ├── article-reading-view.tsx # 文章学习
│   │   ├── speaking-training-view.tsx # 听说训练
│   │   └── auth-guard.tsx           # 认证守卫
│   ├── lib/                     # 工具库
│   │   ├── api-client.ts        # API 客户端
│   │   ├── api-hooks.ts         # React Query Hooks
│   │   ├── auth-context.tsx     # 认证上下文
│   │   ├── types.ts             # 类型定义
│   │   └── utils.ts             # 工具函数
│   └── hooks/                   # 自定义 Hooks
│       └── use-toast.ts         # Toast 通知
│
├── docs/                        # 文档
│   ├── CODE_GUIDE.md            # 本文件
│   └── CHANGELOG.md             # 更新日志
│
├── .env.local                   # 前端环境变量
└── package.json
```

---

## 4. 后端详解

### 4.1 数据库模型 (prisma/schema.prisma)

```prisma
// 用户模型
model User {
  id           String   @id @default(uuid())  // UUID 主键
  username     String   @unique               // 用户名（唯一）
  passwordHash String                        // 加密后的密码
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  words         Word[]         // 关联：用户的单词
  groups        Group[]        // 关联：用户的分组
  learningStats LearningStats? // 关联：学习统计
}

// 单词模型
model Word {
  id           String   @id @default(uuid())
  word         String                        // 英文单词
  partOfSpeech String                        // 词性
  definition   String                        // 中文释义
  enrichment   String?                       // JSON 格式的拓展信息

  userId  String
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  groupId String?
  group   Group?  @relation(fields: [groupId], references: [id], onDelete: SetNull)

  capturedAt DateTime @default(now())
  isMastered Boolean  @default(false)       // 是否已掌握
  photoData  String?                        // Base64 图片数据

  @@unique([userId, word, partOfSpeech])    // 同一用户不能重复添加相同单词+词性
}

// 分组模型
model Group {
  id        String   @id @default(uuid())
  name      String
  order     Int      @default(0)            // 排序序号
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  words Word[]

  @@unique([userId, name])                  // 同一用户分组名不能重复
}

// 学习统计模型
model LearningStats {
  id            String   @id @default(uuid())
  userId        String   @unique
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  totalXp       Int      @default(0)        // 总经验值
  currentLevel  Int      @default(1)        // 当前等级

  lastCheckIn   DateTime?                   // 上次签到
  streakDays    Int      @default(0)        // 连续签到天数

  totalWords    Int      @default(0)        // 总单词数
  masteredWords Int      @default(0)        // 已掌握单词数

  unlockedBadges String @default("[]")      // JSON 数组：已解锁徽章
}
```

### 4.2 认证流程 (JWT)

```
1. 用户注册/登录
   POST /api/auth/register 或 /api/auth/login
   Body: { username, password }
   
2. 后端验证
   - 检查用户名/密码
   - 生成 JWT Token (有效期 7 天)
   
3. 返回 Token
   Response: { user, token }
   
4. 前端存储
   localStorage.setItem('lexi-auth-token', token)
   
5. 后续请求
   Header: Authorization: Bearer <token>
   
6. 后端验证 Token
   auth.ts 中间件解码 JWT，获取 userId
```

### 4.3 路由结构 (routes/*.ts)

每个路由文件遵循相同模式：

```typescript
// 1. 导入依赖
import { Router } from 'express';
import { z } from 'zod';                    // 验证库

// 2. 定义验证 Schema
const wordCreateSchema = z.object({
  word: z.string().min(1),
  partOfSpeech: z.string().min(1),
  // ...
});

// 3. 创建路由
const router = Router();

// 4. 定义端点
router.get('/', async (req: AuthRequest, res) => {
  const userId = req.userId!;               // 从 JWT 获取用户ID
  
  // 调用 Service 层
  const result = await WordService.findMany(userId, filters);
  
  // 返回统一格式响应
  return successResponse(res, result);
});

// 5. 导出路由
export { router as wordsRouter };
```

### 4.4 AI 服务 (services/ai-service.ts)

核心函数 `callAI` 的工作流程：

```typescript
async function callAI(messages, responseFormat, maxTokens, retries) {
  // 1. 设置超时（120 秒）
  const controller = new AbortController();
  setTimeout(() => controller.abort(), TIMEOUT_MS);
  
  // 2. 调用 Kimi API
  const response = await fetch('https://api.kimi.com/coding/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'kimi-k2.5',
      messages,           // 对话历史
      max_tokens,         // 最大生成 token 数
      temperature: 0.7,   // 创造性程度
    }),
    signal: controller.signal,  // 用于超时取消
  });
  
  // 3. 解析响应
  const data = await response.json();
  return data.choices[0].message.content;
  
  // 4. 失败重试（指数退避）
  // 第1次：1秒后重试
  // 第2次：2秒后重试
}
```

### 4.5 响应格式 (utils/response.ts)

所有 API 返回统一格式：

```typescript
// 成功响应
{
  "success": true,
  "data": { ... }           // 实际数据
}

// 错误响应
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "具体错误信息"
  }
}
```

---

## 5. 前端详解

### 5.1 认证上下文 (lib/auth-context.tsx)

管理用户登录状态：

```typescript
// 提供的方法
const {
  user,           // 当前用户信息
  isLoading,      // 是否加载中
  login,          // 登录函数
  register,       // 注册函数
  logout,         // 登出函数
} = useAuth();

// 使用示例
const { user, login } = useAuth();
if (!user) return <LoginPage />;
await login(username, password);
```

### 5.2 API 客户端 (lib/api-client.ts)

封装 HTTP 请求：

```typescript
// 基础请求函数
async function request<T>(endpoint, config) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // 自动添加 Token
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  // 超时处理（默认 30 秒，AI 请求 120 秒）
  const response = await fetchWithTimeout(url, config, timeoutMs);
  
  // 统一错误处理
  if (response.status === 401) {
    clearToken();
    window.location.href = '/login';  // Token 过期跳转登录
  }
  
  return response;
}

// 按功能分组的 API
export const wordsApi = {
  list: (filters) => request('/api/words?...'),
  create: (data) => request('/api/words', { method: 'POST', body: ... }),
  update: (id, data) => request(`/api/words/${id}`, { method: 'PUT', ... }),
  delete: (id) => request(`/api/words/${id}`, { method: 'DELETE' }),
};

export const aiApi = {
  define: (term) => request('/api/ai/define', ...),
  practice: (wordIds) => request('/api/ai/practice', ...),
  story: (wordIds) => request('/api/ai/story', ...),
};
```

### 5.3 React Hooks (lib/api-hooks.ts)

封装数据获取逻辑：

```typescript
// useWords Hook
function useWords(filters) {
  const [words, setWords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const fetchWords = async () => {
    setIsLoading(true);
    const response = await wordsApi.list(filters);
    if (response.success) {
      setWords(response.data.words);
    }
    setIsLoading(false);
  };
  
  useEffect(() => {
    fetchWords();  // 组件挂载时自动获取
  }, [filters]);
  
  return { words, isLoading, refresh: fetchWords };
}

// 使用示例
const { words, isLoading, refresh } = useWords({ search: 'apple' });
```

### 5.4 Server Actions (app/actions.ts)

Next.js Server Actions 调用后端 API：

```typescript
// 为什么需要 Server Actions？
// 1. 前端组件不能直接调用后端 API（跨域/认证问题）
// 2. Server Actions 在服务端执行，可以安全地调用后端

'use server';

export async function getDefinitionAction(data) {
  // 这是在服务端执行的
  const result = await apiRequest('/api/ai/define', {
    method: 'POST',
    body: JSON.stringify({ term: data.word }),
    timeoutMs: 120000,  // 2 分钟超时
  });
  
  // 转换为前端需要的格式
  return {
    success: result.success,
    data: { /* ... */ },
    error: result.error,
  };
}

// 前端调用
const result = await getDefinitionAction({ word: 'apple' });
```

### 5.5 主页面结构 (app/page.tsx)

```typescript
export default function Home() {
  // 1. 数据获取
  const { words, isLoading } = useWords();
  const { groups } = useGroups();
  
  // 2. 视图状态
  const [view, setView] = useState('capture');  // capture/review/practice/story
  
  // 3. 处理函数
  const handleWordAdded = async (word) => { ... };
  const handleGeneratePractice = async (wordIds) => { ... };
  
  // 4. 条件渲染
  switch (view) {
    case 'capture': return <WordCaptureForm ... />;
    case 'review': return <WordReviewList ... />;
    case 'practice': return <PracticeView ... />;
    case 'story': return <StoryView ... />;
  }
}
```

---

## 6. 数据流

### 6.1 添加单词流程

```
用户输入单词
    │
    ▼
┌──────────────────┐
│ WordCaptureForm  │  前端组件
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ getDefinitionAction │  Server Action
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  POST /api/ai/define │  后端 AI 路由
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  AIService.defineWord() │  调用 Kimi API
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  POST /api/words    │  保存到数据库
└────────┬─────────┘
         │
         ▼
    返回结果
    更新 UI
```

### 6.2 生成练习流程

```
用户选择单词 → 点击"生成练习"
    │
    ▼
WordReviewList 收集选中单词的 IDs
    │
    ▼
handleGeneratePractice(wordIds)
    │
    ▼
generatePracticeAction(wordIds)  [Server Action]
    │
    ▼
POST /api/ai/practice  [后端]
    │
    ▼
验证 wordIds 属于当前用户
    │
    ▼
查询数据库获取单词详情
    │
    ▼
AIService.generatePractice(words)  [调用 Kimi]
    │
    ▼
解析 JSON 返回题目
    │
    ▼
setPracticeData(data) → setView('practice')
    │
    ▼
渲染 PracticeView 组件
```

---

## 7. 关键流程图解

### 7.1 认证守卫 (components/auth-guard.tsx)

```
页面加载
    │
    ▼
检查 localStorage 是否有 token
    │
    ├── 有 ──→ 验证 token 有效性
    │              │
    │              ├── 有效 ──→ 显示页面
    │              │
    │              └── 无效 ──→ 跳转登录页
    │
    └── 无 ──→ 跳转登录页
```

### 7.2 图片识别流程

```
用户选择图片
    │
    ▼
FileReader 读取为 Base64
    │
    ▼
extractWordAndDefineAction(imageBase64)
    │
    ▼
后端接收 → 调用 Kimi Vision API
    │
    ▼
Kimi 识别图中文字 → 返回单词列表
    │
    ▼
后端查询哪些单词已存在（去重）
    │
    ▼
返回给前端显示
    │
    ▼
用户选择要添加的单词
    │
    ▼
逐个调用 defineWord 获取完整释义
    │
    ▼
批量保存到数据库
```

---

## 8. 如何添加新功能

### 8.1 添加新的 AI 功能示例：翻译功能

**步骤 1：后端添加 Service 方法**

```typescript
// server/src/services/ai-service.ts
export class AIService {
  static async translate(text: string, targetLang: string) {
    const messages = [
      {
        role: 'system',
        content: '你是翻译助手。将用户输入翻译成目标语言，只返回翻译结果。',
      },
      {
        role: 'user',
        content: `将以下内容翻译成${targetLang}：\n${text}`,
      },
    ];

    const response = await callAI(messages, undefined, 2000);
    return { translation: response };
  }
}
```

**步骤 2：后端添加路由**

```typescript
// server/src/routes/ai.ts
const translateSchema = z.object({
  text: z.string().min(1).max(5000),
  targetLang: z.string().default('zh'),
});

router.post('/translate', async (req: AuthRequest, res) => {
  try {
    const { text, targetLang } = translateSchema.parse(req.body);
    const result = await AIService.translate(text, targetLang);
    return successResponse(res, result);
  } catch (error) {
    // 错误处理...
  }
});
```

**步骤 3：前端添加 Server Action**

```typescript
// src/app/actions.ts
export async function translateAction(
  text: string,
  targetLang: string = 'zh'
): Promise<{ success: boolean; data?: { translation: string }; error?: string }> {
  const result = await apiRequest<any>('/api/ai/translate', {
    method: 'POST',
    body: JSON.stringify({ text, targetLang }),
    timeoutMs: AI_TIMEOUT_MS,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return { success: true, data: result.data };
}
```

**步骤 4：前端添加组件**

```typescript
// src/components/translate-view.tsx
'use client';

import { useState } from 'react';
import { translateAction } from '@/app/actions';

export function TranslateView() {
  const [text, setText] = useState('');
  const [translation, setTranslation] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTranslate = async () => {
    setIsLoading(true);
    const result = await translateAction(text);
    if (result.success) {
      setTranslation(result.data!.translation);
    }
    setIsLoading(false);
  };

  return (
    <div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={handleTranslate} disabled={isLoading}>
        {isLoading ? '翻译中...' : '翻译'}
      </button>
      <div>{translation}</div>
    </div>
  );
}
```

**步骤 5：在页面中使用**

```typescript
// src/app/page.tsx
import { TranslateView } from '@/components/translate-view';

// 在 switch(view) 中添加
case 'translate':
  return <TranslateView />;
```

---

## 9. 常见问题排查

### 9.1 后端服务无法启动

```bash
# 检查环境变量
cat server/.env
# 必须有：DATABASE_URL, OPENAI_API_KEY, JWT_SECRET

# 检查数据库
npx prisma generate
npx prisma db push

# 查看错误日志
npm run dev  # 看具体错误信息
```

### 9.2 前端无法连接后端

```bash
# 1. 检查前端环境变量
cat .env.local
# NEXT_PUBLIC_API_URL=http://localhost:4000

# 2. 确保后端在运行
curl http://localhost:4000/api/words
# 应该返回 401（未授权）或单词列表

# 3. 检查浏览器控制台
# 看是否有 CORS 错误或网络错误
```

### 9.3 AI 功能无响应

```bash
# 1. 检查 Kimi API Key
echo $OPENAI_API_KEY

# 2. 测试 Kimi 直连
curl https://api.kimi.com/coding/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"kimi-k2.5","messages":[{"role":"user","content":"Hello"}]}'

# 3. 检查后端日志
# 看是否有 [AI] 请求失败，xxx ms 后重试
```

### 9.4 数据库问题

```bash
# 重置数据库（会清空数据！）
cd server
rm prisma/dev.db
npx prisma db push

# 或者查看数据库内容
npx prisma studio
# 打开 http://localhost:5555
```

---

## 附录：调试技巧

### 后端调试

```typescript
// 添加日志
console.log('[DEBUG] 变量值:', variable);

// 使用断点（VSCode）
// 在代码行左侧点击设置断点
// 按 F5 启动调试
```

### 前端调试

```typescript
// React DevTools 浏览器扩展
// 查看组件树和状态

// 在代码中添加
console.log('状态:', state);
debugger;  // 断点
```

### 网络调试

```bash
# 查看所有 API 请求
# 浏览器 DevTools → Network → Fetch/XHR

# 查看请求/响应详情
# 点击具体请求 → Headers / Payload / Response
```

---

**文档版本**: 1.0  
**更新日期**: 2026-04-09  
**作者**: Claude
