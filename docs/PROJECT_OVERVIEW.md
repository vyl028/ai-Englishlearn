# LexiCapture（studio）项目概览

更新时间：2026-03-07  
代码仓库根目录：`D:\University\毕设\studio`

> 目标：在不改动任何现有代码的前提下，梳理项目现状（功能、架构、关键文件、运行方式、风险点），为后续迭代开发提供“地图”。

## 1. 项目定位

**LexiCapture** 是一个基于 **Next.js（App Router）** 的 Web 应用，面向“初中（九年级）英语学习”场景：

- 通过**手动输入**或**拍照/上传图片**采集英语单词
- 借助 **Google Gemini** 生成：
  - 单词的（字典风格）中文释义
  - 每周词汇的选择题测验（Quiz）
  - 包含这些词汇的短故事 + 中文翻译，并生成 PDF
- 当前持久化方式为：**浏览器 localStorage（单机/单浏览器）**

> `docs/blueprint.md` 中提到的“存入数据库”目前尚未落地（代码里仍是 localStorage）。

## 2. 当前已实现功能（按用户视角）

### 2.1 新增单词（New Words）
入口：`src/app/page.tsx`

组件：`src/components/word-capture-form.tsx`

三种采集方式：

1) **Text（手动输入）**
- 输入 `word` + `partOfSpeech`
- 可选附带 `photoDataUri`（图片预览）
- 点击 **Add Word** 后调用服务端 action：`getDefinitionAction` → AI 生成中文释义 → 加入单词列表

2) **Camera（拍照识别）**
- 申请摄像头权限，采集视频帧，转成 `data:image/jpeg;base64,...`
- 调用 `extractWordAndDefineAction` 自动识别图片中的多个单词，并直接加入列表

3) **Upload（上传图片识别）**
- 选择本地图片，读取为 Data URI
- 同 Camera 流程进行识别并加入列表

### 2.2 单词复习（My Words）
组件：`src/components/word-review-list.tsx`

- 以“周”为单位分组展示（按捕获时间）
- 每周可一键生成：
  - **Quiz**：`generateQuizAction`
  - **Story**：`generateStoryAction`（生成并下载 PDF）
- 支持：
  - 显示/隐藏释义（Switch）
  - 点击单词打开 Cambridge 词典页面（新标签页）
  - 编辑（本地更新）
  - 删除（带二次确认弹窗）

### 2.3 Quiz（周测）
组件：`src/components/quiz-view.tsx`

- 对每个单词生成 1 道 4 选 1 选择题
- 提交后标记正确/错误，并展示中文解析（`analysis` 字段）

### 2.4 Story PDF（周故事）
服务端生成：`src/lib/pdf-server-utils.ts`

- AI 返回：`{ title, story, translation }`
- 服务端使用 `jsPDF` 生成 PDF（中英分两页）
- 返回 `data:` URI 到前端，由浏览器触发下载

## 3. 与 Blueprint 的对齐情况

来源：`docs/blueprint.md`

- ✅ Word Capture（相机/上传/手输）
- ✅ Definition Lookup（LLM 中文释义）
- ⚠️ Data Storage（当前为 localStorage；未接入数据库/多端同步）
- ✅ Review（复习列表 + Quiz + Story）

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
│  │  ├─ genkit.ts
│  │  ├─ server.ts
│  │  └─ flows/
│  │     ├─ define-captured-word.ts
│  │     ├─ extract-word-and-define.ts
│  │     ├─ generate-quiz.ts
│  │     └─ generate-story.ts
│  ├─ components/
│  │  ├─ word-capture-form.tsx
│  │  ├─ word-review-list.tsx
│  │  ├─ edit-word-dialog.tsx
│  │  ├─ quiz-view.tsx
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
  partOfSpeech: string;
  definition: string;
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

- key：`lexi-capture-words`
- 保存前会**移除 `photoDataUri`**（避免把 base64 图片塞进 localStorage）
- 读取后会把 `capturedAt` 从字符串转回 `Date`

## 8. 关键业务流程（从代码映射）

### 8.1 手动输入 → 生成释义 → 加入列表
`WordCaptureForm.onSubmit`  
→ `src/app/actions.ts#getDefinitionAction`  
→ `src/ai/flows/define-captured-word.ts#defineCapturedWord`  
→ `src/ai/gemini.ts#generateText`  
→ 返回 `definition`，在前端追加到 `words` 并写入 localStorage

### 8.2 拍照/上传 → OCR+释义（多词）→ 加入列表
`WordCaptureForm.handleImageAnalysis`  
→ `src/app/actions.ts#extractWordAndDefineAction`  
→ `src/ai/flows/extract-word-and-define.ts#extractWordAndDefine`  
→ `src/ai/gemini.ts#generateJsonArray`（要求返回 JSON array）  
→ 生成多个 `CapturedWord` 并追加到列表

### 8.3 每周 Quiz
`WordReviewList` 点击 Quiz  
→ `src/app/actions.ts#generateQuizAction`  
→ `src/ai/flows/generate-quiz.ts#generateQuiz`（返回 JSON array）  
→ `QuizView` 展示与判分（依赖 `answer`/`analysis` 字段）

### 8.4 每周 Story PDF
`WordReviewList` 点击 Story  
→ `src/app/actions.ts#generateStoryAction`  
→ `src/ai/flows/generate-story.ts#generateStory`（返回 JSON object）  
→ `src/lib/pdf-server-utils.ts#generateStoryPdf` 生成 `datauristring`  
→ 浏览器创建 `<a download>` 触发下载

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
- Server Actions（AI 调用入口）：`src/app/actions.ts`
- 采集表单（Text/Camera/Upload）：`src/components/word-capture-form.tsx`
- 复习列表（按周分组/Quiz/Story）：`src/components/word-review-list.tsx`
- Quiz UI：`src/components/quiz-view.tsx`
- 编辑弹窗：`src/components/edit-word-dialog.tsx`
- AI 封装：`src/ai/gemini.ts`
- AI flows：`src/ai/flows/*`
- PDF 生成：`src/lib/pdf-server-utils.ts`
- 类型定义：`src/lib/types.ts`
- 样式入口：`src/app/globals.css`
