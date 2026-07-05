import { expect, test, type Page } from '@playwright/test';
import { loginAsMockUser } from './helpers';

const OVERVIEW_MOCK_ROUND_KEY = 'rp_overview_mock_round';

async function openOverviewRound(page: Page, round: 1 | 2 | 3) {
  await page.addInitScript((key) => {
    localStorage.removeItem('rp_token');
    localStorage.removeItem('rp_refresh');
    localStorage.setItem(key, String(round));
  }, OVERVIEW_MOCK_ROUND_KEY);

  await page.goto(`/?mock_round=${round}`);
  await loginAsMockUser(page, '/');
}

async function expectPanelHeightsMatch(page: Page) {
  const progress = page.getByTestId('overview-progress');
  const activity = page.getByTestId('overview-activities');
  const recommend = page.getByTestId('overview-recommendations');
  const notes = page.getByTestId('overview-notes');

  const progressBox = await progress.boundingBox();
  const activityBox = await activity.boundingBox();
  const recommendBox = await recommend.boundingBox();
  const notesBox = await notes.boundingBox();

  expect(progressBox).not.toBeNull();
  expect(activityBox).not.toBeNull();
  expect(recommendBox).not.toBeNull();
  expect(notesBox).not.toBeNull();

  expect(Math.abs(progressBox!.height - activityBox!.height)).toBeLessThan(2);
  expect(notesBox!.height).toBeGreaterThanOrEqual(recommendBox!.height - 2);
}

test.describe('总览 Mock 三轮场景', () => {
  test('Round 1 · 基线数据完整展示', async ({ page }) => {
    await openOverviewRound(page, 1);

    await expect(page.getByTestId('overview-progress')).toBeVisible();
    await expect(page.getByText('分类总览')).toBeVisible();
    await expect(page.getByTestId('overview-activity-item')).toHaveCount(10);
    await expect(page.getByTestId('overview-recommend-item')).toHaveCount(5);
    await expect(page.getByTestId('overview-note-item')).toHaveCount(4);
    await expect(page.getByTestId('overview-trending-card')).not.toHaveCount(0);
    await expect(page.getByText('该周期暂无数据')).toHaveCount(0);

    await expectPanelHeightsMatch(page);
  });

  test('Round 2 · 增量笔记与活动', async ({ page }) => {
    await openOverviewRound(page, 2);

    await expect(page.getByTestId('overview-activity-item')).toHaveCount(10);
    await expect(
      page.getByTestId('overview-activities').getByText('创建笔记「D3 力导向图初探」'),
    ).toBeVisible();
    await expect(page.getByTestId('overview-note-item')).toHaveCount(4);
    await expect(
      page.getByTestId('overview-notes').getByRole('link', { name: 'Supabase Auth Hooks 速记' }),
    ).toBeVisible();

    await expectPanelHeightsMatch(page);
  });

  test('Round 2 · 刷新后增量数据仍在', async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, '2');
    }, OVERVIEW_MOCK_ROUND_KEY);

    await page.goto('/?mock_round=2');
    await loginAsMockUser(page, '/');
    await expect(
      page.getByTestId('overview-activities').getByText('创建笔记「D3 力导向图初探」'),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('overview-hero')).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByTestId('overview-activities').getByText('创建笔记「D3 力导向图初探」'),
    ).toBeVisible();
    await expect(
      page.getByTestId('overview-notes').getByRole('link', { name: 'D3 力导向图初探' }),
    ).toBeVisible();

    await page.goto('/');
    await expect(page.getByTestId('overview-hero')).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByTestId('overview-activities').getByText('成功导入 1 个，失败 0 个'),
    ).toBeVisible();
  });

  test('Round 3 · 后端刷新推荐 / 进度 / 热门', async ({ page }) => {
    await openOverviewRound(page, 3);

    await expect(page.getByText('FastAPI 进阶与 D3 入门笔记')).toBeVisible();
    await expect(page.getByTestId('overview-recommend-item')).toHaveCount(5);
    await expect(page.getByText('claude-code')).toBeVisible();
    await expect(page.getByTestId('overview-trending-card').first()).toContainText('claude-code');

    const masteredCount = page.locator('.progress-row').filter({ hasText: '已掌握' }).locator('.pv');
    await expect(masteredCount).toHaveText(/\d+/);

    await expectPanelHeightsMatch(page);
  });
});
