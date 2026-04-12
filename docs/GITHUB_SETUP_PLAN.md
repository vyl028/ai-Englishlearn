# LexiCapture GitHub 开源配置方案

> 目标：让其他人拉取项目后，只需配置 `.env` 文件和安装依赖就能直接运行
> 
> 状态：待实施
> 创建时间：2026-04-11

---

## 1. 现状分析

### 当前项目结构
```
ai-Englishlearn/
├── 前端：Next.js（端口9002）
├── 后端：Express + Prisma + SQLite（端口4000）
├── 已有 .env.example 和 server/.env.example
└── 后端有独立的 README.md
```

### 现存问题
1. **API客户端硬编码IP地址**：`src/lib/api-client.ts` 中写死了 `192.168.0.100`
2. **Next.js配置硬编码**：`next.config.ts` 的 `allowedDevOrigins` 是固定IP列表
3. **缺少根目录完整启动文档**：README.md 内容过于简单
4. **没有一键安装脚本**：需要分别进入前后端目录安装依赖
5. **.gitignore不完整**：未排除后端 `node_modules` 和数据库文件

---

## 2. 修改方案详情

### 2.1 修改 API 客户端配置

**文件**：`src/lib/api-client.ts`

**当前代码**：
```typescript
const API_BASE_URL = 'http://192.168.0.100:4000';
```

**修改为**：
```typescript
// 从环境变量读取，默认使用 localhost（单用户开发）
// 如需手机访问，在 .env.local 中设置 NEXT_PUBLIC_API_URL=http://192.168.x.x:4000
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
```

**说明**：
- 默认使用 `localhost:4000`，单用户开发无需配置
- 手机访问时，用户自己在 `.env.local` 中配置IP

---

### 2.2 更新前端环境变量示例

**文件**：`.env.example`

**添加内容**：
```bash
# ==========================================
# LexiCapture 前端环境变量
# ==========================================

# API 地址配置（可选，默认 http://localhost:4000）
# 如需手机访问，设置为电脑IP地址，例如：
# NEXT_PUBLIC_API_URL=http://192.168.0.100:4000
```

---

### 2.3 更新 Next.js 配置

**文件**：`next.config.ts`

**当前配置**：
```typescript
allowedDevOrigins: [
  'http://192.168.0.100:9002',
  'http://192.168.168.1:9002',
  // ... 多个硬编码IP
],
```

**修改为**：
```typescript
allowedDevOrigins: [
  'http://localhost:9002',
  'http://127.0.0.1:9002',
  'http://0.0.0.0:9002',
  // 从环境变量读取额外的origin（用逗号分隔）
  ...(process.env.ALLOWED_ORIGINS?.split(',') || []),
],
```

**说明**：
- 保留常用的本地开发地址
- 通过环境变量 `ALLOWED_ORIGINS` 支持动态添加（如手机访问时的IP）
- 用户可以在 `.env.local` 中设置：`ALLOWED_ORIGINS=http://192.168.0.100:9002`

---

### 2.4 创建根目录 README.md

**文件**：`README.md`（完全重写）

**内容结构**：
```markdown
# LexiCapture - AI 英语单词学习应用

基于 Next.js + Express + Prisma + SQLite 的全栈应用，
帮助用户通过 AI 采集、学习和管理英语单词。

## 功能特性

- 📸 拍照/上传识别单词
- 🤖 AI 自动生成释义、例句、搭配
- 📚 单词本管理（分组、筛选、搜索）
- ✏️ 练习题生成（选择题/填空/句子重组）
- 📖 故事生成（基于单词本内容）
- 📝 作文批改（IELTS Task 2 风格）
- 📄 文章阅读与分析
- 🎧 听说训练（ASR/TTS）

## 快速开始

### 前置要求

- Node.js 18+ 
- npm 或 yarn
- AI API 密钥（Kimi/OpenAI 兼容）

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd ai-Englishlearn
```

### 2. 安装依赖

**Windows**：
```bash
.\install.bat
```

**Mac/Linux**：
```bash
./install.sh
```

或手动安装：
```bash
# 安装前端依赖
npm install

# 安装后端依赖
cd server && npm install && cd ..
```

### 3. 配置环境变量

```bash
# 前端配置（可选）
cp .env.example .env.local

# 后端配置（必需）
cp server/.env.example server/.env
```

**编辑 `server/.env`**，配置以下必填项：

```bash
# AI 配置（至少配置一个）
OPENAI_API_KEY=your-api-key-here
OPENAI_BASE_URL=https://api.kimi.com/coding/
OPENAI_MODEL=kimi-k2.5

# JWT 密钥（用于用户认证，随便填32位以上字符）
JWT_SECRET=your-super-secret-key-min-32-characters
```

### 4. 初始化数据库

```bash
cd server
npx prisma db push
cd ..
```

### 5. 启动项目

**Windows**：
```bash
.\start.bat
```

**Mac/Linux**：
```bash
./start.sh
```

或手动启动：
```bash
# 终端1：启动后端
cd server && npm run dev

# 终端2：启动前端
npm run dev
```

### 6. 访问应用

- 电脑浏览器：http://localhost:9002
- 手机访问（同一WiFi）：http://<电脑IP>:9002

---

## 手机访问配置（可选）

如需手机访问：

1. **查看电脑IP**：
   ```bash
   # Windows
   ipconfig
   
   # Mac/Linux
   ifconfig
   ```

2. **配置前端环境变量**：
   编辑 `.env.local`：
   ```bash
   NEXT_PUBLIC_API_URL=http://<电脑IP>:4000
   ALLOWED_ORIGINS=http://<电脑IP>:9002
   ```

3. **重启前端服务**

4. **手机浏览器访问**：http://<电脑IP>:9002

---

## 项目结构

```
ai-Englishlearn/
├── src/                    # 前端代码
│   ├── app/               # Next.js App Router
│   ├── components/        # React 组件
│   ├── lib/               # 工具函数
│   └── hooks/             # 自定义 Hooks
├── server/                # 后端代码
│   ├── src/              # 源代码
│   ├── prisma/           # 数据库模型
│   └── .env              # 后端环境变量
├── docs/                  # 项目文档
├── start.bat             # Windows 启动脚本
├── start.sh              # Mac/Linux 启动脚本
├── install.bat           # Windows 安装脚本
└── install.sh            # Mac/Linux 安装脚本
```

---

## 开发文档

- [后端 API 文档](server/README.md)
- [项目变更记录](docs/CHANGELOG.md)
- [跨设备访问方案](docs/CROSS_DEVICE_SETUP.md)

---

## 技术栈

- **前端**：Next.js 15 + React 18 + TypeScript + Tailwind CSS + shadcn/ui
- **后端**：Express 5 + Prisma + SQLite
- **AI**：Kimi/OpenAI 兼容 API
- **部署**：支持 Vercel/Firebase/自建服务器

---

## License

MIT
```

---

### 2.5 创建一键安装脚本

#### Windows 安装脚本

**文件**：`install.bat`

```bat
@echo off
chcp 65001 >nul
echo ==========================================
echo    LexiCapture 安装脚本
echo ==========================================
echo.

REM 检查 Node.js
node -v >nul 2>&1
if errorlevel 1 (
    echo 错误：未检测到 Node.js，请先安装 Node.js 18+
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)

echo [1/4] 安装前端依赖...
call npm install
if errorlevel 1 (
    echo 前端依赖安装失败！
    pause
    exit /b 1
)

echo [2/4] 安装后端依赖...
cd server
call npm install
if errorlevel 1 (
    echo 后端依赖安装失败！
    cd ..
    pause
    exit /b 1
)
cd ..

echo [3/4] 创建环境变量文件...
if not exist ".env.local" (
    copy .env.example .env.local
    echo 已创建 .env.local
) else (
    echo .env.local 已存在，跳过
)

if not exist "server\.env" (
    copy server\.env.example server\.env
    echo 已创建 server\.env
) else (
    echo server\.env 已存在，跳过
)

echo [4/4] 初始化数据库...
cd server
call npx prisma db push
if errorlevel 1 (
    echo 数据库初始化失败！
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo ==========================================
echo 安装完成！
echo ==========================================
echo.
echo 下一步：
echo 1. 编辑 server\.env 文件，配置 AI API 密钥
echo 2. 运行 .\start.bat 启动项目
echo.
pause
```

#### Mac/Linux 安装脚本

**文件**：`install.sh`

```bash
#!/bin/bash

echo "=========================================="
echo "   LexiCapture 安装脚本"
echo "=========================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误：未检测到 Node.js，请先安装 Node.js 18+"
    echo "下载地址：https://nodejs.org/"
    exit 1
fi

echo "[1/4] 安装前端依赖..."
npm install
if [ $? -ne 0 ]; then
    echo "前端依赖安装失败！"
    exit 1
fi

echo "[2/4] 安装后端依赖..."
cd server && npm install && cd ..
if [ $? -ne 0 ]; then
    echo "后端依赖安装失败！"
    exit 1
fi

echo "[3/4] 创建环境变量文件..."
[ ! -f .env.local ] && cp .env.example .env.local && echo "已创建 .env.local"
[ ! -f server/.env ] && cp server/.env.example server/.env && echo "已创建 server/.env"

echo "[4/4] 初始化数据库..."
cd server && npx prisma db push && cd ..
if [ $? -ne 0 ]; then
    echo "数据库初始化失败！"
    exit 1
fi

echo ""
echo "=========================================="
echo "安装完成！"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 编辑 server/.env 文件，配置 AI API 密钥"
echo "2. 运行 ./start.sh 启动项目"
echo ""
read -p "按回车键继续..."
```

**记得给脚本添加执行权限**：
```bash
chmod +x install.sh start.sh
```

---

### 2.6 更新 .gitignore

**文件**：`.gitignore`

**添加以下内容**：
```gitignore
# ==========================================
# Server (后端)
# ==========================================
/server/node_modules
/server/dist
/server/.env
/server/*.db
/server/*.db-journal
/server/prisma/migrations/

# ==========================================
# IDE
# ==========================================
.idea/
.vscode/
*.swp
*.swo
*~

# ==========================================
# OS
# ==========================================
.DS_Store
Thumbs.db
desktop.ini

# ==========================================
# Environment
# ==========================================
.env.local
.env.*.local
!.env.example
!server/.env.example
```

---

### 2.7 更新后端环境变量示例

**文件**：`server/.env.example`

**更新为**：
```bash
# ==========================================
# LexiCapture 后端环境变量
# ==========================================

# 服务器配置
PORT=4000
# CORS 允许的源，开发环境使用 * 允许所有
CLIENT_URL=*

# 数据库 (SQLite 文件路径，会自动创建)
DATABASE_URL="file:./dev.db"

# JWT 密钥 (至少32位字符，用于用户认证)
# 可以使用：node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=change-this-to-a-random-string-at-least-32-characters

# ==========================================
# AI 配置 (OpenAI 兼容格式)
# 支持：Kimi、DeepSeek、OpenAI 等
# ==========================================

AI_PROVIDER=openai

# Kimi API 示例
OPENAI_API_KEY=your-kimi-api-key-here
OPENAI_BASE_URL=https://api.kimi.com/coding/
OPENAI_MODEL=kimi-k2.5

# 其他可选配置
AI_TIMEOUT_MS=120000
AI_MAX_RETRIES=2

# ==========================================
# 其他 AI 提供商参考配置
# ==========================================

# DeepSeek
# OPENAI_BASE_URL=https://api.deepseek.com/v1
# OPENAI_MODEL=deepseek-chat

# OpenAI 官方
# OPENAI_BASE_URL=https://api.openai.com/v1
# OPENAI_MODEL=gpt-4o-mini
```

---

### 2.8 更新启动脚本

#### Windows 启动脚本

**文件**：`start.bat`

```bat
@echo off
chcp 65001 >nul
echo ==========================================
echo    LexiCapture 启动脚本
echo ==========================================
echo.

REM 检查环境变量文件
if not exist "server\.env" (
    echo 错误：server\.env 文件不存在！
    echo 请先运行 install.bat 或手动复制 server\.env.example 为 server\.env
    pause
    exit /b 1
)

echo 正在启动服务...
echo.

REM 获取IP地址（用于显示）
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "WiFi" -A 4 ^| findstr "IPv4" 2^>nul') do (
    set IP=%%a
    set IP=!IP: =!
    goto :found
)
:found
if not defined IP set IP=localhost

echo 访问地址：
echo - 电脑：http://localhost:9002
echo - 手机：http://%IP%:9002 （需同一WiFi）
echo.

REM 启动后端
echo [1/2] 启动后端服务（端口4000）...
start "后端服务" cmd /k "cd server && npm run dev"

REM 等待后端启动
timeout /t 3 /nobreak >nul

REM 启动前端
echo [2/2] 启动前端服务（端口9002）...
start "前端服务" cmd /k "npm run dev"

echo.
echo 服务启动中，请稍候...
echo 浏览器将自动打开 http://localhost:9002
echo.

REM 自动打开浏览器（可选）
timeout /t 5 /nobreak >nul
start http://localhost:9002

pause
```

#### Mac/Linux 启动脚本

**文件**：`start.sh`

```bash
#!/bin/bash

echo "=========================================="
echo "   LexiCapture 启动脚本"
echo "=========================================="
echo ""

# 检查环境变量文件
if [ ! -f "server/.env" ]; then
    echo "错误：server/.env 文件不存在！"
    echo "请先运行 ./install.sh 或手动复制 server/.env.example 为 server/.env"
    exit 1
fi

# 获取IP地址
IP=$(ifconfig | grep -E "inet 192|inet 10" | head -1 | awk '{print $2}')
[ -z "$IP" ] && IP="localhost"

echo "访问地址："
echo "- 电脑：http://localhost:9002"
echo "- 手机：http://$IP:9002 （需同一WiFi）"
echo ""

# 启动后端
echo "[1/2] 启动后端服务（端口4000）..."
osascript -e 'tell app "Terminal" to do script "cd '"$(pwd)"'/server && npm run dev"' 2>/dev/null || \
    (cd server && npm run dev &)

# 等待后端启动
sleep 3

# 启动前端
echo "[2/2] 启动前端服务（端口9002）..."
npm run dev &

echo ""
echo "服务启动中，请稍候..."
echo ""

# 自动打开浏览器
sleep 5
open http://localhost:9002 2>/dev/null || xdg-open http://localhost:9002 2>/dev/null || echo "请手动打开 http://localhost:9002"

read -p "按回车键关闭所有服务..."

# 关闭服务
pkill -f "npm run dev"
```

---

## 3. 用户操作流程（实施后）

### 拉取项目后的完整流程

```bash
# 1. 克隆项目
git clone <repo-url>
cd ai-Englishlearn

# 2. 一键安装（Windows）
.\install.bat

# 3. 配置 AI 密钥
# 编辑 server/.env，填入自己的 API Key

# 4. 启动项目
.\start.bat
```

**需要手动配置的只有**：
- `server/.env` 中的 AI API 密钥（用户自己申请）

---

## 4. 检查清单（实施前确认）

- [ ] 方案已确认无误
- [ ] 备份当前代码
- [ ] 准备测试环境
- [ ] 确认敏感信息已排除（API Key、密码等）

---

## 5. 相关文件路径汇总

| 文件 | 路径 | 修改类型 |
|------|------|----------|
| API客户端 | `src/lib/api-client.ts` | 修改 |
| 前端环境示例 | `.env.example` | 修改/新增 |
| Next.js配置 | `next.config.ts` | 修改 |
| 根目录README | `README.md` | 重写 |
| Windows安装脚本 | `install.bat` | 新增 |
| Mac/Linux安装脚本 | `install.sh` | 新增 |
| Windows启动脚本 | `start.bat` | 更新 |
| Mac/Linux启动脚本 | `start.sh` | 新增 |
| Git忽略文件 | `.gitignore` | 更新 |
| 后端环境示例 | `server/.env.example` | 更新 |

---

## 6. 注意事项

1. **AI API Key 安全**：确保 `server/.env` 不会被提交到 GitHub
2. **JWT Secret**：用户可以自己生成随机字符串
3. **数据库**：SQLite 文件（`dev.db`）会被自动创建，无需手动配置
4. **跨平台**：脚本需要分别在 Windows 和 Mac/Linux 上测试
5. **Node.js版本**：建议在文档中注明需要 Node.js 18+

---

**方案制定完成，等待用户确认后实施。**
