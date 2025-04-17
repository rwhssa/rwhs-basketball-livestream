# 高中籃球賽事直播系統

這個系統允許使用者通過手機鏡頭進行高中籃球比賽的直播，並將畫面與即時分數整合後輸出至 Instagram Live。

## 系統架構

### 前端 (Svelte 5)
- **手機輸入頁面 (Camera)**: 手機端頁面，允許發布攝影機與麥克風流
- **管理員介面 (Admin)**: 多路畫面預覽與控制
- **輸出畫面 (Output)**: 作為 OBS 瀏覽器來源的垂直 9:16 畫面

### 後端 (Rust)
- **API 伺服器**: 提供 LiveKit 權杖與分數資料
- **WebSocket 服務**: 推送即時分數更新

### 外部服務
- **LiveKit**: 處理 WebRTC 連接
- **Google Sheets**: 分數資料來源
- **OBS**: 畫面擷取與直播
- **Instagram Live**: 最終輸出平台

## 系統需求

- Node.js (前端開發)
- Rust (後端開發)
- Docker & Docker Compose (部署)
- LiveKit Server
- VPS 伺服器

## 開始使用

### 後端設置

1. 安裝 Rust
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. 切換到後端目錄
   ```bash
   cd backend
   ```

3. 創建並配置環境檔案
   ```bash
   cp .env.example .env
   # 編輯 .env 文件，設定 API 金鑰和密碼
   ```

4. 運行後端伺服器
   ```bash
   cargo run
   ```

### 前端設置

1. 切換到前端目錄
   ```bash
   cd frontend
   ```

2. 安裝依賴
   ```bash
   npm install
   ```

3. 創建並配置環境檔案
   ```bash
   cp .env.example .env
   # 編輯 .env 文件，設定適當的後端 URL
   ```

4. 開發模式運行
   ```bash
   npm run dev
   ```

5. 生產模式建構
   ```bash
   npm run build
   ```

## 配置 LiveKit

1. 在後端目錄，檢查 `livekit.yaml` 配置

2. 確保 API 金鑰與密碼在 `.env` 文件中正確設定

## 部署指南

### 使用 Docker Compose

1. 從後端目錄運行
   ```bash
   docker-compose up -d
   ```

這將啟動:
- Rust 後端 API
- LiveKit 伺服器
- Nginx 反向代理

### 手動部署

1. 在 VPS 上安裝 LiveKit 伺服器
2. 建構並部署 Rust 後端
3. 建構並部署 Svelte 前端

## 使用流程

1. **準決賽模式**:
   - 兩支手機分別連接至不同場地的攝影機頁面
   - 管理員監看兩場比賽
   - 輸出頁面顯示兩場比賽的上下分割畫面

2. **決賽模式**:
   - 兩支手機從不同角度拍攝同一場比賽
   - 管理員可選擇主要視角
   - 輸出頁面顯示選中的單一視角

## Google Sheets 整合設定

1. 創建 Google Apps Script，監聽分數變動
2. 設定 Apps Script 向後端 API 發送分數更新

## OBS 設定

1. 添加「瀏覽器來源」，指向輸出頁面 URL
2. 設定來源尺寸為垂直 9:16 比例
3. 將 OBS 輸出設定為 Instagram Live 格式

## 故障排除

- **影像未顯示**: 檢查 WebRTC 連接與 TURN 伺服器配置
- **分數未更新**: 檢查 WebSocket 連接與 Google Apps Script 配置
- **LiveKit 連接問題**: 確認 API 金鑰與密碼設定正確