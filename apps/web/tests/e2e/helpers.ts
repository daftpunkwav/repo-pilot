import { expect, type Page } from '@playwright/test';

/** Mock 演示账号（与 mock/data/users.ts 一致） */
export const MOCK_USER = {
  username: 'zhang.jie',
  password: 'demo1234',
} as const;

/** 清除 Mock 会话，保证未登录测试隔离 */
export async function clearMockAuth(page: Page) {
  await page.goto('/login');
  // §4.1.3: mock 端 token 现用内存 Map；先尝试通过 window.__mockAuth.clear() 清空，
  // 未注入时回退到 localStorage 调用（兼容历史 e2e 行为）。
  await page.evaluate(() => {
    const w = window as unknown as { __mockAuth?: { clear: () => void } };
    if (w.__mockAuth) {
      w.__mockAuth.clear();
      return;
    }
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
