# TESTING.md

## 測試架構

| 工具 | 版本 | 用途 |
|------|------|------|
| Vitest | ^2.1.9 | 測試框架（Vite 原生）|
| Supertest | ^7.2.2 | HTTP 整合測試（模擬實際 HTTP 請求）|

**測試類型：整合測試（Integration Tests）**
- 所有測試皆直接呼叫 HTTP 端點
- 使用相同 SQLite 資料庫（非 mock）
- 測試之間**不使用** mock，確保與生產行為一致

## 測試設定（`vitest.config.js`）

```javascript
// vitest.config.js 重點設定
{
  globals: true,            // 啟用全域測試 API（describe, it, expect）
  fileParallelism: false,   // 禁止並行執行（避免 SQLite 鎖定衝突）
  sequence: {
    concurrent: false       // 確保測試依序執行
  },
  hookTimeout: 10000        // beforeAll / afterAll 最長 10 秒
}
```

> **重要**：因所有測試共用同一個 SQLite 資料庫，`fileParallelism: false` 是必要設定。若並行執行會出現 SQLite LOCKED 錯誤。

## 測試檔案總覽

| 檔案 | 測試對象 | 測試案例數（約）|
|------|----------|----------------|
| `tests/auth.test.js` | `/api/auth/*` | ~12 |
| `tests/products.test.js` | `/api/products/*` | ~8 |
| `tests/cart.test.js` | `/api/cart/*` | ~14 |
| `tests/orders.test.js` | `/api/orders/*` | ~12 |
| `tests/adminProducts.test.js` | `/api/admin/products/*` | ~14 |
| `tests/adminOrders.test.js` | `/api/admin/orders/*` | ~8 |

## 執行順序與依賴關係

Vitest 依字母順序執行，但本專案各測試檔案**獨立設定測試資料**，不依賴彼此的執行結果。

建議執行順序（`npm test` 已自動處理）：

```
auth → products → cart → orders → adminProducts → adminOrders
```

**相依性說明：**
- `cart.test.js`：需要 `registerUser()` 建立測試用戶
- `orders.test.js`：需要登入用戶 + 購物車有商品
- `adminProducts.test.js`：需要 admin token（由 `getAdminToken()` 取得）
- `adminOrders.test.js`：需要 admin token + 至少一筆訂單

## 測試輔助函式（`tests/setup.js`）

```javascript
// 取得管理員 JWT token
async function getAdminToken() {
  const res = await request(app).post('/api/auth/login').send({
    email: process.env.ADMIN_EMAIL || 'admin@hexschool.com',
    password: process.env.ADMIN_PASSWORD || '12345678'
  });
  return res.body.data.token;
}

// 註冊並取得測試用戶 token
// 每次呼叫產生唯一 email（避免 409 衝突）
async function registerUser(overrides = {}) {
  const unique = Date.now();
  const defaults = {
    email: `test${unique}@example.com`,
    password: 'password123',
    name: '測試用戶'
  };
  const res = await request(app).post('/api/auth/register').send({ ...defaults, ...overrides });
  return {
    token: res.body.data.token,
    user: res.body.data.user
  };
}
```

## 各測試檔案說明

### `auth.test.js`

測試認證流程：

- **正向路徑**
  - 成功註冊返回 token + user
  - 成功登入返回 token + user
  - 帶 token 取得個人資料

- **負向路徑**
  - 缺少必填欄位（email / password / name）→ 400
  - Email 格式錯誤 → 400
  - 密碼少於 6 碼 → 400
  - 重複 Email 註冊 → 409
  - 錯誤密碼登入 → 401
  - 無 token 取得 profile → 401
  - 無效 token → 401

### `products.test.js`

- 取得商品列表（預設分頁）
- 帶 `page` / `limit` 參數分頁
- `page` 超出範圍 → 空陣列 + 正確 pagination 資料
- 取得存在商品詳情
- 取得不存在商品 → 404

### `cart.test.js`

- 訪客（X-Session-Id）加入商品
- 登入用戶加入商品
- 重複加入同商品 → 數量累加（非新增）
- 更新購物車數量
- 移除購物車品項
- 取得購物車（含 subtotal 計算）
- 無 session 也無 token → 401
- 加入不存在商品 → 404
- 加入庫存不足商品 → 400
- quantity 為 0 或負數 → 400

### `orders.test.js`

- 從購物車成功建立訂單（驗證：order_no 格式、total_amount、items 快照）
- 建立訂單後購物車清空
- 建立訂單後庫存正確扣減
- 空購物車建立訂單 → 400
- 模擬付款 success → status 變 paid
- 模擬付款 fail → status 變 failed
- 對已付款訂單再付款 → 400
- 查詢不屬於自己的訂單 → 404
- 未登入操作 → 401

### `adminProducts.test.js`

- 管理員建立商品（驗證：必填欄位）
- 管理員更新商品（驗證：updated_at 更新）
- 管理員刪除商品（無 pending 訂單）
- 有 pending 訂單的商品無法刪除 → 409
- 非管理員操作 → 403
- 未登入操作 → 401
- 建立商品缺少 price/name → 400
- 更新不存在商品 → 404

### `adminOrders.test.js`

- 取得所有訂單列表
- 依 status 篩選訂單
- 取得訂單詳情（含用戶資訊 + items）
- 無效 status 篩選值 → 400
- 非管理員 → 403
- 未登入 → 401

## 撰寫新測試的步驟

1. **建立測試檔案** `tests/yourFeature.test.js`

2. **基本結構範本**：
   ```javascript
   const request = require('supertest');
   const app = require('../app');
   const { getAdminToken, registerUser } = require('./setup');

   describe('Your Feature', () => {
     let adminToken;
     let userToken;

     beforeAll(async () => {
       adminToken = await getAdminToken();
       const { token } = await registerUser();
       userToken = token;
     });

     describe('GET /api/your-endpoint', () => {
       it('should return 200 with data', async () => {
         const res = await request(app)
           .get('/api/your-endpoint')
           .set('Authorization', `Bearer ${userToken}`);

         expect(res.status).toBe(200);
         expect(res.body.data).toBeDefined();
         expect(res.body.error).toBeNull();
       });

       it('should return 401 without token', async () => {
         const res = await request(app).get('/api/your-endpoint');
         expect(res.status).toBe(401);
       });
     });
   });
   ```

3. **訪客購物車測試範本**：
   ```javascript
   const sessionId = `test-session-${Date.now()}`;

   const res = await request(app)
     .get('/api/cart')
     .set('X-Session-Id', sessionId);
   ```

4. **確保測試之間互不干擾**：
   - 每個 `beforeAll` 建立獨立的測試用戶（使用 `registerUser()`）
   - 使用唯一 ID / timestamp 產生測試資料（避免衝突）
   - 不依賴其他測試的副作用

5. **在 `vitest.config.js` 中，新測試檔案自動被包含**（無需手動添加）

## 常見陷阱

### 陷阱 1：測試共享 SQLite 狀態

各測試在同一個資料庫執行，所以：
- 建立的商品/用戶在同次 `npm test` 執行期間都存在
- 若 A 測試刪除了 seed 商品，B 測試可能找不到該商品

**解法**：每個測試建立自己的測試資料，並在測試完成後清理（或不依賴 seed 資料）。

### 陷阱 2：`bcrypt` 在 CI 很慢

`bcrypt` 使用 10 rounds 在 CI 環境會讓測試很慢。

**已解決**：`src/database.js` 中的 seed admin 用 `NODE_ENV=test` 時降為 1 round：
```javascript
const saltRounds = process.env.NODE_ENV === 'test' ? 1 : 10;
```

> 測試時記得設定 `NODE_ENV=test`（`npm test` 腳本已自動帶入）。

### 陷阱 3：非同步 vs 同步 better-sqlite3

`better-sqlite3` 是同步操作，但 `supertest` 的 `request(app).get(...)` 是 Promise。測試函式必須是 `async` 並使用 `await`：

```javascript
// 錯誤：忘記 async/await
it('test', () => {
  const res = request(app).get('/api/products'); // 回傳 Promise，不會等待
  expect(res.status).toBe(200); // 永遠失敗
});

// 正確
it('test', async () => {
  const res = await request(app).get('/api/products');
  expect(res.status).toBe(200);
});
```

### 陷阱 4：購物車累加 vs 設定數量

`POST /api/cart` 是**累加**（若商品已存在則加上數量）；`PATCH /api/cart/:itemId` 是**設定新數量**。測試時需注意：

```javascript
// 先加入 2 個
await request(app).post('/api/cart').send({ productId, quantity: 2 }).set('X-Session-Id', sid);
// 再加入 3 個 → 實際變成 5 個（累加）
await request(app).post('/api/cart').send({ productId, quantity: 3 }).set('X-Session-Id', sid);
// 若要驗證數量為 3，需先移除再加入，或改用 PATCH
```

## 執行測試

```bash
# 執行所有測試（順序執行）
npm test

# 執行單一測試檔案
npx vitest run tests/auth.test.js

# 監聽模式（開發時）
npx vitest
```
