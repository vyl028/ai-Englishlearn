@echo off
chcp 65001 >nul

:: Get local IP (192.x first, then 10.x)
set LOCAL_IP=
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4.*192\."') do (
    if "!LOCAL_IP!"=="" set LOCAL_IP=%%a
)
set LOCAL_IP=%LOCAL_IP: =%

if "%LOCAL_IP%"=="" (
    for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4.*10\."') do (
        if "!LOCAL_IP!"=="" set LOCAL_IP=%%a
    )
    set LOCAL_IP=%LOCAL_IP: =%
)

if "%LOCAL_IP%"=="" set LOCAL_IP=localhost

echo ================================================
echo   LexiCapture
echo ================================================
echo.
echo   IP: %LOCAL_IP%
echo.
echo   PC:     http://localhost:9002
echo   Mobile: http://%LOCAL_IP%:9002
echo.
echo ================================================
echo.

cd /d "%~dp0"

echo [1/2] Starting backend (port 4000)...
start "Backend" cmd /k "cd /d %~dp0server && npm run dev"

timeout /t 4 /nobreak >nul

echo [2/2] Starting frontend (port 9002)...
start "Frontend" cmd /k "cd /d %~dp0 && npm run dev"

echo.
echo   Waiting 15s then opening browser...
echo   PC:     http://localhost:9002
echo   Mobile: http://%LOCAL_IP%:9002
echo.

timeout /t 15 /nobreak
start http://localhost:9002
