# ARCHITECTURE.md

## 目錄結構

```
.
├── app.js                      # Express app 組裝（middleware + 路由掛載）
├── server.js                   # 伺服器啟動入口（強制驗證 JWT_SECRET）
├── swagger-config.js           # OpenAPI 3.0 規格設定
├── generate-openapi.js         # 執行產生 openapi.json 的腳本
├── vitest.config.js            # 測試框架設定（sequential、timeout）
├── .env.example                # 環境變數範本
├── database.sqlite             # SQLite 資料庫檔案（git 忽略）
│
├── src/
│   ├── database.js             # DB 初始化、建表、seed 資料
│   └── middleware/
│   │   ├── authMiddleware.js   # JWT Bearer token 驗證 → req.user
│   │   ├── adminMiddleware.js  # role === 'admin' 檢查 → 403
│   │   ├── sessionMiddleware.js# 從 X-Session-Id header 取 sessionId → req.sessionId
│   │   └── errorHandler.js     # 全域錯誤捕捉，統一格式回應
│   └── routes/
│       ├── authRoutes.js       # /api/auth/* （register、login、profile）
│       ├── productRoutes.js    # /api/products/* （公開商品列表、詳情）
│       ├── cartRoutes.js       # /api/cart/* （訪客 + 登入雙模式）
│       ├── orderRoutes.js      # /api/orders/* （需登入）
│       ├── adminProductRoutes.js # /api/admin/products/* （需 admin）
│       ├── adminOrderRoutes.js # /api/admin/orders/* （需 admin）
│       └── pageRoutes.js       # 所有 GET 頁面路由（回傳 EJS 渲染結果）
│
├── public/
│   ├── js/
│   │   ├── api.js              # fetch 封裝，自動注入 auth headers
│   │   ├── auth.js             # localStorage 狀態管理（token、user、session）
│   │   ├── notification.js     # Toast 通知元件（自動消失）
│   │   ├── header-init.js      # 頁面 header 初始化（登入狀態、購物車數量）
│   │   └── pages/
│   │       ├── index.js        # 首頁商品列表（Vue 3 app）
│   │       ├── product-detail.js # 商品詳情頁（Vue 3 app）
│   │       ├── cart.js         # 購物車頁（Vue 3 app）
│   │       ├── checkout.js     # 結帳頁（Vue 3 app）
│   │       ├── login.js        # 登入 / 快速註冊頁（Vue 3 app）
│   │       ├── orders.js       # 訂單列表頁（Vue 3 app）
│   │       ├── order-detail.js # 訂單詳情頁（Vue 3 app）
│   │       ├── admin-products.js # 管理員商品管理（Vue 3 app）
│   │       └── admin-orders.js # 管理員訂單管理（Vue 3 app）
│   ├── css/
│   │   ├── input.css           # Tailwind 指令入口（@import "tailwindcss"）
│   │   └── output.css          # 編譯結果（git 忽略，由 npm run css:build 產生）
│   └── stylesheets/
│       └── style.css           # 自訂樣式（補充 Tailwind 不足之處）
│
├── views/
│   ├── layouts/
│   │   ├── front.ejs           # 公開頁面 layout（head + header + footer）
│   │   └── admin.ejs           # 管理員 layout（head + admin-header + admin-sidebar）
│   ├── partials/
│   │   ├── head.ejs            # <head> 標籤（CSS、viewport、共用 meta）
│   │   ├── header.ejs          # 前台導覽列（Logo + 購物車 + 登入連結）
│   │   ├── footer.ejs          # 前台頁尾
│   │   ├── admin-header.ejs    # 管理員頂部導覽
│   │   ├── admin-sidebar.ejs   # 管理員側邊欄
│   │   └── notification.ejs   # Toast 通知 HTML 結構
│   └── pages/
│       ├── index.ejs           # 首頁（商品列表 + 分頁）
│       ├── product-detail.ejs  # 商品詳情
│       ├── cart.ejs            # 購物車
│       ├── checkout.ejs        # 結帳表單
│       ├── login.ejs           # 登入 / 快速註冊
│       ├── orders.ejs          # 我的訂單列表
│       ├── order-detail.ejs    # 訂單詳情
│       ├── 404.ejs             # 找不到頁面
│       └── admin/
│           ├── products.ejs    # 管理員商品管理
│           └── orders.ejs      # 管理員訂單管理
│
└── tests/
    ├── setup.js                # 共用測試輔助函式
    ├── auth.test.js            # 認證端點測試
    ├── products.test.js        # 商品端點測試
    ├── cart.test.js            # 購物車端點測試
    ├── orders.test.js          # 訂單端點測試
    ├── adminProducts.test.js   # 管理員商品 CRUD 測試
    └── adminOrders.test.js     # 管理員訂單測試
```

## 啟動流程

```
server.js
  ├── 讀取 .env（dotenv.config）
  ├── 驗證 JWT_SECRET 存在（否則拋錯停止啟動）
  ├── require('./app') → app.js
  │     ├── require('./src/database') → database.js
  │     │     ├── 建立 SQLite 連線（WAL mode、foreign_keys ON）
  │     │     ├── CREATE TABLE IF NOT EXISTS（users、products、cart_items、orders、order_items）
  │     │     └── 若 users 表為空 → 插入 admin seed + 8 個花卉商品 seed
  │     ├── 掛載 middleware（cors、json body parser、static public/）
  │     ├── 掛載 API 路由（/api/auth、/api/products、/api/cart、/api/orders、/api/admin/*）
  │     ├── 掛載頁面路由（pageRoutes）
  │     └── 掛載全域錯誤處理（errorHandler）
  └── app.listen(3001) → 伺服器就緒
```

## API 路由總覽

| 前綴 | 檔案 | 需要認證 | 需要 Admin | 說明 |
|------|------|----------|------------|------|
| `POST /api/auth/register` | authRoutes.js | 否 | 否 | 註冊新用戶 |
| `POST /api/auth/login` | authRoutes.js | 否 | 否 | 登入取得 JWT |
| `GET /api/auth/profile` | authRoutes.js | JWT | 否 | 取得當前用戶資訊 |
| `GET /api/products` | productRoutes.js | 否 | 否 | 商品列表（分頁）|
| `GET /api/products/:id` | productRoutes.js | 否 | 否 | 商品詳情 |
| `GET /api/cart` | cartRoutes.js | 雙模式* | 否 | 取得購物車內容 |
| `POST /api/cart` | cartRoutes.js | 雙模式* | 否 | 加入購物車 |
| `PATCH /api/cart/:itemId` | cartRoutes.js | 雙模式* | 否 | 更新購物車數量 |
| `DELETE /api/cart/:itemId` | cartRoutes.js | 雙模式* | 否 | 移除購物車品項 |
| `POST /api/orders` | orderRoutes.js | JWT | 否 | 從購物車建立訂單 |
| `GET /api/orders` | orderRoutes.js | JWT | 否 | 取得我的訂單列表 |
| `GET /api/orders/:id` | orderRoutes.js | JWT | 否 | 取得訂單詳情 |
| `PATCH /api/orders/:id/pay` | orderRoutes.js | JWT | 否 | 模擬付款（success/fail）|
| `GET /api/admin/products` | adminProductRoutes.js | JWT | Admin | 管理員商品列表 |
| `POST /api/admin/products` | adminProductRoutes.js | JWT | Admin | 建立商品 |
| `PUT /api/admin/products/:id` | adminProductRoutes.js | JWT | Admin | 更新商品 |
| `DELETE /api/admin/products/:id` | adminProductRoutes.js | JWT | Admin | 刪除商品 |
| `GET /api/admin/orders` | adminOrderRoutes.js | JWT | Admin | 管理員訂單列表（可篩選）|
| `GET /api/admin/orders/:id` | adminOrderRoutes.js | JWT | Admin | 管理員訂單詳情 |

> *雙模式：支援 `Authorization: Bearer <JWT>` 或 `X-Session-Id: <uuid>` 擇一使用。

## 統一回應格式

所有 API 端點皆使用相同的回應結構：

```json
// 成功
{
  "data": { "id": "...", "name": "..." },
  "error": null,
  "message": "操作成功"
}

// 成功（列表型）
{
  "data": {
    "products": [...],
    "pagination": {
      "total": 8,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  },
  "error": null,
  "message": "取得成功"
}

// 失敗
{
  "data": null,
  "error": "Email 已被使用",
  "message": "操作失敗"
}
```

HTTP 狀態碼：

| 代碼 | 情境 |
|------|------|
| 200 | 成功 |
| 201 | 資源建立成功 |
| 400 | 請求參數錯誤（格式、必填欄位遺漏）|
| 401 | 未帶 token 或 token 無效/過期 |
| 403 | 沒有足夠權限（非 admin）|
| 404 | 資源不存在 |
| 409 | 衝突（Email 重複、商品有 pending 訂單）|
| 500 | 伺服器內部錯誤 |

## 認證與授權機制

### JWT 認證（`authMiddleware.js`）

1. 從 `Authorization` header 擷取 `Bearer <token>`
2. 用 `jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] })` 解碼
3. 查詢資料庫確認用戶存在（防止已刪除用戶的舊 token 仍有效）
4. 將解碼結果存入 `req.user`（包含 `userId`、`email`、`role`）

**Token 參數：**
- 演算法：HS256
- 有效期：7 天（`expiresIn: '7d'`）
- Payload：`{ userId, email, role }`

### Admin 授權（`adminMiddleware.js`）

- 必須在 `authMiddleware` 之後執行
- 檢查 `req.user.role === 'admin'`，否則回傳 403

### 訪客購物車（`sessionMiddleware.js`）

- 從 `X-Session-Id` header 擷取 session ID
- 若不存在，`req.sessionId` 為 `undefined`（不報錯）
- `dualAuth()` 函式：先嘗試 JWT（若有 Authorization header），再用 sessionId，兩者都沒有則拒絕

## 資料庫 Schema

**資料庫檔案：** `database.sqlite`
**驅動：** `better-sqlite3`（同步 API，所有操作不需 `await`）
**設定：**
- WAL（Write-Ahead Logging）模式：`PRAGMA journal_mode=WAL`
- 外鍵約束啟用：`PRAGMA foreign_keys = ON`
- 主鍵類型：TEXT（UUID v4）

### `users` 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `email` | TEXT | UNIQUE NOT NULL | 電子郵件（唯一）|
| `password_hash` | TEXT | NOT NULL | bcrypt 雜湊 |
| `name` | TEXT | NOT NULL | 顯示名稱 |
| `role` | TEXT | NOT NULL DEFAULT 'user', CHECK IN ('user','admin') | 角色 |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') | 建立時間（ISO 格式）|

### `products` 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `name` | TEXT | NOT NULL | 商品名稱 |
| `description` | TEXT | — | 商品描述 |
| `price` | INTEGER | NOT NULL, CHECK(price > 0) | 價格（整數，單位：元）|
| `stock` | INTEGER | NOT NULL DEFAULT 0, CHECK(stock >= 0) | 庫存量 |
| `image_url` | TEXT | — | 圖片 URL（Unsplash）|
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') | 建立時間 |
| `updated_at` | TEXT | NOT NULL DEFAULT datetime('now') | 更新時間 |

### `cart_items` 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `session_id` | TEXT | — | 訪客 session ID（訪客購物車）|
| `user_id` | TEXT | FK → users.id | 用戶 ID（登入購物車）|
| `product_id` | TEXT | NOT NULL, FK → products.id | 商品 ID |
| `quantity` | INTEGER | NOT NULL DEFAULT 1, CHECK(quantity > 0) | 數量 |

> `session_id` 與 `user_id` 擇一使用，不會同時非空。

### `orders` 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `order_no` | TEXT | UNIQUE NOT NULL | 訂單編號（ORD-YYYYMMDD-XXXXX）|
| `user_id` | TEXT | NOT NULL, FK → users.id | 下單用戶 |
| `recipient_name` | TEXT | NOT NULL | 收件人姓名 |
| `recipient_email` | TEXT | NOT NULL | 收件人 Email |
| `recipient_address` | TEXT | NOT NULL | 收件地址 |
| `total_amount` | INTEGER | NOT NULL | 訂單總金額（元）|
| `status` | TEXT | NOT NULL DEFAULT 'pending', CHECK IN ('pending','paid','failed') | 訂單狀態 |
| `created_at` | TEXT | NOT NULL DEFAULT datetime('now') | 建立時間 |

**訂單編號格式：** `ORD-YYYYMMDD-XXXXX`
- `YYYYMMDD`：下單日期
- `XXXXX`：UUID 前 5 個字元（大寫）

### `order_items` 表

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| `id` | TEXT | PRIMARY KEY | UUID v4 |
| `order_id` | TEXT | NOT NULL, FK → orders.id | 所屬訂單 |
| `product_id` | TEXT | NOT NULL, FK → products.id | 商品 ID |
| `product_name` | TEXT | NOT NULL | 商品名稱（快照，下單時複製）|
| `product_price` | INTEGER | NOT NULL | 商品單價（快照，下單時複製）|
| `quantity` | INTEGER | NOT NULL | 數量 |

> `product_name` 和 `product_price` 為去正規化欄位，確保訂單歷史不受商品更新影響。

## 資料流：訂單建立

```
用戶 POST /api/orders
  ├── authMiddleware → 驗證 JWT → req.user
  ├── 查詢 cart_items WHERE user_id = req.user.userId
  ├── 若購物車空 → 400 Bad Request
  ├── 驗證所有商品庫存充足
  ├── db.transaction() 開始 ─────────────────────────────────┐
  │     ├── INSERT orders（含 order_no、total_amount 計算）   │
  │     ├── 對每個購物車品項：                                │
  │     │     ├── INSERT order_items（含 name/price 快照）    │
  │     │     └── UPDATE products SET stock = stock - qty    │
  │     └── DELETE cart_items WHERE user_id = req.user.userId│
  └── transaction() 結束（全成功才 commit）───────────────────┘
  └── 回應 201 Created + 訂單資料
```

## 第三方整合：ECPay 金流

> 目前為**模擬付款**，尚未實際串接 ECPay。

環境變數中已預留 ECPay 設定（`ECPAY_MERCHANT_ID`、`ECPAY_HASH_KEY`、`ECPAY_HASH_IV`、`ECPAY_ENV`），但付款流程以 `PATCH /api/orders/:id/pay` 的 `action: success | fail` 參數模擬。

實際 ECPay 串接需實作：
1. 建立訂單時向 ECPay 取得付款 URL
2. 接收 ECPay 的非同步通知（webhook）
3. 驗證交易 CheckMacValue（HMAC-SHA256）
4. 更新訂單狀態
