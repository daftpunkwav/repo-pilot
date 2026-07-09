import { test, expect } from '@playwright/test';
import { loginAsMockUser } from './helpers';

test.describe('agent', () => {
  test('chat input and new session', async ({ page }) => {
    await loginAsMockUser(page);
    await page.goto('/agent');
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 15000 });

    const newSessionBtn = page.getByTestId('new-session-btn');
    await newSessionBtn.scrollIntoViewIfNeeded();
    await newSessionBtn.click();

    await page.getByTestId('chat-input').fill('你好');
    await page.getByRole('button', { name: '发送' }).click();
    await expect(page.getByTestId('stream-renderer')).toBeVisible({ timeout: 15000 });
  });
});
