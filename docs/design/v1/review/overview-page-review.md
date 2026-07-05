# 总览页（Overview）审查报告

> 审查范围：`docs/design/v1/frontend` 总览页及相关 API / Mock / Hooks  
> 审查日期：2026-07-05  
> 视觉验收：已通过（用户确认）

---

## 结论摘要

总览页 **UI 原型完成度高**，数据层已用 `IApiClient` 统一抽象，**Mock 可完整演示交互**。但与真实后端 / LLM 对接仍处 **Phase 2 前半段**：7 个数据区块中，仅 **进度统计、最近笔记（Mock 内存）** 能随用户操作即时变化；其余多为静态 Mock 或模板 SSE。

**API 契约整体规范**（TypeScript 接口 + `ApiResponse` 包装 + SSE `AsyncGenerator`），但 **交接文档未覆盖总览专用接口**，且 **Real HTTP Client 尚未实现**。

**发现 1 项重大安全问题**（Mentor 周报 XSS），需在接 LLM 前修复。若干 **缓存失效缺口** 会导致总览数据与用户操作不同步，应尽早修复。

---

## 用户九问逐条答复

| # | 问题 | 能否真实对接？ | 当前状态 | 建议 |
|---|------|----------------|----------|------|
| 1 | Mentor 本周学习总结由 LLM 生成 | **能** | `UserProfile.history_summary` 静态 Mock 字符串；UI 用 `dangerouslySetInnerHTML` | 后端定时/事件 Job 写 `history_summary`（Markdown）；前端安全渲染 |
| 2 | 最近活动由后端更新 | **能** | Mock 返回固定 5 条 `MOCK_ACTIVITIES`，变更项目/笔记后不更新 | 后端 Activity Feed + 前端 mutation 后 invalidate |
| 3 | 为你推荐 + 理由由 Agent/LLM 生成；刷新策略在后端 | **能** | Mock 按 stars 排序 + 硬编码 `reason`；无刷新协议 | 后端 `GET /overview/recommendations` + `meta.generated_at` / ETag；**不应**让用户手动刷新，由后端策略 + Webhook/定时重算；前端仅在相关 mutation 后 refetch |
| 4 | 悬停 Scout 由 LLM 生成 | **能** | `streamTrendingScoutIntro` SSE 接口已定义，Mock 模板流式输出 | Real 端 POST SSE + 限流；前端已用 `useTrendingScoutSpot` 消费 `text_delta` |
| 5 | 分类总览真实更新 | **部分** | UI 标题为「分类总览」，实际展示 **`by_progress` 四档进度**，非 category；`by_category` 已在 `ProjectStats` 聚合但未用 | 若产品意指进度分布：已随 `getProjectStats` 更新；若意指分类：需改 UI 或增 API 字段 |
| 6 | 最近笔记随笔记更新 | **能** | Mock 从内存 `notes[]` 读取，**正确**；但 note mutation 未 invalidate `overview/recentNotes` | mutation 后 invalidate 即可 |
| 7 | GitHub 热门真实获取 | **能** | Mock 静态 `TRENDING_DATA`（daily/weekly/monthly） | 后端代理 GitHub Trending / 自建爬虫；前端 `listTrending({ period, language })` 已就绪 |
| 8 | API 是否规范 | **基本规范** | 见下文「API 设计」 | 补全交接文档、统一 queryKey、Real Client |
| 9 | 安全 / 现代 / 易拓展 / 易维护 | **中等** | 类型安全、Hook 分层良好；OverviewPage 仍偏大；无 Real Client | 见下文分级问题清单 |

---

## 架构与数据流

```
OverviewPage
├── useProjectStats ────── getProjectStats()          ✅ Mock 动态聚合
├── useQuery userProfile ─ getUserProfile()           ⚠️ history_summary 静态
├── useActivities ─────── listActivities()          ❌ Mock 静态
├── useRecommendedProjects listRecommendedProjects()  ⚠️ Mock 伪推荐
├── useOverviewRecentNotes listOverviewRecentNotes() ✅ Mock 动态（缺 invalidate）
├── useTrending ─────────── listTrending(period)      ❌ Mock 静态
├── useTrendingScoutSpot ─ streamTrendingScoutIntro() ✅ SSE 契约就绪
└── AgentCarousel ───────── agentCatalog.ts（静态）   ⏸ 非总览数据问题
```

**React Query 全局**：`staleTime: 5min`，`refetchOnWindowFocus: false`。总览不会在切 tab 时自动刷新，**必须**依赖 mutation invalidate 或后端推送。

---

## API 设计评价

### 优点

- `IApiClient` 单一入口，Mock / Real 可替换（`VITE_USE_MOCK`）。
- 总览 DTO 独立：`RecommendedProject`、`OverviewRecentNote`、`TrendingScoutIntroParams`，不污染核心 Project/Note 类型。
- Scout 与 Agent 对话同模式：`AsyncGenerator<SSEEvent>` + `text_delta` / `done`。
- 认证：Mock 用 `requireAuth()`，与 ProtectedRoute 一致。

### 不足

| 项 | 说明 |
|----|------|
| 交接文档缺口 | `process/frontend-api-contract.md` 未列出 `listTrending`、`listActivities`、`listRecommendedProjects`、`listOverviewRecentNotes`、`streamTrendingScoutIntro` |
| 无 REST 路径映射 | 仅 TS 方法名，Real 实现需自行约定 URL |
| 推荐刷新语义缺失 | 无 `generated_at`、`version`、`refresh_policy` 字段 |
| `history_summary` 格式未定义 | 当前当 HTML 注入；应明确 Markdown/plain |
| queryKey 分散 | `['overview','recommendations']` 与 mutations 无联动 |

---

## 问题分级

### 🔴 重大（必须立即修复）

| ID | 问题 | 位置 | 风险 |
|----|------|------|------|
| O-SEC-01 | Mentor 周报 `dangerouslySetInnerHTML` 渲染 `history_summary` | `OverviewPage.tsx` L248–254 | LLM/后端若返回恶意 HTML → XSS |

### 🟠 功能缺陷（尽早修复）

| ID | 问题 | 位置 |
|----|------|------|
| O-FUNC-01 | 笔记 CRUD 后不 invalidate `overview/recentNotes` | `hooks/useNotes.ts` |
| O-FUNC-02 | import / progress / note 后不 invalidate `activities`、`recommendations` | `hooks/useProjects.ts`、`useNotes.ts` |
| O-FUNC-03 | Mock `listActivities` 返回静态数组，不反映用户操作 | `api/mock/index.ts` L711–714 |
| O-FUNC-04 | 最近活动全部链接 `/agent`，忽略 `type` / `project_id` | `OverviewPage.tsx` L295–298 |
| O-FUNC-05 | Scout 流无 `error` 处理，失败时无反馈 | `hooks/useTrendingScoutSpot.ts` |
| O-FUNC-06 | Real API Client 未实现，生产无法对接 | `api/client.ts` L157 |

### 🟡 体验 / 规格差距（可后续迭代）

| ID | 问题 |
|----|------|
| O-UX-01 | 「分类总览」展示进度非 category |
| O-UX-02 | Trending 全部外链 GitHub，已导入项目未跳详情 |
| O-UX-03 | Trending 无语言筛选 UI（API 已支持 `language`） |
| O-UX-04 | 推荐区未展示 `recommended_by` Agent |
| O-UX-05 | Mentor 周报不可点击跳转 Agent |
| O-UX-06 | Phase 2 规格项缺失：统计卡、继续学习、导入 Stars 快捷入口等（见 `process/02-OVERVIEW.md`） |

### 🔵 后端 / LLM 依赖（非前端独力可完成）

| ID | 依赖 |
|----|------|
| O-BE-01 | LLM 生成 `history_summary`、推荐列表、Scout intro |
| O-BE-02 | Activity Feed 持久化与聚合 |
| O-BE-03 | GitHub Trending 数据源 |
| O-BE-04 | 推荐重算策略（ cron / 事件驱动），非用户手动刷新 |

### 🟣 安全与其他（中低）

| ID | 问题 | 级别 |
|----|------|------|
| O-SEC-02 | Token 存 localStorage，无 refresh 自动续期 | Medium（Mock 阶段可接受） |
| O-SEC-03 | `MarkdownRenderer` 无 rehype-sanitize（总览未用，Agent 页用） | Medium |
| O-SEC-04 | Mock 演示密码硬编码 | Low（仅 dev） |

---

## 可维护性与扩展性

| 维度 | 评分 | 说明 |
|------|------|------|
| 类型安全 | ⭐⭐⭐⭐ | `api/types.ts` 完整 |
| 分层 | ⭐⭐⭐ | Hooks 分离良好；`OverviewPage` ~470 行可后续拆块 |
| LLM 扩展 | ⭐⭐⭐⭐ | SSE 模式统一，Scout/Agent 易接 Real |
| 测试 | ⭐⭐ | 总览无单测 / e2e 覆盖 |
| 文档 | ⭐⭐⭐ | 有 process 规格，API 契约待补 |

---

## 修复建议（本分支执行）

| 优先级 | 动作 | 对应 ID |
|--------|------|---------|
| P0 | 移除 `dangerouslySetInnerHTML`，纯文本/Markdown 安全渲染 | O-SEC-01 |
| P1 | 统一 overview query invalidate | O-FUNC-01, O-FUNC-02 |
| P1 | Mock 可变 Activity Feed | O-FUNC-03 |
| P1 | 活动项按 type 深链 | O-FUNC-04 |
| P2 | Scout SSE error 处理 | O-FUNC-05 |
| P2 | 补全 `frontend-api-contract.md` 总览章节 | API 文档 |

**不在本分支修复**：Real HTTP Client（O-FUNC-06）、LLM 后端、GitHub Trending 真源、Phase 2 全量规格 gap。

---

## 附录：关键文件

| 文件 | 职责 |
|------|------|
| `frontend/src/pages/OverviewPage.tsx` | 总览 UI |
| `frontend/src/hooks/useOverview.ts` | 推荐、最近笔记 |
| `frontend/src/hooks/useTrendingScoutSpot.ts` | Scout 悬停 SSE |
| `frontend/src/api/client.ts` | `IApiClient` 契约 |
| `frontend/src/api/mock/index.ts` | Mock 实现 |
| `frontend/src/api/mock/data/{trending,activities,recommendations}.ts` | 静态数据 |
| `process/02-OVERVIEW.md` | 产品规格 |
| `process/frontend-api-contract.md` | 后端交接 |
