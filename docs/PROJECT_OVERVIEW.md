# LexiCapture 项目概览

**更新时间**：2026-04-12  
**代码仓库根目录**：`D:\University\GraduationProject\studio2\ai-Englishlearn`（当前为前后端分离架构）

> 当前阶段：**维护/优化阶段**（1-100 号改进清单 + 跨设备适配阶段一/二/三 已全部完成）

## 1. 项目定位
LexiCapture 是一个**面向初中英语学习**的 AI 驱动全栈 Web 应用，支持：
- 手动/拍照/上传图片采集单词
- AI 生成中文释义、拓展信息（搭配、同反义词、例句、难度用法）
- 每周练习题（选择题/填空/句子重组，贴近国内英语试卷风格）
- 单词故事生成 + PDF 导出
- 雅思作文批改（Task 2）
- 文章深度阅读分析
- 听说训练（ASR/TTS + AI 对话）
- 成长系统（等级、勋章、学习曲线）

**当前架构**：**Next.js 15 前端（App Router） + Express 后端（端口 4000） + Prisma + SQLite**  
数据持久化：**服务端 SQLite 数据库 + JWT 认证**（已完成前后端分离，不再使用 localStorage）。

## 2. 核心功能（最新状态）
- **单词采集**：手动批量输入 / 拍照 / 上传图片（**已切换为 Kimi 多模态视觉模型**，一步完成识别+释义）
- **单词本**：分组管理（全部/自定义分组）、搜索、筛选、排序、批量操作、掌握标记
- **练习 / 故事**：可配置题型/题量/选词范围，支持重做、错题筛选、PDF 导出
- **作文批改 / 文章阅读**：支持文件上传（PDF/DOCX/图片 OCR），结构化输出
- **听说训练**：跟读评估 + AI 对话
- **成长系统**：XP、等级、勋章、学习曲线、打卡
- **设置**：主题、备份导入导出、数据修复、**退出登录**

## 3. 技术栈（最新）
**前端**：Next.js 15（App Router）、React 18、TypeScript、Tailwind CSS + shadcn/ui、Radix UI  
**后端**：Express 5 + Prisma + SQLite + JWT 认证  
**AI**：Kimi（OpenAI 兼容）多模态模型（图片识别 + 文本生成）  
**其他**：jsPDF（PDF 导出）、PWA 支持、响应式设计（移动优先）

## 4. 目录结构（关键）
.
├── src/                  # 前端（Next.js）
│   ├── app/              # Server Actions + 页面
│   ├── components/       # UI 组件
│   └── lib/              # 工具
├── server/               # 后端（Express + Prisma）
│   ├── prisma/schema.prisma
│   ├── src/routes/       # API 路由（auth、words、groups、ai）
│   └── src/services/     # 业务逻辑 + AI 服务
├── docs/                 # 文档（本文件等）
├── README.md             # 开源快速启动指南
├── install.bat / start.bat（Windows）
├── install.sh / start.sh（Mac/Linux）
└── .env.example / server/.env.example
text## 5. 跨设备与响应式（已完成）
- 遵循 **RESPONSIVE_BREAKPOINTS.md** 标准（移动优先，Tailwind 默认断点）
- 触摸目标 ≥44×44px、摄像头/表单/导航移动端优化
- 支持手机通过电脑 IP 访问（开发环境 0.0.0.0 + 防火墙配置）
- PWA 已配置，可“添加到主屏幕”

## 6. 开源准备（已完成）
- 所有硬编码 IP 已移除
- 敏感信息已清理（git filter-repo）
- 提供一键安装/启动脚本（install.bat/sh、start.bat/sh）
- README.md 包含完整快速上手流程

**后续建议**：引入 Firebase Auth + Firestore 实现真正多端同步（当前为单用户 SQLite）。

详细变更记录见 `CHANGELOG.md`。