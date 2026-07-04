import { test, expect } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('[name="username"]', 'zhang.jie');
  await page.fill('[name="password"]', 'demo1234');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
}

test.describe('notes', () => {
  test('lists notes and opens editor', async ({ page }) => {
    await login(page);
    await page.goto('/notes');
    const first = page.getByTestId('note-item').first();
    await expect(first).toBeVisible();
    await first.click();
    await expect(page.getByTestId('save-note-btn')).toBeVisible();
  });
});
