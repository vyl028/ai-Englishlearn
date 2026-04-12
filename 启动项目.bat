@echo off
chcp 65001 >nul
title LexiCapture 启动器

echo ================================================
echo         LexiCapture 一键启动脚本
echo ================================================
echo.

:: 获取本机局域网 IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4.*192\."') do (
    set LOCAL_IP=%%a
)
:: 去除前导空格
set LOCAL_IP=%LOCAL_IP: =%

:: 如果没找到 192.x.x.x，尝试 10.x.x.x
if "%LOCAL_IP%"=="" (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4.*10\."') do (
        set LOCAL_IP=%%a
    )
    set LOCAL_IP=%LOCAL_IP: =%
)

:: 如果还没找到，用 localhost 兜底
if "%LOCAL_IP%"=="" (
    set LOCAL_IP=localhost
)

echo [信息] 检测到本机 IP：%LOCAL_IP%
echo.
echo  电脑访问地址：http://localhost:9002
echo  手机访问地址：http://%LOCAL_IP%:9002
echo  （手机和电脑需在同一 WiFi 下）
echo.
echo ================================================
echo.

:: 切换到项目根目录
cd /d "%~dp0"

:: 写入前端环境变量，让前端 API 请求走局域网 IP（手机和电脑均可用）
echo NEXT_PUBLIC_API_URL=http://%LOCAL_IP%:4000 > .env.local

:: 写入后端 CORS 允许来源（同时允许 localhost 和局域网 IP）
:: 这里不改动 server/.env，改用环境变量覆盖

echo [1/2] 正在启动后端服务器（端口 4000）...
start "LexiCapture 后端" cmd /k "cd /d "%~dp0server" && set CLIENT_URL=http://%LOCAL_IP%:9002 && npm run dev"

:: 等待后端启动
timeout /t 3 /nobreak >nul

echo [2/2] 正在启动前端服务器（端口 9002）...
start "LexiCapture 前端" cmd /k "cd /d "%~dp0" && npm run dev"

echo.
echo ================================================
echo  两个服务器窗口已打开，请等待约 10 秒启动完成
echo.
echo  电脑访问：http://localhost:9002
echo  手机访问：http://%LOCAL_IP%:9002
echo ================================================
echo.

:: 10 秒后自动在浏览器打开
timeout /t 10 /nobreak
start http://localhost:9002

