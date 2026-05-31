@echo off
chcp 65001 >nul
echo ========================================
echo   多平台内容发布工具
echo ========================================
echo.

:: 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 未检测到 Node.js，请先安装 Node.js 18+
    echo   下载地址：https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✅ Node.js %NODE_VERSION%

:: 安装依赖
if not exist "node_modules\" (
    echo 📦 安装依赖...
    call npm install
    if %errorlevel% neq 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo 📦 依赖已就绪
)

:: 释放端口 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo ⚠️  端口 3000 已被占用，正在释放...
    taskkill /f /pid %%a >nul 2>nul
    timeout /t 2 /nobreak >nul
)

:: 启动服务
echo.
echo 🚀 启动服务...
echo   访问地址: http://localhost:3000
echo.

start http://localhost:3000
node server.js

pause
