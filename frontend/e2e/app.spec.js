import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const signIn = async (page) => {
  await page.goto('/login');
  await page.getByLabel('อีเมล').fill('traveler@example.com');
  await page.locator('#password').fill('travel123');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('ทริปดี');
};

test('real API login, save, reload, remove, logout and guest recovery', async ({ page }) => {
  await signIn(page);
  const name = 'บ้านสวน ริเวอร์ไซด์';
  const top = page.getByRole('region', { name: /3 ที่พัก/ });
  await expect(top.locator('article')).toHaveCount(3);
  await top.getByRole('button', { name: `เพิ่มในรายการโปรด: ${name}` }).click();
  await expect(page.getByRole('status')).toContainText('บันทึกในรายการโปรดแล้ว');
  await page.getByRole('navigation', { name: 'เมนูหลัก' }).getByRole('link', { name: /รายการโปรด/ }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await page.getByRole('button', { name: `นำออกจากรายการโปรด: ${name}` }).click();
  await expect(page.getByRole('heading', { name: 'ยังไม่มีที่พักในรายการโปรด' })).toBeVisible();
  await page.getByRole('button', { name: 'ออกจากระบบ' }).click();
  await page.goto('/favorites');
  await expect(page.getByRole('heading', { name: 'เก็บที่พักที่ถูกใจไว้ด้วยกัน' })).toBeVisible();
});

test('register creates a working session and validates server errors', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('ชื่อ', { exact: false }).fill('ผู้เดินทางใหม่');
  await page.getByLabel('เบอร์โทรศัพท์', { exact: false }).fill('0891234567');
  await page.getByLabel('อีเมล').fill(`new-${Date.now()}@example.com`);
  await page.locator('#password').fill('travel123');
  await page.getByRole('button', { name: 'สร้างบัญชี', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ออกจากระบบ' })).toBeVisible();
  await page.getByRole('button', { name: 'ออกจากระบบ' }).click();
  await page.goto('/login');
  await page.getByLabel('อีเมล').fill('traveler@example.com');
  await page.locator('#password').fill('wrong-password');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Invalid credentials');
  await expect(page.getByRole('alert')).toBeFocused();
});

test('currency failure is recoverable and pagination works', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#all-hotels article')).toHaveCount(9);
  await page.getByRole('combobox', { name: 'สกุลเงิน' }).selectOption('USD');
  await expect(page.getByRole('button', { name: 'แสดงราคา THB แทน' })).toBeVisible();
  await page.getByRole('button', { name: 'แสดงราคา THB แทน' }).click();
  await expect(page.locator('#all-hotels article')).toHaveCount(9);
  await page.getByRole('button', { name: 'ถัดไป' }).click();
  await expect(page.locator('#all-hotels article')).toHaveCount(2);
});

test('save failure leaves favorite state unchanged and offers recovery', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/v1/favorites/*', async (route) => {
    if (route.request().method() === 'PUT') await route.fulfill({ status: 503, json: { message: 'Temporary error' } });
    else await route.continue();
  });
  const button = page.getByRole('button', { name: 'เพิ่มในรายการโปรด: บ้านสวน ริเวอร์ไซด์' }).first();
  await button.click();
  await expect(page.getByRole('alert')).toContainText('กรุณาลองกดหัวใจอีกครั้ง');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('responsive layout, keyboard controls and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [[1440, 1000], [375, 812], [812, 375]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.locator('#all-hotels article')).toHaveCount(9);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true });
  }
  const currency = page.getByRole('combobox', { name: 'สกุลเงิน' });
  await currency.focus();
  await expect(currency).toBeFocused();
  const heart = page.getByRole('button', { name: /เพิ่มในรายการโปรด/ }).first();
  const box = await heart.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await heart.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/login/);
});

test('home and authentication pass accessibility checks', async ({ page }) => {
  for (const path of ['/', '/login', '/register', '/favorites']) {
    await page.goto(path);
    if (path === '/') await expect(page.locator('#all-hotels article')).toHaveCount(9);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
  }
});
