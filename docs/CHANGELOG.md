# 变更记录（Changelog）

> 规则：从现在开始，本项目**每次修改**都需要在此文件追加一条记录（包括：改了什么、为什么改、涉及哪些文件）。
>
> 注意：**不要**在此文件写入任何密钥/Token/账号密码等敏感信息（如 `.env` 内容），只描述“已新增/已配置”即可。

## 2026-03-13

### 新增/修改内容
- 进度文档同步：项目概览补充“回退到编号选择阶段”的说明，并明确后续迭代从 `docs/IMPROVEMENT_BACKLOG.md` 选编号开始。
- 清单 2：记住上次打开的主要模块（view），刷新后自动恢复。
- 清单 4：全局生成（Practice/Story）期间禁用导航与顶部操作；顶部显示生成提示，并支持“取消生成”（使用 AbortController 中断请求；取消后不会应用结果）。
- 清单 6：新增“设置”入口（主题、备份/导入/AI 预留、隐私与数据清理）。
- 清单 9：统一内容宽度与 header/content 横向 padding。
- 清单 10：全站 icon-only 按钮补齐 `aria-label/title`，提升键盘可达性与焦点可见性。

### 涉及文件
- 修改：`src/app/page.tsx`
- 修改：`src/ai/llm.ts`
- 修改：`src/ai/gemini.ts`
- 修改：`src/ai/openai.ts`
- 修改：`src/ai/flows/generate-practice.ts`
- 修改：`src/ai/flows/generate-story.ts`
- 修改：`src/components/app-sidebar.tsx`
- 修改：`src/components/theme-toggle.tsx`
- 修改：`src/components/practice-view.tsx`
- 修改：`src/components/story-view.tsx`
- 修改：`src/components/quiz-view.tsx`
- 修改：`src/components/word-review-list.tsx`
- 修改：`src/components/ui/sidebar.tsx`
- 修改：`src/components/ui/dialog.tsx`
- 修改：`src/components/ui/sheet.tsx`
- 修改：`src/components/ui/carousel.tsx`
- 修改：`docs/PROJECT_OVERVIEW.md`

### 背景/原因
- 进入“按编号清单迭代”的协作节奏，先落地基础的使用习惯、可取消生成、设置入口与可访问性改进。

### 如何验证
- 运行：`npm run dev`
- 切换到任一模块（如“文章阅读”）→ 刷新页面，确认会恢复到上次模块。
- 在“单词本”生成 Practice/Story 时观察顶部提示；点击“取消生成”，确认导航恢复且不会跳转到结果页。
- 点击右上角“设置”按钮，确认可打开设置抽屉；点击“清空本机数据”后刷新，确认数据与上次模块被清空。
- Tab 聚焦返回/设置/侧边栏 trigger 等纯图标按钮，确认有可读的提示（title）且焦点可见。

## 2026-03-11

### 新增/修改内容
- 全站 UI/布局优化：主导航从底部栏调整为**侧边栏**（桌面端常驻，移动端抽屉），顶部栏统一展示当前模块标题与快捷操作。
- 新增**深色模式切换**：记住你的选择，并在页面加载前应用主题，减少闪烁。
- 视觉与可读性优化：补齐中文字体回退、全局 `color-scheme`、选中态；答题正确/错误颜色在深色模式下更清晰。
- 清理页面与采集流程中不必要的前端 `console.log`。

### 涉及文件
- 新增：`src/components/app-sidebar.tsx`
- 新增：`src/components/theme-toggle.tsx`
- 新增：`src/lib/app-view.ts`
- 修改：`src/app/page.tsx`
- 修改：`src/app/layout.tsx`
- 修改：`src/app/globals.css`
- 修改：`tailwind.config.ts`
- 修改：`src/components/word-capture-form.tsx`
- 修改：`src/components/practice-view.tsx`
- 修改：`src/components/reading-questions-view.tsx`
- 修改：`src/components/quiz-view.tsx`
- 修改：`docs/PROJECT_OVERVIEW.md`

### 背景/原因
- 提升“英语学习软件”整体质感与一致性；侧边栏更适合桌面端长期使用；深色模式便于夜间学习。

### 如何验证
- 运行：`npm run dev`
- 切换侧边栏导航，确认“新增单词/单词本/听说训练/文章阅读/作文批改”可正常切换。
- 点击右上角主题按钮切换深色模式，刷新后确认主题保留。
- 进入练习/阅读理解题，提交后确认正确/错误高亮在深色模式下仍清晰。
- 运行：`npm run typecheck`

## 2026-03-10

### 新增/修改内容
- 新增“成长”系统：学习行为获得 XP，自动升级（等级进度条、距离下一级提示）。
- 新增勋章系统：连续打卡（3/7/14 天）与掌握单词（10/100）自动解锁并展示。
- 学习记录可视化：展示近 7 天学习曲线（XP 与新增单词），并可切换 14/30 天。
- 单词本新增“掌握”标记，可随时标记/取消标记；掌握度在成长面板中汇总展示。
- 界面优化：成长入口增加等级进度提示；单词卡片“掌握/释义”操作改为图标按钮（移动端更紧凑）。

### 涉及文件
- 新增：`src/lib/gamification.ts`
- 新增：`src/components/growth-sheet.tsx`
- 修改：`src/app/page.tsx`
- 修改：`src/components/word-review-list.tsx`
- 修改：`src/components/practice-view.tsx`
- 修改：`src/lib/types.ts`
- 修改：`docs/PROJECT_OVERVIEW.md`

### 背景/原因
- 引入游戏化激励，让学习过程更有反馈与成就感，鼓励持续学习与复习。

### 如何验证
- 运行：`npm run dev`
- 顶部点击“成长”按钮，确认可打开成长面板（等级、打卡、掌握度、勋章、学习曲线）。
- 在“新增单词”添加 1~2 个单词，确认 XP/等级进度与曲线更新。
- 在“单词本”对某个单词切换“掌握”开关，确认掌握度更新（并可切回未掌握）。
- 生成并完成一次练习（提交答案），确认 XP 更新并计入曲线。
- 生成一次故事，确认 XP 更新并计入曲线。
- 刷新页面，确认成长数据与掌握标记仍保留（localStorage）。
- 运行：`npm run typecheck`

## 2026-03-08

### 新增/修改内容
- “听说训练”页面内将“跟读训练”和“AI 对话”拆分为两个页签（保持同一入口）。
- AI 对话：对用户发言的评价/纠错改为折叠隐藏，需要时手动展开查看（按钮位于用户消息气泡内）。
- AI 回复生成后自动开始朗读；朗读按钮可再次点击停止，移除固定的“停止朗读”按钮。

### 涉及文件
- 修改：`src/components/speaking-training-view.tsx`
- 修改：`docs/PROJECT_OVERVIEW.md`

### 背景/原因
- 将口语跟读与对话练习分区，减少信息干扰；自动朗读 + 单按钮停播让练习更连贯。

### 如何验证
- 运行：`npm run dev`
- 进入“听说训练”：
  - 切换页签，确认“跟读训练 / AI 对话”界面独立；
  - 在“AI 对话”说一句英文，AI 回复后应自动朗读；点击该回复的“播放”按钮可停止/再播放；“查看评价与纠错”位于用户消息气泡内，点击展开查看中文反馈；
  - 在“跟读训练”中点击“播放”示范朗读，再次点击应停止。
- 运行：`npm run typecheck`

## 2026-03-08

### 新增/修改内容
- “听说训练”移除不稳定的“识别置信度”展示，改为提供多个 ASR 候选并支持切换；默认自动选择匹配度最高的候选用于评测。
- 新增“AI 对话（口语）”进阶功能：用户语音发言（ASR 转写）→ AI 英文回复（可 TTS 朗读）→ 中文纠错反馈与改进建议（基于转写文本）。

### 涉及文件
- 修改：`src/components/speaking-training-view.tsx`
- 新增：`src/ai/flows/speaking-chat.ts`
- 修改：`src/app/actions.ts`
- 修改：`src/lib/types.ts`
- 修改：`docs/PROJECT_OVERVIEW.md`

### 背景/原因
- 浏览器提供的 ASR 置信度在 Edge/Chromium 中经常缺失或为 0，不适合用作核心指标；候选切换更稳。
- 需要模拟真实交流场景，提供“对话 + 纠错反馈”的口语练习闭环。

### 如何验证
- 运行：`npm run dev`
- 进入“听说训练”：
  - 跟读评测完成后若有多个候选，确认可切换候选并重新计算匹配度；
  - 进入 “AI 对话（口语）”，点击“开始说话”说一句英文，应自动发送并看到 AI 英文回复 + 中文反馈；可点击“播放”朗读回复。
- 运行：`npm run typecheck`

## 2026-03-08

### 新增/修改内容
- 新增“听说训练”模块（ASR + TTS）：支持语音输入单词/短句，TTS 示范朗读，跟读后基于 ASR 转写进行近似评分（WER + 置信度）并给出改进建议。
- 主页底部导航新增“听说训练”入口，便于在网页端直接使用（Edge 推荐）。

### 涉及文件
- 新增：`src/components/speaking-training-view.tsx`
- 修改：`src/app/page.tsx`
- 修改：`docs/PROJECT_OVERVIEW.md`

### 背景/原因
- 需要在网页端构建可运行的听说训练闭环：先用浏览器原生 Web Speech API 实现 ASR/TTS，后续再迭代更精细的发音评估。

### 如何验证
- 运行：`npm run dev`
- 进入“听说训练”：输入（或语音输入）英文目标文本，点击“播放”听示范；点击“开始跟读”朗读后应看到识别结果、匹配度与改进建议。
- 运行：`npm run typecheck`

## 2026-03-08

### 新增/修改内容
- “文章阅读”与“作文批改”支持上传图片（OCR 识别英文正文），识别后自动填充到正文输入框，便于后续分析/批改。

### 涉及文件
- 修改：`src/app/actions.ts`（文件上传解析：新增图片 OCR）
- 修改：`src/components/article-reading-view.tsx`（上传支持图片）
- 修改：`src/components/essay-review-view.tsx`（上传支持图片）
- 修改：`docs/PROJECT_OVERVIEW.md`

### 背景/原因
- 适配截图/拍照场景（扫描版 PDF/截图/手机照片），减少手动复制粘贴成本。

### 如何验证
- 运行：`npm run dev`
- 在“文章阅读”上传 `.png/.jpg/.jpeg/.webp` 图片，确认正文自动填充（必要时可手动修正排版/漏字）。
- 在“作文批改”上传 `.png/.jpg/.jpeg/.webp` 图片，确认正文自动填充并可正常批改。
- 运行：`npm run typecheck`

## 2026-03-08

### 新增/修改内容
- 练习题（Practice）不再在题目头部显示“词汇：xxx”，避免暴露题目由哪个单词生成；同时移除题目中的额外提示文案，让题面更接近真实试题。
- 文章阅读的阅读理解题不再在作答前显示“定位/原文”提示；提交后可在“答案与解析”中查看定位信息。

### 涉及文件
- 修改：`src/components/practice-view.tsx`
- 修改：`src/ai/flows/generate-practice.ts`
- 修改：`src/components/reading-questions-view.tsx`

### 背景/原因
- 题目页面不应提前泄露目标单词或定位提示，避免形成“提示题”，提升练习/阅读理解的真实感。

### 如何验证
- 运行：`npm run dev`
- 在“单词本”生成练习：确认题目头部不再显示“词汇：xxx”，且填空/重组不再额外显示提示文案。
- 在“文章阅读”开启“生成题目”：确认作答前不再显示“定位/原文”；提交后在解析中可看到定位信息（若有）。
- 运行：`npm run typecheck`

## 2026-03-08

### 新增/修改内容
- 单词新增改为**自动识别词性**：手动输入时不再需要选择词性，可一次性生成并加入同一单词的多个常见词性条目。
- 单词本支持同一单词的**多词性切换查看**：在“了解更多”里使用按钮切换不同词性，并展示对应的释义与拓展内容。
- 文章阅读提取词汇/短语加入单词本时，改为调用与“直接新增单词”一致的 LLM 词条生成逻辑（以直接新增为准），并增加“加入中...”状态提示。

### 涉及文件
- 新增：`src/ai/flows/define-term-auto.ts`
- 修改：`src/ai/server.ts`
- 修改：`src/lib/types.ts`
- 修改：`src/app/actions.ts`
- 修改：`src/components/word-capture-form.tsx`
- 修改：`src/components/word-review-list.tsx`
- 修改：`src/components/article-reading-view.tsx`
- 修改：`src/app/page.tsx`

### 背景/原因
- 减少手动操作（不再手选词性），并让从不同入口加入的单词“了解更多”内容保持一致；同时满足“同一单词多词性”在单词本中的学习与查看需求。

### 如何验证
- 运行：`npm run dev`
- 在“新增单词”里输入一个多词性单词（如 record），确认可一次性加入多个词性条目。
- 在“单词本”里展开“了解更多”，确认可用按钮在不同词性间切换并看到对应内容。
- 在“文章阅读”的“词汇”页签点“加入单词本”，确认会生成完整“了解更多”内容并加入单词本。
- 运行：`npm run typecheck`

## 2026-03-08

### 新增/修改内容
- 新增“作文批改（IELTS Writing Task 2）”功能：支持用户粘贴或上传英语作文，系统输出评分、错误点、优化建议与示范句，并给出修改前后对照与优化后的全文。
- 新增作文文件解析：支持 `.txt` / `.md` / `.docx` / `.pdf` 上传读取（PDF 为 best-effort，扫描版/特殊字体编码可能提取不完整）。
- 主页底部导航新增“作文批改”入口，不影响原有单词本与练习/故事流程。
- 补齐 `Analyze*` / `DefineWordsBatch` 相关类型定义，使 `npm run typecheck` 可通过。

### 涉及文件
- 新增：`src/ai/flows/review-essay.ts`
- 新增：`src/components/essay-review-view.tsx`
- 新增：`src/lib/essay-file-utils.ts`
- 修改：`src/lib/types.ts`
- 修改：`src/app/actions.ts`
- 修改：`src/app/page.tsx`
- 修改：`docs/PROJECT_OVERVIEW.md`

### 背景/原因
- 满足“上传或输入英语作文 → 自动批改与优化建议输出 → IELTS Task 2 参考评分/分级”的需求。

### 如何验证
- 运行：`npm run dev`
- 进入“作文批改”，粘贴英文作文或上传文件，点击“开始批改”，应看到“评分 / 问题 / 优化后 / 对照”结果页签。
- 运行：`npm run typecheck`

## 2026-03-08

### 新增/修改内容
- 调整“作文批改”界面文案：将标题中的英文改为中文翻译；“Task 2 题目（可选）”改为“题目（可选）”，并同步更新提示语。

### 涉及文件
- 修改：`src/components/essay-review-view.tsx`
- 修改：`docs/PROJECT_OVERVIEW.md`

### 背景/原因
- 统一全站中文 UI 文案，降低理解成本。

### 如何验证
- 运行：`npm run dev`
- 进入“作文批改”，确认标题与“题目（可选）”文案已更新。

## 2026-03-08

### 新增/修改内容
- 新增“文章阅读”功能：用户可上传或粘贴英文文章，系统输出结构分析、句法讲解、难句拆解与重组、关键词/短语提取。
- 新增可选“题目”生成：生成中国考试风格的阅读理解题（选择题），并在页面内完成作答、提交与查看解析；答题交互逻辑与单词本练习一致。
- 主页底部导航新增“文章阅读”入口。

### 涉及文件
- 新增：`src/ai/flows/study-article.ts`
- 新增：`src/components/article-reading-view.tsx`
- 新增：`src/components/reading-questions-view.tsx`
- 修改：`src/components/essay-review-view.tsx`
- 修改：`src/lib/types.ts`
- 修改：`src/app/actions.ts`
- 修改：`src/app/page.tsx`
- 修改：`docs/PROJECT_OVERVIEW.md`

### 背景/原因
- 帮助用户在阅读真实语料时获得类似教师指导的理解支持（结构/句法/难句/词汇/题目）。

### 如何验证
- 运行：`npm run dev`
- 进入“文章阅读”，粘贴或上传文章后点击“开始分析”，应看到“结构 / 句法 / 难句 / 词汇 / 题目”。开启“生成题目”后应可答题并查看答案与解析。
- 运行：`npm run typecheck`

## 2026-03-08

### 新增/修改内容
- “文章阅读”提取到的关键词/短语支持一键加入单词本：会自动判断是否已存在；若已存在则提示“已在单词本”并避免重复添加。
- 单词词性选项新增 `phrase`，便于短语条目在单词本中展示与编辑。

### 涉及文件
- 修改：`src/components/article-reading-view.tsx`
- 修改：`src/app/page.tsx`
- 修改：`src/components/word-capture-form.tsx`
- 修改：`src/components/edit-word-dialog.tsx`
- 修改：`docs/PROJECT_OVERVIEW.md`

### 背景/原因
- 让“文章阅读”的学习闭环更完整：把文章中学到的词汇/短语快速沉淀到单词本中复习。

### 如何验证
- 运行：`npm run dev`
- 进入“文章阅读”完成分析，在“词汇”页签点击“加入单词本”；对同一词条重复点击应提示“已在单词本”。
- 运行：`npm run typecheck`

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

## 2026-03-07

### 新增/修改内容
- 单词本分组切换 UI 改为下拉选择（保留“全部”视角 + 自定义分组），避免分组过多时横向按钮拥挤。
- 移除“默认分组”概念：旧的 `default` 分组会在启动时自动迁移；原默认分组内的单词会变为未分组（仅在“全部”中可见，可再手动移动到任意分组）。
- “显示释义”从全局开关改为每个单词独立开关，避免影响整页阅读。
- 故事生成改为直接在页面展示，并新增“导出 PDF”按钮；导出时才在服务端生成 PDF（不再生成后自动下载）。

### 涉及文件
- 修改：`src/app/actions.ts`（新增 `exportStoryPdfAction`；`generateStoryAction` 不再返回 pdfDataUri）
- 新增：`src/components/story-view.tsx`（故事展示 + 导出按钮）
- 修改：`src/app/page.tsx`（新增 story 视图；导出 PDF 流程；分组迁移与新词分组逻辑调整）
- 修改：`src/components/word-review-list.tsx`（分组切换改下拉；释义改为单词级开关；删除分组后的行为调整）
- 修改：`docs/PROJECT_OVERVIEW.md`（同步更新说明）

### 背景/原因
- 分组数量增多时需要更紧凑的切换方式；同时“全部”已覆盖默认收纳场景，不再需要额外的“默认分组”。
- 释义显示与故事导出改为更细粒度的控制，减少干扰并提升交互效率。

### 如何验证
- 运行：`npm run dev`
- 在“单词本”通过下拉切换分组，确认展示与计数正确；删除分组后该分组单词应变为未分组并可在“全部”中看到。
- 单词卡片的“释义”开关仅影响该单词的释义显示。
- 生成故事后应进入故事页面展示内容；点击“导出 PDF”应下载对应 PDF。

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
