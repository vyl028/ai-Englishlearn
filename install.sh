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
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo "已创建 .env.local"
else
    echo ".env.local 已存在，跳过"
fi

if [ ! -f server/.env ]; then
    cp server/.env.example server/.env
    echo "已创建 server/.env"
else
    echo "server/.env 已存在，跳过"
fi

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
echo "1. 编辑 server/.env 文件，填入你的 AI API 密钥"
echo "2. 运行 ./start.sh 启动项目"
echo ""
