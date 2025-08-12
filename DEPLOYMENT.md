# 🚀 部署指南

## 方案 1: Railway (後端) + Vercel (前端) - 推薦

### 後端部署到 Railway

1. **註冊 Railway 賬號**
   - 前往 [Railway.app](https://railway.app)
   - 使用 GitHub 登入

2. **連接 GitHub 倉庫**
   ```bash
   # 先推送代碼到 GitHub
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

3. **創建 Railway 項目**
   - 點擊 "New Project"
   - 選擇 "Deploy from GitHub repo"
   - 選擇你的倉庫
   - Railway 會自動檢測到 Django 項目

4. **配置環境變數**
   在 Railway 項目設置中添加：
   ```
   SECRET_KEY=your-super-secret-key-here
   DEBUG=False
   DATABASE_URL=自動生成的 PostgreSQL URL
   ```

5. **自動部署**
   - Railway 會自動安裝依賴並部署
   - 獲取部署 URL (例如：https://your-app.railway.app)

### 前端部署到 Vercel

1. **註冊 Vercel 賬號**
   - 前往 [Vercel.com](https://vercel.com)
   - 使用 GitHub 登入

2. **導入項目**
   - 點擊 "New Project"
   - 選擇你的 GitHub 倉庫
   - 設置根目錄為 `frontend/`

3. **配置構建設置**
   ```
   Framework Preset: Vite
   Root Directory: frontend/
   Build Command: npm run build
   Output Directory: dist/
   ```

4. **設置環境變數**
   ```
   VITE_API_URL=https://your-backend.railway.app/api
   ```

5. **部署完成**
   - Vercel 會自動構建並部署
   - 獲取前端 URL (例如：https://your-app.vercel.app)

### 最後步驟

1. **更新 Django CORS 設置**
   在 Railway 環境變數中添加：
   ```
   FRONTEND_URL=https://your-app.vercel.app
   ```

2. **測試部署**
   - 訪問你的 Vercel URL
   - 確保前後端連接正常

## 方案 2: Render (一體化部署)

### 後端部署到 Render

1. **註冊 Render 賬號**
   - 前往 [Render.com](https://render.com)

2. **創建 Web Service**
   - 選擇 "New" → "Web Service"
   - 連接 GitHub 倉庫
   - 設置：
     ```
     Build Command: pip install -r requirements.txt
     Start Command: gunicorn backend.wsgi:application
     ```

3. **配置環境變數**
   ```
   SECRET_KEY=your-secret-key
   DEBUG=False
   DATABASE_URL=自動生成
   ```

### 前端部署到 Netlify

1. **註冊 Netlify 賬號**
   - 前往 [Netlify.com](https://netlify.com)

2. **部署設置**
   ```
   Base directory: frontend/
   Build command: npm run build
   Publish directory: frontend/dist/
   ```

3. **環境變數**
   ```
   VITE_API_URL=https://your-backend.onrender.com/api
   ```

## 快速部署腳本

創建一個自動化部署腳本：

```bash
#!/bin/bash
echo "🚀 開始部署 LevelUp 應用..."

# 檢查是否在正確目錄
if [ ! -f "manage.py" ]; then
    echo "❌ 請在項目根目錄運行此腳本"
    exit 1
fi

# 構建前端
echo "📦 構建前端..."
cd frontend
npm install
npm run build

# 回到根目錄
cd ..

# 提交所有更改
echo "📝 提交更改到 Git..."
git add .
git commit -m "Deploy: $(date)"
git push origin main

echo "✅ 代碼已推送到 GitHub!"
echo "🌐 現在請到 Railway 和 Vercel 完成部署設置"
```

## 部署檢查清單

- [ ] requirements.txt 包含所有依賴
- [ ] settings_prod.py 配置正確
- [ ] 環境變數設置完成
- [ ] CORS 配置更新
- [ ] 前端 API URL 配置正確
- [ ] 數據庫遷移完成
- [ ] 靜態文件收集正常
- [ ] 測試部署成功

## 故障排除

### 常見問題

1. **CORS 錯誤**
   ```python
   # 在 settings_prod.py 中確保
   CORS_ALLOWED_ORIGINS = [
       "https://your-frontend-domain.vercel.app",
   ]
   ```

2. **靜態文件 404**
   ```python
   # 確保 WhiteNoise 配置正確
   MIDDLEWARE = [
       'whitenoise.middleware.WhiteNoiseMiddleware',
       # ... 其他中間件
   ]
   ```

3. **數據庫連接錯誤**
   ```python
   # 檢查 DATABASE_URL 環境變數
   DATABASES = {
       'default': dj_database_url.parse(os.environ.get('DATABASE_URL'))
   }
   ```

## 成本估算

- **Railway**: 免費額度每月 $5 credit (足夠小型應用)
- **Vercel**: 免費額度包含個人項目
- **總成本**: 基本上免費使用

## 下一步

部署成功後：
1. 設置自定義域名
2. 配置 SSL 證書 (自動)
3. 設置監控和日誌
4. 優化性能和 SEO

🎉 **恭喜！你的 LevelUp 應用現在已經上線了！**
