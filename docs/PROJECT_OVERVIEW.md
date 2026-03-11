# LexiCapture（studio）项目概览

更新时间：2026-03-11  
代码仓库根目录：`D:\University\毕设\studio`

> 目标：梳理项目现状（功能、架构、关键文件、运行方式、风险点），为后续迭代开发提供“地图”。

## 1. 项目定位

**LexiCapture** 是一个基于 **Next.js（App Router）** 的 Web 应用，面向“初中（九年级）英语学习”场景：

- 通过**手动输入**或**拍照/上传图片**采集英语单词
- 借助 **LLM（Gemini / OpenAI 等）** 生成：
  - 单词的（字典风格）中文释义
  - 单词拓展信息（搭配 / 同反义词 / 例句 / 难度与用法分析）
  - 每周词汇练习题（支持选择题/填空/句子重组，可配置题型与题量）
  - 包含这些词汇的短故事 + 中文翻译，并支持导出 PDF
- 当前持久化方式为：**浏览器 localStorage（单机/单浏览器）**
- 界面：桌面端以**侧边栏**作为主导航（移动端为抽屉）；支持**浅色/深色模式**切换

> `docs/blueprint.md` 中提到的“存入数据库”目前尚未落地（代码里仍是 localStorage）。

## 2. 当前已实现功能（按用户视角）

### 2.1 新增单词
入口：`src/app/page.tsx`

组件：`src/components/word-capture-form.tsx`

三种采集方式：

1) **Text（手动输入）**
- 输入 `word`（可为单词或短语），系统自动识别常见词性并生成 1~N 个词条
- 点击“添加单词”后调用服务端 action：`defineTermAutoAction` → flow：`defineTermAuto`（`src/ai/flows/define-term-auto.ts`）→ AI 生成中文释义 + 单词拓展信息（搭配/同反义/例句/难度用法）→ 将多个词性条目加入单词列表

2) **Camera（拍照识别）**
- 申请摄像头权限，采集视频帧，转成 `data:image/jpeg;base64,...`
- 调用 `extractWordAndDefineAction` 自动识别图片中的多个单词，并生成中文释义 + 拓展信息后加入列表

3) **Upload（上传图片识别）**
- 选择本地图片，读取为 Data URI
- 同 Camera 流程进行识别并加入列表

### 2.2 单词复习（单词本）
组件：`src/components/word-review-list.tsx`

- 顶部新增“分组”下拉（含“全部”视角）+ “分组管理”：
  - 支持分组管理：新建 / 重命名 / 删除（删除后该分组单词会变为未分组，仅在“全部”中可见）
  - 单词卡片支持“移动分组”（也可移动为未分组）
  - 新增单词默认进入当前选中的分组；若当前为“全部”则为未分组
- 在任意分组视角下，列表仍以“周”为单位分组展示（按捕获时间）
- 每周可一键生成：
  - **Practice**（可勾选题型：选择题/填空/句子重组；可设置题目数量，默认 10；可选择用于生成的单词范围；提交后展示答案对比与讲解）：`generatePracticeAction`
  - **Story**（可选择用于生成的单词范围；生成后在页面展示；支持导出 PDF；单词数量过多时会提示并可选择是否继续）：`generateStoryAction`
- 支持：
  - 每个单词卡片独立开关显示释义
  - 单词卡片支持“掌握”标记（可标记/取消；用于掌握度与勋章解锁）
  - 同一单词支持多词性：在“了解更多”里用按钮切换查看不同词性的拓展信息（搭配/同反义/例句/难度用法）
  - 点击单词打开 Cambridge 词典页面（新标签页）
  - 编辑（本地更新）
  - 删除（带二次确认弹窗）

### 2.3 Practice（练习）
组件：`src/components/practice-view.tsx`

- 支持题型：选择题（MCQ）/填空题/句子重组题
- 支持配置：选词范围（分组下拉/最近一周/最近一个月/手动选择）+ 题型勾选 + 题目数量（默认 10）
  - 最近一周/最近一个月按“全部单词（跨分组）”计算
- 选择题题干为更贴近国内英语试卷的“单项选择/单句填空（单空 ____）”风格；选项显示 A/B/C/D 标号
- 提交后展示：答案对比、详细解析、语法讲解与词汇用法讲解

### 2.4 Story PDF（周故事）
服务端生成：`src/lib/pdf-server-utils.ts`

- AI 返回：`{ title, story, translation }`
- 导出时服务端使用 `jsPDF` 生成 PDF（中英分两页）
- 导出时返回 `data:` URI 到前端，由浏览器触发下载
- 支持选词范围（分组下拉/最近一周/最近一个月/手动选择）；当单词数量过多会弹窗确认是否继续生成
  - 最近一周/最近一个月按“全部单词（跨分组）”计算

### 2.5 作文批改（雅思写作任务 2）
组件：`src/components/essay-review-view.tsx`

- 支持：粘贴英文作文文本，或上传文件（`.txt` / `.md` / `.docx` / `.pdf` / 图片 `.png/.jpg/.jpeg/.webp`）读取正文
  - 文件解析 action：`extractEssayTextFromFileAction`（服务端）
  - 解析实现：`src/lib/essay-file-utils.ts`（DOCX 解析较可靠；PDF 为 best-effort，扫描版/特殊字体编码可能提取不完整；图片会走 OCR 识别，建议检查排版/漏字）
- 批改入口 action：`reviewEssayAction` → flow：`reviewEssay`（`src/ai/flows/review-essay.ts`）
- LLM 输出：结构化 JSON，包含：
  - 雅思写作任务 2 分项评分（TR/CC/LR/GRA）+ 总分（overall）与作文分级（CEFR）
  - 问题清单（语法/拼写/时态/逻辑/衔接/用词等）+ 改进建议 + 示范句
  - 优化后的完整作文（英文）
  - 关键 Before/After 改写对照

### 2.6 文章阅读（深度语言分析）
组件：`src/components/article-reading-view.tsx`

- 支持：粘贴英文文章文本，或上传文件（`.txt` / `.md` / `.docx` / `.pdf` / 图片 `.png/.jpg/.jpeg/.webp`）读取正文
  - 文件解析 action：`extractTextFromFileAction`（服务端，复用作文上传解析逻辑）
  - 解析实现：`src/lib/essay-file-utils.ts`（DOCX 解析较可靠；PDF 为 best-effort，扫描版/特殊字体编码可能提取不完整；图片会走 OCR 识别，建议检查排版/漏字）
- 分析入口 action：`studyArticleAction` → flow：`studyArticle`（`src/ai/flows/study-article.ts`）
- 输出内容（面向“教师式阅读辅导”）：
  - 文章结构分析：段落主旨、段落角色、与前文逻辑关系（转折/因果/递进/举例等）
  - 句法结构解析：从句、时态、语态、修饰结构等（代表性例句讲解）
  - 难句拆解与重组：主干提取、从句拆解、简化表达与重写示范
  - 关键词与核心短语提取（含中文释义/用法提示）
  - 提取到的词汇/短语支持一键加入单词本：加入时会调用与“新增单词”一致的词条生成逻辑（含完整“了解更多”）；若已存在则提示“已在单词本”
  - 可选：阅读理解题生成（中国考试风格选择题），并在页面内完成作答、提交、查看答案与解析

### 2.7 听说训练（ASR / TTS）
组件：`src/components/speaking-training-view.tsx`

- 入口：侧边栏导航 “听说训练”
- 页面内分为两个页签：**跟读训练** / **AI 对话**
- 跟读训练：
  - ASR（语音识别）：支持语音输入目标文本；跟读后识别转写为英文文本
  - TTS（语音合成）：对目标文本进行示范朗读（可选语音与语速）
  - 跟读评估：基于 ASR 转写的词级对齐（WER）给出近似分数，并支持在多个 ASR 候选间切换（默认选择匹配度最高的候选）
- AI 对话：
  - 用户口语发言（ASR 转写）→ AI 英文回复（自动 TTS 朗读；朗读按钮再次点击可停止）→ 中文反馈与纠错建议（基于转写文本，不包含音频层面的发音评估）
  - 反馈与纠错默认折叠隐藏，需手动展开（按钮位于用户消息气泡内）
- 注意：ASR 支持度与效果依赖浏览器与环境（Edge/Chrome 推荐）；麦克风权限通常需要 HTTPS 或 localhost

### 2.8 成长系统（等级 / 勋章 / 学习曲线）
入口：顶部“成长”按钮（显示等级）

- 学习行为获得 XP，自动提升等级（新增单词 / 完成练习 / 生成故事 / 标记掌握 + 每日首次学习自动打卡）
- 勋章：连续打卡（3/7/14 天）、掌握单词（10/100）自动解锁并永久保留
- 学习记录可视化：展示近 7 天学习曲线（XP 与新增单词），并可切换 14/30 天
- 数据持久化：localStorage `lexi-capture-gamification`

## 3. 与 Blueprint 的对齐情况

来源：`docs/blueprint.md`

- ✅ Word Capture（相机/上传/手输）
- ✅ Definition Lookup（LLM 中文释义）
- ⚠️ Data Storage（当前为 localStorage；未接入数据库/多端同步）
- ✅ Review（复习列表 + Practice + Story）

## 4. 技术栈与关键依赖

### 4.1 框架/语言
- Next.js `15.3.3`（App Router）：`src/app/*`
- React `18.3.x`
- TypeScript `5.x`

### 4.2 UI 与样式
- Tailwind CSS：`tailwind.config.ts` + `src/app/globals.css`
- shadcn/ui + Radix UI（大量 `src/components/ui/*`）
- 图标：`lucide-react`
- 表单：`react-hook-form` + `zod` + `@hookform/resolvers`

### 4.3 AI
- 默认使用 **Gemini**（`@google/generative-ai`）：`src/ai/gemini.ts`
- 新增统一 AI 入口：`src/ai/llm.ts`（支持 Gemini / OpenAI / OpenAI-compatible）
- OpenAI 兼容封装：`src/ai/openai.ts`
- Flow（其实是普通的 server-side 函数 + Zod 校验）：`src/ai/flows/*`
- 依赖中包含 `genkit` / `@genkit-ai/*`，但当前主要逻辑已转为 **直接调用 Gemini SDK**（见 `src/ai/genkit.ts` 注释）。

### 4.4 PDF
- `jspdf` + `jspdf-autotable`
- 内置中文字体：`public/fonts/NotoSansSC-*.ttf`

### 4.5 可选服务端
- Express `5.x`：`src/ai/server.ts`（可作为独立 AI 服务运行，端口 3400）
- PM2 配置：`ecosystem.config.js`

## 5. 目录结构（全量）

（来自 `tree /A /F`）

```
.
├─ docs/
│  └─ blueprint.md
├─ public/
│  ├─ manifest.json
│  └─ fonts/ (NotoSansSC-*.ttf)
├─ src/
│  ├─ app/
│  │  ├─ actions.ts
│  │  ├─ globals.css
│  │  ├─ layout.tsx
│  │  └─ page.tsx
│  ├─ ai/
│  │  ├─ dev.ts
│  │  ├─ gemini.ts
│  │  ├─ llm.ts
│  │  ├─ openai.ts
│  │  ├─ genkit.ts
│  │  ├─ server.ts
│  │  └─ flows/
│  │     ├─ define-captured-word.ts
│  │     ├─ extract-word-and-define.ts
│  │     ├─ generate-quiz.ts
│  │     ├─ generate-practice.ts
│  │     └─ generate-story.ts
│  ├─ components/
│  │  ├─ word-capture-form.tsx
│  │  ├─ word-review-list.tsx
│  │  ├─ edit-word-dialog.tsx
│  │  ├─ quiz-view.tsx
│  │  ├─ practice-view.tsx
│  │  └─ ui/ (shadcn/radix 组件集合)
│  ├─ hooks/
│  │  ├─ use-mobile.tsx
│  │  └─ use-toast.ts
│  └─ lib/
│     ├─ types.ts
│     ├─ utils.ts
│     ├─ pdf-utils.ts
│     └─ pdf-server-utils.ts
├─ next.config.ts
├─ tailwind.config.ts
├─ tsconfig.json
├─ package.json
└─ ...
```

## 6. 运行方式（开发/生产）

### 6.1 前置条件
- Node.js + npm（建议 Node 18+，具体以 Next.js 15 的要求为准）
- 配置 AI Provider 的 API Key（见环境变量）

### 6.2 常用命令（来自 `package.json`）

```bash
# 启动 Next.js 开发服务器（Turbopack，端口 9002）
npm run dev

# 构建 / 生产启动
npm run build
npm run start

# 代码质量
npm run lint
npm run typecheck

# 可选：启动本地 AI 服务（Express，端口 3400）
npm run ai:dev

# Genkit CLI（当前更偏“遗留/可选”，见第 9 节说明）
npm run genkit:dev
npm run genkit:watch
```

### 6.3 生产守护（PM2）
配置：`ecosystem.config.js`

- `lexicapture-nextjs`：`npm start`（PORT=3000）
- `lexicapture-ai`：`node --loader tsx src/ai/server.ts`（固定监听 3400）

## 7. 核心数据模型

定义：`src/lib/types.ts`

### 7.1 CapturedWord（应用内单词记录）
```ts
type CapturedWord = {
  id: string;
  word: string;
  // 自定义分组 id（旧数据可能缺失；缺失时视为未分组）
  groupId?: string;
  partOfSpeech: string;
  definition: string;
  enrichment?: WordEnrichment;
  capturedAt: Date;
  photoDataUri?: string;
};
```

### 6.4 环境变量（AI 相关）
推荐做法：复制 `.env.example` 为 `.env`，再按需填写。

- `AI_PROVIDER`：`gemini`（默认）或 `openai`
- Gemini：`GOOGLE_API_KEY`（或兼容的 `GEMINI_API_KEY`）、`GEMINI_MODEL`、可选 `GEMINI_BASE_URL`
- OpenAI / OpenAI-compatible：`OPENAI_API_KEY`、`OPENAI_MODEL`、可选 `OPENAI_BASE_URL`（默认 `https://api.openai.com/v1`）

### 7.2 localStorage 持久化策略
实现：`src/app/page.tsx`

- 单词数据 key：`lexi-capture-words`
  - 保存前会**移除 `photoDataUri`**（避免把 base64 图片塞进 localStorage）
  - 读取后会把 `capturedAt` 从字符串转回 `Date`
  - 旧数据若缺少 `groupId` 会视为未分组（仅在“全部”中可见）
- 分组列表 key：`lexi-capture-groups`
- 当前选中分组 key：`lexi-capture-selected-group`

## 8. 关键业务流程（从代码映射）

### 8.1 手动输入 → 生成释义 → 加入列表
`WordCaptureForm.onSubmit`  
→ `src/app/actions.ts#getDefinitionAction`  
→ `src/ai/flows/define-captured-word.ts#defineCapturedWord`  
→ `src/ai/gemini.ts#generateText`  
→ 返回 `definition`，在前端追加到 `words`（进入当前选中分组；若当前为“全部”则为未分组）并写入 localStorage

### 8.2 拍照/上传 → OCR+释义（多词）→ 加入列表
`WordCaptureForm.handleImageAnalysis`  
→ `src/app/actions.ts#extractWordAndDefineAction`  
→ `src/ai/flows/extract-word-and-define.ts#extractWordAndDefine`  
→ `src/ai/gemini.ts#generateJsonArray`（要求返回 JSON array）  
→ 生成多个 `CapturedWord` 并追加到列表（进入当前选中分组；若当前为“全部”则为未分组）

### 8.3 每周 Practice（练习）
`WordReviewList` 点击 Practice（可配置选词范围：分组下拉/最近一周/最近一月/手动选择 + 题型勾选 + 题目数量）  
→ `src/app/actions.ts#generatePracticeAction`  
→ `src/ai/flows/generate-practice.ts#generatePractice`（返回 JSON array）  
→ `PracticeView` 展示与判分（本地判题 + 解析/语法/用法讲解）

### 8.4 每周 Story PDF
`WordReviewList` 点击 Story（可配置选词范围：分组下拉/最近一周/最近一月/手动选择；单词过多会二次确认）  
→ `src/app/actions.ts#generateStoryAction`  
→ `src/ai/flows/generate-story.ts#generateStory`（返回 JSON object）  
→ 前端进入故事展示页面（StoryView）  
→ 点击“导出 PDF”  
→ `src/app/actions.ts#exportStoryPdfAction`  
→ `src/lib/pdf-server-utils.ts#generateStoryPdf` 生成 `datauristring` 并下载

## 9. AI 模块说明（当前实现）

### 9.1 Gemini 封装
文件：`src/ai/gemini.ts`

- API Key：`GOOGLE_API_KEY` 或 `GEMINI_API_KEY`
- 模型：默认 `gemini-2.5-flash`（可用 `GEMINI_MODEL` 覆盖）
- 支持 **代理模式**：设置 `GEMINI_BASE_URL` 后改为手写 `fetch` 调用 `${BASE_URL}/v1beta/models/${model}:generateContent`
- `generateJsonArray()`：
  - 首选 `JSON.parse`
  - 失败时尝试从 ```json code block``` 或首个 `[`/`{` 到末尾 `]`/`}` 截取再 parse

### 9.2 “Genkit”现状说明（重要）
- `src/ai/genkit.ts` 明确标注：**Deprecated**，保留为兼容/未来可能用途
- `src/ai/flows/*` 并未使用 `genkit` 的 `defineFlow` 等能力，当前更像“普通 server-side helper”
- `npm run genkit:*` 是否仍可用，取决于 Genkit CLI 对当前代码形态的支持；如果后续要持续使用 Genkit UI，建议统一为真正的 Genkit flow 定义

### 9.3 独立 AI 服务（可选）
文件：`src/ai/server.ts`

- Express 服务，提供：
  - `POST /flows/defineCapturedWordFlow`
  - `POST /flows/extractWordAndDefineFlow`
- 返回结构模拟 genkit CLI：`{ result: { output: ... } }`

> 注意：当前 Next.js 的 server actions 直接调用 flow 函数，并未走 HTTP；`src/app/actions.ts` 里虽然定义了 `GENKIT_API_URL`/`AI_USE_LOCAL`，但未实际使用。

## 10. PDF 生成模块说明

文件：`src/lib/pdf-server-utils.ts`

- 运行环境：Node.js（使用 `fs.readFileSync` 读取字体）
- 字体：`public/fonts/NotoSansSC-Regular.ttf`（用于中文页）
- 输出：`doc.output('datauristring')`（返回给前端下载）

## 11. 环境变量清单（建议后续固化到文档/模板）

项目中出现的环境变量（见 `src/ai/*`、`src/app/actions.ts`）：

- `GOOGLE_API_KEY`：Gemini API key（必需，服务端使用）
- `GEMINI_API_KEY`：备用 key（与 `GOOGLE_API_KEY` 二选一）
- `GEMINI_MODEL`：覆盖默认模型名（如 `gemini-2.5-flash`）
- `GEMINI_BASE_URL`：启用代理模式（自建转发/网关时用）
- `GENKIT_API_URL` / `NEXT_PUBLIC_GENKIT_API_URL`：目前在代码里定义但未实际使用
- `AI_USE_LOCAL`：目前未实际使用

## 12. 配置要点

### 12.1 Next.js 配置
文件：`next.config.ts`

- `typescript.ignoreBuildErrors: true`（生产构建不因 TS 错误失败）
- `eslint.ignoreDuringBuilds: true`（生产构建不因 ESLint 失败）
- `allowedDevOrigins`：包含 `http://10.21.250.55:9002`（如换网段/域名可能需要调整）
- `images.remotePatterns`：允许 `placehold.co`、`picsum.photos`

### 12.2 PWA 相关
- `public/manifest.json`
- `src/app/layout.tsx` 中写入了 PWA 相关 meta

> `manifest.json` 引用的 `icon-192x192.png` / `icon-512x512.png` 在 `public/` 下目前未看到对应文件，可能影响“添加到主屏幕”的图标显示。

### 12.3 Firebase App Hosting
- `apphosting.yaml`：当前仅设置 `maxInstances: 1`

## 13. 已知问题 / 风险点（建议优先关注）

1) **中文字符串疑似编码乱码**
- `src/components/quiz-view.tsx`：`答案解析` 显示为乱码
- `src/lib/pdf-server-utils.ts`：`中文译文` 显示为乱码

2) **Genkit 相关文档/脚本可能与现状不一致**
- `CLAUDE.md` 中描述“Next.js server actions 通过 HTTP 调用 Genkit”，但当前代码是直接 import 调用
- `GENKIT_API_URL`/`AI_USE_LOCAL` 常量未使用，暗示架构曾变更

3) **生产构建忽略 TS/ESLint 错误**
- `next.config.ts` 直接忽略，可能掩盖潜在 bug（后续迭代建议逐步收紧）

4) **localStorage 的局限**
- 单设备/单浏览器；清缓存即丢
- 容量有限（不能存图片），当前已规避 `photoDataUri` 持久化

5) **PDF data URI 体积风险**
- `datauristring` 可能较大；故事变长/字体嵌入会放大体积（后续可考虑改为流式下载或服务端存储）

6) **重复词/去重策略**
- OCR 提取“避免重复”依赖模型输出；前端未做去重

## 14. 后续开发建议（可作为迭代 Backlog）

- 明确 AI 架构路线：  
  - A) 继续“Next.js server actions 直连 Gemini”（简单）  
  - B) 走“独立 AI 服务（Express/Genkit）+ HTTP”（便于隔离与扩展）
- 做持久化：Firebase（Firestore/Realtime DB）或其他数据库；支持多端同步
- 引入账号体系/设备迁移（Auth + 用户隔离数据）
- 修复中文乱码（统一文件编码为 UTF-8；检查字体/渲染链路）
- 完善 PWA（补齐图标、离线缓存、可选 service worker）
- 增加导出/导入（JSON/CSV/PDF）
- 对 AI 输出做更强校验与容错（尤其是 `answer`/`analysis` 缺失时的 UI 兜底）

## 15. 关键文件速查表

- 主页/视图切换：`src/app/page.tsx`
- 侧边栏导航：`src/components/app-sidebar.tsx`
- 主题切换（深色模式）：`src/components/theme-toggle.tsx`
- 视图元信息：`src/lib/app-view.ts`
- Server Actions（AI 调用入口）：`src/app/actions.ts`
- 采集表单（Text/Camera/Upload）：`src/components/word-capture-form.tsx`
- 复习列表（按周分组/Practice/Story/掌握标记）：`src/components/word-review-list.tsx`
- Practice UI：`src/components/practice-view.tsx`
- 成长面板（等级/勋章/学习曲线）：`src/components/growth-sheet.tsx`
- 编辑弹窗：`src/components/edit-word-dialog.tsx`
- 作文批改 UI：`src/components/essay-review-view.tsx`
- 文章阅读 UI：`src/components/article-reading-view.tsx`
- 听说训练 UI（ASR/TTS）：`src/components/speaking-training-view.tsx`
- 阅读理解题 UI：`src/components/reading-questions-view.tsx`
- AI 封装：`src/ai/gemini.ts`
- AI flows：`src/ai/flows/*`
- 文章阅读 flow：`src/ai/flows/study-article.ts`
- PDF 生成：`src/lib/pdf-server-utils.ts`
- 文件解析（上传文本提取）：`src/lib/essay-file-utils.ts`
- 成长逻辑与持久化：`src/lib/gamification.ts`
- 类型定义：`src/lib/types.ts`
- 样式入口：`src/app/globals.css`
