# 實作計畫：將四頁 Pencil 設計轉成 EJS + Tailwind CSS 套用到專案

## Context

Pencil 畫布上已完成四頁 Artisan Editorial 設計（首頁、商品列表、商品詳情、購物車）。使用者確認：**採用 FLORISTE 品牌**（取代「花漾生活」）、**新增 `/shop` 商城頁**（首頁改為編輯風形象頁）。結帳/登入/訂單/後台頁面不重新設計（ECPay 流程不變），但會透過 theme token 值的更換自動獲得新配色。

**核心原則：純視覺重構（re-skin）**——所有 Vue 模板綁定（`v-for`/`v-if`/`@click`/`:disabled`/`:key`）、DOM hooks（`id="cart-badge"`、`id="auth-nav"`、`id="orders-link"`、`data-product-id`）、script 載入順序（vue → auth → api → notification → header-init → page script）、API 呼叫全部保留不動。測試皆為 API 整合測試，不檢查 HTML，不受影響。

## 設計系統 → Tailwind v4 Token 對應

修改 `public/css/input.css` 的 `@theme`（沿用既有 token 名稱改值，讓未重設計的頁面自動換色）：

```css
--color-rose-primary: #A8566A;   /* 原 #C4727F，玫瑰醬紅主強調色 */
--color-rose-dark:    #8E4757;   /* hover */
--color-rose-light:   #C99AA4;
--color-cream:        #FAF6EF;   /* 羊皮紙底 */
--color-blush:        #F3EDE2;   /* 米白變化（購買須知/摘要側欄底） */
--color-rose-bg:      #F3EDE2;
--color-sage:         #5B7A52;   /* 免運綠 */
--color-text-primary: #20281E;   /* 深林墨綠 */
--color-text-secondary: #75705F;
--color-text-muted:   #B5AD9D;
/* 新增 */
--color-forest:       #20281E;   /* 深色區塊/按鈕 */
--color-forest-deep:  #171E16;   /* 頁尾 */
--color-hairline:     #E6DDCF;   /* 髮絲線 */
--font-display: "Playfair Display", serif;
--font-serif-tc: "Noto Serif TC", serif;
--font-caption: "Funnel Sans", sans-serif;
```

`views/partials/head.ejs`：Google Fonts link 加入 `Playfair Display:ital,wght@0,300;0,400;0,700;1,300` 與 `Funnel Sans:wght@300;400;500;600`（保留 Noto Sans TC / Noto Serif TC）；`<title>` 品牌字樣改為 `FLORISTE 花開有時`。

設計語彙：sharp corner（按鈕 `rounded`=4px、徽章/圖片不圓角）、flat 無陰影、髮絲線 `border-hairline`、caption 一律 `tracking-[0.3em] uppercase text-[11px] font-caption`。

## 檔案異動清單

### 1. 共用 partials
- **`views/partials/header.ejs`** 重寫：三欄置中 Logo 結構（左：花卉商城 `/shop`、花藝故事 `/#story`、訂閱花禮 `/#subscribe`；中：FLORISTE Playfair 26px + 「花 開 有 時」小字；右：登入連結、購物袋+badge、我的訂單）。**必須保留** `id="cart-badge"`（初始 `display:none`）、`id="orders-link"`、`id="auth-nav"`——`public/js/header-init.js` 會注入 auth HTML 與更新 badge。底色改 `bg-cream` + 髮絲線底框（原為 sticky white，改為 sticky bg-cream）。
- **`public/js/header-init.js`** 小修：注入的 auth HTML 內 class 換成新風格（細字、letterSpacing），邏輯不動。
- **`views/partials/footer.ejs`** 重寫：深綠 `bg-forest-deep` 四欄編輯風頁尾（品牌欄 + 商品/服務/聯絡欄、髮絲線、❀ 符號、copyright 列）。

### 2. 首頁（編輯風形象頁）
- **`views/pages/index.ejs`** 重寫，對應 Pencil `Homepage — Artisan Editorial`：
  - Hero：全幅 Unsplash 花卉照（深色 scrim 漸層）+ FLORISTE 超大 Playfair display（RWD：`text-6xl md:text-8xl lg:text-[9rem]`）+ 「花開有時，為你而綻」+ 雙 CTA（探索花卉→`/shop`、訂閱花禮→`#subscribe`）+ 底部三枚定位標籤
  - 分類列：髮絲線分隔的分類連結（皆連 `/shop`，視覺導航）
  - 精選商品（`№ 01`）：不對稱拼版——左大卡 `products[0]`（BESTSELLER 徽章）+ 右 2×2 `products[1..4]`；卡片可點進 `/products/:id`，「加入購物袋」沿用 `addToCart`
  - ❀ 裝飾分隔、品牌故事分割（`id="story"`，文左圖右）、深色訂閱 slab（`id="subscribe"`，指標列 + CTA→`/shop`）、大型引言區
- **`public/js/pages/index.js`** 修改：`loadProducts` 改 `GET /api/products?page=1&limit=5`（取 5 件做拼版），移除分頁邏輯；保留 `addToCart`、`goToProduct`、badge 更新、`_adding` 旗標。

### 3. 商城頁（新增）
- **`src/routes/pageRoutes.js`** 新增路由：`GET /shop` → `renderFront(res, 'shop', { title: '花卉商城', pageScript: 'shop' })`
- **`views/pages/shop.ejs`** 新建，對應 Pencil `Shop — 花卉商城`：米白 banner（`№ 01 — ALL BOTANICALS`）、工具列（共 N 件商品 + 排序：最新上架/價格）、3 欄商品網格（RWD：`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`）、售完卡樣式（`product.stock <= 0`：圖片 `opacity-45` + 墨綠「已售完」徽章 + 「補貨通知」灰字取代加入連結）、編輯風分頁（`01 02 03` Playfair 頁碼 + PREV/NEXT，沿用現有 pagination 結構）
- **`public/js/pages/shop.js`** 新建：複製現有 `index.js` 的 `loadProducts(page)`（`limit=9`）+ 分頁 + `addToCart` 邏輯，新增客戶端排序（最新=API 原序；價格=當頁 `products` 陣列排序切換）

### 4. 商品詳情頁
- **`views/pages/product-detail.ejs`** 重寫，對應 Pencil `Product Detail`：
  - 麵包屑：首頁 — 花卉商城(`/shop`) — `{{ product.name }}`
  - 左右分割（`lg:grid-cols-[7fr_5fr]`，行動版堆疊）：左大圖（單圖，**不做縮圖列**——DB 僅一張 `image_url`，不偽造）；右：caption、Noto Serif TC 商品名、Playfair 大價格、庫存 pill（綠點 + 尚有 X 件）、髮絲線、描述、數量選擇器（細框 −/N/＋）+ 加入購物袋並排、購買須知（blush 底 ❀ 三點）
  - 保留全部 Vue 綁定：`v-if="loading"`/`notFound`/`v-else-if="product"`、`@click="decrease/increase"`、`:disabled="adding || product.stock <= 0"`、售完顯示「已售完」
  - 新增「你可能也喜歡」區：3 張小卡
- **`public/js/pages/product-detail.js`** 修改：新增 `related` data + onMounted 加 `GET /api/products?limit=4` 過濾當前 id 取 3 件；其餘邏輯不動。

### 5. 購物車頁
- **`views/pages/cart.ejs`** 重寫，對應 Pencil `Cart — 購物袋`：
  - 置中「購物袋」標題 + `YOUR BAG — {{ items.length }} ITEMS` caption
  - 免運狀態列（保留現有 `v-if="total < 500"` 雙態）：未達—「再買 NT$XXX 即可享免運費」+ 玫瑰紅進度條（`:style="{ width: Math.min(total/500*100, 100) + '%' }"`）；已達—綠字「✓ 已達免運門檻」滿格綠條
  - 表格式商品列（髮絲線分隔）：96px 縮圖、名稱、單價、數量選擇器（保留 `:disabled="item.quantity <= 1"` / `>= item.product.stock"`）、Playfair 小計、細字底線「移除」（觸發既有 `confirmDelete`）
  - 確認刪除 modal 保留邏輯、重新套新風格（sharp corner、髮絲線）
  - 摘要側欄（blush 底）：小計/運費（`total >= 500` 顯示綠字「免運」否則 NT$150）/Playfair 總計、全寬「前往結帳」（既有 `goCheckout`）、繼續選購→`/shop`、❀ 信任標語
  - 空車狀態保留：「購物車是空的」+「去逛逛」→`/shop`
  - **`public/js/pages/cart.js`** 預期不需改（檢查後若 total 計算/綁定相容即不動）

### 6. 圖片素材
Hero/故事/訂閱區使用 Unsplash 外部 URL（與既有 seed data 模式一致），挑選花卉主題圖並加 `?w=1600&q=80` 參數；商品圖一律使用 DB `image_url`。

## 不變動範圍

- checkout / login / orders / order-detail / admin 各頁 HTML 不動（僅透過 token 值換色）
- 所有 API routes、middleware、資料庫、測試
- `views/layouts/front.ejs` 結構（除非 script 順序需要，預期不動）

## 驗證方式

1. `npm run css:build` 編譯成功
2. `npm test` 全數通過（API 測試，應不受影響）
3. `node server.js` 啟動後逐頁驗證：
   - `GET /`、`/shop`、`/products/:id`（用 seed 商品 id）、`/cart` 回 200 且含關鍵字（FLORISTE、花卉商城等）
   - 瀏覽器手動流程：首頁加入購物袋 → badge +1 → /shop 分頁切換與排序 → 詳情頁數量加減後加入 → 購物車改量/移除/免運條變化 → 前往結帳導向正常
4. 對照 Pencil 截圖比對四頁視覺還原度

---

## 執行結果（2026-06-08 完成）

| 驗證項目 | 結果 |
|---------|------|
| `npm run css:build` | ✅ Tailwind v4.2.2 編譯成功 |
| `npm test` | ✅ 32/32 全數通過（6 個測試檔） |
| 頁面回應 | ✅ `/`、`/shop`、`/products/:id`、`/cart`、`/checkout`、`/login` 全部 200 |
| 內容標記 | ✅ FLORISTE / ALL BOTANICALS / ORDER SUMMARY / BEFORE YOU ORDER 正確渲染 |
| 客戶端 JS | ✅ `node --check` 5 個檔案語法通過 |

### 實際異動檔案

- `public/css/input.css` — theme token 換值 + 新增 forest/hairline/字體 token
- `views/partials/head.ejs` — 字體載入 + 標題改 FLORISTE
- `views/partials/header.ejs`、`views/partials/footer.ejs` — 重寫（保留全部 JS hooks）
- `views/layouts/front.ejs` — 新增 `fullBleed` 選項
- `views/pages/index.ejs` + `public/js/pages/index.js` — 編輯風形象首頁
- `views/pages/shop.ejs` + `public/js/pages/shop.js` — 新增商城頁（含客戶端排序）
- `src/routes/pageRoutes.js` — 新增 `GET /shop` 路由
- `views/pages/product-detail.ejs` + `public/js/pages/product-detail.js` — 重寫 + 推薦商品
- `views/pages/cart.ejs` — 重寫（`cart.js` 相容未改）

### 計畫偏差紀錄

- 商品詳情頁依計畫**未做縮圖列**（DB 僅單張 `image_url`）
- 設計來源：Pencil 檔 `pencil-new.pen` 四個頂層 frame（Homepage / Shop / Product Detail / Cart — Artisan Editorial）
