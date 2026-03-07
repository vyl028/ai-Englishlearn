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
- 本地 `.env` 增加 OpenAI 相关环境变量（`AI_PROVIDER=openai` + `OPENAI_API_KEY`），用于切换到 OpenAI 作为 LLM Provider。
- 本地 `.env` 配置 `OPENAI_BASE_URL` 指向 OpenAI-compatible 服务地址，用于绕开 `api.openai.com` 不可达的网络问题。
- 本地 `.env` 配置 `OPENAI_MODEL` 为 OpenAI-compatible 服务侧“可用模型”，避免默认 `gpt-4o-mini` 在该服务下无渠道导致的 `model_not_found`。

### 涉及文件
- 修改：`src/lib/types.ts`（新增 enrichment 结构与相关 schema/type）
- 修改：`src/ai/flows/define-captured-word.ts`（生成 definition + enrichment）
- 修改：`src/ai/flows/extract-word-and-define.ts`（图片识别结果增加 enrichment）
- 修改：`src/app/actions.ts`（保存单词时带上 enrichment）
- 修改：`src/components/word-capture-form.tsx`（图片识别添加到单词本时保留 enrichment）
- 修改：`src/components/word-review-list.tsx`（新增 enrichment 展示）
- 修改：`src/components/edit-word-dialog.tsx`（编辑时保留 enrichment，避免丢失）
- 修改：`.env`（仅本地使用，内容不应记录在此）

### 背景/原因
- 现有单词本仅存释义；加入搭配/同反义/例句/用法分析后，学习信息更完整，且不依赖外部跳转。

### 如何验证
- 配置任一可用 LLM Key（Gemini 或 OpenAI），运行 `npm run dev`。
- 新增单词或用图片识别新增单词后，在 “My Words” 中展开 “Learn more” 查看拓展信息。

## 2026-03-07

### 新增/修改内容
- 新增 “Practice（多题型练习）”：基于用户某一周的单词列表，LLM 自动生成 3 种题型（选择题/填空题/句子重组题）。
- 答题提交后自动展示：答案对比、详细解析、语法讲解与词汇用法讲解。

### 涉及文件
- 修改：`src/lib/types.ts`（新增 Practice 题型的 schema/type）
- 新增：`src/ai/flows/generate-practice.ts`
- 修改：`src/app/actions.ts`（新增 `generatePracticeAction`）
- 新增：`src/components/practice-view.tsx`
- 修改：`src/components/word-review-list.tsx`（每周新增 Practice 入口）
- 修改：`src/app/page.tsx`（新增 practice 视图与状态管理）
- 修改：`docs/PROJECT_OVERVIEW.md`（补充 Practice 功能与结构）

### 背景/原因
- 在“生成故事”之外增加更系统的练习方式，支持多题型并提供可复习的讲解，提升学习效果。

### 如何验证
- 配置任一可用 LLM Key（Gemini 或 OpenAI），运行 `npm run dev`。
- 在 “My Words” 页面按周点击 “Practice”，生成题目后完成作答并提交，检查是否显示答案对比与讲解。

## 2026-03-07

### 新增/修改内容
- 修复 Practice 生成在部分模型下返回 JSON 字段不完整（例如缺少 `promptEn`）导致的 Zod 校验失败：在服务端对 LLM 输出做字段兜底与别名兼容，并补充提示词强调必填字段。

### 涉及文件
- 修改：`src/ai/flows/generate-practice.ts`

### 背景/原因
- 部分 OpenAI-compatible 模型会省略 `fill_blank`/`reorder` 的 `promptEn`（将其视为冗余），从而导致校验失败并中断生成流程。

### 如何验证
- 运行：`npm run dev`
- 在 “My Words” 页面点击 “Practice”，确认能正常生成题目并显示每题的英文提示。

## 2026-03-07

### 新增/修改内容
- 合并原 “Quiz（选择题）” 与 “Practice（多题型）” 为同一练习入口：在 “Practice” 中通过勾选题型实现“仅选择题”或“混合题型”练习。
- Practice 生成改为“随机混合题型 + 可配置题目数量（默认 10）”，不再强制每个单词各生成 3 种题型各 1 题。

### 涉及文件
- 修改：`src/lib/types.ts`（Practice 输入增加 `questionCount` / `allowedTypes`，并抽出 `PracticeQuestionTypeSchema`）
- 修改：`src/ai/flows/generate-practice.ts`（随机生成 targets，按勾选题型混合出题）
- 修改：`src/components/word-review-list.tsx`（Practice 配置弹窗：题型勾选 + 题量）
- 修改：`src/app/page.tsx`（移除单独 Quiz 视图入口，统一走 Practice）
- 修改：`docs/PROJECT_OVERVIEW.md`（更新功能与流程说明）

### 背景/原因
- 原 Quiz 与 Practice 功能重叠且入口分散；合并后更易理解，也便于按需生成题型组合与控制题量，降低一次生成过大导致超时的风险。

### 如何验证
- 运行：`npm run dev`
- 在 “My Words” 页面点击 “Practice”，在弹窗中勾选题型与设置题量后生成；确认题型混合符合勾选项，且能正常判题与展示讲解。

## 2026-03-07

### 新增/修改内容
- 优化 Practice 的选择题（MCQ）生成：改为更贴近国内英语试卷的“单项选择/单句填空（单空 ____）”风格，并要求选项包含目标词及其常见变形作为干扰项，避免 “Which sentence uses <word> correctly?” 这类题型。
- 练习页面选择题选项增加 A/B/C/D 标号展示。
- 全站 UI 文案中文化（按钮、提示、弹窗、toast 等），保留单词本整体交互与布局不变。

### 涉及文件
- 修改：`src/ai/flows/generate-practice.ts`（MCQ 出题约束与示例）
- 修改：`src/components/practice-view.tsx`（A/B/C/D + 中文文案）
- 修改：`src/components/word-review-list.tsx`（中文文案 + 练习配置弹窗）
- 修改：`src/components/word-capture-form.tsx`（中文文案）
- 修改：`src/components/edit-word-dialog.tsx`（中文文案）
- 修改：`src/app/page.tsx`（中文 toast/导航/删除确认）
- 修改：`src/app/actions.ts`（用户可见错误信息中文化）
- 修改：`src/app/layout.tsx`（`lang` 调整为 `zh-CN`，描述中文化）
- 修改：`src/components/ui/carousel.tsx`（无障碍文案中文化）
- 修改：`src/components/ui/dialog.tsx`（无障碍文案中文化）
- 修改：`src/components/ui/sheet.tsx`（无障碍文案中文化）
- 修改：`src/components/ui/sidebar.tsx`（无障碍文案中文化）
- 修改：`docs/PROJECT_OVERVIEW.md`（同步更新说明）

### 背景/原因
- 选择题希望更符合国内考试习惯，且更适合作为“词形/搭配/语法点”练习；同时统一中文界面以提升学习体验。

### 如何验证
- 运行：`npm run dev`
- 在 “单词本” 按周点击 “练习”，只勾选“选择题（单项选择）”生成后检查题干是否为单空填空式、选项是否包含变形且唯一正确，并确认选项显示 A/B/C/D 标号。

## 2026-03-07

### 新增/修改内容
- 练习/故事生成支持选择单词范围：当前分组、最近一周、最近一个月（按自然月回退 1 个月），以及手动勾选单词本中的任意单词。
- 故事生成在所选单词数量过多时弹出提示，并允许用户选择是否继续生成。

### 涉及文件
- 修改：`src/components/word-review-list.tsx`（生成弹窗：选词范围 + 搜索勾选 + 故事二次确认）
- 修改：`docs/PROJECT_OVERVIEW.md`（同步更新说明）

### 背景/原因
- 生成内容不一定只基于某一周的分组；支持按最近一周/最近一月或手动选词，可更灵活地复习与输出。

### 如何验证
- 运行：`npm run dev`
- 在 “单词本” 任一周点击 “练习/故事”，分别切换“最近一周 / 最近一个月 / 手动选择”，确认生成使用所选单词集合；故事选择大量单词时应出现二次确认弹窗。

## 2026-03-07

### 新增/修改内容
- 单词本新增“自定义分组”体系：提供分组列表（含“全部”视角）用于切换查看，并支持新建/重命名/删除分组；新增单词默认进入“默认分组”。
- 单词卡片新增“移动分组”入口，可将单词移动到指定分组。
- 练习/故事生成弹窗的“当前分组”改为“分组下拉选择”，可选择不同分组进行一键选词；保留“最近一周/最近一个月/手动选择”，其中最近一周/最近一月按“跨分组（全部单词）”计算。
- 生成弹窗适配小屏：内容区可滚动、底部按钮固定可见，避免超出屏幕。
- 增加本地存储迁移：旧的单词本数据若缺少 `groupId` 会自动归入“默认分组”。

### 涉及文件
- 修改：`src/lib/types.ts`（CapturedWord 增加 `groupId`；新增 WordGroup 类型）
- 修改：`src/app/page.tsx`（分组/选中分组持久化；新增单词默认分组；分组增删改与单词移动逻辑）
- 修改：`src/components/word-review-list.tsx`（分组列表与管理弹窗；移动分组；生成弹窗分组下拉 + 防超屏）
- 修改：`docs/PROJECT_OVERVIEW.md`（同步更新说明）

### 背景/原因
- 需要在保留“按日期分周展示”的基础上，引入更符合学习场景的“自定义分组（按教材/单元/主题）”管理能力，并让练习/故事的选词更灵活可控。

### 如何验证
- 运行：`npm run dev`
- 在“单词本”顶部切换分组，确认列表按周展示且只包含该分组单词；在“分组管理”中新建/重命名/删除分组后刷新页面，确认本地持久化生效。
- 在任意单词卡片点击“移动分组”，移动后应出现在目标分组中（“全部”视角可看到所有分组的单词）。
- 在任一周点击“练习/故事”，在弹窗中切换“分组/最近一周/最近一个月/手动选择”，确认已选数量与预期一致，且弹窗在小屏不超出屏幕。

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
