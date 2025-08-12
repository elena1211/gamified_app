#!/bin/bash

echo "🚀 LevelUp 應用快速部署腳本"
echo "=============================="

# 檢查是否在正確目錄
if [ ! -f "manage.py" ]; then
    echo "❌ 請在項目根目錄運行此腳本"
    exit 1
fi

# 檢查是否有 git
if ! command -v git &> /dev/null; then
    echo "❌ 需要安裝 Git"
    exit 1
fi

# 檢查是否有 node 和 npm
if ! command -v node &> /dev/null; then
    echo "❌ 需要安裝 Node.js"
    exit 1
fi

echo "📦 安裝後端依賴..."
pip install -r requirements.txt

echo "📦 安裝前端依賴..."
cd frontend
npm install

echo "🏗️  構建前端..."
npm run build

echo "🗄️  收集靜態文件..."
cd ..
python manage.py collectstatic --noinput

echo "📝 檢查遷移狀態..."
python manage.py makemigrations
python manage.py migrate

echo "✅ 本地測試..."
echo "啟動後端服務器進行測試..."
python manage.py runserver &
SERVER_PID=$!

sleep 3

# 檢查服務器是否正常運行
if curl -f http://localhost:8000/api/ &> /dev/null; then
    echo "✅ 後端服務器正常運行"
else
    echo "⚠️  後端服務器可能有問題，請檢查"
fi

# 停止測試服務器
kill $SERVER_PID 2>/dev/null

echo ""
echo "🎯 準備提交到 Git..."
git add .

# 檢查是否有未提交的更改
if git diff --staged --quiet; then
    echo "ℹ️  沒有新的更改需要提交"
else
    echo "提交訊息 (按 Enter 使用預設訊息):"
    read -r commit_message
    if [ -z "$commit_message" ]; then
        commit_message="Deploy: Prepare for production deployment $(date '+%Y-%m-%d %H:%M:%S')"
    fi
    
    git commit -m "$commit_message"
    echo "✅ 更改已提交"
fi

echo ""
echo "🌐 推送到 GitHub..."
if git push origin main; then
    echo "✅ 代碼已成功推送到 GitHub"
else
    echo "⚠️  推送失敗，請檢查 Git 配置"
fi

echo ""
echo "🎉 部署準備完成！"
echo ""
echo "下一步:"
echo "1. 前往 Railway.app 部署後端"
echo "2. 前往 Vercel.com 部署前端"
echo "3. 詳細步驟請參考 DEPLOYMENT.md"
echo ""
echo "🔗 有用的連結:"
echo "- Railway: https://railway.app"
echo "- Vercel: https://vercel.com"
echo "- 部署指南: ./DEPLOYMENT.md"
