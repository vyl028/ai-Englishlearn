@echo off
chcp 65001 >nul
echo ==========================================
echo    LexiCapture 启动脚本
echo ==========================================
echo.
echo 当前电脑IP地址：192.168.0.100
echo.
echo 【访问地址】
echo - 电脑访问：http://localhost:9002
echo - 手机访问：http://192.168.0.100:9002
echo.
echo 【重要提示】
echo 1. 手机和电脑必须连接同一个WiFiecho 2. 如果IP地址变了（换WiFi后），需要更新以下文件：
echo    - src/lib/api-client.ts
echo    - server/src/index.ts
echo    - next.config.ts
echo.
echo 按任意键开始启动...
pause >nul

echo.
echo 正在启动后端服务（端口4000）...
start "后端服务" cmd /k "cd server && npm run dev"

timeout /t 3 /nobreak >nul

echo 正在启动前端服务（端口9002）...
start "前端服务" cmd /k "npm run dev"

echo.
echo ==========================================
echo 服务启动中，请等待...
echo ==========================================
echo.
echo 后端地址：http://192.168.0.100:4000
echo 前端地址：http://192.168.0.100:9002
echo.
pause
