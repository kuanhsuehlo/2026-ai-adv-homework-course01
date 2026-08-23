const { test, expect } = require('@playwright/test');

// 用真實的綠界 staging 跑完一筆「網路 ATM（土地銀行）」付款，並把訂單變成「已付款」。
test('綠界 staging 網路ATM 付款 → 訂單已付款', async ({ page }) => {
  test.setTimeout(180000);

  // 綠界送出時會跳原生 confirm/alert，預設會被自動取消（導致不導頁）→ 一律接受
  page.on('dialog', (d) => d.accept().catch(() => {}));

  const email = `ecpay_${Date.now()}@example.com`;

  // 1. 註冊並登入
  await page.goto('/login');
  await page.getByRole('button', { name: '註冊', exact: true }).click();
  await page.getByPlaceholder('請輸入您的姓名').fill('綠界測試員');
  await page.getByPlaceholder('your@email.com').fill(email);
  await page.getByPlaceholder('至少 6 個字元').fill('test1234');
  await page.getByRole('button', { name: '註 冊' }).click();
  await expect(page.getByRole('button', { name: '登出' })).toBeVisible();

  // 2. 加入商品（商品圖為 unsplash 外部資源，等 'load' 會被卡死 → 改等 DOM 就緒，
  //    加入購物袋按鈕由 Vue 透過 API 渲染，getByRole 會自動等它出現）
  await page.goto('/shop', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '加入購物袋' }).first().click();
  await expect(page.locator('#cart-badge')).toHaveText('1');

  // 3. 結帳建立訂單
  await page.goto('/cart');
  await page.getByRole('button', { name: '前往結帳' }).click();
  await page.waitForURL(/\/checkout/);
  await page.getByPlaceholder('請輸入收件人姓名').fill('綠界測試員');
  await page.getByPlaceholder('請輸入 Email').fill(email);
  await page.getByPlaceholder('請輸入收件地址').fill('台北市大安區仁愛路四段1號');
  await page.getByRole('button', { name: '確認送出訂單' }).click();

  // 4. 訂單詳情頁
  await page.waitForURL(/\/orders\/[^/]+$/, { timeout: 20000 });
  const orderUrl = page.url();
  console.log('[ECPAY] order url =', orderUrl);
  await expect(page.getByRole('button', { name: '前往付款' })).toBeVisible();

  // 5. 前往付款 → 綠界收銀台
  await page.getByRole('button', { name: '前往付款' }).click();
  await page.waitForURL((u) => String(u).includes('ecpay.com.tw') || String(u).includes('payment='), { timeout: 30000 });
  console.log('[ECPAY] after pay url =', page.url());
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'test-results/ecpay-cashier.png', fullPage: true });

  async function clickText(re) {
    const loc = page.locator('button:visible, a:visible, input[type=button]:visible, input[type=submit]:visible, span:visible').filter({ hasText: re });
    if (await loc.count().catch(() => 0)) {
      await loc.first().click({ timeout: 5000 }).catch(() => {});
      return true;
    }
    return false;
  }

  // 6. 網路 ATM → 台灣土地銀行 → 前往付款（staging 模擬銀行頁自動成功，免輸入帳號）
  await page.getByText('網路ATM', { exact: false }).first().click();
  const picked = await page.locator('#selWebATMBank').selectOption({ label: '台灣土地銀行' })
    .then(() => 'selWebATMBank').catch(() => null);
  console.log('[ECPAY] 選銀行 =', picked);

  // 點「前往付款」會先跳出 HTML 提示視窗（含「關閉」鈕）；按下「關閉」後才真正跳轉至銀行頁
  await page.locator('#WebATMPaySubmit').click();
  await page.getByRole('button', { name: '關閉' }).waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  const [popup] = await Promise.all([
    page.waitForEvent('popup', { timeout: 8000 }).catch(() => null),
    page.waitForURL((u) => !String(u).includes('AioCheckOut'), { timeout: 25000 }).catch(() => null),
    page.getByRole('button', { name: '關閉' }).click({ timeout: 5000 }).catch(() => {}),
  ]);
  const bank = popup || page;
  await bank.waitForLoadState('domcontentloaded').catch(() => {});
  console.log('[ECPAY] 關閉提示後 →', bank.url(), 'popup =', !!popup);
  await bank.screenshot({ path: 'test-results/ecpay-bank.png', fullPage: true }).catch(() => {});

  // 土地銀行 staging 模擬回傳表單（已預填 RC=0 / 交易成功），按「Save」送出即完成付款
  for (let i = 0; i < 8; i++) {
    if (popup && popup.isClosed()) break;
    if (!bank.url().includes('ecpay.com.tw')) break;
    const btn = bank.locator('button:visible, a:visible, input[type=button]:visible, input[type=submit]:visible')
      .filter({ hasText: /確認|確定|同意|付款|送出|完成|模擬|Save|Submit/i }).first();
    if (await btn.count().catch(() => 0)) await btn.click({ timeout: 4000 }).catch(() => {});
    else break;
    await bank.waitForTimeout(1500).catch(() => {});
  }
  console.log('[ECPAY] 銀行頁完成 →', bank.url());

  // 7. 回訂單頁，用「查詢付款狀態」(QueryTradeInfo) 確認模擬付款 → 已付款
  for (let i = 0; i < 10; i++) {
    await page.goto(orderUrl);
    if (await page.getByText('已付款').count()) break;
    const checkBtn = page.getByRole('button', { name: '查詢付款狀態' });
    if (await checkBtn.count()) await checkBtn.click().catch(() => {});
    await page.waitForTimeout(3000);
  }
  await expect(page.getByText('已付款')).toBeVisible({ timeout: 10000 });
  console.log('[ECPAY] 訂單已付款 ✓');
});
