# DEVELOPMENT.md

## 環境變數

| 變數名稱 | 用途 | 必填 | 預設值 |
|----------|------|------|--------|
| `JWT_SECRET` | JWT 簽名密鑰（HS256）| **必填** | 無（未設定則伺服器拒絕啟動）|
| `BASE_URL` | 後端伺服器 URL | 否 | `http://localhost:3001` |
| `FRONTEND_URL` | CORS 允許來源 | 否 | `http://localhost:5173` |
| `ADMIN_EMAIL` | 初始管理員帳號 Email | 否 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | 初始管理員密碼 | 否 | `12345678` |
| `ECPAY_MERCHANT_ID` | ECPay 商店代號 | 否 | `3002607`（測試用）|
| `ECPAY_HASH_KEY` | ECPay Hash Key | 否 | 測試值 |
| `ECPAY_HASH_IV` | ECPay Hash IV | 否 | 測試值 |
| `ECPAY_ENV` | ECPay 環境 | 否 | `staging` |

> `JWT_SECRET` 在 `server.js` 啟動時強制驗證；若為空，程序直接以錯誤訊息退出（`process.exit(1)`）。

## 命名規則

### 檔案命名

| 類型 | 規則 | 範例 |
|------|------|------|
| 路由檔案 | camelCase + Routes 後綴 | `authRoutes.js`、`adminProductRoutes.js` |
| Middleware 檔案 | camelCase + Middleware 後綴 | `authMiddleware.js`、`sessionMiddleware.js` |
| 前端頁面腳本 | kebab-case | `product-detail.js`、`admin-orders.js` |
| EJS 模板 | kebab-case | `product-detail.ejs`、`order-detail.ejs` |
| 測試檔案 | camelCase + .test.js | `auth.test.js`、`adminProducts.test.js` |
| 計畫文件 | YYYY-MM-DD-feature-name.md | `2026-04-26-ecpay-integration.md` |

### 變數與函式命名

| 類型 | 規則 | 範例 |
|------|------|------|
| 一般變數/函式 | camelCase | `userId`、`getAdminToken()` |
| 資料庫欄位 | snake_case | `user_id`、`order_no`、`created_at` |
| 常數（模組層級）| SCREAMING_SNAKE_CASE | `JWT_SECRET`（透過 `process.env`）|
| Express Router | camelCase + Router 後綴 | `authRouter`、`productRouter` |
| Middleware 函式 | camelCase | `authMiddleware`、`sessionMiddleware` |

### API 路由命名

- 公開 API：`/api/<resource>`（複數）
- 管理員 API：`/api/admin/<resource>`（複數）
- 資源操作：
  - `GET /api/products` → 列表
  - `GET /api/products/:id` → 單筆
  - `POST /api/products` → 建立
  - `PUT /api/products/:id` → 全量更新
  - `PATCH /api/products/:id/action` → 部分更新或特定動作

### 模組系統

本專案使用 **CommonJS**（`require` / `module.exports`），非 ES Modules：

```javascript
// 正確
const express = require('express');
const { db } = require('../database');
module.exports = router;

// 錯誤（本專案不使用）
import express from 'express';
export default router;
```

## 新增 API 端點的步驟

以新增「商品評論」功能為例：

1. **建立計畫文件**（先規劃，後實作）
   ```
   docs/plans/YYYY-MM-DD-product-reviews.md
   ```

2. **更新 `src/database.js`**（若需新增資料表）
   ```javascript
   // 在 initializeDatabase() 函式內加入
   db.exec(`
     CREATE TABLE IF NOT EXISTS reviews (
       id TEXT PRIMARY KEY,
       product_id TEXT NOT NULL,
       user_id TEXT NOT NULL,
       rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
       comment TEXT,
       created_at TEXT NOT NULL DEFAULT (datetime('now')),
       FOREIGN KEY (product_id) REFERENCES products(id),
       FOREIGN KEY (user_id) REFERENCES users(id)
     )
   `);
   ```

3. **建立路由檔案** `src/routes/reviewRoutes.js`
   ```javascript
   const express = require('express');
   const router = express.Router();
   const { db } = require('../database');
   const authMiddleware = require('../middleware/authMiddleware');

   // GET /api/products/:id/reviews
   router.get('/:id/reviews', (req, res) => {
     // ...
   });

   module.exports = router;
   ```

4. **在 `app.js` 掛載路由**
   ```javascript
   const reviewRoutes = require('./src/routes/reviewRoutes');
   app.use('/api/products', reviewRoutes);
   ```

5. **加入 JSDoc 供 OpenAPI 產生**（在路由函式上方）
   ```javascript
   /**
    * @swagger
    * /api/products/{id}/reviews:
    *   get:
    *     summary: 取得商品評論
    *     tags: [Reviews]
    *     parameters:
    *       - in: path
    *         name: id
    *         required: true
    *         schema:
    *           type: string
    *     responses:
    *       200:
    *         description: 評論列表
    */
   ```

6. **撰寫測試** `tests/reviews.test.js`（參考 [TESTING.md](./TESTING.md)）

7. **更新文件**
   - `docs/FEATURES.md`：新增功能描述
   - `docs/CHANGELOG.md`：記錄變更
   - 移動計畫文件至 `docs/plans/archive/`

## 新增 Middleware 的步驟

1. 建立 `src/middleware/yourMiddleware.js`
2. 函式簽名：`(req, res, next) => { ... }`
3. 成功時呼叫 `next()`；失敗時直接回傳 `res.status(xxx).json(...)`
4. 在需要的路由或 `app.js` 中引入並使用

範例（限制每分鐘請求次數）：
```javascript
// src/middleware/rateLimitMiddleware.js
const requestCounts = new Map();

function rateLimitMiddleware(req, res, next) {
  const key = req.ip;
  const now = Date.now();
  const windowMs = 60_000;
  const maxRequests = 100;

  const record = requestCounts.get(key) || { count: 0, windowStart: now };
  if (now - record.windowStart > windowMs) {
    record.count = 0;
    record.windowStart = now;
  }
  record.count++;
  requestCounts.set(key, record);

  if (record.count > maxRequests) {
    return res.status(429).json({ data: null, error: '請求過於頻繁', message: '請稍後再試' });
  }
  next();
}

module.exports = rateLimitMiddleware;
```

## JSDoc / OpenAPI 格式說明

每個路由處理器上方必須加入 JSDoc 以利 `npm run openapi` 產生規格：

```javascript
/**
 * @swagger
 * /api/orders/{id}/pay:
 *   patch:
 *     summary: 模擬付款
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 訂單 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [success, fail]
 *     responses:
 *       200:
 *         description: 付款結果
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: 無效的 action 或訂單狀態
 *       401:
 *         description: 未認證
 *       404:
 *         description: 訂單不存在
 */
```

## 計畫歸檔流程

1. **命名格式**：`YYYY-MM-DD-<feature-name>.md`
   ```
   docs/plans/2026-04-26-ecpay-integration.md
   ```

2. **計畫文件結構**：
   ```markdown
   # 計畫：<功能名稱>

   ## User Story
   身為 <角色>，我希望 <行為>，以便 <目的>。

   ## 功能規格（Spec）
   - 端點：...
   - 請求格式：...
   - 業務邏輯：...
   - 錯誤情境：...

   ## 任務清單（Tasks）
   - [ ] 更新 database.js（新增資料表）
   - [ ] 建立路由檔案
   - [ ] 在 app.js 掛載
   - [ ] 撰寫測試
   - [ ] 更新 FEATURES.md
   - [ ] 更新 CHANGELOG.md
   ```

3. **功能完成後**：
   - 將計畫文件移至 `docs/plans/archive/`
   - 在 `docs/FEATURES.md` 將功能狀態標記為完成 ✅
   - 在 `docs/CHANGELOG.md` 記錄版本變更

4. **禁止在 archive/ 內修改**：歸檔後的計畫為唯讀歷史記錄。

## 開發常見陷阱

### 購物車 dualAuth 用法

購物車端點**不可**只用 `authMiddleware`，因為必須支援訪客（session only）：

```javascript
// 錯誤：只接受 JWT
router.get('/', authMiddleware, handler);

// 正確：先 sessionMiddleware，再 dualAuth 邏輯
router.get('/', sessionMiddleware, (req, res) => {
  const userId = req.user?.userId;
  const sessionId = req.sessionId;
  if (!userId && !sessionId) {
    return res.status(401).json({ data: null, error: '需要登入或 Session ID', message: '未認證' });
  }
  // 以 userId 或 sessionId 查詢 cart_items
});
```

### better-sqlite3 同步操作

`better-sqlite3` 是**同步**驅動，不要使用 `await`：

```javascript
// 錯誤
const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(id);

// 正確
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
```

### Transaction 用法

```javascript
const createOrder = db.transaction((orderData, cartItems) => {
  const orderId = uuidv4();
  db.prepare('INSERT INTO orders ...').run(orderId, ...);
  for (const item of cartItems) {
    db.prepare('INSERT INTO order_items ...').run(...);
    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.product_id);
  }
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(orderData.userId);
  return orderId;
});

// 呼叫（任何例外都會自動 rollback）
const orderId = createOrder(orderData, cartItems);
```
