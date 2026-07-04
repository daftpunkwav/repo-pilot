import { test, expect } from '@playwright/test';

test.describe('auth', () => {
  test('login with mock credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="username"]', 'zhang.jie');
    await page.fill('[name="password"]', 'demo1234');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('stats-cards')).toBeVisible();
  });

  test('redirects unauthenticated users', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL('/login');
  });
});
