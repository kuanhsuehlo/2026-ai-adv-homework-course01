# ECPay 金流整合計畫

## Context

現有付款流程使用模擬按鈕（付款成功/付款失敗）。本計畫將其替換為真實的綠界 AIO 金流串接。
因專案僅在本地端運行，**無法接收綠界的 Server-to-Server ReturnURL 回呼**，改採：
- `OrderResultURL`（瀏覽器跳轉，可訪問 localhost）接收付款跳轉
- `QueryTradeInfo` API 主動查詢並驗證付款狀態

---

## 新的付款流程

```
用戶點「前往付款」
  → POST /api/ecpay/create-payment（帶 JWT，後端生成表單參數）
  → 前端動態建立 <form> 並 POST 至 ECPay Checkout URL
  → 用戶在綠界頁面完成付款（測試卡：4311-9522-2222-2222 / 任意到期日 / CVV 222 / 3DS 1234）
  → 綠界瀏覽器跳轉至 POST /ecpay/result
  → 後端呼叫 QueryTradeInfo 驗證付款
  → 更新 orders.status（paid / failed）
  → 跳轉至 /orders/{id}?payment=success|failed
```

---

## 需修改 / 新增的檔案

### 新增

**1. `src/utils/ecpay.js`**
- `ecpayUrlEncode(source)` — 標準 URL encode → lowercase → .NET 特殊字元替換
- `generateCheckMacValue(params)` — SHA256，使用 .env 的 HashKey/HashIV
- `generateMerchantTradeNo()` — `FLW` + Unix timestamp + 4 random chars（≤ 20 chars）
- `queryTradeInfo(merchantTradeNo)` — POST 至 QueryTradeInfo/V5，回傳已解析的 key-value 物件
- 導出常數：`CHECKOUT_URL`（依 ECPAY_ENV 切換 staging/production）

**2. `src/routes/ecpayRoutes.js`**（export `{ apiRouter, callbackRouter }`）

`apiRouter`（掛載於 `/api/ecpay`）：
- `POST /create-payment`（需 authMiddleware）
  1. 驗證 order 屬於該 user 且 status = pending
  2. 生成 `merchantTradeNo`，寫入 `orders.ecpay_merchant_trade_no`
  3. 組合 AIO 必填參數（TotalAmount 直接用 order.total_amount，ItemName 限 200 字）
  4. 設定 `ReturnURL = BASE_URL/ecpay/notify`、`OrderResultURL = BASE_URL/ecpay/result`
  5. 計算 CheckMacValue
  6. 回傳 `{ data: { formUrl, params }, ... }`

`callbackRouter`（掛載於 `/ecpay`）：
- `POST /result`（OrderResultURL，瀏覽器跳轉）
  1. 從 `req.body.MerchantTradeNo` 查詢訂單
  2. 若 status ≠ pending，直接跳轉（冪等保護）
  3. 呼叫 `queryTradeInfo`：TradeStatus === '1' → paid，否則 → failed
  4. 更新 DB，`res.redirect(/orders/{id}?payment=success|failed)`
- `POST /notify`（ReturnURL，localhost 不會被呼叫，僅防禦性處理）
  - 回應 `1|OK`（text/plain）

---

### 修改

**3. `src/database.js`**
- 在 `initializeDatabase()` 後執行 migration，加入 `ecpay_merchant_trade_no TEXT` 欄位：
  ```javascript
  try { db.exec(`ALTER TABLE orders ADD COLUMN ecpay_merchant_trade_no TEXT`); } catch {}
  ```

**4. `app.js`**
- 新增路由掛載：
  ```javascript
  const ecpayRoutes = require('./src/routes/ecpayRoutes');
  app.use('/api/ecpay', ecpayRoutes.apiRouter);
  app.use('/ecpay', ecpayRoutes.callbackRouter);
  ```

**5. `views/pages/order-detail.ejs`**（line 74-89）
- 移除「付款成功」和「付款失敗」兩個按鈕
- 改為單一「前往付款」按鈕（rose-primary），呼叫 `handlePayWithEcpay`

**6. `public/js/pages/order-detail.js`**
- 移除 `simulatePay`、`handlePaySuccess`、`handlePayFail`
- 新增 `handlePayWithEcpay`：
  1. 呼叫 `POST /api/ecpay/create-payment`（apiFetch + JWT header）
  2. 從回應取得 `{ formUrl, params }`
  3. 動態建立 `<form method="POST" action="formUrl">`，填入 hidden inputs
  4. `document.body.appendChild(form); form.submit()`

---

## 環境變數（已存在於 .env）

```
ECPAY_MERCHANT_ID=3002607
ECPAY_HASH_KEY=pwFHCqoQZGmho4w6
ECPAY_HASH_IV=EkRm7iFT261dpevs
ECPAY_ENV=staging
BASE_URL=http://localhost:3001
```

---

## 驗證步驟

1. `npm start` 啟動伺服器
2. 登入 → 加商品至購物車 → 結帳 → 進入訂單詳情頁
3. 點「前往付款」→ 確認跳轉至 `payment-stage.ecpay.com.tw`
4. 使用測試卡 `4311-9522-2222-2222` / 任意到期日 / CVV `222` / 3DS `1234`
5. 付款完成後確認跳轉回 `http://localhost:3001/orders/{id}?payment=success`
6. 確認訂單狀態變為「已付款」（`paid`）
7. 測試付款失敗（點取消）→ 確認跳轉回 `?payment=failed`，狀態變為「付款失敗」
