const { test, expect } = require('@playwright/test');

// Seeded admin account (src/database.js)
const ADMIN_EMAIL = 'admin@hexschool.com';
const ADMIN_PASSWORD = '12345678';

test.describe('登入 / 註冊頁', () => {
  test('切換到註冊分頁會顯示姓名欄位', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '註冊', exact: true }).click();
    await expect(page.getByPlaceholder('請輸入您的姓名')).toBeVisible();
  });

  test('密碼顯示／隱藏切換', async ({ page }) => {
    await page.goto('/login');
    const pw = page.getByPlaceholder('請輸入密碼');
    await expect(pw).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: '顯示密碼' }).click();
    await expect(pw).toHaveAttribute('type', 'text');
  });

  test('空欄送出顯示驗證錯誤', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: '登 入' }).click();
    await expect(page.getByText('請輸入 Email')).toBeVisible();
    // 仍停留在登入頁，未送出
    await expect(page).toHaveURL(/\/login/);
  });

  test('以管理員帳號登入成功並顯示登出', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('your@email.com').fill(ADMIN_EMAIL);
    await page.getByPlaceholder('請輸入密碼').fill(ADMIN_PASSWORD);
    await page.getByRole('button', { name: '登 入' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: '登出' })).toBeVisible();
    // 管理員會看到後台管理連結
    await expect(page.getByRole('link', { name: '後台管理' })).toBeVisible();
  });

  test('註冊新帳號成功後自動登入並導向首頁', async ({ page }) => {
    const email = `e2e_${Date.now()}@example.com`;
    await page.goto('/login');
    await page.getByRole('button', { name: '註冊', exact: true }).click();
    await page.getByPlaceholder('請輸入您的姓名').fill('E2E 測試員');
    await page.getByPlaceholder('your@email.com').fill(email);
    await page.getByPlaceholder('至少 6 個字元').fill('test1234');
    await page.getByRole('button', { name: '註 冊' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: '登出' })).toBeVisible();
  });
});
