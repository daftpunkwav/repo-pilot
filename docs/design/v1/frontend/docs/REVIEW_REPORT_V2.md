# v1 Frontend + Mock 第二轮审查报告

> 范围：`docs/design/v1/frontend/`（同第一轮）
> 时间：2026-07-09 第二轮
> 关注：第一轮未深入的页面/组件/CSS/mock data/e2e/规范文档

## 总体评价

第一轮修复（12 commits）后整体质量稳步上升。本轮发现的问题更多属于 **可读性 / 一致性 / 文档同步 / 测试细节** 层面。代码依然没有严重安全问题。

---

## 严重问题（必修，3 项）

### S-6. `runScout` 在 `ProjectDetailPage` 中无错误处理 + 状态泄漏
- 位置：`src/pages/ProjectDetailPage.tsx:92-108`
- 现状：切换到「ai」标签调用 `analyzeProject` 流；切换标签不会 abort 流，`scoutContent` 持续累积；用户切走再切回可能看到陈旧结果。流异常同样被吞掉。
- 影响：用户每次切回 AI 标签都会看到上一次的残留内容；中途切走浪费资源。
- 建议：用 `AbortController` 取消；切换标签时调用 `controller.abort()`。

### S-7. `ProjectDetailPage` 的 `runScout` 误用 `asSSETextDelta` 直接强转
- 位置：`src/pages/ProjectDetailPage.tsx:100-103`
- 现状：`asSSETextDelta` 只对 `text_delta` 事件有效，其他事件也会进入循环体；工具调用/问题/错误事件被忽略但占位 `thinking` / `tool_call` 都不显示。
- 影响：未来真实后端发 `tool_call` 时用户看不到任何视觉提示。
- 建议：用 `switch (event.event)` 分支渲染，与 `agentStore.processSSEStream` 保持一致。

### S-8. `Topbar` 用 `window.matchMedia` 在 SSR / 测试环境崩溃
- 位置：`src/components/layout/Topbar.tsx:34`
- 现状：`const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia(...).matches)` 在组件函数体内每次渲染都执行；Vitest jsdom 无 `matchMedia`，会抛 `ReferenceError`。
- 影响：单元测试挂载 Topbar 会直接报错。
- 建议：把 matchMedia 调用移到 `useEffect`；hook 同理（`useTheme` 中已正确处理，Topbar 漏了）。

---

## 中等问题（应修，7 项）

### M-9. `NotesPage.handleSave` 用 `getState()` 而不是订阅值
- 位置：`src/pages/NotesPage.tsx:64-67`
- 现状：每次保存都 `useNoteStore.getState()` 读取最新 title/content；与 React 响应式脱钩但能拿到最新值。可接受但风格不一致（其他 hook 都用 selector 订阅）。
- 建议：保持现状即可，但补一个单元测试覆盖空标题拒绝分支。

### M-10. `ProjectDetailPage` 缺少导航 Loading 兜底
- 位置：`src/pages/ProjectDetailPage.tsx:136`
- 现状：`if (isLoading || !project) return <LoadingSpinner />;`——`isError` 分支已经 `navigate('/projects')`，但页面仍在渲染（短暂闪烁）。
- 建议：`isError` 时直接 return null，或加 `Skeleton`。

### M-11. `ImportStarsDrawer` 中 `selected.has(key) || s.already_imported` 让已导入的 checkbox 永久 checked
- 位置：`src/components/project/ImportStarsDrawer.tsx:113`
- 现状：把 `already_imported` 与选中混在一起导致用户无法取消已导入项（虽然 `disabled`）。
- 建议：`checked={selected.has(key)}`，让 `disabled` 单独负责禁用。

### M-12. `GraphControls` 中 `minSimilarity` 渲染了但无控件
- 位置：`src/components/graph/GraphControls.tsx:21,70-71`
- 现状：只展示「阈值 ≥ X」，没有任何 slider / 控件修改（`setMinSimilarity` 没接）。
- 建议：要么补 slider，要么删除展示。

### M-13. `EmbedAgentChat` 缺 `aria-label` / 键盘 Esc 关闭
- 位置：`src/components/agent/EmbedAgentChat.tsx`
- 现状：textarea 无 label；用户无法用 Esc 停止生成。
- 建议：加 `aria-label="对话输入"`；监听 `Escape` 时如 `streaming` 触发 abort。

### M-14. `useContextWindow` refetchInterval 过长且无 jitter
- 位置：`src/components/agent/ContextWindowPanel.tsx:5-11`
- 现状：`refetchInterval: 15000`，多会话同时挂载时整齐对齐打后端。
- 建议：加 `refetchIntervalInBackground: false` 与 jitter（`Math.random() * 2000`）。

### M-15. `EmptyState` 用 emoji 📭 而非 SVG
- 位置：`src/components/common/EmptyState.tsx:11`
- 现状：emoji 在不同字体下渲染不一致；某些 Linux 桌面会缺字形显示豆腐。
- 建议：替换为 SVG（与项目其它空状态一致）。

---

## 轻度问题（优化，6 项）

### L-7. `Sidebar` 与 `Topbar` 重复 "显示用户 initials"
- 位置：`Sidebar.tsx:29` 与 `Topbar.tsx:33`
- 现状：两处都 `(user?.username ?? 'X').slice(0, 2).toUpperCase()`。
- 建议：抽 `src/utils/user.ts` → `userInitials(name?: string | null)`。

### L-8. `AgentCarousel` 中 `indexRef.current = index;` 在函数体内赋值
- 位置：`src/components/agent/AgentCarousel.tsx:97`
- 现状：每次渲染都会重写 ref（功能 OK 但不够规范）。
- 建议：用 `useEffect(() => { indexRef.current = index; }, [index]);`。

### L-9. `ProjectsPage` 中 `searchParams.get('import') === 'stars'` 仅在 mount 时生效
- 位置：`src/pages/ProjectsPage.tsx:70-74`
- 现状：`useEffect` 仅依赖 `searchParams`，但 `searchParams` 引用每次 render 都新（即使 URL 不变），实际是依赖 `searchParams.toString()`。
- 建议：补依赖 `[searchParams]` 即可（React Router v7 保证稳定），或更稳：`[searchParams.toString()]`。

### L-10. `FRONTEND_SPEC.md` 与实际代码版本不一致
- 位置：`docs/design/v1/FRONTEND_SPEC.md` §1.1
- 现状：写的是 React 18 / Vite 5 / Zustand 4 / react-router 6，实际代码用 React 19 / Vite 7 / Zustand 5 / react-router 7。
- 建议：更新 §1.1 与 §1.3 的 tsconfig JSON 块（缺 `noImplicitOverride`、`useUnknownInCatchVariables`），§1.1 加 React 19 新约定（`use()`/`useTransition`）。

### L-11. `LlmSettingsSection` 中 `agentConfigs.find(...)!` 非空断言
- 位置：`src/components/settings/LlmSettingsSection.tsx:278`
- 现状：`const cfg = agentConfigs.find((c) => c.agent_id === agent.id)!;` 用了 ESLint 禁止的 `!`。
- 建议：抽 `useMemo` 返回 `Map<AgentId, AgentLlmConfig>`，直接 `map.get(agent.id)`。

### L-12. `NotesPage.handleSave` 缺 `catch` 处理
- 位置：`src/pages/NotesPage.tsx:71-77`
- 现状：`await updateNote.mutateAsync(...)` 与 `createNote.mutateAsync(...)` 都未 `try/catch`；`useUpdateNote`/`useCreateNote` 的 `onError` 也未定义，失败会进入 React Query 默认错误状态但用户无感知。
- 建议：补 `try/catch` + `addToast`。

---

## 文档同步问题

- **FRONTEND_SPEC.md §1.1**：版本号全部落后真实 package.json
- **FRONTEND_SPEC.md §1.3**：tsconfig 示例缺 `noImplicitOverride`、`useUnknownInCatchVariables`、`verbatimModuleSyntax` 等新严格项
- **README.md** 路径指向 `../process/README.md`，应核对是否仍存在

---

## 测试覆盖补充

第二轮可补：
- `NotesPage` save 流程（标题空 + 关联项目空 + 成功）
- `AuthLayout` 简单渲染 + 无障碍 role 校验
- `Sidebar` active 高亮
- `Topbar` 主题切换
- `EmptyState` 渲染
- `cn` 在 `GlassCard` 中正确传递
- `agentStore.processSSEStream` 流处理（mock generator）

---

## 修复优先级（推荐顺序）

> **状态：已全部修复（2026-07-09）**

1. ~~**S-8** Topbar matchMedia SSR/test 崩溃~~ ✅
2. ~~**S-6** ProjectDetailPage abort Scout 流~~ ✅
3. ~~**S-7** ProjectDetailPage switch event 类型~~ ✅
4. ~~**M-12** GraphControls 控件补全~~ ✅
5. ~~**M-11** ImportStarsDrawer checkbox 行为~~ ✅
6. ~~**M-15** EmptyState emoji → SVG~~ ✅
7. ~~**M-13** EmbedAgentChat a11y + Esc~~ ✅
8. ~~**M-14** ContextWindow refetch jitter~~ ✅
9. ~~**L-7** 抽 userInitials~~ ✅
10. ~~**L-11** LlmSettingsSection 去非空断言~~ ✅
11. ~~**L-12** NotesPage handleSave 错误处理~~ ✅
12. ~~**L-10** FRONTEND_SPEC.md 同步~~ ✅
13. ~~**M-10** ProjectDetailPage isError 闪烁~~ ✅