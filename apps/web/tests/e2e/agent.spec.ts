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

  test('context panel collapses and expands', async ({ page }) => {
    await loginAsMockUser(page);
    await page.goto('/agent');
    await expect(page.getByText(/当前上下文/)).toBeVisible({ timeout: 15000 });

    await page.getByTestId('context-panel-collapse').click();
    await expect(page.getByTestId('context-panel-expand')).toBeVisible();
    await expect(page.getByText(/当前上下文/)).not.toBeVisible();

    await page.getByTestId('context-panel-expand').click();
    await expect(page.getByTestId('context-panel-collapse')).toBeVisible();
    await expect(page.getByText(/当前上下文/)).toBeVisible();
  });
});
