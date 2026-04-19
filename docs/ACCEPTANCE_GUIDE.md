# LexiCapture 系统验收指南

**项目名称**：LexiCapture — AI 驱动的英语单词学习 PWA  
**文档版本**：1.0  
**生成日期**：2026-04-12  
**适用场景**：毕业设计答辩 · 系统功能验收 · 演示走查

---

## 目录

1. [项目简介](#1-项目简介)
2. [系统架构](#2-系统架构)
3. [技术栈](#3-技术栈)
4. [数据库设计](#4-数据库设计)
5. [AI 功能模块](#5-ai-功能模块)
6. [核心功能模块](#6-核心功能模块)
7. [API 接口总览](#7-api-接口总览)
8. [部署与启动](#8-部署与启动)
9. [验收演示路径](#9-验收演示路径)
10. [关键技术创新点](#10-关键技术创新点)

---

## 1. 项目简介

### 1.1 背景与定位

LexiCapture 是面向**初中英语学习者**的 AI 辅助单词学习应用，核心解决：

- 传统词典查词流程繁琐、信息孤立
- 手动抄写单词效率低，无法从真实语境（教材/笔记/照片）中快速采集
- 学习路径单一，缺乏个性化练习与写作反馈

### 1.2 核心功能一览

| 功能模块 | 说明 |
|---------|------|
| AI 单词采集 | 拍照 / 上传图片 → 多模态 AI 一步识别 + 释义 |
| 单词本管理 | 分组、搜索、筛选、排序、批量操作、掌握标记 |
| 智能练习 | 选择题 / 填空题 / 句子重组，贴近国内英语试卷 |
| 单词故事 | AI 用用户词汇生成英语短故事，支持 PDF 导出 |
| 雅思作文批改 | Task 2 四维评分（TR/CC/LR/GRA）+ 逐条改进建议 |
| 文章深度阅读 | 篇章结构 / 句法分析 / 词汇标注 |
| 听说训练 | AI 对话 + 口语评估 |
| 成长系统 | XP、等级、连击天数、成就徽章 |

---

## 2. 系统架构

### 2.1 总体架构

```
┌─────────────────────────────────────────────────┐
│           用户（浏览器 / 手机 PWA）               │
└──────────────────┬──────────────────────────────┘
                   │ HTTP / HTTPS
                   ▼
┌─────────────────────────────────────────────────┐
│      Next.js 15 前端  (port 9002)               │
│  · App Router SPA · shadcn/ui · Tailwind        │
│  · Server Actions（JWT 代理 → 后端）             │
└──────────────────┬──────────────────────────────┘
                   │ JWT Bearer Token
                   ▼
┌─────────────────────────────────────────────────┐
│      Express.js 后端  (port 4000)               │
│  · REST API · JWT 中间件 · Prisma ORM           │
│  · AI 服务层（Kimi 多模态 / OpenAI 兼容）        │
└──────────┬──────────────────────┬───────────────┘
           ▼                      ▼
     SQLite 数据库          Kimi / OpenAI API
     (Prisma 管理)          (多模态 + 文本生成)
```

### 2.2 前后端分离设计要点

- 前端 **Server Actions** 作为 BFF 层：读取 HttpOnly Cookie 中的 JWT，代理转发到后端
- 后端所有路由均受 `authenticateToken` 中间件保护，强制身份验证
- AI Key 仅存在于后端 `server/.env`，前端无法访问（安全隔离）

### 2.3 AI 调用链路

```
前端组件
  → Server Action (src/app/actions.ts)
  → POST /api/ai/* (Express, 携带 JWT)
  → server/src/services/ai-service.ts
  → Kimi 多模态模型（OpenAI 兼容接口）
```

---

## 3. 技术栈

### 3.1 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 15 | App Router，SSR/SSG，Server Actions |
| React | 18 | UI 渲染 |
| TypeScript | 5 | 类型安全 |
| Tailwind CSS | 3 | 原子化样式 |
| shadcn/ui + Radix UI | — | 35+ 无障碍 UI 组件 |
| Zod | — | 运行时 Schema 验证 |
| jsPDF | — | PDF 导出 |
| PWA | — | 可添加到主屏幕，离线缓存 |

### 3.2 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Express.js | 5 | REST API 服务器 |
| Prisma ORM | 5 | 数据库访问层 |
| SQLite | — | 本地持久化数据库 |
| JWT | — | 无状态身份认证 |
| bcrypt | — | 密码哈希 |

### 3.3 AI 层

| 技术 | 说明 |
|------|------|
| Kimi 多模态模型 | 图片识别 + 文本生成（OpenAI 兼容接口） |
| OpenAI SDK | 统一接入方式，支持切换到 GPT-4o-mini |
| 自研 JSON 生成器 | Zod 校验 + 自动修复重试（最多 1 次），防止截断 |
| AI 缓存层 | FNV-1a hash + localStorage，TTL 14 天，LRU 淘汰 |

---

## 4. 数据库设计

数据库文件：`server/prisma/dev.db`（SQLite），通过 Prisma ORM 管理迁移。

### 4.1 实体关系

```
User (用户)
  ├── Word[] (单词)       — 一对多，级联删除
  ├── Group[] (分组)      — 一对多，级联删除
  └── LearningStats (学习统计) — 一对一，级联删除
```

### 4.2 表结构

**users 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| username | String (unique) | 用户名 |
| passwordHash | String | bcrypt 哈希密码 |
| createdAt | DateTime | 注册时间 |
| updatedAt | DateTime | 最后更新 |

**words 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| word | String | 单词原形 |
| partOfSpeech | String | 词性 |
| definition | String | 中文释义 |
| enrichment | JSON (String) | 拓展信息（搭配/例句/同反义词/CEFR 级别等） |
| userId | UUID | 所属用户（外键） |
| groupId | UUID? | 所属分组（可为空） |
| capturedAt | DateTime | 采集时间 |
| isMastered | Boolean | 是否已掌握 |
| photoData | String? | 来源图片 base64 |

**groups 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| name | String | 分组名 |
| order | Int | 排序权重 |
| userId | UUID | 所属用户 |
| createdAt | DateTime | 创建时间 |

**learning_stats 表**

| 字段 | 类型 | 说明 |
|------|------|------|
| totalXp | Int | 累计经验值 |
| currentLevel | Int | 当前等级 |
| streakDays | Int | 连续打卡天数 |
| longestStreak | Int | 历史最长连击 |
| totalWords | Int | 累计采集单词数 |
| masteredWords | Int | 已掌握单词数 |
| unlockedBadges | JSON | 解锁徽章列表 |

---

## 5. AI 功能模块

### 5.1 AI Flow 清单

| Flow 文件 | 对应后端接口 | 功能 |
|----------|------------|------|
| `extract-word-and-define.ts` | `POST /api/ai/extract` | 从图片/文本提取单词 + 生成释义 |
| `define-captured-word.ts` | `POST /api/ai/define` | 单词详细定义 + 拓展信息 |
| `define-term-auto.ts` | `POST /api/ai/define` | 自动词性识别，返回 1~6 条释义 |
| `generate-practice.ts` | `POST /api/ai/practice` | 生成选择题 / 填空题 / 重组题 |
| `generate-story.ts` | `POST /api/ai/story` | 用词汇生成英语故事 |
| `review-essay.ts` | `POST /api/ai/review-essay` | 雅思作文四维批改 |
| `study-article.ts` | `POST /api/ai/study-article` | 文章深度分析 |
| `speaking-chat.ts` | `POST /api/ai/speaking-chat` | 口语对话 + 反馈 |

### 5.2 单词拓展信息（enrichment 字段）

每个单词的 AI 生成内容包含：

```json
{
  "collocations": ["常见搭配1", "搭配2"],
  "synonyms": ["同义词1", "同义词2"],
  "antonyms": ["反义词1"],
  "exampleSentences": [
    { "en": "英文例句", "zh": "中文翻译" }
  ],
  "cefrLevel": "B1",
  "usageNotes": "用法说明（中文）",
  "difficulty": "中级"
}
```

### 5.3 雅思作文评分维度

| 维度代码 | 全称 | 说明 |
|---------|------|------|
| TR | Task Response | 任务完成度 |
| CC | Coherence & Cohesion | 连贯性与衔接 |
| LR | Lexical Resource | 词汇丰富度 |
| GRA | Grammatical Range & Accuracy | 语法多样性与准确性 |

### 5.4 AI JSON 容错机制

后端 `generateJson()` 函数实现：
1. 指示 AI 严格输出 JSON
2. Zod Schema 校验输出
3. 校验失败时，将原始响应 + 错误信息反馈给 AI 重试（最多 1 次）
4. 防止因 token 超限导致 JSON 截断

---

## 6. 核心功能模块

### 6.1 单词采集（Capture）

**路径**：首页 → "采集"标签页  
**三种方式**：
- **手动输入**：逐行粘贴单词，批量 AI 释义
- **拍照**：调用摄像头拍摄教材/笔记
- **上传图片**：选择本地图片文件

**处理流程**：
```
图片 base64 → POST /api/ai/extract → Kimi 多模态模型
→ 返回：[{ word, partOfSpeech, definition, enrichment }]
→ 前端展示预览 → 用户确认 → POST /api/words/batch 保存
```

### 6.2 单词本（Review）

**路径**：首页 → "单词本"标签页  
**功能**：
- 分组切换（"全部" + 自定义分组）
- 搜索过滤 / 按时间·难度排序
- 单词卡片展开（释义、例句、搭配、同反义词）
- 标记掌握状态（绿色 = 已掌握）
- 批量选择 → 移动分组 / 删除 / 导出

### 6.3 练习（Practice）

**路径**：首页 → "练习"标签页  
**配置项**：
- 选词范围：最近一周 / 最近一月 / 全部 / 指定分组
- 题型勾选：选择题、填空题、句子重组（可多选）
- 题目数量：5 / 10 / 20（默认 10）

**题型说明**：
- **选择题**：A/B/C/D 四选一，考察单词含义或用法
- **填空题**：给出例句，填入正确单词（含词形变化）
- **句子重组**：打乱句子 parts，拖拽排列正确顺序

### 6.4 故事生成（Story）

**路径**：首页 → "故事"标签页  
- 从单词本中选词，AI 编写含目标词汇的英语短故事
- 支持 PDF 导出（含故事正文 + 词汇表）

### 6.5 雅思作文批改（Essay）

**路径**：首页 → "作文"标签页  
**输入方式**：
- 直接粘贴文本
- 上传 PDF / DOCX 文件
- 上传图片（AI OCR 识别）

**输出内容**：
- 四维分数 + 总分（0~9）
- 问题列表（按类别分组，含严重程度）
- 修改前后对照表
- 总体评价 + 优缺点分析

### 6.6 文章深度阅读（Article）

**路径**：首页 → "文章"标签页  
**分析内容**：
- 篇章结构拆解（段落主旨）
- 重点句法说明
- 高频词汇/短语标注（含 CEFR 级别）
- 阅读建议

### 6.7 听说训练（Speaking）

**路径**：首页 → "口语"标签页  
- AI 扮演对话角色，模拟真实英语对话场景
- 用户发言后，AI 即时给出发音/语法/流畅度反馈

### 6.8 成长系统

**触发事件 → XP 奖励**：

| 事件 | XP |
|------|----|
| 每日首次活跃 | +10 |
| 采集新单词 | +5 / 词 |
| 完成练习 | +30（基础）+ 每道答对 +2 |
| 生成故事 | +20 |
| 标记掌握 | +10 / 词 |

**等级公式**：第 N 级所需累计 XP = `100 × N × (N-1) / 2`

**成就徽章**：
- `streak_3` / `streak_7` / `streak_14`：连续打卡 3/7/14 天
- `mastered_10` / `mastered_100`：掌握 10/100 个单词

---

## 7. API 接口总览

Base URL：`http://localhost:4000`

### 认证接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册 |
| POST | `/api/auth/login` | 登录，返回 JWT |
| GET  | `/api/auth/me` | 获取当前用户信息 |

### 单词接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/words` | 获取单词列表（支持分页/过滤） |
| POST | `/api/words` | 新增单词 |
| PUT  | `/api/words/:id` | 更新单词 |
| DELETE | `/api/words/:id` | 删除单词 |
| POST | `/api/words/batch` | 批量新增 |
| POST | `/api/words/batch-delete` | 批量删除 |

### 分组接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/groups` | 获取分组列表 |
| POST | `/api/groups` | 新建分组 |
| PUT  | `/api/groups/:id` | 更新分组 |
| DELETE | `/api/groups/:id` | 删除分组 |
| POST | `/api/groups/reorder` | 拖拽排序 |

### AI 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/define` | 定义单词 |
| POST | `/api/ai/extract` | 图片提取单词 |
| POST | `/api/ai/practice` | 生成练习题 |
| POST | `/api/ai/story` | 生成故事 |
| POST | `/api/ai/review-essay` | 作文批改 |
| POST | `/api/ai/study-article` | 文章分析 |
| POST | `/api/ai/speaking-chat` | 口语对话 |

### 学习统计接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/api/user-stats` | 获取学习统计 |
| POST | `/api/user-stats/checkin` | 每日打卡 |
| POST | `/api/user-stats/xp` | 更新 XP |

---

## 8. 部署与启动

### 8.1 环境要求

- Node.js 18+
- AI API Key（Kimi 或 OpenAI 兼容服务）

### 8.2 环境变量配置

**前端** (`.env.local`)：

```env
# AI Provider（可选，默认 gemini，项目实际使用 kimi-openai 兼容）
GOOGLE_API_KEY=your_key
```

**后端** (`server/.env`)：

```env
PORT=4000
JWT_SECRET=your_jwt_secret_here
DATABASE_URL=file:./prisma/dev.db
OPENAI_API_KEY=your_kimi_or_openai_key
OPENAI_BASE_URL=https://api.moonshot.cn/v1   # Kimi 兼容地址
```

### 8.3 本地开发启动

```bash
# 安装依赖（首次）
npm install
cd server && npm install && cd ..

# 初始化数据库
cd server && npx prisma migrate deploy && cd ..

# 终端 1 — 前端
npm run dev

# 终端 2 — 后端
cd server && npm run dev
```

访问：`http://localhost:9002`

### 8.4 一键脚本启动（Windows）

```bash
.\install.bat   # 首次安装依赖
.\start.bat     # 启动前后端 + 显示局域网 IP
```

### 8.5 手机访问

确保电脑和手机在同一 Wi-Fi 下，访问：`http://<电脑IP>:9002`  
（`start.bat` / `start.sh` 启动时自动显示局域网 IP）

---

## 9. 验收演示路径

以下为建议的功能演示顺序，覆盖所有核心模块：

### 路径 1：用户注册与认证（2 分钟）

1. 打开 `http://localhost:9002`，自动跳转登录页
2. 点击"注册"→ 填写用户名和密码 → 注册成功并自动登录
3. 右上角设置 → 显示当前用户名及"退出登录"按钮

### 路径 2：单词采集 — 图片识别（3 分钟）

1. 切换到"采集"标签页
2. 选择"上传图片"→ 上传含英文单词的教材截图或手写笔记照片
3. 系统调用 Kimi 多模态 AI，约 5~10 秒后展示识别出的单词列表（含词性、中文释义）
4. 点击"保存全部"→ 单词写入数据库

### 路径 3：单词本管理（2 分钟）

1. 切换到"单词本"标签页，查看刚采集的单词
2. 点击单词卡片展开：查看例句、搭配、同反义词、CEFR 级别
3. 点击"掌握"标记 → 卡片变绿
4. 新建分组"第一章" → 选中若干单词 → 批量移入分组
5. 切换分组，验证筛选正确

### 路径 4：练习生成（3 分钟）

1. 切换到"练习"标签页
2. 选词范围选"全部"，勾选三种题型，题量设为 10
3. 点击"生成练习"→ 约 5~8 秒后显示题目
4. 作答：演示选择题、填空题、重组题各一道
5. 提交 → 查看分数 + 答案解析

### 路径 5：故事生成与导出（2 分钟）

1. 切换到"故事"标签页
2. 选择若干单词 → 点击"生成故事"
3. 故事展示在页面，包含目标词汇高亮
4. 点击"导出 PDF"→ 下载包含故事 + 词汇表的 PDF

### 路径 6：雅思作文批改（3 分钟）

1. 切换到"作文"标签页
2. 粘贴一篇雅思 Task 2 作文（约 250 词）
3. 点击"开始批改"→ 约 10~15 秒后展示结果
4. 查看"评分"：TR / CC / LR / GRA 四维雷达图
5. 查看"问题"：按语法/词汇/结构分类的改进建议
6. 查看"对照"：修改前后的句子对比

### 路径 7：成长系统（1 分钟）

1. 点击右上角用户头像或成长系统入口
2. 查看当前等级、经验值进度条、连击天数
3. 查看已解锁徽章

---

## 10. 关键技术创新点

### 10.1 多模态 AI 单词识别（一步识别+释义）

传统方案需要三步：OCR 引擎识别文字 → 分词提取单词 → AI 生成释义。  
本项目直接将图片 base64 发送给 Kimi 多模态模型，**一次 API 调用**完成：
- 场景理解（教材、手写笔记、截图、单词卡）
- 英文单词提取（过滤中文和无关符号）
- 中文释义 + 拓展信息生成

### 10.2 AI JSON 稳定性保障

AI 文本生成存在输出不稳定（截断、格式错误、多余前言）的问题，本项目通过：
- **Zod Schema 强校验**：响应必须匹配预定义结构
- **自动修复重试**：校验失败时，将错误原因反馈 AI 重试（最多 1 次）
- **后处理过滤器**：如 `stripRevisedTextPreamble()` 去除 AI 作文批改中的多余说明文字

### 10.3 前后端安全分离

- AI API Key 仅存于后端 `server/.env`，前端代码和浏览器网络请求中**完全不可见**
- JWT 通过 HttpOnly Cookie 传递（Server Action 层读取），防止 XSS 窃取
- 所有后端路由强制 JWT 验证，防止未授权访问

### 10.4 PWA + 移动优先响应式

- 支持"添加到主屏幕"，类 App 体验
- 触摸目标 ≥ 44×44px 满足无障碍标准
- 底部导航栏 + 移动端特化交互组件（8 个 `mobile-*` 组件）
- 同一局域网下可直接用手机访问开发服务器

---

*本文档基于 `docs/PROJECT_OVERVIEW.md`、`docs/CHANGELOG.md` 及源码自动生成，如有出入以实际代码为准。*
