# 花卉電商示範網站（Flower E-Commerce Demo）

全端花卉電商應用，以 Node.js / Express 為核心，具備完整的商品瀏覽、購物車、結帳、訂單管理、以及管理員後台功能。

## 技術棧

| 層級 | 技術 | 版本 | 用途 |
|------|------|------|------|
| Web 框架 | Express.js | ~4.16.1 | REST API + 靜態路由 |
| 資料庫 | better-sqlite3 | ^12.8.0 | 同步 SQLite 操作 |
| 認證 | jsonwebtoken | ^9.0.2 | JWT HS256，7 天有效 |
| 密碼雜湊 | bcrypt | ^6.0.0 | 10 rounds（測試環境 1 round）|
| 伺服器渲染 | EJS | ^5.0.1 | HTML 頁面模板 |
| 前端框架 | Vue 3 | CDN | 頁面互動（CSR）|
| CSS 框架 | Tailwind CSS | ^4.2.2 | 樣式工具集 |
| API 文件 | swagger-jsdoc | ^6.2.8 | OpenAPI 3.0 規格產生 |
| 測試框架 | Vitest + Supertest | ^2.1.9 / ^7.2.2 | API 整合測試 |
| ID 產生 | uuid | ^11.1.0 | 所有資料表主鍵 |

## 快速開始

### 環境需求

- Node.js >= 18
- npm >= 9

### 安裝步驟

```bash
# 1. 複製環境變數範本
cp .env.example .env

# 2. 編輯 .env，至少設定以下必填項目
#    JWT_SECRET=your-secret-key

# 3. 安裝依賴套件
npm install

# 4. 啟動開發伺服器（含 CSS 編譯）
npm start
```

伺服器啟動後，開啟瀏覽器至 `http://localhost:3001`。

### 分開啟動（開發模式）

```bash
# 終端機 1：啟動後端
npm run dev:server

# 終端機 2：監聽 CSS 變更
npm run dev:css
```

### 預設帳號

資料庫初始化時自動建立管理員帳號（來自 `.env` 的 `ADMIN_EMAIL` / `ADMIN_PASSWORD`）：

| 角色 | Email | 密碼 |
|------|-------|------|
| 管理員 | admin@hexschool.com | 12345678 |

> 一般用戶可透過 `/login` 頁面點選「快速註冊測試帳號」。

## 常用指令表

| 指令 | 說明 |
|------|------|
| `npm start` | 編譯 CSS 後啟動生產伺服器 |
| `npm run dev:server` | 單獨啟動後端（不處理 CSS）|
| `npm run dev:css` | 監聽模式編譯 CSS |
| `npm run css:build` | 一次性編譯並 minify CSS |
| `npm run openapi` | 產生 `openapi.json` 規格文件 |
| `npm test` | 執行所有整合測試 |

## 文件索引

| 文件 | 內容 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 目錄結構、資料流、API 路由總覽、資料庫 schema |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 開發規範、命名規則、新增功能步驟、環境變數說明 |
| [FEATURES.md](./FEATURES.md) | 所有功能的行為描述、請求參數、業務邏輯、錯誤碼 |
| [TESTING.md](./TESTING.md) | 測試架構、測試案例說明、撰寫新測試的步驟 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本更新歷史 |
| [../CLAUDE.md](../CLAUDE.md) | Claude Code 專用：關鍵規則與快捷指令 |
