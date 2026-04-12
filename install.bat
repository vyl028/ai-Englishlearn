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
    copy .env.example .env.local >nul
    echo 已创建 .env.local
) else (
    echo .env.local 已存在，跳过
)

if not exist "server\.env" (
    copy server\.env.example server\.env >nul
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
echo 1. 编辑 server\.env 文件，填入你的 AI API 密钥
echo 2. 运行 .\start.bat 启动项目
echo.
pause
