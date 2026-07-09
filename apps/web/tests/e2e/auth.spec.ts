import { test, expect } from '@playwright/test';
import { clearMockAuth, loginAsMockUser, MOCK_USER } from './helpers';

test.describe('auth', () => {
  test('login with mock credentials', async ({ page }) => {
    await clearMockAuth(page);
    await page.fill('[name="username"]', MOCK_USER.username);
    await page.fill('[name="password"]', MOCK_USER.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('overview-hero')).toBeVisible({ timeout: 15000 });
  });

  test('redirects unauthenticated users', async ({ page }) => {
    await clearMockAuth(page);
    await page.goto('/projects');
    await expect(page).toHaveURL('/login');
  });
});
