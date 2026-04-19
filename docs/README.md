# LexiCapture - AI 英语单词学习应用

基于 Next.js + Express + Prisma + SQLite 的全栈 AI 英语学习工具。

## 功能特性
- 📸 拍照/上传多模态识别单词
- 🤖 AI 自动生成释义、例句、搭配
- 📚 单词本（分组、搜索、批量操作）
- ✏️ 练习题 + 故事生成 + PDF 导出
- 📝 雅思作文批改 + 文章深度分析
- 🎧 听说训练（ASR/TTS + AI 对话）
- 🏆 成长系统（等级/勋章/学习曲线）

## 快速开始（3 分钟上手）

### 前置要求
- Node.js 18+
- AI API Key（Kimi 或 OpenAI 兼容）

### 1. 克隆项目
```bash
git clone <your-repo-url>
cd studio
2. 一键安装（推荐）
Windows：
Bash.\install.bat
Mac/Linux：
Bashchmod +x install.sh && ./install.sh
3. 配置环境变量
Bash# 后端（必须）
cp server/.env.example server/.env
# 编辑 server/.env，填入你的 AI Key 和 JWT_SECRET
4. 启动项目
Windows：
Bash.\start.bat
Mac/Linux：
Bashchmod +x start.sh && ./start.sh
5. 访问

电脑：http://localhost:9002
手机（同一 WiFi）：http://<电脑IP>:9002

首次登录：注册账号后即可使用（数据保存在服务端 SQLite）。
项目结构

src/ → 前端（Next.js）
server/ → 后端（Express + Prisma）
docs/ → 详细文档（RULE.md、PROJECT_OVERVIEW.md 等）

更多文档

协作规则
项目概览
响应式规范
变更记录

License
MIT
text#### 5. **RESPONSIVE_BREAKPOINTS.md**（响应式断点规范）—— **保持不变**
（内容完全保留，作为 UI 开发的硬性标准。）

---