const { test, expect } = require('@playwright/test');

// 一鏡到底的完整使用者流程 —— 單一 test，因此只會錄成「一支」影片。
// 適合用來錄製示範影片；細項驗證請看 auth.spec.js / cart.spec.js。
test('完整流程：註冊 → 逛商城 → 加入購物車 → 改量 → 移除', async ({ page }) => {
  const email = `journey_${Date.now()}@example.com`;

  // 1. 註冊新帳號 → 自動登入並導向首頁
  await page.goto('/login');
  await page.getByRole('button', { name: '註冊', exact: true }).click();
  await page.getByPlaceholder('請輸入您的姓名').fill('示範帳號');
  await page.getByPlaceholder('your@email.com').fill(email);
  await page.getByPlaceholder('至少 6 個字元').fill('test1234');
  await page.getByRole('button', { name: '註 冊' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: '登出' })).toBeVisible();

  // 2. 逛商城，加入第一件商品到購物袋
  await page.goto('/shop');
  const addBtn = page.getByRole('button', { name: '加入購物袋' }).first();
  await expect(addBtn).toBeVisible();
  await addBtn.click();
  await expect(page.locator('#cart-badge')).toHaveText('1');

  // 3. 進購物車：增加數量
  await page.goto('/cart');
  await expect(page.getByRole('button', { name: '前往結帳' })).toBeVisible();
  const minus = page.getByRole('button', { name: '−' });
  await expect(minus).toBeDisabled();
  await page.getByRole('button', { name: '+' }).click();
  await expect(minus).toBeEnabled();

  // 4. 移除商品 → 確認 → 購物車清空
  await page.getByRole('button', { name: '移除', exact: true }).click();
  await expect(page.getByRole('heading', { name: '確認移除' })).toBeVisible();
  await page.getByRole('button', { name: '確認移除', exact: true }).click();
  await expect(page.getByText('購物袋是空的')).toBeVisible();
});
