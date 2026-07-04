import { test, expect } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('[name="username"]', 'zhang.jie');
  await page.fill('[name="password"]', 'demo1234');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
}

test.describe('graph', () => {
  test('renders force graph svg', async ({ page }) => {
    await login(page);
    await page.goto('/graph');
    await expect(page.getByTestId('force-graph-svg')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('graph-node').first()).toBeVisible();
  });
});
