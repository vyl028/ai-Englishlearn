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

# 获取本机局域网 IP
LOCAL_IP=$(ip route get 1 2>/dev/null | awk '{print $7; exit}')
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP=$(ifconfig 2>/dev/null | grep -E "inet (192|10|172)\." | head -1 | awk '{print $2}')
fi
if [ -z "$LOCAL_IP" ]; then
    LOCAL_IP="localhost"
fi

echo "【访问地址】"
echo "- 电脑浏览器：http://localhost:9002"
if [ "$LOCAL_IP" != "localhost" ]; then
    echo "- 手机访问（同一WiFi）：http://$LOCAL_IP:9002"
fi
echo ""

# 启动后端（在新终端窗口中）
echo "[1/2] 启动后端服务（端口 4000）..."
if command -v osascript &>/dev/null; then
    # macOS
    osascript -e "tell app \"Terminal\" to do script \"cd '$(pwd)/server' && npm run dev\""
elif command -v gnome-terminal &>/dev/null; then
    gnome-terminal -- bash -c "cd '$(pwd)/server' && npm run dev; exec bash"
elif command -v xterm &>/dev/null; then
    xterm -e "cd '$(pwd)/server' && npm run dev" &
else
    (cd server && npm run dev) &
    BACKEND_PID=$!
fi

sleep 3

# 启动前端
echo "[2/2] 启动前端服务（端口 9002）..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=========================================="
echo "服务启动中，请稍候..."
echo "=========================================="
echo ""
echo "后端地址：http://localhost:4000"
echo "前端地址：http://localhost:9002"
echo ""

sleep 5

# 自动打开浏览器
if command -v open &>/dev/null; then
    open http://localhost:9002
elif command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:9002
fi

echo "按 Ctrl+C 关闭所有服务..."
wait
