import { expect, type Page } from '@playwright/test';

/** Mock 演示账号（与 mock/data/users.ts 一致） */
export const MOCK_USER = {
  username: 'zhang.jie',
  password: 'demo1234',
} as const;

/** 清除 Mock 会话，保证未登录测试隔离 */
export async function clearMockAuth(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.removeItem('rp_token');
    localStorage.removeItem('rp_refresh');
  });
}

/**
 * 登录并等待受保护页面就绪。
 * 总览页 overview-hero 出现即表示 auth + 数据查询均正常。
 */
export async function loginAsMockUser(page: Page, landingPath = '/') {
  await clearMockAuth(page);
  await page.fill('[name="username"]', MOCK_USER.username);
  await page.fill('[name="password"]', MOCK_USER.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(landingPath);
  await expect(page.getByTestId('overview-hero')).toBeVisible({ timeout: 15000 });
}
