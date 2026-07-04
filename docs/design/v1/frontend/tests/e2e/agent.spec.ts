import { test, expect } from '@playwright/test';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('[name="username"]', 'zhang.jie');
  await page.fill('[name="password"]', 'demo1234');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/');
}

test.describe('agent', () => {
  test('chat input and new session', async ({ page }) => {
    await login(page);
    await page.goto('/agent');
    await page.getByTestId('new-session-btn').click();
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await page.getByTestId('chat-input').fill('你好');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(page.getByTestId('stream-renderer')).toBeVisible({ timeout: 10000 });
  });
});
