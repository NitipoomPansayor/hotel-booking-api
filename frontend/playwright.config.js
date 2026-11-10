import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL || undefined },
  webServer: [
    { command: 'node e2e/server.js', url: 'http://127.0.0.1:5000/api/v1/hotels', timeout: 60000, reuseExistingServer: false },
    { command: 'npm run dev', url: 'http://127.0.0.1:5173', timeout: 30000, reuseExistingServer: false },
  ],
});
