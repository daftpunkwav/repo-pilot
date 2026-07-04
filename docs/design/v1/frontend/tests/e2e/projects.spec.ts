import { test, expect } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('[name="username"]', 'zhang.jie');
  await page.fill('[name="password"]', 'demo1234');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
}

test.describe('projects', () => {
  test('shows project table', async ({ page }) => {
    await login(page);
    await page.goto('/projects');
    await expect(page.getByTestId('project-table')).toBeVisible();
    await expect(page.getByTestId('import-stars-btn')).toBeVisible();
  });
});
