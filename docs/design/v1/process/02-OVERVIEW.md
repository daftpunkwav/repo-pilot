# Phase 2 — 总览页

> **路由：** `/`  
> **前置依赖：** Gate 1  
> **原型参考：** `overview.html`  
> **门禁：** Gate 2

---

## 1. 页面职责

应用首页/dashboard：展示 **RepoPilot 产品价值**、用户库 **统计概览**、**学习进度分布**、**最近动态**、**GitHub 热门项目**、**快捷操作入口**。

**不是**项目完整列表（列表在 `/projects`）。

---

## 2. 功能清单

| 区块 | 功能 | 数据来源 |
|------|------|----------|
| Hero | 欢迎语（含用户名）、产品一句话介绍、快捷按钮 | `authStore.user` + 静态文案 |
| 统计卡 ×4 | 项目总数、学习中、已掌握、笔记数 | `getProjectStats()` + `listAllNotes()` |
| 学习进度分布 | 按 progress 四档横向条 | `getProjectStats().by_progress` |
| Agent 周报卡 | Mock 学习摘要（可点击跳 Agent） | Mock 静态 / `getUserProfile()` |
| 最近活动 | 最近导入/笔记/分析 5 条 | Mock `activities` 数组 |
| 继续学习 | 最近打开的 3 个项目卡片 | `listProjects({ sort_by: 'updated_at', page_size: 3 })` |
| GitHub 热门 | Tab: 今日/本周/本月 + 语言筛选 | `listTrending({ period, language })` |
| 产品说明 | RepoPilot 是什么、6 Agent 简介（可折叠） | 静态 Markdown |

### 快捷操作按钮

| 按钮 | 行为 |
|------|------|
| 导入 GitHub Stars | `navigate('/projects')` +  query `?import=stars` 打开抽屉 |
| 浏览项目库 | `navigate('/projects')` |
| 打开图谱 | `navigate('/graph')` |
| 与 Agent 对话 | `navigate('/agent')` |

---

## 3. 组件树

```
OverviewPage
├── OverviewHero
│   ├── 欢迎标题 + lede
│   └── QuickActions（4 按钮）
├── StatsCards（4 列 grid）
├── Row2Col
│   ├── ProgressPanel（学习进度条）
│   └── ActivityPanel（最近活动列表）
├── AgentSummaryCard（玻璃态周报）
├── ContinueLearning（项目卡片横滑/列表）
├── TrendingSection
│   ├── PeriodTabs（daily/weekly/monthly）
│   ├── LanguageFilter
│   └── TrendingRepoList
└── ProductIntro（折叠面板，Markdown）
```

---

## 4. Mock API

| 方法 | 说明 |
|------|------|
| `getProjectStats()` | 已有，见 FRONTEND_SPEC |
| `listProjects({ page_size: 3, sort_by: 'imported_at', sort_order: 'desc' })` | 继续学习 |
| `listAllNotes()` | 统计笔记数 |
| `listTrending({ period, language })` | **新增 Mock**，返回 8–12 条热门 repo |

**`listTrending` Mock 数据结构：**

```typescript
interface TrendingRepo {
  owner: string;
  repo: string;
  url: string;
  description?: string;
  language?: string;
  stars: number;
  stars_today?: number;
}
```

热门列表项点击 → 若未导入则提示「去项目库添加」；已导入则 `navigate(/projects/:id)`。

**`activities` Mock（内存数组）：**

```typescript
interface ActivityItem {
  id: string;
  type: 'import' | 'note' | 'agent' | 'progress';
  title: string;
  description: string;
  created_at: string;
  project_id?: string;
}
```

---

## 5. 设计规范

| 项 | 规范 |
|----|------|
| 布局 | 参考 `overview.html`：Hero → 4 列 stat → 2 列 panel → 热门区 |
| 统计卡 | `.stat-card` + 右上角 icon |
| Agent 周报 | `.agent-summary` 玻璃态（CSS 变量 `--glass-*`） |
| 热门 Tab | `.filter-btn` 风格，选中 `.active` |
| 响应式 | `<900px` 统计卡 2 列，2 列 panel 变 1 列 |

---

## 6. 规范与约束

- 热门数据 **Mock 模拟**，v1.0 后端可后续对接第三方或自建索引
- 产品文案可硬编码在 `constants/product.ts`，便于 i18n 预留
- 使用 `react-query`：`useProjectStats`, `useTrending`

---

## 7. 验收标准

| ID | 条件 |
|----|------|
| G2-01 | 登录后默认 landing 为 `/` 总览页 |
| G2-02 | 4 张统计卡数字与 Mock 数据一致 |
| G2-03 | 进度条四档比例正确 |
| G2-04 | 热门 Tab 切换重新拉取/过滤 Mock 数据 |
| G2-05 | 快捷按钮跳转正确；Stars 导入带 query 打开项目库抽屉（Phase 3 联调） |
| G2-06 | 继续学习卡片点击 → 项目详情 |
| G2-07 | 加载态骨架屏；空库时统计为 0 且不报错 |
| G2-08 | `data-testid="stats-cards"` 存在 |

---

## 8. 与 product 文档关系

本页为 **v1.0 新增**（相对原 MVP 将 `/` 设为 Dashboard 列表）。已在 `MVP_SCOPE.md §5.1` 更新：总览与项目库分离，符合原型与「所见所得」策略。
