#!/bin/bash
# 多平台内容发布工具 - 一键安装运行脚本 (Linux/Mac)

set -e

echo "========================================"
echo "  多平台内容发布工具"
echo "========================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js，请先安装 Node.js 18+"
    echo "   安装方法：https://nodejs.org/"
    echo "   或: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt install nodejs -y"
    exit 1
fi

echo "✅ Node.js $(node -v)"

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
else
    echo "📦 依赖已就绪"
fi

# 检查端口
if command -v lsof &> /dev/null; then
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  端口 3000 已被占用，正在释放..."
        kill $(lsof -t -i:3000) 2>/dev/null || true
        sleep 1
    fi
fi

# 启动服务
echo ""
echo "🚀 启动服务..."
echo "   访问地址: http://localhost:3000"
echo "   按 Ctrl+C 停止服务"
echo ""

node server.js
