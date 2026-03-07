# 变更记录（Changelog）

> 规则：从现在开始，本项目**每次修改**都需要在此文件追加一条记录（包括：改了什么、为什么改、涉及哪些文件）。
>
> 注意：**不要**在此文件写入任何密钥/Token/账号密码等敏感信息（如 `.env` 内容），只描述“已新增/已配置”即可。

## 2026-03-07

### 新增/修改内容
- 新增项目概览文档，整理项目结构、功能流、模块说明与风险点，便于后续开发对齐。
- 新增本地环境变量文件用于运行（`.env`），提供 `GOOGLE_API_KEY`（已被 `.gitignore` 忽略，不会提交到仓库）。
- 为兼容当前 Node.js（在 Windows 上暴露“残缺 localStorage”导致 Next.js dev 崩溃的问题），新增启动修复脚本并调整 npm scripts：
  - 通过 Node `--require` 预加载脚本，在 Next.js 运行前把服务端 `localStorage` 置为 `undefined`，避免 Next 内部调用 `localStorage.getItem(...)` 报错
  - 保留 `scripts/next-safe.cjs` 作为 Next 启动包装器，并由 npm scripts 统一入口调用

### 涉及文件
- 新增：`docs/PROJECT_OVERVIEW.md`
- 新增：`.env`（仅本地使用，内容不应记录在此）
- 新增：`scripts/next-safe.cjs`
- 新增：`scripts/node-preload.cjs`
- 修改：`package.json`（更新 `dev/build/start/lint` 启动命令）

### 背景/原因
- 在部分 Node 版本（已观察到 Node 25.x）下，服务端存在 `globalThis.localStorage` 但缺少 `getItem` 等方法；Next.js dev 工具链会在检测到 `localStorage` 存在时读取 `localStorage.getItem("DEBUG")`，从而导致 `/` 请求 500。
- 采用预加载脚本可以覆盖主进程及 worker 线程，确保后续“直接 `npm run dev`”可运行。

### 如何验证
- 运行：`npm run dev`
- 访问：`http://localhost:9002`

## 2026-03-07

### 新增/修改内容
- 新增统一 LLM 入口 `src/ai/llm.ts`：通过 `AI_PROVIDER` 在 Gemini / OpenAI（含 OpenAI-compatible base URL）间切换。
- 新增 OpenAI 适配 `src/ai/openai.ts`：支持 `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_BASE_URL`（用于 OpenAI-compatible 接口）。
- 将现有 AI flows 从直接依赖 `@/ai/gemini` 改为依赖 `@/ai/llm`，为后续扩展更多模型做准备。
- 新增 `.env.example`，便于以“复制并填写”的方式配置不同 Provider 的 Key 与模型。

### 涉及文件
- 修改：`.gitignore`（允许提交 `.env.example`，继续忽略 `.env*`）
- 新增：`src/ai/llm.ts`
- 新增：`src/ai/openai.ts`
- 修改：`src/ai/flows/define-captured-word.ts`
- 修改：`src/ai/flows/extract-word-and-define.ts`
- 修改：`src/ai/flows/generate-quiz.ts`
- 修改：`src/ai/flows/generate-story.ts`
- 修改：`src/ai/genkit.ts`
- 新增：`.env.example`
- 修改：`docs/PROJECT_OVERVIEW.md`

### 背景/原因
- 现有实现绑定 Gemini；当网络/配额不可用时无法替换。抽象统一入口后，可通过环境变量切换到 OpenAI 或任意 OpenAI-compatible 服务。

### 如何验证
- Gemini（默认）：配置 `GOOGLE_API_KEY`，运行 `npm run dev` 并触发“释义/识别/Quiz/Story”相关功能。
- OpenAI：配置 `AI_PROVIDER=openai` + `OPENAI_API_KEY`（必要时设置 `OPENAI_MODEL` / `OPENAI_BASE_URL`），同上验证。

## 2026-03-07

### 新增/修改内容
- 新增“单词智能拓展（Enrichment）”：在新增单词（手动输入/图片识别）时，LLM 会同步生成常见搭配、同反义词、例句、难度与用法分析，并随单词一起存入本地单词本。
- 复习列表新增 “Learn more” 展示区，用户无需跳转外部词典即可查看核心学习信息（仍保留原 Cambridge 外链点击行为）。

### 涉及文件
- 修改：`src/lib/types.ts`（新增 enrichment 结构与相关 schema/type）
- 修改：`src/ai/flows/define-captured-word.ts`（生成 definition + enrichment）
- 修改：`src/ai/flows/extract-word-and-define.ts`（图片识别结果增加 enrichment）
- 修改：`src/app/actions.ts`（保存单词时带上 enrichment）
- 修改：`src/components/word-capture-form.tsx`（图片识别添加到单词本时保留 enrichment）
- 修改：`src/components/word-review-list.tsx`（新增 enrichment 展示）
- 修改：`src/components/edit-word-dialog.tsx`（编辑时保留 enrichment，避免丢失）

### 背景/原因
- 现有单词本仅存释义；加入搭配/同反义/例句/用法分析后，学习信息更完整，且不依赖外部跳转。

### 如何验证
- 配置任一可用 LLM Key（Gemini 或 OpenAI），运行 `npm run dev`。
- 新增单词或用图片识别新增单词后，在 “My Words” 中展开 “Learn more” 查看拓展信息。

---

## 记录模板（复制后填写）

### YYYY-MM-DD
#### 新增/修改内容
- （一句话总结）

#### 涉及文件
- 新增：`path/to/file`
- 修改：`path/to/file`
- 删除：`path/to/file`

#### 背景/原因
- （为什么要改）

#### 如何验证
- （如何确认改动有效）
