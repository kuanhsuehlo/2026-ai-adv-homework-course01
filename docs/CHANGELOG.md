# CHANGELOG.md

本文件依 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.0.0/) 格式撰寫。

## [Unreleased]

## [1.0.0] - 2026-04-26

### 新增

- **用戶認證系統**
  - `POST /api/auth/register`：Email + 密碼 + 姓名註冊，回傳 JWT token
  - `POST /api/auth/login`：登入取得 7 天有效 JWT token
  - `GET /api/auth/profile`：取得已登入用戶資料
  - bcrypt 密碼雜湊（生產 10 rounds，測試 1 round）

- **商品目錄**
  - `GET /api/products`：商品列表（支援 page / limit 分頁）
  - `GET /api/products/:id`：商品詳情
  - 初始 8 筆花卉商品 seed 資料

- **購物車（雙模式）**
  - `GET /api/cart`：取得購物車內容（含小計）
  - `POST /api/cart`：加入商品（已存在則累加數量）
  - `PATCH /api/cart/:itemId`：更新品項數量
  - `DELETE /api/cart/:itemId`：移除品項
  - 同時支援 `Authorization: Bearer` 與 `X-Session-Id` header

- **訂單管理**
  - `POST /api/orders`：從購物車建立訂單（Transaction 原子操作：扣庫存 + 清購物車）
  - `GET /api/orders`：取得我的訂單列表
  - `GET /api/orders/:id`：訂單詳情
  - `PATCH /api/orders/:id/pay`：模擬付款（action: success / fail）
  - 訂單編號格式：`ORD-YYYYMMDD-XXXXX`
  - order_items 儲存商品名稱與價格快照

- **管理員商品管理**
  - `GET /api/admin/products`：管理員商品列表（分頁）
  - `POST /api/admin/products`：建立商品
  - `PUT /api/admin/products/:id`：更新商品（含 updated_at 自動更新）
  - `DELETE /api/admin/products/:id`：刪除商品（有 pending 訂單則拒絕，409）

- **管理員訂單管理**
  - `GET /api/admin/orders`：所有用戶訂單列表（支援 status 篩選）
  - `GET /api/admin/orders/:id`：訂單詳情（含用戶資訊）

- **前端頁面（EJS + Vue 3）**
  - 首頁商品列表、商品詳情、購物車、結帳、登入
  - 我的訂單列表、訂單詳情
  - 管理員商品管理、管理員訂單管理

- **基礎設施**
  - SQLite 資料庫（WAL mode、外鍵約束）
  - JWT 中介層、Admin 角色中介層、Session 中介層
  - 全域錯誤處理中介層
  - OpenAPI 3.0 規格產生（`npm run openapi`）
  - Tailwind CSS v4 樣式系統
  - Vitest + Supertest 整合測試（50+ 測試案例）
