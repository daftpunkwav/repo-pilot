# v1 Frontend + Mock 综合审查报告

> 范围：`docs/design/v1/frontend/`（排除 `node_modules` / `dist` / `screenshots` / `output` / `test-results`）
> 目标：现代化 / 规范 / 安全 / 可维护 / 可扩展 / 为未来后端 + Agent 服务预留接口
> 报告日期：2026-07-09

## 总体评价

**整体质量良好**——架构清晰、类型严格（`strict + noUncheckedIndexedAccess + noUnusedLocals`），API/Mock 接口契约完整（`IApiClient` 50+ 方法统一签名），React Query + Zustand 分工合理，玻璃拟态设计系统初具雏形。

**主要风险点**：
1. Mock 类型泄漏到 `main.tsx` 与 1 个 hook（违反抽象边界）
2. `EmbedAgentChat` 吞掉异常，无错误状态（`SSE` 流断线用户无感）
3. 主题 `useTheme` 被错放在 `useSettings` 模块（命名混乱）
4. `tsconfig.json` 缺少 `exactOptionalPropertyTypes`、`verbatimModuleSyntax`
5. 测试覆盖率极低（仅 1 个 store + 1 个 util）
6. `dist/`、`*.log` 未被 `.gitignore` 显式排除（`dist` 已排除，但 `dev.log` 之类会泄漏）
7. `git config user.email` 当前是 `agent@repopilot.local`，与要求不符

---

## 严重问题（必修，5 项）

### S-1. Mock 类型/类泄漏到生产代码
- 位置：`src/main.tsx:5-6`、`src/hooks/useOverviewMockRoundSync.ts:5`
- 现状：`main.tsx` 直接 `import { MockApiClient } from '@/api/mock'`，在 `if (client instanceof MockApiClient)` 分支中调用 `applyOverviewScenario`。
- 影响：未来切到 Real API 时，编译期不会报错；Mock 是开发期实现，不应被引导/同步层依赖。
- 建议：抽象出 `IApiClientDevHooks`（如 `getAppliedDevSnapshot?: () => unknown`），让 `MockApiClient` 自报；非 mock 客户端该方法为 `undefined`。同步逻辑走 `if (client.getAppliedDevSnapshot)` 即可。这样 `main.tsx` 永远不需要 `instanceof MockApiClient`。

### S-2. `EmbedAgentChat.send` 异常被静默吞掉
- 位置：`src/components/agent/EmbedAgentChat.tsx:68-91`
- 现状：`try {...} finally { setStreaming(false); }`——`catch` 不存在，但 SSE 流异常会直接 `finally` 退出，`assistant` 文本可能残缺且无任何 toast/banner 提示。
- 影响：用户看到一半流卡住、点击发送却无任何反馈。
- 建议：补 `catch`，调用 `addToast({ type: 'error', message: '连接中断，请重试' })`；或在底部红字 inline 错误。

### S-3. `useTheme` 错放在 `useSettings.ts`
- 位置：`src/hooks/useSettings.ts:29-36`
- 现状：`useTheme` 与 UI 偏好（`fontScale`）混在 settings 模块中，但实际状态来自 `useUIStore`；命名上让人误以为跟 LLM settings 有关。
- 影响：未来拆包/重构时容易改错；命名误导。
- 建议：拆出 `src/hooks/useTheme.ts`，原 `useSettings` 仅保留 LLM 相关。

### S-4. `git config user.email` 与要求不符
- 位置：仓库根 `git config`
- 现状：`user.email=agent@repopilot.local`，但要求三个远端推送邮箱均为 `daftpunk.wav@outlook.com`。
- 建议：本次修复已切换为 `daftpunk.wav@outlook.com`（已通过 `git config user.email` 修改），提交后推送三个远端都会用此邮箱。

### S-5. SSE 解析器无错误/取消传播
- 位置：`src/utils/sse-parser.ts:7-31`
- 现状：解析器未暴露 `AbortSignal`；下游（EmbedChatChat、TrendingScoutSpot、agentStore）只能靠 generation 计数器"放弃"结果，无法真正关闭底层 `reader`。
- 影响：取消请求时 TCP 连接不会立即关闭，造成资源浪费与潜在状态错乱。
- 建议：`parseSSEStream(reader, signal?: AbortSignal)`；遇到 `signal.aborted` 即 `break` 并 `reader.cancel()`。

---

## 中等问题（应修，8 项）

### M-1. `tsconfig` 缺严格化选项
- 位置：`tsconfig.json`
- 缺：`exactOptionalPropertyTypes`（避免 `field?: string` 被赋 `undefined`）、`noImplicitOverride`、`verbatimModuleSyntax`（更好支持 ESM/CJS 互操作）、`useUnknownInCatchVariables`（已隐式启用，补充明示）。
- 现状：`strict: true` 但其它严格选项不齐。

### M-2. `package.json` 缺 `engines` 与 `packageManager`
- 建议：固定 Node 版本（`>=20.11`），加 `engines` 与 `packageManager: "npm@10.x"`，CI 行为可重现。

### M-3. `Settings` 类型 `llm_model` 与 `llm_default_model` 双字段
- 位置：`src/api/types.ts:475-477`
- 现状：两个字段语义重叠，后端兼容考虑保留；但前端多处手动同步（如 `mock/index.ts:750-754`、`settingsStore.ts:39-41`），易错。
- 建议：保留字段但加 JSDoc 强调"前端只读 `llm_default_model`，`llm_model` 是后端冗余字段"；或在类型层加 `@deprecated` 标记（仅前端 `llm_model`）。

### M-4. 缺少 `ErrorBoundary`
- 位置：`src/main.tsx`、`src/App.tsx`
- 现状：任意渲染异常会致整页白屏。
- 建议：根级 `<ErrorBoundary fallback={…}>` 包裹 `<App />`，至少兜底"出错了，点此刷新"。

### M-5. Markdown 渲染未显式禁用 HTML
- 位置：`src/components/common/MarkdownRenderer.tsx`
- 现状：`react-markdown` 默认不渲染原始 HTML（已是安全默认），但项目无显式声明（如 `rehype-sanitize` 留位）。
- 建议：保留现状即可；如未来 Agent 输出可能含 HTML，补 `rehype-sanitize`。

### M-6. `EmbedAgentChat` `setLines` 在流期间每字都触发 setState
- 位置：`src/components/agent/EmbedAgentChat.tsx:72-75`
- 现状：每收到一个 `text_delta` 就整体重渲染 `lines` 数组，300 字符 = 300 次 setState。
- 建议：合并为 16ms 节流，或用 `useTransition` / `useDeferredValue`。

### M-7. `useOverviewMockRoundSync` 重复同步
- 位置：`src/hooks/useOverviewMockRoundSync.ts:21-31` + `main.tsx:14-18`
- 现状：URL → localStorage 同步在两处都做（`main.tsx:14` + hook 内），且都触发 `applyOverviewScenario`。
- 建议：仅保留一处职责（建议放 main.tsx bootstrap），hook 仅负责"已变更 → 失效 query"。

### M-8. 缺少 `import.meta.env` 完整类型
- 位置：`src/vite-env.d.ts:3-7`
- 现状：仅声明 `VITE_USE_MOCK` 与 `VITE_API_BASE_URL`。
- 建议：未来加 `VITE_SSE_BASE_URL` / `VITE_BUILD_SHA` 时显式声明，避免 `any` 推断。

---

## 轻度问题（优化，6 项）

### L-1. `JSON.parse(JSON.stringify(...))` 深克隆
- 位置：`src/api/mock/index.ts:102-104`、`src/api/mock/data/overviewScenarios.ts:30-32`
- 现状：丢失 `Date` / `Map` / `Set` / 函数；mock 数据虽无这些，但仍可优化。
- 建议：抽 `src/utils/clone.ts` 用 `structuredClone`（浏览器原生）。

### L-2. `formatNumber` 边界值问题
- 位置：`src/utils/format.ts:2-6`
- 现状：`n >= 10000` 直接 `floor(n/1000) + 'k'`，`220000` → `220k` 没问题；但 `1_500_000` → `1500k` 不符合直觉。
- 建议：扩展到 `m`（百万）。

### L-3. 重复 `clone` / `trendingWeekly` 兼容逻辑
- 位置：`src/api/mock/index.ts:787-789`
- 现状：`listTrending` 中 `if (params?.period === 'weekly' && this.scenarioTrendingWeekly)` 覆盖默认数据，但其他周期（`daily`/`monthly`）仍走默认。
- 建议：统一改成 `if (this.scenarioTrendingWeekly && period === 'weekly')`。

### L-4. `useAuth` hook 暴露冗余 `useCallback`
- 位置：`src/hooks/useAuth.ts:15-23`
- 现状：zstund action 引用本来就稳定，`useCallback` 包装无收益。
- 建议：直接返回 `login`/`register`。

### L-5. 测试覆盖严重不足
- 现状：仅 1 个 store + 1 个 util 测试；e2e 有 7 个 spec，但 unit 缺 store (project/note/agent/graph/settings) + hooks + utils (format/date/errors/validators 已覆盖其一)。
- 建议：至少补齐：
  - `authStore` login/logout 流程
  - `projectStore` filter reset / setSearch 行为
  - `useOverviewMockRoundSync` 副作用
  - `errors.ts` `isApiError` / `extractErrorMessage`
  - `format.ts` 边界

### L-6. E2E `chromium only`
- 位置：`playwright.config.ts:14`
- 现状：只跑 Chromium，多浏览器回归缺失。
- 建议：CI 启用 `chromium + webkit`，本地仍 chromium。

---

## 安全 / 隐私

- ✅ 无 `dangerouslySetInnerHTML` 使用
- ✅ 无 `eval` / `new Function`
- ⚠️ `localStorage` 存 access/refresh token：当前阶段 OK（mock），真实后端应迁移到 httpOnly cookie + 内存 access token
- ✅ Markdown 渲染默认安全
- ⚠️ `bindGithub` PAT 仅 echo 不存（`mock/index.ts:278` `void params.pat`），mock 没问题；真实后端需存加密
- ✅ 无密钥硬编码（mock token 用 `mock_token_${Date.now()}`）
- ⚠️ `setZoomLevel` 在 d3 zoom 回调里直接调用（`ForceGraph.tsx:65`）会触发 setState 每帧；性能可接受但应考虑节流

---

## 类型安全

- ✅ `strict + noUncheckedIndexedAccess + noUnusedLocals + noUnusedParameters + noFallthroughCasesInSwitch`
- ✅ `IApiClient` 接口完整
- ⚠️ `asSSETextDelta` 等 `sse-helpers` 用 `as unknown as T`（`src/utils/sse-helpers.ts:11-37`），运行期无校验。**这是合理的 trade-off**（性能），但应在 mock / real 端 schema 校验。
- ✅ 无 `any`（grep 验证）
- ✅ `no-non-null-assertion` 已开启

---

## 现代化 / React 19

- ✅ React 19.2 + react-router 7 + zustand 5 + react-query 5
- ✅ `useShallow` 用于 store 多字段读取
- ✅ 函数组件 + hooks
- ⚠️ 未使用 `use()`（`Promise` 卸载场景暂无需要）
- ⚠️ 未使用 `useTransition`（流式更新场景可优化，见 M-6）

---

## 修复优先级（推荐顺序）

1. **S-4** git 邮箱切换（已做）
2. **S-3** 拆 `useTheme.ts`（小改，1 commit）
3. **S-2** EmbedAgentChat 错误处理（小改，1 commit）
4. **S-1** Mock 抽象边界（小改，1 commit）— 大改动则开分支
5. **M-4** ErrorBoundary（小改）
6. **M-1** tsconfig 严格化（小改）
7. **M-2** package.json engines（小改）
8. **M-6** 流式 setState 节流（中改）
9. **M-7** mock round 同步去重（中改）
10. **S-5** SSE 解析器支持 abort（中改）
11. **L-1** `structuredClone`（小改）
12. **L-5** 补 unit test（中改）
13. **L-3** trending 场景化逻辑（小改）

---

## 已做小修复（本次会话内）

- ✅ `git config user.email` → `daftpunk.wav@outlook.com`
- ✅ `git config user.name` → `daftpunkwav`

## 待办（按上面顺序继续 commit + 推送）
