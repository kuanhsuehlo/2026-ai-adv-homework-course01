const { defineConfig, devices } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const PORT = 3100;
const TMP_DIR = path.join(__dirname, 'e2e', '.tmp');
const DB_PATH = path.join(TMP_DIR, 'e2e.sqlite');

// Runs at config load (in every Playwright process) — before the webServer boots.
// Just ensure the dir exists so better-sqlite3 can create the DB file there.
// We intentionally do NOT wipe the DB: src/database.js seeds products + admin once
// on first connection, register tests use unique emails, and cart tests use a fresh
// guest session per run — so a persistent seeded test DB stays deterministic.
fs.mkdirSync(TMP_DIR, { recursive: true });

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    trace: 'on-first-retry',
    // 每個測試都錄成影片（test-results/.../video.webm），失敗時另存截圖
    video: 'on',
    screenshot: 'only-on-failure',
    // 放慢每個操作（毫秒），讓錄影好觀看；用 SLOWMO 環境變數覆寫，預設 0（CI 不放慢）
    launchOptions: { slowMo: Number(process.env.SLOWMO || 0) },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node server.js',
    url: `http://localhost:${PORT}`,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
      PORT: String(PORT),
      JWT_SECRET: 'e2e-test-secret',
      DB_PATH,
      // 綠界付款後的 OrderResultURL/ReturnURL 要指回這台 e2e server（而非預設的 :3001）
      BASE_URL: `http://localhost:${PORT}`,
      // 讓 server 端的 QueryTradeInfo(https→綠界) 信任公司根憑證，否則 TLS 驗證失敗
      NODE_OPTIONS: '--use-system-ca',
    },
  },
});
