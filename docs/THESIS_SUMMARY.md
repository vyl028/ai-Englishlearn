# LexiCapture 智能英语学习系统 —— 设计与实现技术总结

> 本文档作为毕业论文撰写的技术素材，系统梳理 LexiCapture 项目的架构设计、核心功能实现、关键技术难点与优化方案。

---

## 摘要

LexiCapture 是一款面向中国英语学习者的 AI 辅助学习 PWA（渐进式 Web 应用）。系统采用前后端分离架构，前端基于 Next.js 15 与 React 构建单页应用，后端基于 Express.js 提供 RESTful API，数据持久化采用 Prisma ORM + SQLite。系统核心能力围绕 AI 展开：支持拍照识词、AI 释义、智能练习生成、词汇故事、雅思作文批改、深度文章分析、AI 口语训练等六大学习场景。本文档从系统架构、数据库设计、AI 集成策略、核心功能模块、代码重构优化等方面进行系统总结。

**关键词**：英语学习；人工智能；PWA；Next.js；大语言模型；自适应学习

---

## 1. 项目背景与需求分析

### 1.1 研究背景

传统英语学习软件普遍存在以下问题：
- **输入成本高**：手动录入单词与释义效率低下，拍照识别准确度不足；
- **练习形式单一**：多为简单的背诵与闪卡，缺乏语境化、多题型的智能练习；
- **缺乏个性化反馈**：作文、口语等输出型技能难以获得即时、专业的 AI 反馈；
- **学习数据割裂**：练习记录、掌握情况散落在不同模块，缺乏统一的掌握度追踪。

### 1.2 系统定位

LexiCapture 定位为"AI 驱动的个人英语词汇与技能训练中心"，核心设计原则：
- **低门槛输入**：拍照即可识别英文单词并自动生成带搭配、例句的丰富释义；
- **语境化学习**：基于用户真实词汇库生成练习题、故事、阅读材料；
- **即时专业反馈**：AI 作文批改（雅思 Task 2 四维度评分）、口语对话实时纠错；
- **数据驱动掌握**：基于练习频次、正确率、连续答对等数据自动判定单词掌握度。

### 1.3 技术选型

| 层级 | 技术栈 | 说明 |
|------|--------|------|
| 前端框架 | Next.js 15 + React 18 | App Router、Server Actions、Turbopack |
| 前端 UI | Tailwind CSS + shadcn/ui | 基于 Radix UI 的无样式组件库 |
| 状态管理 | React Hooks + Context | 局部状态为主，Server Actions 承担数据变更 |
| 后端框架 | Express.js 5 | RESTful API + JWT 认证 |
| ORM / 数据库 | Prisma 6 + SQLite | 开发便捷，单文件部署 |
| AI 调用 | 统一 OpenAI 兼容 API | 支持 Gemini、Kimi、GPT-4o 等通过 BaseURL 切换 |
| 缓存 | localStorage (FNV-1a 哈希) | 前端缓存 AI 结果，14 天 TTL |

---

## 2. 系统总体架构

### 2.1 双服务架构

系统采用前后端分离的双服务架构：

```
┌──────────────────────────────────────────────┐
│          PWA (Mobile + Desktop)               │
│   Next.js 15 Frontend  (port 9002)           │
│   SPA with 7 views · Radix UI · Tailwind     │
│        ↕ Server Actions (JWT proxy)           │
└──────────────────┬───────────────────────────┘
                   │ JWT Bearer Token
                   ▼
┌──────────────────────────────────────────────┐
│     Express.js Backend  (port 4000)          │
│   Auth · Words · Groups · AI · UserStats     │
│        Prisma ORM  →  SQLite                 │
│              AI Service Layer                │
└──────────────────────────────────────────────┘
```

**前端**以单页应用（SPA）形态运行在 Next.js App Router 中，通过 7 个视图（capture / review / practice / story / essay / article / speaking）完成全部用户交互。所有 AI 请求均通过 Next.js Server Actions 代理，Server Actions 负责注入 JWT Token 并转发至后端，避免前端直接暴露 API Key。

**后端**采用 Express.js 提供标准 RESTful API，按业务域划分为 Auth、Words、Groups、AI、Practice、WordMastery、UserStats 等模块，通过 Prisma Client 操作 SQLite 数据库。

### 2.2 AI 调用链

```
Frontend component
  → Server Action (src/app/actions.ts)
  → POST /api/ai/* on Express backend (with JWT)
  → server/src/services/ai-service.ts
  → callLLM() 统一函数
      ├── 用户级配置覆盖（model / baseUrl / apiKey）
      └── 环境变量默认值回退
```

AI 服务层设计为"统一入口 + 运行时配置覆盖"模式：
- 所有 AI 能力（释义、练习、故事、批改、分析、对话）共用 `callLLM()` 单一函数；
- `callLLM()` 支持 `model`、`baseUrl`、`apiKey` 等参数覆盖，使得用户可在设置页自定义 AI 配置；
- 若用户未自定义，则自动回退到服务端环境变量默认值。

---

## 3. 数据库设计

采用 Prisma ORM 管理 SQLite 数据库，核心模型如下：

### 3.1 用户与基础数据

- **User**：用户账户，含用户名、密码哈希；
- **Group**：单词分组，支持用户自定义分组与拖拽排序；
- **Word**：单词条目，含词性、释义、enrichment（JSON 存储搭配/同反义词/例句等）、是否已掌握、拍照原始数据。

### 3.2 学习统计与游戏化

- **LearningStats**：用户全局学习统计，含 XP、等级、连续打卡天数、已解锁徽章等；
- **GrowthGoals**：用户自定义的周目标（XP / 新词数量）；
- **LearningEvent**：学习事件流水，用于统计与回溯。

### 3.3 练习与掌握度（本次新增）

- **PracticeRecord**：练习记录，整份练习的题目 JSON、使用的单词 ID 列表、得分、是否已提交；
- **PracticeAnswer**：单题作答记录，含题目索引、用户答案、正确答案、是否答对；
- **WordMasteryStats**：单词掌握度统计，基于正确率、连续答对、最近活跃度计算 0-100 分掌握度；
- **AiConfig**：用户级 AI 配置，支持按用户存储自定义模型、API 地址、密钥。

### 3.4 关键关系

```prisma
User ──1:N── Word
User ──1:N── Group
User ──1:1── LearningStats
Word ──1:N── WordMasteryStats
PracticeRecord ──1:N── PracticeAnswer
```

---

## 4. 核心功能模块实现

### 4.1 单词捕获与 AI 释义

**流程**：
1. 用户上传图片 → 前端 Base64 编码；
2. 后端调用 `recognizeWordsFromImage()`，使用视觉模型识别图中英语单词列表；
3. 对每个识别出的单词调用 `defineWord()`，生成带中文释义、搭配、同反义词、例句的 enrichment 数据；
4. 结果返回前端，用户确认后写入数据库。

**技术细节**：
- 图片识别与释义生成拆分为两阶段，降低单请求失败率；
- 若某单词释义失败，采用降级策略保留单词条目但不填充释义，避免整批失败；
- enrichment 以 JSON 字符串存储于 Word 表，保持 schema 简洁。

### 4.2 智能练习题生成

**题型设计**：
- **MCQ（选择题）**：单句填空，A/B/C/D 四选项，测试词义与用法；
- **Fill-in-the-blank（填空题）**：句子挖空，填写单词正确形式，支持多个可接受答案；
- **Reorder（重组题）**：打乱句子片段，要求重组为正确语序。

**AI Prompt 工程**：
- 系统提示词强制要求返回纯 JSON，禁止 Markdown 代码块与说明文字；
- 要求 `analysisZh`、`grammarZh`、`usageZh` 必须为中文，并在后端增加中文内容检测与自动兜底机制；
- 使用 `responseFormat: { type: 'json_object' }` 约束模型输出格式。

**缓存机制**：前端基于输入参数计算 FNV-1a 哈希作为缓存 Key，AI 生成的练习题缓存 14 天，减少重复请求。

### 4.3 练习记录与答题历史（本次新增）

**需求动机**：此前练习题仅存在于前端内存，刷新页面即丢失，用户无法回顾过往答题情况。

**实现方案**：
- 用户点击"开始练习"时，前端在获取 AI 题目后立即调用 `practiceApi.create()` 将题目与单词 ID 持久化到 `PracticeRecord`；
- 用户提交答案时，`PracticeView` 构造包含题目索引、类型、用户答案、正确答案、是否答对的 `PracticeAnswerResult[]` 数组；
- 后端 `submitPractice` 在 Prisma 事务中批量创建 `PracticeAnswer` 并更新记录的 `correctCount` / `totalCount` / `isSubmitted`；
- 若提交时携带 `wordResults`（各单词作答情况），同步调用 `WordMasteryService.recordAnswer()` 更新掌握度。

### 4.4 智能单词掌握度判定（本次新增）

**算法设计**：

掌握度得分 `masteryScore` 由三个维度加权计算：

```
correctRateScore = (totalCorrect / totalAppeared) * 100
consecutiveScore = min(consecutiveCorrect / CONSECUTIVE_CORRECT_THRESHOLD, 1) * 100
recencyScore = 基于最近答题时间衰减的分数（越近越高）

masteryScore = correctRateScore * 0.5 + consecutiveScore * 0.3 + recencyScore * 0.2
```

**阈值策略**：
- `MASTERY_THRESHOLD = 80`：掌握度达到 80 分触发自动标记；
- `MIN_APPEARANCES = 3`：至少出现 3 次才具备自动标记资格；
- `CONSECUTIVE_CORRECT_THRESHOLD = 3`：连续答对 3 题可得满分连续分。

**联动机制**：当 `isAutoMastered` 变为 `true` 时，自动将对应 `Word.isMastered` 设为 `true`，并为用户增加 +10 XP。

**前端展示**：单词卡片上显示掌握度标签（熟练 / 掌握中 / 初学）与迷你进度条；Tooltip 展示详细统计（出现次数、正确次数、连续答对、掌握度分数）。

### 4.5 AI 作文批改（IELTS Task 2）

**评分维度**：Task Response、Coherence & Cohesion、Lexical Resource、Grammatical Range & Accuracy，每项 0-9 分，并给出 Overall Band。

**数据规范化**：由于不同模型返回的字段名存在差异（如 `tr` vs `taskResponse`、`keyChanges` vs `beforeAfter`），后端实现 `validateAndNormalizeEssayReview()` 函数进行字段映射、类型转换、默认值填充，确保前端接收统一的数据结构。

### 4.6 AI 口语训练

采用"对话伙伴 + 口语教练"双角色模式：
- 助手回复（`assistantReplyEn`）：自然简短的英语对话，延续话题；
- 教练反馈（`feedbackZh`）：基于转写文本指出 1-4 个关键问题，提供纠正版本与实用建议；
- 评分（`scoreOverall`）：综合打分（0-100）。

### 4.7 游戏化系统

| 行为 | XP |
|------|-----|
| 首次每日活动 | +10 |
| 新词捕获 | +5 |
| 完成练习 | +30 基础 + 每题正确 +2 |
| 生成故事 | +20 |
| 单词标记为已掌握 | +10 |

**等级公式**：Level N 需要累计 `100 × N × (N−1) / 2` XP。

**徽章系统**：连续打卡（3/7/14 天）、掌握单词数（10/100 个）等里程碑徽章。

---

## 5. AI 集成与稳定性优化

### 5.1 统一 AI 调用层

早期代码中，不同 AI 功能分别编写独立的 `fetch` 调用，导致：
- 超时、重试、错误处理逻辑重复且不一致；
- 切换模型需修改多处代码；
- 视觉模型与普通模型调用路径分离。

**重构方案（A 方案）**：
- 合并 `callAI` / `callVisionAI` 为单一 `callLLM(messages, options)` 函数；
- `options` 涵盖 `model`、`temperature`、`maxTokens`、`responseFormat`、`retries`、`stripThink`、`baseUrl`、`apiKey`；
- 所有 AI 功能（释义、练习、故事、批改、分析、对话）统一通过 `callLLM()` 发起请求。

### 5.2 JSON 解析可靠性（本次重点优化）

大语言模型偶发返回 Markdown 代码块、说明前缀、截断 JSON，导致前端报错"无法获取json"。

**多层修复策略**：

1. **API 层面约束**：所有 JSON 请求携带 `responseFormat: { type: 'json_object' }`；
2. **Prompt 层面约束**：系统提示词增加绝对规则——"只返回纯 JSON 对象，不要 markdown 代码块，不要任何说明文字"；
3. **解析层多路径提取**：`extractJson()` 依次尝试：
   - 直接解析原始文本；
   - 提取 Markdown fenced code block；
   - 去除前后缀文字后解析；
   - 智能补全截断的括号与字符串；
4. **数据兜底**：各功能模块在解析后对关键字段进行检测与默认值填充（如练习题的 `analysisZh` 若缺失则自动生成中文解析）。

### 5.3 用户级 AI 配置管理（本次新增）

**需求**：服务端环境变量配置的 AI 模型对所有用户全局生效，无法支持不同用户使用不同模型或 API 服务商。

**实现**：
- 新增 `AiConfig` 表，按用户存储 `provider`、`model`、`visionModel`、`baseUrl`、`apiKey`；
- `AiConfigService.getEffectiveConfig(userId)` 优先返回用户自定义配置，缺失字段自动回退到环境变量；
- 所有 AI 路由在处理请求前调用 `getEffectiveConfig()` 获取运行时配置，并传递给 `AIService` 各方法；
- 前端设置页提供"编辑配置"弹窗，支持查看当前生效值、修改并保存、一键重置为默认值。

---

## 6. 代码重构与质量优化

### 6.1 重构方案总览

| 方案 | 目标 | 主要动作 |
|------|------|----------|
| A | 统一后端 AI 调用 | 合并 `callAI`/`callVisionAI` 为 `callLLM`，所有服务方法使用统一入口 |
| B | 类型与错误映射统一 | 提取公共类型到 `types.ts`，统一错误码与响应格式 |
| C | 删除冗余代码 | 清理未使用的组件、hooks、工具函数，移除废弃的 shadcn/ui 文件引用 |
| D | 前后端类型对齐 | 消除 `api-client.ts` 中手写的过时类型，统一从 Zod schema 推导 |

### 6.2 关键改进成果

- **删除冗余**：移除 swipeable-card、virtual-list、mobile-detail-view 等未使用组件及其 hooks，减少维护面；
- **类型安全**：所有 AI 返回的类型统一由 `src/lib/types.ts` 中的 Zod Schema 推导，前后端共享同一套类型定义；
- **错误处理**：Express 路由统一使用 `successResponse` / `errorResponse` 包装，避免各处手写不一致的 JSON 结构。

---

## 7. 前端架构与交互设计

### 7.1 视图路由

系统为 SPA，所有视图通过 `page.tsx` 中的状态机切换：

| 视图 | 组件 | 功能 |
|------|------|------|
| capture | WordCaptureForm | 拍照/手动输入/上传图片识别单词 |
| review | WordReviewList | 单词本（分组、掌握度、批量操作、历史） |
| practice | PracticeView | AI 练习答题与提交 |
| story | StoryView | AI 词汇故事生成与 PDF 导出 |
| essay | EssayReviewView | IELTS 作文批改 |
| article | ArticleReadingView | 文章上传与深度分析 |
| speaking | SpeakingTrainingView | AI 口语对话 |

### 7.2 移动端适配

针对移动场景开发了专用的底部导航栏（`mobile-nav-bar`）、搜索浮层（`mobile-search-overlay`）、单词选择器（`mobile-word-selector`）与批量操作栏（`mobile-batch-action-bar`），确保触屏操作友好。

### 7.3 数据获取模式

- **读取**：组件内通过 `useEffect` + `api-client` 直接调用后端 API；
- **写入**：AI 相关写操作（生成练习、故事、批改等）通过 Next.js Server Actions 代理，Server Action 负责读取 httpOnly Cookie 中的 JWT 并注入请求头；
- **缓存**：AI 生成结果缓存在 `localStorage`，Key 为 FNV-1a 哈希，LRU 淘汰策略防止存储溢出。

---

## 8. 部署与运行

### 8.1 开发环境

```bash
# 终端 1 —— 前端
cd final && npm run dev        # port 9002

# 终端 2 —— 后端
cd final/server && npm run dev # port 4000
```

### 8.2 环境变量

**前端（`.env.local`）**：
```env
GOOGLE_API_KEY=          # Google AI (Gemini)
AI_PROVIDER=gemini       # 默认 AI 提供商
OPENAI_API_KEY=          # OpenAI 兼容 API Key
GENKIT_API_URL=          # 遗留 Genkit 服务（可选）
```

**后端（`server/.env`）**：
```env
PORT=4000
JWT_SECRET=              # JWT 签名密钥
DATABASE_URL=file:./prisma/dev.db
GOOGLE_API_KEY=
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=
OPENAI_VISION_MODEL=
```

### 8.3 构建与发布

```bash
# 前端生产构建
npm run build

# 后端编译
cd server && npm run build
```

由于前端为 Next.js 静态导出配置（或配合独立后端运行），后端仅需 `node dist/index.js` 即可启动，SQLite 单文件数据库使得部署极为轻量。

---

## 9. 创新点与特色

1. **拍照识词 + AI 释义闭环**：从图片输入到结构化单词数据的端到端自动化，enrichment 数据包含搭配、同反义词、CEFR 等级等多维信息；
2. **基于用户词汇库的语境化学习**：练习、故事、阅读分析均基于用户真实捕获的单词生成，实现"用学过的词学更多的词"；
3. **自适应掌握度判定**：不依赖用户手动标记，而是基于练习数据的多维度算法自动判定单词掌握状态；
4. **用户级 AI 配置隔离**：支持不同用户使用不同的模型提供商与 API 密钥，配置按账号持久化且可动态切换；
5. **多层 JSON 解析容错**：结合 API 约束、Prompt 约束、多路径提取、智能截断修复与数据兜底，显著降低大模型格式不稳定带来的错误率。

---

## 10. 后续可扩展方向

1. **SRS 间隔重复**：基于掌握度数据实现 SuperMemo/Anki 风格的间隔重复复习调度；
2. **多模态口语评分**：接入语音识别（ASR）与发音评分（如 Azure Speech），从"文本纠错"升级为"发音纠错"；
3. **学习报告可视化**：基于 `LearningEvent` 流水数据生成周/月学习趋势图表；
4. **云端同步**：当前备份依赖 localStorage 导出/导入，可扩展为云端账户数据同步。

---

## 附录 A：核心 API 路由一览

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/auth/*` | POST/GET | 注册、登录、获取当前用户 |
| `/api/words` | CRUD | 单词增删改查、批量操作 |
| `/api/groups` | CRUD | 分组管理、排序 |
| `/api/ai/define` | POST | AI 单词释义 |
| `/api/ai/extract` | POST | 图片识词 |
| `/api/ai/practice` | POST | 生成练习题 |
| `/api/ai/story` | POST | 生成词汇故事 |
| `/api/ai/review-essay` | POST | 作文批改 |
| `/api/ai/study-article` | POST | 文章深度分析 |
| `/api/ai/speaking-chat` | POST | 口语对话 |
| `/api/ai/config` | GET/PUT/DELETE | AI 配置管理 |
| `/api/practice` | GET/POST/DELETE | 练习记录管理 |
| `/api/practice/:id/submit` | POST | 提交练习答案 |
| `/api/word-mastery` | GET/POST/DELETE | 单词掌握度查询与重置 |
| `/api/user-stats` | GET/POST | 学习统计与目标 |

## 附录 B：文件结构摘要

```
final/
├── src/
│   ├── app/                    # Next.js App Router 页面与 Server Actions
│   ├── ai/                     # AI 流程定义与 LLM 统一入口
│   ├── components/             # React 组件（含 shadcn/ui 与业务组件）
│   ├── hooks/                  # 自定义 React Hooks
│   └── lib/                    # 类型、API 客户端、工具函数、游戏化逻辑
├── server/
│   ├── src/
│   │   ├── routes/             # Express 路由
│   │   ├── services/           # 业务服务层
│   │   ├── middleware/         # 认证中间件
│   │   └── utils/              # 响应封装等工具
│   └── prisma/
│       └── schema.prisma       # 数据库模型定义
└── docs/
    └── THESIS_SUMMARY.md       # 本文档
```

---

*文档版本：2026-04-21*
*对应代码分支：`refactor/cleanup-and-unify`*
