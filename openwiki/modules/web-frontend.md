---
type: 前端模块
title: Web 前端模块
description: 基于 React 的 RepoPilot Web 前端，具备 Liquid Glass UI、智能体对话和知识图谱可视化功能
tags: [frontend, react, typescript, vite]
openwiki:
  roles: [architecture, domain]
  source_paths: [apps/web/src/]
  symbols: [App, AgentPage, ProjectsPage, GraphPage]
---

# Web 前端模块

## 概述

Web 前端是一个基于 React 19 + TypeScript 的单页应用（SPA），使用 Vite 构建。它为用户提供了与 RepoPilot 多智能体系统交互、管理项目、查看知识图谱以及记录笔记的用户界面。

## 目录结构

```
apps/web/src/
├── api/                    # API clients
│   ├── client.ts          # Main API client
│   ├── mock/              # Mock API implementation
│   └── real/              # Real API implementation
├── components/            # React components
│   ├── agent/             # Agent-related components
│   ├── auth/              # Authentication components
│   ├── common/            # Shared UI components
│   ├── graph/             # Graph visualization
│   ├── icons/             # Custom icons
│   ├── layout/            # Layout components
│   ├── note/              # Note editor components
│   └── project/           # Project management
├── constants/             # App constants
├── hooks/                 # Custom React hooks
├── pages/                 # Route-level pages
├── stores/                # Zustand state stores
├── styles/                # Global styles
└── utils/                 # Utility functions
```

## 核心组件

### 布局组件

| 组件 | 路径 | 用途 |
|-----------|------|---------|
| `AppShell` | `components/layout/AppShell.tsx` | 带侧边栏的主应用外壳 |
| `Sidebar` | `components/layout/Sidebar.tsx` | 导航侧边栏 |
| `Topbar` | `components/layout/Topbar.tsx` | 顶部导航栏 |
| `ProtectedRoute` | `components/layout/ProtectedRoute.tsx` | 针对已认证用户的路由保护 |

### 智能体组件

| 组件 | 路径 | 用途 |
|-----------|------|---------|
| `ChatPanel` | `components/agent/ChatPanel.tsx` | 智能体对话主界面 |
| `AgentSelector` | `components/agent/AgentSelector.tsx` | 智能体选择轮播 |
| `MessageBubble` | `components/agent/MessageBubble.tsx` | 聊天消息展示 |
| `ToolCallCard` | `components/agent/ToolCallCard.tsx` | 工具执行展示 |
| `StreamRenderer` | `components/agent/StreamRenderer.tsx` | SSE 流式渲染 |
| `QuestionPanel` | `components/agent/QuestionPanel.tsx` | 交互式问答 UI |

### 项目组件

| 组件 | 路径 | 用途 |
|-----------|------|---------|
| `ProjectTable` | `components/project/ProjectTable.tsx` | 项目列表视图 |
| `FilterBar` | `components/project/FilterBar.tsx` | 项目筛选 |
| `ImportStarsDrawer` | `components/project/ImportStarsDrawer.tsx` | GitHub stars 导入 |
| `ProjectAiPanel` | `components/project/ProjectAiPanel.tsx` | AI 分析面板 |

### 图谱组件

| 组件 | 路径 | 用途 |
|-----------|------|---------|
| `ForceGraph` | `components/graph/ForceGraph.tsx` | D3 力导向图 |
| `GraphControls` | `components/graph/GraphControls.tsx` | 图谱交互控件 |
| `GraphGuidePanel` | `components/graph/GraphGuidePanel.tsx` | 图谱说明面板 |

## 状态管理

### Zustand 状态库

| Store | 路径 | 用途 |
|-------|------|---------|
| `authStore` | `stores/authStore.ts` | 认证状态 |
| `agentStore` | `stores/agentStore.ts` | 智能体对话状态 |
| `projectStore` | `stores/projectStore.ts` | 项目数据 |
| `noteStore` | `stores/noteStore.ts` | 笔记管理 |
| `graphStore` | `stores/graphStore.ts` | 图谱可视化状态 |
| `settingsStore` | `stores/settingsStore.ts` | 用户设置 |
| `uiStore` | `stores/uiStore.ts` | UI 状态（主题等） |

### React Query

服务端状态通过 TanStack Query 管理：

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 minutes
      gcTime: 30 * 60 * 1000,      // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

## 路由

```typescript
// Main routes
/                    → OverviewPage (dashboard)
/projects            → ProjectsPage (project library)
/projects/:id        → ProjectDetailPage
/graph               → GraphPage (knowledge graph)
/agent               → AgentPage (chat interface)
/agent/sessions/:id  → AgentPage (specific session)
/notes               → NotesPage (note management)
/settings            → SettingsPage (app settings)
/profile             → ProfilePage (user profile)
/login               → LoginPage
/register            → RegisterPage
```

## API 客户端架构

前端同时支持 Mock 和真实 API 客户端：

```typescript
// api/client.ts
export const useMock = import.meta.env.VITE_USE_MOCK === 'true';

export const api = useMock ? mockApi : realApi;
export const agentApi = useMock ? mockAgentApi : realAgentApi;
```

### 真实 API 客户端

- HTTP 客户端：原生 `fetch`（`api/real/http.ts`；无 axios 依赖）
- 基础 URL：`/api/v1`（由 Vite 开发服务器代理，可用 `VITE_API_BASE_URL` 覆盖）
- 认证方式：httpOnly Cookie + `credentials`；历史 localStorage 令牌键已废弃，仅做遗留清理
- 统一错误类型：`ApiRequestError`（携带 `code`，便于 ErrorBoundary / Sentry 捕获）

#### 业务域拆分

`api/real/` 按 7 个业务域拆分为独立模块，`RealApiClient`（`api/real/index.ts`）只做委托聚合：

| 域模块 | 路径 | 覆盖端点 |
|--------|------|----------|
| auth | `api/real/domain/auth.ts` | 登录/注册/刷新 |
| projects | `api/real/domain/projects.ts` | 项目 CRUD、导入 |
| graph | `api/real/domain/graph.ts` | 知识图谱 |
| notes | `api/real/domain/notes.ts` | 笔记 |
| overview | `api/real/domain/overview.ts` | 仪表盘 |
| settings | `api/real/domain/settings.ts` | 用户设置 |
| agent | `api/real/domain/agent.ts` | Agent 会话与 SSE |

新增 API 方法时：在对应 `domain/*.ts` 实现，经 `domain/index.ts` 汇总，由 `RealApiClient` 暴露；共享的 HTTP 上下文在 `domain/http-ctx.ts`。

## 核心 Hooks

| Hook | 路径 | 用途 |
|------|------|---------|
| `useAuth` | `hooks/useAuth.ts` | 认证操作 |
| `useProjects` | `hooks/useProjects.ts` | 项目数据获取 |
| `useGraph` | `hooks/useGraph.ts` | 图谱数据与操作 |
| `useNotes` | `hooks/useNotes.ts` | 笔记 CRUD 操作 |
| `useSettings` | `hooks/useSettings.ts` | 设置管理 |
| `useOverview` | `hooks/useOverview.ts` | 仪表盘数据 |
| `useTheme` | `hooks/useTheme.ts` | 主题切换 |
| `useTrendingScoutSpot` | `hooks/useTrendingScoutSpot.ts` | 热门仓库 Scout 速览位 |

## 关键工具模块

### agentQuestion（Agent 反问/测验解析）

`utils/agentQuestion.ts` 是 `@/utils/agentQuestion` 的稳定入口，仅 re-export；实现按职责拆为 7 个子模块（`utils/agentQuestion/`）：

| 子模块 | 职责 |
|--------|------|
| `constants.ts` | 共享兜底选项（LEVEL / LANG / GOAL） |
| `radio-helpers.ts` | 占位选项识别、选项字母前缀清理、单选标签格式化 |
| `text-cleanup.ts` | 题干/选项文本清洗 |
| `parsers.ts` | 从正文 JSON/Markdown 识别 ask_user 与测验题 |
| `hydrate.ts` | `ensureAgentQuestion` / `hydrateAgentMessages` 消息水合 |
| `quiz.ts` | 考题判定与标题 |
| `card-formatters.ts` | 答案卡片与记忆 chip 内容格式化 |

修改题目解析逻辑时改对应子模块，入口文件的 re-export 契约保持不变。

### ErrorBoundary

`components/common/ErrorBoundary.tsx` 是应用级错误边界：捕获子树渲染异常，提供 `fallback` 渲染与 `reset` 重试；`onError` 钩子可对接 Sentry / DataDog 等上报通道（未设置时降级为 `console.error`）。

## Liquid Glass UI

前端采用自定义的“Liquid Glass”设计系统，具备以下特性：

- 带背景模糊的玻璃拟态卡片
- 基于 CSS 自定义属性的动态色彩系统
- 支持移动端的响应式布局
- 流畅的动画与过渡效果

## 构建配置

### Vite 配置

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:19878',
        changeOrigin: true,
      },
    },
  },
});
```

### TypeScript 配置

- `tsconfig.json`：主 TypeScript 配置
- `tsconfig.node.json`：Vite 专用配置
- `tsconfig.test.json`：测试配置