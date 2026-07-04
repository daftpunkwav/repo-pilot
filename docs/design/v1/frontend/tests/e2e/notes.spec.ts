import { test, expect } from '@playwright/test';
import { loginAsMockUser } from './helpers';

test.describe('notes', () => {
  test('lists notes and opens editor', async ({ page }) => {
    await loginAsMockUser(page);
    await page.goto('/notes');
    const first = page.getByTestId('note-item').first();
    await expect(first).toBeVisible({ timeout: 15000 });
    await first.click();
    await expect(page.getByTestId('save-note-btn')).toBeVisible();
  });
});
