# Phase 0 — 基础架构

> **前置依赖：** 无  
> **产出：** 可 `npm run dev` 的空壳应用，Mock API 可调用，AppShell 可切换路由  
> **门禁：** [10-REVIEW-GATES.md § Gate 0](./10-REVIEW-GATES.md)

---

## 1. 目标

搭建符合 [FRONTEND_SPEC.md](../FRONTEND_SPEC.md) 的工程骨架，迁移设计系统，实现 `IApiClient` + `MockApiClient` 最小集（仅 `me` / `login` 占位），供后续 Phase 直接扩展。

---

## 2. 任务清单

| # | 任务 | 参考 |
|---|------|------|
| 0.1 | 在 `frontend/` 按 FRONTEND_SPEC §2 初始化 Vite + React + TS | §1, §2 |
| 0.2 | 配置 `tsconfig` strict、`@/*` 别名、ESLint、Prettier | §1.3, §13 |
| 0.3 | 安装依赖：zustand, @tanstack/react-query, react-router-dom, d3, react-markdown, remark-gfm | §1.1 |
| 0.4 | 复制 `docs/design/v1/assets/design-system.css` → `src/styles/design-system.css` | 原型 |
| 0.5 | 编写 `global.css`（reset、scrollbar、`data-theme`） | FRONTEND_SPEC §1.2 |
| 0.6 | 实现 `api/types.ts`（可先放 User、ApiResponse、Auth 相关类型） | §4.1 |
| 0.7 | 实现 `api/client.ts` + `api/mock/index.ts` 骨架 + `.env` `VITE_USE_MOCK=true` | §4.2–4.4 |
| 0.8 | 实现 `authStore`（login/logout/fetchMe 占位） | §5.1 |
| 0.9 | 实现 `uiStore`（theme、sidebarCollapsed、toasts） | §5.2 |
| 0.10 | 实现 `AppShell` + `Sidebar` + `Topbar` + `ProtectedRoute` | §7.8, ROUTES-AND-NAV |
| 0.11 | 配置 `createBrowserRouter`（所有路由指向占位页） | ROUTES-AND-NAV |
| 0.12 | `main.tsx` 中 `await initApiClient()` 后渲染 | §4.3 |
| 0.13 | 侧栏 6 项 + Topbar 用户菜单（可先 mock 用户） | ROUTES-AND-NAV |

---

## 3. 设计规范

| 项 | 值 |
|----|-----|
| Sidebar 展开宽度 | 240px |
| Sidebar 折叠宽度 | 64px |
| Topbar 高度 | 48px |
| 最小视口宽度 | 900px（与 PRD §4.3 一致） |
| 主题切换 | `data-theme="dark\|light"` on `<html>` |
| 字体 | DM Sans + JetBrains Mono（与原型一致） |

---

## 4. Mock 最小要求

此 Phase 仅需 Mock 能通过 `fetchMe` 返回用户（或空），供 ProtectedRoute 联调。完整 Mock 数据在 Phase 1–3 逐步补齐。

---

## 5. 验收标准

| ID | 条件 |
|----|------|
| G0-01 | `npm run dev` 启动无报错，端口 5173 |
| G0-02 | `npm run build` 成功 |
| G0-03 | `tsc --noEmit` 无错误 |
| G0-04 | 未登录访问 `/` → 重定向 `/login` |
| G0-05 | Mock 登录后（临时硬编码或 Phase 1 前 stub）可看到 AppShell + 侧栏 6 项 |
| G0-06 | 点击侧栏各项，路由切换，对应占位页渲染 |
| G0-07 | `design-system.css` 变量生效（按钮、侧栏样式与原型一致） |
| G0-08 | 主题切换 `dark/light` 即时生效 |

---

## 6. 禁止事项

- 不使用 Tailwind（与 FRONTEND_SPEC / 原型 CSS 变量体系冲突）
- 不在此 Phase 实现完整业务页面
- 不直连真实后端
