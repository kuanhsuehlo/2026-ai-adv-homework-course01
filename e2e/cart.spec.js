const { test, expect } = require('@playwright/test');

test.describe('訪客購物車流程', () => {
  test('從商城加入商品 → 購物車顯示 → 改量 → 移除清空', async ({ page }) => {
    // 1. 商城加入第一件商品
    await page.goto('/shop');
    const addBtn = page.getByRole('button', { name: '加入購物袋' }).first();
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // 購物袋 badge 出現並顯示 1
    const badge = page.locator('#cart-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('1');

    // 2. 購物車頁顯示該商品
    await page.goto('/cart');
    await expect(page.getByText('購物袋是空的')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '前往結帳' })).toBeVisible();
    await expect(page.getByRole('button', { name: '移除', exact: true })).toHaveCount(1);

    // 3. 數量 +1：minus 鈕由 disabled 變為 enabled
    const minus = page.getByRole('button', { name: '−' });
    await expect(minus).toBeDisabled();
    await page.getByRole('button', { name: '+' }).click();
    await expect(minus).toBeEnabled();

    // 4. 移除 → 確認 → 購物車清空
    await page.getByRole('button', { name: '移除', exact: true }).click();
    await expect(page.getByRole('heading', { name: '確認移除' })).toBeVisible();
    await page.getByRole('button', { name: '確認移除', exact: true }).click();
    await expect(page.getByText('購物袋是空的')).toBeVisible();
  });
});
