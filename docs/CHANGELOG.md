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

