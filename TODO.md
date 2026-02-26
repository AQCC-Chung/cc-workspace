# CC Workspace — 未來待辦

## 📋 重構 & 架構
- [ ] **前端 `.jsx → .tsx` 遷移** — 在現有版本上逐檔遷移（App、Navbar、TasteMap、Home、Flights、MeetNote），加入 type annotations
- [ ] **後端拆分 routers/models/services** — 參考 Jules 架構，將 `main.py` 拆成模組化結構（保留現有 `query_parser.py`、`scraper.py`）
- [ ] **共用型別抽出** — 建立 `src/types/index.ts`，集中管理 `Recommendation`、`SearchResult` 等前端型別

## 💪 FitTracker
- [ ] **BMI 顯示** — 在日曆或首頁顯示 BMI 指標
- [ ] **體重趨勢圖** — 體重隨時間的折線圖
- [ ] **訓練量/體重比** — 相對力量指標
- [ ] **RPE 趨勢分析** — 各動作的 RPE 走勢，疲勞預警

## 🏗️ DevOps
- [ ] **Docker 本地開發** — `docker-compose up` 一鍵啟動前後端（已加入 Dockerfile）
- [ ] **CI/CD 優化** — code-splitting 減小 bundle size（目前 556KB）
