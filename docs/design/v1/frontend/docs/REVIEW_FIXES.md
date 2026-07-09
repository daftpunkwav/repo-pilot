# v1 Frontend Review & Fixes

本目录汇集 `docs/design/v1/frontend`（含 mock 数据层）的审查与改进记录。

## 文档索引

- [REVIEW_REPORT.md](./REVIEW_REPORT.md) — 2026-07-09 全面审查报告（严重 / 中等 / 轻度问题分级、修复优先级）

## 关键设计决策

### API 抽象边界
- `IApiClient` 是 Mock / Real 的统一接口契约（[src/api/client.ts](../src/api/client.ts)）
- Mock-only 钩子（`applyOverviewScenario`、`getAppliedOverviewRound`）通过可选方法挂在接口上
- 应用层用 `applyOverviewScenarioIfMock(client, round)` 助手函数判断，避免 `instanceof MockApiClient` 泄漏
- 这样 `VITE_USE_MOCK=false` 时 mock 子树可被 tree-shake 剔除

### 状态管理分层
- **Zustand**：本地 UI 状态（主题、字体缩放、Agent 流式、笔记编辑态、图谱选中）
- **React Query**：远程数据缓存 + 失效（项目 / 笔记 / 设置 / 活动 / 推荐）
- **localStorage 持久化**（仅 `useUIStore`）：主题 / 侧栏折叠 / 缩放
- Token 暂存 localStorage（mock）；真实后端应迁到 httpOnly cookie

### SSE 流
- 解析器（[src/utils/sse-parser.ts](../src/utils/sse-parser.ts)）支持 `AbortSignal`，取消时关闭底层 reader
- 应用层（[src/components/agent/EmbedAgentChat.tsx](../src/components/agent/EmbedAgentChat.tsx)）16ms 节流 flush，避免每字触发整树 setState

### 错误处理
- 应用级 `ErrorBoundary`（[src/components/common/ErrorBoundary.tsx](../src/components/common/ErrorBoundary.tsx)）兜底任意渲染异常
- SSE 流异常统一通过 `useUIStore.addToast` 反馈给用户

## 已修复问题（2026-07-09）

| 严重度 | 问题 | 提交 |
|--------|------|------|
| S-3 | useTheme 错放 useSettings | `refactor(frontend): split useTheme from useSettings ...` |
| S-2 | EmbedAgentChat 吞异常 | `fix(agent): surface SSE errors in EmbedAgentChat ...` |
| S-1 | MockApiClient 泄漏到 app 层 | `refactor(frontend): remove MockApiClient import from app code` |
| M-4 | 缺 ErrorBoundary | `feat(frontend): add app-level ErrorBoundary` |
| M-1 | tsconfig 严格化 | `chore(frontend): tighten TS strictness and pin Node/npm versions` |
| L-1 | JSON 深克隆 | `refactor(frontend): replace JSON deep-clone with structuredClone` |
| L-3 | trending 场景化逻辑 | `fix(mock): apply scenarioTrendingWeekly to all weekly + language combos` |
| L-5 | 单测覆盖率 | `test(frontend): add unit tests for utils + projectStore + graphStore` |
| M-6 | 流式 setState | `perf(agent): throttle EmbedAgentChat text_delta flushes to 16ms` |
| S-5 | SSE 取消 | `feat(frontend): add AbortSignal support to SSE parser` |

## 后续 TODO

| 严重度 | 问题 | 备注 |
|--------|------|------|
| M-3 | Settings 双字段（llm_model / llm_default_model） | 与后端约定后再决定 deprecate |
| M-8 | vite-env.d.ts 扩展 | 等真实后端 base URL 方案 |
| L-2 | formatNumber 百万扩展 | 真实数据量大时再优化 |
| L-4 | useAuth useCallback 冗余 | 等待 zustand 5 升级 |
| L-6 | E2E 多浏览器 | CI 阶段引入 |
| M-7 | mock round 同步去重 | 与 S-1 合并后已部分解决 |
| M-5 | rehype-sanitize 留位 | 等 Agent 输出扩展时加 |
