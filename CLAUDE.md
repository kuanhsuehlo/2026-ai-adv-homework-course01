# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

**花卉電商示範網站（Flower E-Commerce Demo）** — Express.js + SQLite + EJS + Vue 3 + Tailwind CSS

全端花卉電商應用，包含：公開商品瀏覽、訪客/登入購物車、JWT 認證、訂單管理、模擬付款、以及管理員後台。後端採 REST API 架構，前端使用 EJS 伺服器端渲染 + Vue 3 CSR 互動。

## 常用指令

```bash
# 開發（分兩個終端機）
node server.js                    # 啟動後端（Port 3001）
npx @tailwindcss/cli -i public/css/input.css -o public/css/output.css --watch  # 監聽 CSS

# 一次性啟動（含 CSS 編譯）
npm start

# 執行所有測試（必須依序）
npm test

# 執行單一測試檔案
npx vitest run tests/auth.test.js

# 產生 OpenAPI 規格文件
npm run openapi

# 編譯 CSS（生產用，minify）
npm run css:build
```

**環境需求：** `.env` 必須包含 `JWT_SECRET`，否則 `server.js` 啟動時會強制 `process.exit(1)`。複製 `.env.example` 並填入值。

## 架構重點

**模組系統：** 全專案使用 CommonJS（`require` / `module.exports`），無 ES modules。

**請求生命週期：**
```
server.js → app.js → middleware (cors/json/static) → routes → errorHandler
```

**中介層組合規則：**
- 一般登入路由：`authMiddleware`
- 管理員路由：`authMiddleware` + `adminMiddleware`（順序不可顛倒）
- 購物車路由：`dualAuth()`（定義在 `cartRoutes.js`）—— 先嘗試 JWT，再 fallback 到 `X-Session-Id` header；**絕對不可**只用 `authMiddleware`

## 關鍵規則

- **資料庫同步 API**：`better-sqlite3` 為同步操作，所有 DB 呼叫不需 `await`。
- **統一回應格式**：所有 API 回應必須符合 `{ data, error, message }` 結構；不可直接回傳裸物件。
- **訂單建立必須用 Transaction**：在 `db.transaction()` 內依序執行：INSERT orders → INSERT order_items（含 name/price 快照）→ UPDATE products stock → DELETE cart_items。任一步驟失敗全部 rollback。
- **刪除商品需先檢查 pending 訂單**：有 pending 訂單的商品回傳 409 Conflict。
- **order_items 儲存快照**：`product_name` 與 `product_price` 於下單時複製，不受後續商品更新影響。
- **功能開發使用 `docs/plans/` 記錄計畫；完成後移至 `docs/plans/archive/`**。

## 測試架構

- 使用 Vitest + Supertest，針對真實 SQLite 執行整合測試（不使用 mock）。
- `vitest.config.js` 設定 `fileParallelism: false`，測試檔案必須依序執行。
- 共用輔助函式在 `tests/setup.js`：`getAdminToken()`、`registerUser(overrides)`。
- 每個測試自行建立獨立測試資料（以 `Date.now()` 確保 email 唯一性）。

## 詳細文件

- [./docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 架構、目錄結構、資料流、DB Schema
- [./docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — 開發規範、命名規則、環境變數
- [./docs/FEATURES.md](./docs/FEATURES.md) — 功能列表、所有端點的 request/response 格式
- [./docs/TESTING.md](./docs/TESTING.md) — 測試規範與指南
- [./docs/CHANGELOG.md](./docs/CHANGELOG.md) — 更新日誌
