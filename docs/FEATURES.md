# FEATURES.md

## 功能完成狀態

| 功能區塊 | 狀態 | 說明 |
|----------|------|------|
| 用戶認證 | ✅ 完成 | 註冊、登入、個人資料 |
| 商品瀏覽 | ✅ 完成 | 商品列表（分頁）、商品詳情 |
| 購物車（雙模式）| ✅ 完成 | 訪客 session + 登入 JWT |
| 訂單管理 | ✅ 完成 | 建立、列表、詳情、模擬付款 |
| 管理員商品管理 | ✅ 完成 | CRUD + 刪除前檢查 |
| 管理員訂單管理 | ✅ 完成 | 列表篩選、訂單詳情 |
| OpenAPI 文件 | ✅ 完成 | `npm run openapi` 產生 |
| ECPay 金流串接 | 🔲 未完成 | 目前為模擬付款 |

---

## 功能一：用戶認證

Token 儲存於前端 `localStorage`（key: `flower_token`），每次請求放入 `Authorization: Bearer <token>`。

| 端點 | 認證 | 說明 |
|------|------|------|
| `POST /api/auth/register` | 無 | 回傳 201 + token + user |
| `POST /api/auth/login` | 無 | 回傳 200 + token + user |
| `GET /api/auth/profile` | JWT | 回傳當前用戶資料 |

**register / login 請求欄位：**

| 欄位 | 必填 | 限制 |
|------|------|------|
| `email` | 必填 | Email 格式 |
| `password` | 必填 | 最少 6 字元 |
| `name` | register 必填 | 非空字串 |

**錯誤代碼：**

| 情境 | HTTP |
|------|------|
| 必填欄位缺少 | 400 |
| Email 格式錯誤 | 400 |
| 密碼少於 6 碼 | 400 |
| Email 已被使用 | 409 |
| 帳號或密碼錯誤 | 401 |
| token 缺少/無效 | 401 |

---

## 功能二：商品瀏覽

| 端點 | 認證 | 說明 |
|------|------|------|
| `GET /api/products?page=1&limit=10` | 無 | 分頁列表，回傳 `{ products, pagination }` |
| `GET /api/products/:id` | 無 | 單一商品，不存在回傳 404 |

---

## 功能三：購物車（雙模式）

所有端點接受擇一：`Authorization: Bearer <token>` 或 `X-Session-Id: <uuid>`，兩者皆無則 401。  
訪客 session ID 由前端 `auth.js` 自動產生並存入 `localStorage`（key: `flower_session_id`）。  
訪客與登入購物車**不自動合併**。

| 端點 | 說明 |
|------|------|
| `GET /api/cart` | 回傳 `{ items, total }`，items 含 subtotal |
| `POST /api/cart` | 加入；商品已存在則**累加**數量 |
| `PATCH /api/cart/:itemId` | 更新數量（直接設值，非累加） |
| `DELETE /api/cart/:itemId` | 移除品項 |

**POST /api/cart 欄位：** `productId`（必填）、`quantity`（必填，正整數）

**業務邏輯：**
- 庫存驗證：現有購物車數量 + 新增數量 > stock → 400
- 商品已在購物車 → `UPDATE quantity = quantity + ?`
- 商品不在購物車 → `INSERT`

**錯誤代碼：**

| 情境 | HTTP |
|------|------|
| 無認證 | 401 |
| 商品不存在 | 404 |
| 庫存不足 | 400 |
| quantity 非正整數 | 400 |
| 操作非自己的品項 | 404 |

---

## 功能四：訂單管理

所有端點需 JWT。

**建立訂單：`POST /api/orders`**  
從購物車建立，Transaction 內依序：INSERT orders → INSERT order_items（name/price 快照）→ UPDATE stock → DELETE cart_items。

請求欄位：`recipientName`、`recipientEmail`、`recipientAddress`（皆必填）

**模擬付款：`PATCH /api/orders/:id/pay`**  
欄位：`action`（`"success"` → `paid`｜`"fail"` → `failed`）  
只有 `status === 'pending'` 的訂單可操作，否則 400。

**訂單狀態機：** `pending` → `paid` 或 `failed`（單向，不可逆）

| 端點 | 說明 |
|------|------|
| `GET /api/orders` | 當前用戶訂單列表（倒序） |
| `GET /api/orders/:id` | 訂單詳情，只能查自己的（否則 404） |

**錯誤代碼：**

| 情境 | HTTP |
|------|------|
| 購物車為空 | 400 |
| 庫存不足（建立時再次驗證）| 400 |
| 訂單不存在或非本人 | 404 |
| 訂單非 pending 再次付款 | 400 |
| action 非合法值 | 400 |

---

## 功能五：管理員商品管理

所有端點需 JWT + admin role。

| 端點 | 說明 |
|------|------|
| `GET /api/admin/products?page&limit` | 分頁列表 |
| `POST /api/admin/products` | 建立商品（201） |
| `PUT /api/admin/products/:id` | 全量更新（自動更新 `updated_at`） |
| `DELETE /api/admin/products/:id` | 刪除（有 pending 訂單則 409） |

**建立 / 更新欄位：** `name`（必填）、`price`（必填，正整數）、`stock`（必填，非負整數）、`description`（選填）、`image_url`（選填）  
PUT 為全量更新，所有欄位必填。

**刪除業務邏輯：** 查詢 `order_items JOIN orders WHERE product_id = :id AND status = 'pending'`，有結果則 409。

**錯誤代碼：** 401 / 403 / 404 / 409（pending 訂單）/ 400（欄位缺少或不合法）

---

## 功能六：管理員訂單管理

所有端點需 JWT + admin role。管理員**無法**直接修改訂單狀態。

| 端點 | 說明 |
|------|------|
| `GET /api/admin/orders?page&limit&status` | 全用戶訂單列表，status 可選 `pending`/`paid`/`failed` |
| `GET /api/admin/orders/:id` | 訂單詳情，含用戶資訊（email、name）與 items |

**錯誤代碼：** 401 / 403 / 404 / 400（status 參數值不合法）
