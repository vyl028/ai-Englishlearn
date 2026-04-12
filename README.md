# LexiCapture

> AI 驱动的英语学习 PWA，专为中文用户设计

---

## 项目简介

**LexiCapture** 是一款基于 AI 的英语词汇学习渐进式 Web 应用（PWA）。用户可通过拍照或手动输入的方式捕获英文单词，获取 AI 生成的释义与丰富的学习数据，并通过多种练习模式巩固记忆。

### 核心功能

| 功能 | 说明 |
|------|------|
| 📷 拍照捕词 | AI OCR 识别图片中的单词并自动生成释义 |
| 📚 单词本 | 分组管理、掌握度追踪 |
| 🧠 AI 练习 | 选择题 / 填空题 / 句子排序三种模式 |
| 📖 AI 故事 | 用用户词汇自动生成英文故事 |
| ✍️ 雅思作文批改 | Task 2 四维度评分与反馈 |
| 📰 深度阅读分析 | 文章结构 / 句法 / 词汇三维度解析 |
| 🎤 口语训练 | AI 实时对话与反馈 |
| 🏆 游戏化激励 | XP 经验值、等级、连续打卡、徽章系统 |

---

## 技术架构

### 双服务器设计

```
┌──────────────────────────────────────────────┐
│          PWA (Mobile + Desktop)               │
│   Next.js 15 前端  (端口 9002)               │
│   SPA 7 视图 · Radix UI · Tailwind           │
│        ↕ Server Actions (JWT 代理)           │
└──────────────────┬───────────────────────────┘
                   │ JWT Bearer Token
                   ▼
┌──────────────────────────────────────────────┐
│     Express.js 后端  (端口 4000)             │
│   Auth · Words · Groups · AI · UserStats     │
│        Prisma ORM  →  SQLite                 │
│              AI Service Layer                │
└──────────┬───────────────────┬───────────────┘
           ▼                   ▼
   Gemini 2.5 Flash       GPT-4o-mini
   (默认 / 主要)          (可切换备用)
```

### 主要目录结构

```
.
├── src/
│   ├── app/                  # Next.js App Router 页面、布局、Server Actions
│   │   └── actions.ts        # 全部 AI Server Actions（JWT 代理至后端）
│   ├── ai/
│   │   ├── flows/            # 12 个 AI Flow 定义
│   │   ├── llm.ts            # 统一 AI 入口（Gemini / OpenAI 路由）
│   │   ├── gemini.ts         # Gemini 提供商实现
│   │   └── openai.ts         # OpenAI 提供商实现
│   ├── components/           # React 组件（35 个 shadcn/ui 基础组件 + 功能组件）
│   ├── hooks/                # 12 个自定义 React Hooks
│   └── lib/
│       ├── types.ts          # Zod Schema 集中定义
│       ├── api-hooks.ts      # useWords / useGroups 等数据 Hooks
│       ├── ai-cache.ts       # AI 结果本地缓存（localStorage）
│       └── gamification.ts   # 游戏化系统逻辑
└── server/
    ├── src/
    │   ├── routes/           # Express 路由
    │   ├── services/         # 业务服务层（含 ai-service.ts）
    │   └── middleware/       # JWT 验证等中间件
    └── prisma/
        ├── schema.prisma     # 数据库 Schema
        └── dev.db            # SQLite 数据库文件
```

---

## 快速开始

### 环境要求

- Node.js 18+
- npm 9+

### 1. 安装依赖

```bash
# 安装前端依赖
npm install

# 安装后端依赖
cd server && npm install && cd ..
```

### 2. 配置环境变量

在项目根目录创建 `.env.local`：

```env
# 必填 — Google AI（Gemini）
GOOGLE_API_KEY=your_gemini_api_key

# 可选 — 切换 AI 提供商（默认：gemini）
AI_PROVIDER=gemini          # 或：openai
OPENAI_API_KEY=              # 使用 OpenAI 时必填
```

在 `server/` 目录创建 `.env`：

```env
PORT=4000
JWT_SECRET=your_jwt_secret
DATABASE_URL=file:./prisma/dev.db
GOOGLE_API_KEY=your_gemini_api_key
```

### 3. 初始化数据库

```bash
cd server && npx prisma migrate dev && cd ..
```

### 4. 启动开发服务器

需要两个终端同时运行：

```bash
# 终端 1 — 前端（Next.js，端口 9002）
npm run dev

# 终端 2 — 后端（Express，端口 4000）
cd server && npm run dev
```

打开浏览器访问 [http://localhost:9002](http://localhost:9002)

---

## 开发命令

```bash
# ── 前端 ──────────────────────────────────────────────
npm run dev              # Next.js 开发服务器（Turbopack）
npm run build            # 生产构建
npm run start            # 启动生产服务器

# ── 后端 ──────────────────────────────────────────────
cd server && npm run dev # Express 后端（端口 4000）

# ── 代码质量 ──────────────────────────────────────────
npm run lint             # ESLint 代码检查
npm run typecheck        # TypeScript 类型检查
npm run preflight        # typecheck + lint 组合检查
npm run smoke            # 冒烟测试
```

---

## AI 集成

### 调用链路

```
前端组件
  → Server Action（src/app/actions.ts）
  → POST /api/ai/*（Express 后端，携带 JWT）
  → server/src/services/ai-service.ts
  → src/ai/llm.ts（提供商路由）
      ├── src/ai/gemini.ts  →  Gemini 2.5 Flash
      └── src/ai/openai.ts  →  GPT-4o-mini
```

### AI Flows 一览

| 文件 | 功能 |
|------|------|
| `extract-word-and-define.ts` | 从图片提取单词并生成释义 |
| `analyze-image.ts` | 智能图像分析（单词或句子） |
| `define-captured-word.ts` | 单词详细释义 + 丰富数据 |
| `define-term-auto.ts` | 自动检测词性，返回 1–6 条释义 |
| `define-words-batch.ts` | 批量单词释义 |
| `analyze-sentence.ts` | 识别句子中的候选生词 |
| `generate-practice.ts` | 生成选择题 / 填空 / 排序练习 |
| `generate-story.ts` | 用用户词汇生成英文故事 |
| `review-essay.ts` | 雅思 Task 2 作文四维度批改 |
| `study-article.ts` | 深度文章分析（结构 / 句法 / 词汇） |
| `speaking-chat.ts` | AI 口语练习对话 |

### AI 缓存策略

练习题和故事结果缓存于 `localStorage`：

- **缓存键**：输入参数的 FNV-1a 哈希
- **TTL**：14 天（图片提取结果：7 天）
- **淘汰策略**：存储接近上限时 LRU 淘汰

---

## API 路由

后端基础地址：`http://localhost:4000`

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/login` | POST | 登录，返回 JWT |
| `/api/auth/me` | GET | 当前用户信息 |
| `/api/words` | GET / POST / PUT / DELETE | 单词 CRUD |
| `/api/words/batch` | POST | 批量创建单词 |
| `/api/words/batch-delete` | POST | 批量删除单词 |
| `/api/groups` | GET / POST / PUT / DELETE | 分组 CRUD |
| `/api/groups/reorder` | POST | 分组排序 |
| `/api/ai/define` | POST | 定义单词 |
| `/api/ai/extract` | POST | 从图片提取单词 |
| `/api/ai/practice` | POST | 生成练习题 |
| `/api/ai/story` | POST | 生成词汇故事 |
| `/api/ai/review-essay` | POST | 雅思作文批改 |
| `/api/ai/study-article` | POST | 深度文章分析 |
| `/api/ai/speaking-chat` | POST | 口语练习对话 |
| `/api/user-stats/*` | GET / POST | 学习统计与目标 |

---

## 数据库 Schema

由 Prisma 管理（`server/prisma/schema.prisma`）：

```
User          id · email · passwordHash · createdAt
  ├── Word[]      id · word · partOfSpeech · definition · enrichment(JSON)
  │               groupId · isMastered · capturedAt · photoData
  ├── Group[]     id · name · order · userId
  └── LearningStats?  xp · level · streak · unlockedBadges · …
```

---

## 游戏化系统

### XP 获取规则

| 行为 | 获得 XP |
|------|---------|
| 每日首次活动 | +10 |
| 捕获新单词 | +5 |
| 完成练习 | +30 基础 + 每题答对 +2 |
| 生成故事 | +20 |
| 单词标记为已掌握 | +10 |

### 等级公式

第 N 级所需总 XP：`100 × N × (N−1) / 2`（等差数列）

### 徽章

| 徽章 ID | 解锁条件 |
|---------|---------|
| `streak_3` | 连续打卡 3 天 |
| `streak_7` | 连续打卡 7 天 |
| `streak_14` | 连续打卡 14 天 |
| `mastered_10` | 累计掌握 10 个单词 |
| `mastered_100` | 累计掌握 100 个单词 |

---

## 前端视图

所有视图均在 `src/app/page.tsx` 中通过客户端路由切换：

| 视图键 | 组件 | 说明 |
|--------|------|------|
| `capture` | `WordCaptureForm` | 添加单词（手动 / 拍照 / 上传图片） |
| `review` | `WordReviewList` | 单词本（分组 / 掌握度 / 批量操作） |
| `practice` | `PracticeView` | AI 生成练习题 |
| `story` | `StoryView` | AI 词汇故事 |
| `essay` | `EssayReviewView` | 雅思作文批改 |
| `article` | `ArticleReadingView` | 深度文章分析 |
| `speaking` | `SpeakingTrainingView` | AI 口语练习 |

---

## 开发规范

1. **TypeScript 严格模式** — 每次提交前运行 `npm run typecheck`
2. **Zod Schema 优先** — 在编写 AI Flow 代码前，先在 `src/lib/types.ts` 中定义/更新 Schema
3. **AI Flow 变更** — 修改 Flow → 确认 Schema 对齐 → 更新 `actions.ts` → 端到端测试
4. **禁止前端直接调用 AI** — 所有 AI 请求必须经过 Server Actions → 后端
5. **缓存 AI 结果** — 使用 `src/lib/ai-cache.ts` 避免重复的高成本 AI 请求
6. **全局任务锁** — 遵守 `page.tsx` 中的 `globalTask` 状态，防止并发 AI 请求

---

## License

MIT
