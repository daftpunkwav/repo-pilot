# RepoPilot v1.0 — 前端技术规格书 (Frontend Specification)

> 版本: 1.0.0 | 日期: 2026-07-04 | 状态: 草稿
> 权威来源: TECHNICAL_SPEC.md §12 · MVP_SCOPE.md §5 · API_SPEC.md
> **分步开发流程:** [process/README.md](./process/README.md)（按页面 Phase + 审查门禁）
> 本文档是前端开发的唯一权威参考。所有前端代码必须遵循本文档的架构、类型、接口和规范。

---

## §1 技术栈与约束

### 1.1 核心技术栈

| 技术 | 版本 | 用途 | 约束 |
|------|------|------|------|
| React | 18.x | UI 框架 | Function Components + Hooks only，禁止 Class Components |
| Vite | 5.x | 构建工具 | dev server 端口 5173，HMR 启用 |
| TypeScript | 5.x | 类型安全 | `strict: true`, `noUncheckedIndexedAccess: true`, 禁止 `any` |
| Zustand | 4.x | 客户端状态管理 | 仅管理纯客户端状态（UI、Auth、Agent 流状态） |
| @tanstack/react-query | 5.x | 服务端状态管理 | 所有 API 数据获取/缓存/同步 |
| react-router-dom | 6.x | 路由 | `createBrowserRouter`，data router 模式 |
| D3.js | 7.x | 知识图谱可视化 | 仅用于 `ForceGraph` 组件，不全局引入 |
| react-markdown + remark-gfm | latest | Markdown 渲染 | README + 笔记内容，禁止 raw HTML |
| Vitest | latest | 单元测试 | Store + Utils 覆盖率 >= 60% |
| Playwright | latest | E2E 测试 | 5 条核心 happy path |
| ESLint + Prettier | latest | 代码规范 | 配置见 §13 |
| pywebview | — | 桌面端壳 | 加载本地 SPA，`window.chrome.webview` 通信 |

### 1.2 CSS 方案

**纯 CSS 变量主题系统**，不引入 CSS-in-JS 框架（禁止 styled-components / emotion）。

- 设计系统文件 `design-system.css` 提供完整的组件样式（已从原型迁移）
- 主题通过 `data-theme="dark|light"` 属性切换 CSS 变量
- 组件级样式使用 CSS Modules（`*.module.css`）或 BEM 命名
- 全局样式补充在 `global.css`

### 1.3 TypeScript 严格约束

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**禁止项：**
- 禁止使用 `any` 类型（违反 ESLint `@typescript-eslint/no-explicit-any`）
- 禁止使用 `as any` 类型断言
- 禁止 `@ts-ignore`（仅允许 `@ts-expect-error` 并附注释）
- 禁止非空断言 `!`（使用可选链或显式判断替代）

---

## §2 项目目录结构

> **路径说明（2026-07-05）：** 本规格描述的**实施目录**为 `docs/design/v1/frontend/`（Mock 开发沙盒）。审查通过并迁入 Monorepo 后，目标目录为 `apps/web/`。对照见 [`docs/architecture/PATH_MAPPING.md`](../../architecture/PATH_MAPPING.md)。

```
docs/design/v1/frontend/    # 下文简称 frontend/
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx                    # 入口：挂载 React + QueryClientProvider
│   ├── App.tsx                     # 根组件 + createBrowserRouter
│   ├── vite-env.d.ts
│   │
│   ├── api/                        # API 层（§4 详述）
│   │   ├── types.ts                # 全部 TypeScript 接口定义
│   │   ├── client.ts               # API Client 统一出口 + mock/real 切换
│   │   ├── mock/                   # Mock 实现
│   │   │   ├── index.ts            # MockApiClient 类（实现 IApiClient）
│   │   │   ├── data/               # Mock 静态数据文件
│   │   │   │   ├── users.ts        # 用户 mock 数据
│   │   │   │   ├── projects.ts     # 项目 mock 数据（15+ 条）
│   │   │   │   ├── categories.ts   # 分类 mock 数据（预设 + 自定义）
│   │   │   │   ├── notes.ts        # 笔记 mock 数据
│   │   │   │   ├── graph.ts        # 图谱节点+边数据
│   │   │   │   ├── sessions.ts     # Agent 会话 + 消息历史
│   │   │   │   └── settings.ts     # 设置默认值
│   │   │   └── sse.ts              # SSE 流式 Mock（AsyncGenerator）
│   │   └── real/                   # 真实后端实现（后期开发）
│   │       ├── index.ts            # RealApiClient 类（实现 IApiClient）
│   │       ├── interceptor.ts      # JWT 拦截器 + 自动 refresh + 重试
│   │       └── sse.ts              # 真实 SSE 消费（fetch + ReadableStream）
│   │
│   ├── stores/                     # Zustand Stores（§5 详述）
│   │   ├── authStore.ts            # 认证状态
│   │   ├── uiStore.ts              # UI 状态（主题/侧栏/字体）
│   │   ├── projectStore.ts         # 项目筛选/排序状态
│   │   ├── agentStore.ts           # Agent 对话 + SSE 流状态
│   │   ├── noteStore.ts            # 笔记编辑状态
│   │   ├── graphStore.ts           # 图谱交互状态
│   │   ├── settingsStore.ts        # 设置状态
│   │   └── userProfileStore.ts     # 用户画像状态
│   │
│   ├── hooks/                      # 自定义 Hooks（封装 react-query）
│   │   ├── useAuth.ts              # 认证相关 hooks
│   │   ├── useProjects.ts          # 项目 CRUD + 筛选 hooks
│   │   ├── useAgentChat.ts         # Agent SSE 流处理 hook
│   │   ├── useGraph.ts             # 图谱数据 hook
│   │   ├── useNotes.ts             # 笔记 CRUD hooks
│   │   ├── useSettings.ts          # 设置 hook
│   │   └── useTheme.ts             # 主题切换 hook
│   │
│   ├── pages/                      # 页面组件（§6 详述）
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── ProjectDetailPage.tsx
│   │   ├── GraphPage.tsx
│   │   ├── AgentPage.tsx
│   │   ├── NotesPage.tsx
│   │   └── SettingsPage.tsx
│   │
│   ├── components/                 # 通用组件（§7 详述）
│   │   ├── layout/
│   │   │   ├── AppShell.tsx        # Sidebar + Topbar + Content 布局
│   │   │   ├── Sidebar.tsx         # 左侧导航栏
│   │   │   ├── Topbar.tsx          # 顶部栏（面包屑 + 用户菜单）
│   │   │   └── ProtectedRoute.tsx  # 路由守卫
│   │   ├── agent/
│   │   │   ├── ChatPanel.tsx       # 对话面板（消息列表 + 输入框）
│   │   │   ├── MessageBubble.tsx   # 消息气泡（支持 Markdown）
│   │   │   ├── StreamRenderer.tsx  # SSE 流式渲染器
│   │   │   ├── QuestionPanel.tsx   # 反问面板（5 种类型）
│   │   │   ├── ToolCallCard.tsx    # 工具调用展示卡片
│   │   │   └── AgentSelector.tsx   # Agent 切换下拉菜单
│   │   ├── graph/
│   │   │   ├── ForceGraph.tsx      # D3.js 力导向图
│   │   │   └── GraphControls.tsx   # 图谱控制（缩放/搜索/筛选）
│   │   ├── project/
│   │   │   ├── ProjectCard.tsx     # 项目卡片（Grid 视图）
│   │   │   ├── ProjectTable.tsx    # 项目表格（List 视图）
│   │   │   ├── FilterBar.tsx       # 筛选栏
│   │   │   └── ProgressBadge.tsx   # 进度徽章
│   │   ├── note/
│   │   │   ├── NoteEditor.tsx      # Markdown 编辑器 + 实时预览
│   │   │   └── NoteList.tsx        # 笔记列表
│   │   └── common/
│   │       ├── MarkdownRenderer.tsx # 统一 Markdown 渲染
│   │       ├── EmptyState.tsx      # 空态占位图
│   │       ├── LoadingSpinner.tsx  # 加载动画
│   │       ├── Toast.tsx           # 全局 Toast 通知
│   │       └── ConfirmDialog.tsx   # 确认对话框
│   │
│   ├── styles/
│   │   ├── design-system.css       # 设计系统（色彩/间距/组件）
│   │   └── global.css              # 全局样式补充（reset + scrollbar）
│   │
│   └── utils/
│       ├── cn.ts                   # className 合并工具（clsx + tailwind-merge 风格）
│       ├── date.ts                 # 日期格式化（相对时间 + ISO）
│       ├── sse-parser.ts           # SSE 文本流解析器
│       └── validators.ts           # 表单校验（URL/密码/用户名）
│
├── tests/
│   ├── unit/                       # Vitest 单元测试
│   │   ├── stores/                 # Store 测试
│   │   └── utils/                  # 工具函数测试
│   └── e2e/                        # Playwright E2E 测试
│       ├── auth.spec.ts
│       ├── projects.spec.ts
│       ├── notes.spec.ts
│       ├── agent.spec.ts
│       └── graph.spec.ts
│
├── index.html
├── vite.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── .env                            # VITE_USE_MOCK=true
├── .env.production                 # VITE_USE_MOCK=false
├── .eslintrc.cjs
└── .prettierrc
```

---

## §3 路由设计

### 3.1 路由配置

```typescript
// src/App.tsx
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { GraphPage } from './pages/GraphPage';
import { AgentPage } from './pages/AgentPage';
import { NotesPage } from './pages/NotesPage';
import { SettingsPage } from './pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 分钟内不重新获取
      gcTime: 30 * 60 * 1000,          // 30 分钟后垃圾回收
      retry: 1,                         // 失败重试 1 次
      refetchOnWindowFocus: false,      // 桌面端不需要
    },
  },
});

const router = createBrowserRouter([
  // 公开路由（无需认证）
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },

  // 受保护路由（需要认证）
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'projects/:id', element: <ProjectDetailPage /> },
      { path: 'graph', element: <GraphPage /> },
      { path: 'agent', element: <AgentPage /> },
      { path: 'agent/sessions/:sessionId', element: <AgentPage /> },
      { path: 'notes', element: <NotesPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },

  // 兜底路由
  { path: '*', element: <Navigate to="/" replace /> },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
```

### 3.2 ProtectedRoute 逻辑

```typescript
// src/components/layout/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

### 3.3 路由导航约定

| 场景 | 导航方式 |
|------|----------|
| 页面内跳转 | `<Link to="/projects/xxx">` |
| 编程式导航 | `useNavigate()` + `navigate('/path')` |
| 登录成功 | `navigate('/', { replace: true })` |
| 登出 | `navigate('/login', { replace: true })` |
| 项目详情返回 | `navigate(-1)` 或 `navigate('/')` |
| 404 兜底 | `<Navigate to="/" replace />` |

---

## §4 API 层架构

这是整个前端最关键的架构设计。核心原则：**mock 和 real 共享完全相同的 TypeScript 接口，切换时零业务代码修改。**

### §4.1 接口定义（types.ts）

```typescript
// src/api/types.ts

// ========================================
// 统一响应
// ========================================

export interface ApiResponse<T> {
  data: T;
  meta: {
    ts: number;
    page?: number;
    page_size?: number;
    total?: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

// ========================================
// 分页
// ========================================

export interface PaginatedList<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ========================================
// User
// ========================================

export interface User {
  id: string;
  username: string;
  email?: string;
  avatar_url?: string;
  github_login?: string;
  github_bound: boolean;
  created_at: string; // ISO 8601
}

// ========================================
// Auth
// ========================================

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

// ========================================
// GitHub
// ========================================

export interface GitHubAccount {
  id: string;
  username: string;
  avatar_url?: string;
  bound_at: string; // ISO 8601
}

export interface StarRepo {
  owner: string;
  repo: string;
  url: string;
  description?: string;
  language?: string;
  stars: number;
  already_imported: boolean;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: Array<{ repo: string; reason: string }>;
}

// ========================================
// Project
// ========================================

export type ProjectProgress = 'none' | 'learning' | 'learned' | 'mastered';
export type ProjectSource = 'github' | 'manual';

export interface Project {
  id: string;
  name: string;                  // "facebook/react"
  url: string;                   // "https://github.com/facebook/react"
  description?: string;
  language?: string;
  stars: number;
  category_id?: string;
  progress: ProjectProgress;
  tags: string[];                // tag_id[]
  source: ProjectSource;
  imported_at: string;           // ISO 8601
  readme?: string;               // Markdown 全文
  readme_fetched_at?: string;    // ISO 8601
}

export interface CreateProjectInput {
  name: string;
  url: string;
  description?: string;
  category_id?: string;
  tags?: string[];
}

export interface ProjectListParams {
  search?: string;
  category_id?: string;
  language?: string;
  progress?: ProjectProgress;
  tag_id?: string;
  sort_by?: 'name' | 'stars' | 'imported_at' | 'updated_at';
  sort_order?: 'asc' | 'desc';
  page?: number;
  page_size?: number;
}

export interface ProjectStats {
  total: number;
  by_progress: Record<ProjectProgress, number>;
  by_category: Record<string, number>;
  by_language: Record<string, number>;
}

// ========================================
// Category
// ========================================

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  is_preset: boolean;
}

// ========================================
// Tag
// ========================================

export interface Tag {
  id: string;
  name: string;
  count: number; // 关联项目数
}

// ========================================
// Note
// ========================================

export interface Note {
  id: string;
  project_id: string;
  title: string;
  content: string; // Markdown
  created_at: string;
  updated_at: string;
}

// ========================================
// Graph
// ========================================

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  name: string;
  language?: string;
  stars: number;
  category_id?: string;
  progress?: ProjectProgress;
}

export interface GraphEdge {
  source: string;
  target: string;
  similarity: number; // 0-1
}

// ========================================
// Agent
// ========================================

export type AgentId = 'hub' | 'scout' | 'mentor' | 'navigator' | 'curator' | 'scribe';
export type MessageRole = 'user' | 'assistant' | 'tool' | 'system';

export interface AgentSession {
  id: string;
  title: string;
  agent: AgentId;
  updated_at: string; // ISO 8601
  unread: boolean;
}

export interface AgentMessage {
  id: string;
  session_id: string;
  agent: AgentId;
  role: MessageRole;
  content?: string;
  tool_call?: ToolCallData;
  question?: AgentQuestion;
  created_at: string; // ISO 8601
}

export interface ToolCallData {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
}

export interface AgentProfile {
  id: AgentId;
  name: string;
  description: string;
  avatar_emoji: string;
  capabilities: string[];
}

export interface AgentPermissions {
  allow_web_search: boolean;
  allow_github_api: boolean;
  allow_file_write: boolean;
  max_iterations: number;
  max_tokens_per_turn: number;
}

// ========================================
// 反问系统 (Question System)
// ========================================

export interface AgentQuestion {
  question_id: string;
  intro: {
    type: 'markdown';
    content: string;
  };
  questions: QuestionItem[];
  actions: {
    submit: {
      text: string;
      style: 'primary' | 'secondary' | 'ghost' | 'danger' | 'link';
    };
    skip?: {
      text: string;
      style: 'ghost';
    };
  };
  allow_skip: boolean;
  timeout: number | null; // 秒，null = 无超时
}

export type QuestionItem =
  | RadioQuestion
  | CheckboxQuestion
  | SliderQuestion
  | DragSortQuestion
  | KnowledgeMapQuestion;

export interface RadioQuestion {
  id: string;
  text: string;
  type: 'radio';
  options: RadioOption[];
  allow_other?: boolean;
}

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

export interface CheckboxQuestion {
  id: string;
  text: string;
  type: 'checkbox';
  options: CheckboxOption[];
}

export interface CheckboxOption {
  value: string;
  text: string;
}

export interface SliderQuestion {
  id: string;
  text: string;
  type: 'slider';
  min: number;
  max: number;
  labels?: Record<string, string>; // key = 数值, value = 标签文字
}

export interface DragSortQuestion {
  id: string;
  text: string;
  type: 'drag_sort';
  items: string[];
}

export interface KnowledgeMapQuestion {
  id: string;
  text: string;
  type: 'knowledge_map';
  tree: KnowledgeNode[];
}

export interface KnowledgeNode {
  id: string;
  label: string;
  children?: KnowledgeNode[];
}

export type QuestionAnswer =
  | { type: 'radio'; value: string; other_text?: string }
  | { type: 'checkbox'; values: string[] }
  | { type: 'slider'; value: number }
  | { type: 'drag_sort'; order: string[] }
  | { type: 'knowledge_map'; checked: string[] };

// ========================================
// SSE 流式事件
// ========================================

export type SSEEventType =
  | 'text_delta'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'question'
  | 'agent_switch'
  | 'done'
  | 'error';

export interface SSEEvent {
  event: SSEEventType;
  data: Record<string, unknown>;
}

// SSE data 字段细化类型
export interface SSETextDelta {
  content: string;
}

export interface SSEThinking {
  content: string;
}

export interface SSEToolCall {
  call_id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface SSEToolResult {
  call_id: string;
  result: unknown;
  duration_ms?: number;
}

export interface SSEQuestion extends AgentQuestion {
  // 继承 AgentQuestion 所有字段
}

export interface SSEAgentSwitch {
  from: AgentId;
  to: AgentId;
  reason: string;
}

export interface SSEDone {
  usage: {
    tokens: number;
    input_tokens?: number;
    output_tokens?: number;
  };
  iterations: number;
}

export interface SSEError {
  code: string;
  message: string;
}

// ========================================
// Settings
// ========================================

export interface Settings {
  theme: 'dark' | 'light';
  font_scale: number;            // 0.8 - 1.4
  code_font: string;             // 等宽字体名称
  llm_provider: string;          // "openai" | "anthropic" | "local"
  llm_model: string;
  llm_api_base: string | null;
  llm_api_key_masked: string;    // "sk-****xxxx"
  llm_configured: boolean;
  llm_last_test?: string;        // ISO 8601
  llm_latency_ms?: number;
}

// ========================================
// User Profile（用户画像）
// ========================================

export interface UserProfile {
  tech_proficiency: Record<string, TechProficiencyEntry>;
  learning_preferences: LearningPreferences;
  goals: Goal[];
  history_summary: string;
  extensions: Record<string, unknown>;
}

export type ProficiencyLevel = 'none' | 'basic' | 'intermediate' | 'advanced' | 'mastered';
export type ProficiencySource = 'self_reported' | 'inferred' | 'assessed';

export interface TechProficiencyEntry {
  level: ProficiencyLevel;
  source: ProficiencySource;
  confidence: number; // 0-1
  evidence: string[];
  updated_at: string;
}

export type LearningStyle = 'hands_on' | 'theoretical' | 'visual';
export type Verbosity = 'concise' | 'balanced' | 'detailed';

export interface LearningPreferences {
  style: LearningStyle;
  depth_first: boolean;
  verbosity: Verbosity;
  language: string; // "zh-CN" | "en-US"
}

export type GoalStatus = 'active' | 'completed' | 'paused';

export interface Goal {
  title: string;
  deadline?: string; // ISO 8601
  priority: number;  // 1 = 最高
  status: GoalStatus;
}
```

### §4.2 ApiClient 接口定义

```typescript
// src/api/client.ts

import type {
  ApiResponse,
  User,
  LoginResponse,
  GitHubAccount,
  StarRepo,
  ImportResult,
  Project,
  ProjectListParams,
  PaginatedList,
  CreateProjectInput,
  ProjectStats,
  Category,
  Tag,
  Note,
  GraphData,
  Settings,
  AgentSession,
  AgentMessage,
  AgentProfile,
  AgentId,
  AgentPermissions,
  UserProfile,
  SSEEvent,
  QuestionAnswer,
} from './types';

/**
 * IApiClient — Mock 和 Real 实现的统一接口契约。
 * 所有方法签名必须严格一致，确保切换实现时零业务代码修改。
 */
export interface IApiClient {
  // ─── Auth ─────────────────────────────────────────────
  register(params: {
    username: string;
    password: string;
  }): Promise<ApiResponse<LoginResponse>>;

  login(params: {
    username: string;
    password: string;
  }): Promise<ApiResponse<LoginResponse>>;

  logout(): Promise<ApiResponse<{ success: boolean }>>;

  refresh(): Promise<ApiResponse<{ access_token: string }>>;

  me(): Promise<ApiResponse<User>>;

  updateProfile(data: Partial<User>): Promise<ApiResponse<User>>;

  changePassword(params: {
    old_password: string;
    new_password: string;
  }): Promise<ApiResponse<{ success: boolean }>>;

  // ─── GitHub ───────────────────────────────────────────
  listGithubAccounts(): Promise<ApiResponse<GitHubAccount[]>>;

  bindGithub(params: {
    username: string;
    pat: string;
  }): Promise<ApiResponse<GitHubAccount>>;

  unbindGithub(id: string): Promise<ApiResponse<{ success: boolean }>>;

  listStars(username?: string): Promise<ApiResponse<StarRepo[]>>;

  importProjects(
    repos: Array<{ owner: string; repo: string; url: string }>
  ): Promise<ApiResponse<ImportResult>>;

  // ─── Projects ─────────────────────────────────────────
  listProjects(
    params?: ProjectListParams
  ): Promise<ApiResponse<PaginatedList<Project>>>;

  getProject(id: string): Promise<ApiResponse<Project>>;

  createProject(data: CreateProjectInput): Promise<ApiResponse<Project>>;

  updateProject(
    id: string,
    data: Partial<Project>
  ): Promise<ApiResponse<Project>>;

  deleteProject(id: string): Promise<ApiResponse<{ success: boolean }>>;

  updateProgress(
    id: string,
    progress: Project['progress']
  ): Promise<ApiResponse<{ id: string; progress: string }>>;

  getProjectStats(): Promise<ApiResponse<ProjectStats>>;

  exportProjects(): Promise<ApiResponse<Project[]>>;

  // ─── Categories & Tags ────────────────────────────────
  listCategories(): Promise<ApiResponse<Category[]>>;

  createCategory(data: { name: string }): Promise<ApiResponse<Category>>;

  updateCategory(
    id: string,
    data: { name: string }
  ): Promise<ApiResponse<Category>>;

  deleteCategory(id: string): Promise<ApiResponse<{ success: boolean }>>;

  listTags(): Promise<ApiResponse<Tag[]>>;

  createTag(data: { name: string }): Promise<ApiResponse<Tag>>;

  deleteTag(id: string): Promise<ApiResponse<{ success: boolean }>>;

  setProjectTags(
    projectId: string,
    tagIds: string[]
  ): Promise<ApiResponse<{ project_id: string; tag_ids: string[] }>>;

  // ─── Notes ────────────────────────────────────────────
  listNotes(projectId: string): Promise<ApiResponse<Note[]>>;

  listAllNotes(): Promise<ApiResponse<Note[]>>;

  getNote(id: string): Promise<ApiResponse<Note>>;

  createNote(
    projectId: string,
    data: { title: string; content: string }
  ): Promise<ApiResponse<Note>>;

  updateNote(
    id: string,
    data: Partial<Note>
  ): Promise<ApiResponse<Note>>;

  deleteNote(id: string): Promise<ApiResponse<{ success: boolean }>>;

  // ─── Graph ────────────────────────────────────────────
  getGraph(params?: {
    min_similarity?: number;
    max_edges?: number;
  }): Promise<ApiResponse<GraphData>>;

  // ─── Settings ─────────────────────────────────────────
  getSettings(): Promise<ApiResponse<Settings>>;

  updateSettings(
    data: Partial<Settings>
  ): Promise<ApiResponse<Settings>>;

  testLLM(): Promise<
    ApiResponse<{ success: boolean; latency_ms: number; model: string }>
  >;

  // ─── Agent ────────────────────────────────────────────
  listAgentSessions(): Promise<ApiResponse<AgentSession[]>>;

  getAgentSession(
    id: string
  ): Promise<ApiResponse<AgentSession & { messages: AgentMessage[] }>>;

  createAgentSession(): Promise<ApiResponse<AgentSession>>;

  deleteAgentSession(id: string): Promise<ApiResponse<{ success: boolean }>>;

  getAgentProfiles(): Promise<ApiResponse<AgentProfile[]>>;

  getUserProfile(): Promise<ApiResponse<UserProfile>>;

  updateUserProfile(
    data: Partial<UserProfile>
  ): Promise<ApiResponse<UserProfile>>;

  getPermissions(): Promise<ApiResponse<AgentPermissions>>;

  // ─── Agent SSE 流 ─────────────────────────────────────
  /** 发送聊天消息，返回 SSE 流式事件生成器 */
  chatAgent(
    sessionId: string,
    message: string
  ): AsyncGenerator<SSEEvent>;

  /** 提交反问答案，返回 SSE 流式事件生成器 */
  answerQuestion(
    sessionId: string,
    questionId: string,
    answers: QuestionAnswer[]
  ): AsyncGenerator<SSEEvent>;

  /** 触发项目分析，返回 SSE 流式事件生成器 */
  analyzeProject(
    projectId: string,
    agent?: AgentId
  ): AsyncGenerator<SSEEvent>;
}
```

### §4.3 Mock ↔ Real 切换机制

```typescript
// src/api/client.ts

/**
 * 根据环境变量 VITE_USE_MOCK 决定使用 Mock 还是 Real 实现。
 * 使用动态 import 确保未选中的实现不会被打包进最终产物。
 */
async function createApiClient(): Promise<IApiClient> {
  const useMock = import.meta.env.VITE_USE_MOCK === 'true';

  if (useMock) {
    const { MockApiClient } = await import('./mock');
    return new MockApiClient();
  }

  const { RealApiClient } = await import('./real');
  const baseUrl =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:19876/api/v1';
  return new RealApiClient(baseUrl);
}

// 模块级单例 — 应用启动时初始化一次
let apiClientPromise: Promise<IApiClient> | null = null;

export function getApiClient(): Promise<IApiClient> {
  if (!apiClientPromise) {
    apiClientPromise = createApiClient();
  }
  return apiClientPromise;
}

// 同步访问快捷方式（在 main.tsx 中 await 初始化后使用）
let apiClient: IApiClient | null = null;

export async function initApiClient(): Promise<IApiClient> {
  apiClient = await getApiClient();
  return apiClient;
}

export function getApi(): IApiClient {
  if (!apiClient) {
    throw new Error(
      'ApiClient not initialized. Call initApiClient() in main.tsx before rendering.'
    );
  }
  return apiClient;
}
```

**入口初始化：**

```typescript
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initApiClient } from './api/client';
import { App } from './App';
import './styles/design-system.css';
import './styles/global.css';

async function bootstrap() {
  await initApiClient();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

bootstrap();
```

**环境变量文件：**

```bash
# .env (开发环境)
VITE_USE_MOCK=true

# .env.production (生产环境)
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://127.0.0.1:19876/api/v1
```

### §4.4 Mock 实现要求

`MockApiClient` 必须满足以下行为规范：

#### 4.4.1 延迟模拟

```typescript
// src/api/mock/index.ts
const MIN_DELAY = 200; // ms
const MAX_DELAY = 500; // ms

function delay(ms?: number): Promise<void> {
  const duration = ms ?? MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
  return new Promise((resolve) => setTimeout(resolve, duration));
}
```

#### 4.4.2 响应格式

所有方法必须返回 `ApiResponse<T>` 格式：

```typescript
function wrapResponse<T>(data: T, meta?: Partial<ApiResponse<T>['meta']>): ApiResponse<T> {
  return {
    data,
    meta: {
      ts: Date.now(),
      ...meta,
    },
  };
}
```

#### 4.4.3 CRUD 行为

- **Create**: 追加到内存数组，生成 UUID id，设置 `created_at` / `updated_at`
- **Read (List)**: 支持 search（模糊匹配 name/description）、category/language/progress/tag 筛选、sort_by/sort_order 排序、page/page_size 分页切片
- **Read (Get)**: 按 id 查找，未找到抛 `{ error: { code: 'NOT_FOUND', message: '...' } }`
- **Update**: 合并更新到内存对象，更新 `updated_at`
- **Delete**: 从内存数组移除，级联删除关联数据（笔记、标签关联）

#### 4.4.4 认证模拟

```typescript
// Mock 内存 token 管理
let currentToken: string | null = null;
let currentRefreshToken: string | null = null;
let currentUser: User | null = null;

// login 方法
async login(params: { username: string; password: string }) {
  await delay();
  const user = mockUsers.find(
    (u) => u.username === params.username
  );
  if (!user) {
    throw { error: { code: 'AUTH_FAILED', message: '用户名或密码错误' } };
  }
  currentToken = `mock_token_${Date.now()}`;
  currentRefreshToken = `mock_refresh_${Date.now()}`;
  currentUser = user;
  localStorage.setItem('rp_token', currentToken);
  localStorage.setItem('rp_refresh', currentRefreshToken);
  return wrapResponse({
    access_token: currentToken,
    refresh_token: currentRefreshToken,
    user,
  });
}
```

#### 4.4.5 SSE 模拟

SSE 方法返回 `AsyncGenerator<SSEEvent>`，逐字符 yield 模拟打字效果（详见 §8.2）。

#### 4.4.6 Mock 数据量要求

| 数据类型 | 最低条数 | 说明 |
|----------|----------|------|
| users | 2 | 1 个主用户 + 1 个测试用户 |
| projects | 15 | 覆盖 5+ 语言、4 种进度、3+ 分类 |
| categories | 8 | 5 个预设 + 3 个自定义 |
| notes | 10 | 分布在 5+ 个项目上 |
| graph nodes | 15 | 与 projects 对应 |
| graph edges | 20 | 合理的 similarity 分布 |
| sessions | 3 | 不同 agent 类型 |
| messages | 10+ | 包含各种 role 和 tool_call |

### §4.5 Real 实现要求（后期开发参考）

#### 4.5.1 JWT 拦截器

```typescript
// src/api/real/interceptor.ts

export class JwtInterceptor {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private isRefreshing = false;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.token = localStorage.getItem('rp_token');
    this.refreshToken = localStorage.getItem('rp_refresh');
  }

  getToken(): string | null {
    return this.token;
  }

  setTokens(access: string, refresh: string): void {
    this.token = access;
    this.refreshToken = refresh;
    localStorage.setItem('rp_token', access);
    localStorage.setItem('rp_refresh', refresh);
  }

  clearTokens(): void {
    this.token = null;
    this.refreshToken = null;
    localStorage.removeItem('rp_token');
    localStorage.removeItem('rp_refresh');
  }

  /**
   * 带自动 refresh 的 fetch 封装。
   * 401 响应 → 调用 refresh() → 成功后重试原请求 → refresh 失败 → 清空 + 跳转登录
   */
  async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    let response = await fetch(url, { ...options, headers });

    if (response.status === 401 && this.refreshToken) {
      // 并发请求共享同一个 refresh Promise
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        this.refreshPromise = this.doRefresh();
      }

      try {
        const newToken = await this.refreshPromise;
        headers.set('Authorization', `Bearer ${newToken}`);
        response = await fetch(url, { ...options, headers });
      } catch {
        this.clearTokens();
        window.location.href = '/login';
        throw new Error('Session expired');
      } finally {
        this.isRefreshing = false;
        this.refreshPromise = null;
      }
    }

    return response;
  }

  private async doRefresh(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.refreshToken}`,
      },
    });

    if (!res.ok) {
      throw new Error('Refresh failed');
    }

    const json = await res.json();
    const newToken: string = json.data.access_token;
    this.token = newToken;
    localStorage.setItem('rp_token', newToken);
    return newToken;
  }
}
```

#### 4.5.2 统一错误处理

```typescript
// 非 2xx 响应统一抛 ApiError
async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const json = await response.json();

  if (!response.ok) {
    const apiError: ApiError = json;
    throw apiError;
  }

  return json as ApiResponse<T>;
}
```

#### 4.5.3 SSE 消费（POST 方式）

使用 `fetch` + `ReadableStream` 消费（不使用 `EventSource`，因为需要 POST 请求体）。详见 §8.1。

---

## §5 Zustand Stores

### 设计原则

1. **Zustand 仅管理纯客户端状态**：UI 状态、认证 token、Agent 流式状态
2. **服务端数据由 react-query 管理**：项目列表、笔记、图谱等通过 `useQuery` / `useMutation` 获取
3. **Store 中不直接调用 API**：通过 hooks 层组合 Store + react-query
4. **每个 Store 职责单一**，避免跨 Store 依赖

### §5.1 authStore

```typescript
// src/stores/authStore.ts
import { create } from 'zustand';
import type { User } from '../api/types';
import { getApi } from '../api/client';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const api = getApi();
      const response = await api.login({ username, password });
      set({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: extractErrorMessage(err),
      });
      throw err;
    }
  },

  logout: async () => {
    try {
      const api = getApi();
      await api.logout();
    } finally {
      localStorage.removeItem('rp_token');
      localStorage.removeItem('rp_refresh');
      set({ user: null, isAuthenticated: false });
    }
  },

  register: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const api = getApi();
      const response = await api.register({ username, password });
      set({
        user: response.data.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: extractErrorMessage(err),
      });
      throw err;
    }
  },

  fetchMe: async () => {
    const token = localStorage.getItem('rp_token');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const api = getApi();
      const response = await api.me();
      set({
        user: response.data,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      localStorage.removeItem('rp_token');
      localStorage.removeItem('rp_refresh');
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));

// 工具函数
function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const apiErr = err as { error: { message: string } };
    return apiErr.error.message;
  }
  return '未知错误，请重试';
}
```

### §5.2 uiStore

```typescript
// src/stores/uiStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'dark' | 'light' | 'system';

interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  fontScale: number;
  toasts: Toast[];

  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setFontScale: (scale: number) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number; // ms, 默认 3000
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      sidebarCollapsed: false,
      fontScale: 1.0,
      toasts: [],

      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },

      toggleSidebar: () => {
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setFontScale: (scale) => {
        const clamped = Math.max(0.8, Math.min(1.4, scale));
        set({ fontScale: clamped });
        document.documentElement.style.setProperty(
          '--font-scale',
          String(clamped)
        );
      },

      addToast: (toast) => {
        const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const newToast: Toast = { ...toast, id };
        set((state) => ({ toasts: [...state.toasts, newToast] }));

        const duration = toast.duration ?? 3000;
        setTimeout(() => {
          get().removeToast(id);
        }, duration);
      },

      removeToast: (id) => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      },
    }),
    {
      name: 'rp-ui-store',
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
        fontScale: state.fontScale,
      }),
    }
  )
);

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') {
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;
    root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    root.setAttribute('data-theme', theme);
  }
}
```

### §5.3 projectStore

```typescript
// src/stores/projectStore.ts
import { create } from 'zustand';
import type { ProjectListParams, ProjectProgress } from '../api/types';

/**
 * projectStore 仅管理筛选/排序等客户端状态。
 * 项目数据获取由 react-query hooks 处理。
 */
interface ProjectFilterState {
  search: string;
  categoryId: string | null;
  language: string | null;
  progress: ProjectProgress | null;
  tagId: string | null;
  sortBy: ProjectListParams['sort_by'];
  sortOrder: ProjectListParams['sort_order'];
  page: number;
  pageSize: number;
  viewMode: 'table' | 'card';

  setSearch: (search: string) => void;
  setCategoryId: (id: string | null) => void;
  setLanguage: (lang: string | null) => void;
  setProgress: (progress: ProjectProgress | null) => void;
  setTagId: (id: string | null) => void;
  setSortBy: (sort: NonNullable<ProjectListParams['sort_by']>) => void;
  setSortOrder: (order: NonNullable<ProjectListParams['sort_order']>) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setViewMode: (mode: 'table' | 'card') => void;
  resetFilters: () => void;
  toApiParams: () => ProjectListParams;
}

export const useProjectStore = create<ProjectFilterState>((set, get) => ({
  search: '',
  categoryId: null,
  language: null,
  progress: null,
  tagId: null,
  sortBy: 'imported_at',
  sortOrder: 'desc',
  page: 1,
  pageSize: 20,
  viewMode: 'table',

  setSearch: (search) => set({ search, page: 1 }),
  setCategoryId: (categoryId) => set({ categoryId, page: 1 }),
  setLanguage: (language) => set({ language, page: 1 }),
  setProgress: (progress) => set({ progress, page: 1 }),
  setTagId: (tagId) => set({ tagId, page: 1 }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSortOrder: (sortOrder) => set({ sortOrder }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
  setViewMode: (viewMode) => set({ viewMode }),

  resetFilters: () =>
    set({
      search: '',
      categoryId: null,
      language: null,
      progress: null,
      tagId: null,
      sortBy: 'imported_at',
      sortOrder: 'desc',
      page: 1,
    }),

  toApiParams: () => {
    const state = get();
    return {
      search: state.search || undefined,
      category_id: state.categoryId ?? undefined,
      language: state.language ?? undefined,
      progress: state.progress ?? undefined,
      tag_id: state.tagId ?? undefined,
      sort_by: state.sortBy,
      sort_order: state.sortOrder,
      page: state.page,
      page_size: state.pageSize,
    };
  },
}));
```

### §5.4 agentStore（最复杂的 Store）

```typescript
// src/stores/agentStore.ts
import { create } from 'zustand';
import type {
  AgentSession,
  AgentMessage,
  AgentId,
  AgentQuestion,
  SSEEvent,
  QuestionAnswer,
  SSETextDelta,
  SSEThinking,
  SSEToolCall,
  SSEToolResult,
  SSEAgentSwitch,
  SSEError,
} from '../api/types';
import { getApi } from '../api/client';

interface AgentState {
  // ─── 数据 ─────────────────────────────────────────────
  sessions: AgentSession[];
  currentSessionId: string | null;
  messages: AgentMessage[];
  activeAgent: AgentId;

  // ─── 流式状态 ─────────────────────────────────────────
  streaming: boolean;
  streamingContent: string;
  thinkingBuffer: string;
  pendingQuestion: AgentQuestion | null;
  toolCalls: Map<string, { name: string; args: Record<string, unknown>; result?: unknown }>;

  // ─── 错误 ─────────────────────────────────────────────
  error: string | null;

  // ─── Actions ──────────────────────────────────────────
  loadSessions: () => Promise<void>;
  switchSession: (sessionId: string) => Promise<void>;
  createSession: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;

  sendMessage: (message: string) => Promise<void>;
  answerQuestion: (answers: QuestionAnswer[]) => Promise<void>;
  skipQuestion: () => void;

  setActiveAgent: (agent: AgentId) => void;
  clearError: () => void;

  // SSE 内部处理
  processSSEStream: (stream: AsyncGenerator<SSEEvent>) => Promise<void>;
  resetStreamState: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  activeAgent: 'hub',
  streaming: false,
  streamingContent: '',
  thinkingBuffer: '',
  pendingQuestion: null,
  toolCalls: new Map(),
  error: null,

  loadSessions: async () => {
    const api = getApi();
    const response = await api.listAgentSessions();
    set({ sessions: response.data });
  },

  switchSession: async (sessionId) => {
    const api = getApi();
    const response = await api.getAgentSession(sessionId);
    set({
      currentSessionId: sessionId,
      messages: response.data.messages,
      activeAgent: response.data.agent,
      pendingQuestion: null,
      streaming: false,
    });
  },

  createSession: async () => {
    const api = getApi();
    const response = await api.createAgentSession();
    const newSession = response.data;
    set((state) => ({
      sessions: [newSession, ...state.sessions],
      currentSessionId: newSession.id,
      messages: [],
      activeAgent: 'hub',
    }));
  },

  deleteSession: async (sessionId) => {
    const api = getApi();
    await api.deleteAgentSession(sessionId);
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== sessionId);
      const updates: Partial<AgentState> = { sessions };
      if (state.currentSessionId === sessionId) {
        updates.currentSessionId = sessions[0]?.id ?? null;
        updates.messages = [];
      }
      return updates;
    });
  },

  sendMessage: async (message) => {
    const { currentSessionId } = get();
    if (!currentSessionId) return;

    // 添加用户消息到列表
    const userMsg: AgentMessage = {
      id: `temp_${Date.now()}`,
      session_id: currentSessionId,
      agent: get().activeAgent,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      messages: [...state.messages, userMsg],
      streaming: true,
      streamingContent: '',
      thinkingBuffer: '',
      error: null,
    }));

    const api = getApi();
    const stream = api.chatAgent(currentSessionId, message);
    await get().processSSEStream(stream);
  },

  answerQuestion: async (answers) => {
    const { currentSessionId, pendingQuestion } = get();
    if (!currentSessionId || !pendingQuestion) return;

    set((state) => ({
      pendingQuestion: null,
      streaming: true,
      streamingContent: '',
    }));

    const api = getApi();
    const stream = api.answerQuestion(
      currentSessionId,
      pendingQuestion.question_id,
      answers
    );
    await get().processSSEStream(stream);
  },

  skipQuestion: () => {
    set({ pendingQuestion: null });
  },

  setActiveAgent: (agent) => set({ activeAgent: agent }),
  clearError: () => set({ error: null }),

  resetStreamState: () =>
    set({
      streaming: false,
      streamingContent: '',
      thinkingBuffer: '',
      pendingQuestion: null,
      toolCalls: new Map(),
    }),

  /**
   * 核心 SSE 流处理逻辑
   *
   * 事件处理映射：
   * - text_delta   → 追加到 streamingContent
   * - thinking     → 追加到 thinkingBuffer（可折叠展示）
   * - tool_call    → 插入 toolCalls Map（显示工具名 + 参数）
   * - tool_result  → 更新对应 toolCall 的 result
   * - question     → 设置 pendingQuestion，暂停流式渲染
   * - agent_switch → 更新 activeAgent，显示切换提示
   * - done         → 设置 streaming=false，将流式内容固化为 message
   * - error        → 显示错误提示
   */
  processSSEStream: async (stream) => {
    try {
      for await (const event of stream) {
        switch (event.event) {
          case 'text_delta': {
            const delta = event.data as unknown as SSETextDelta;
            set((state) => ({
              streamingContent: state.streamingContent + delta.content,
            }));
            break;
          }

          case 'thinking': {
            const thinking = event.data as unknown as SSEThinking;
            set((state) => ({
              thinkingBuffer: state.thinkingBuffer + thinking.content,
            }));
            break;
          }

          case 'tool_call': {
            const toolCall = event.data as unknown as SSEToolCall;
            set((state) => {
              const newMap = new Map(state.toolCalls);
              newMap.set(toolCall.call_id, {
                name: toolCall.name,
                args: toolCall.args,
              });
              return { toolCalls: newMap };
            });
            break;
          }

          case 'tool_result': {
            const toolResult = event.data as unknown as SSEToolResult;
            set((state) => {
              const newMap = new Map(state.toolCalls);
              const existing = newMap.get(toolResult.call_id);
              if (existing) {
                newMap.set(toolResult.call_id, {
                  ...existing,
                  result: toolResult.result,
                });
              }
              return { toolCalls: newMap };
            });
            break;
          }

          case 'question': {
            const question = event.data as unknown as AgentQuestion;
            set({
              pendingQuestion: question,
              streaming: false, // 暂停流式渲染，等待用户回答
            });
            break;
          }

          case 'agent_switch': {
            const switchData = event.data as unknown as SSEAgentSwitch;
            set({ activeAgent: switchData.to });
            break;
          }

          case 'done': {
            const { streamingContent, thinkingBuffer, currentSessionId, activeAgent, toolCalls } =
              get();

            // 将流式内容固化为正式 message
            const assistantMsg: AgentMessage = {
              id: `msg_${Date.now()}`,
              session_id: currentSessionId!,
              agent: activeAgent,
              role: 'assistant',
              content: streamingContent,
              created_at: new Date().toISOString(),
            };

            set((state) => ({
              messages: [...state.messages, assistantMsg],
              streaming: false,
              streamingContent: '',
              thinkingBuffer: '',
              toolCalls: new Map(),
            }));
            break;
          }

          case 'error': {
            const errData = event.data as unknown as SSEError;
            set({
              error: errData.message,
              streaming: false,
            });
            break;
          }
        }
      }
    } catch (err) {
      set({
        error: '连接中断，请重试',
        streaming: false,
      });
    }
  },
}));
```

### §5.5 noteStore

```typescript
// src/stores/noteStore.ts
import { create } from 'zustand';

interface NoteState {
  // 客户端编辑状态
  editingNoteId: string | null;
  editorContent: string;
  editorTitle: string;
  previewMode: boolean;
  searchQuery: string;

  // Actions
  startEditing: (noteId: string, title: string, content: string) => void;
  stopEditing: () => void;
  setEditorContent: (content: string) => void;
  setEditorTitle: (title: string) => void;
  togglePreview: () => void;
  setSearchQuery: (query: string) => void;
}

export const useNoteStore = create<NoteState>((set) => ({
  editingNoteId: null,
  editorContent: '',
  editorTitle: '',
  previewMode: false,
  searchQuery: '',

  startEditing: (noteId, title, content) =>
    set({
      editingNoteId: noteId,
      editorTitle: title,
      editorContent: content,
      previewMode: false,
    }),

  stopEditing: () =>
    set({
      editingNoteId: null,
      editorContent: '',
      editorTitle: '',
      previewMode: false,
    }),

  setEditorContent: (content) => set({ editorContent: content }),
  setEditorTitle: (title) => set({ editorTitle: title }),
  togglePreview: () => set((state) => ({ previewMode: !state.previewMode })),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
```

### §5.6 graphStore

```typescript
// src/stores/graphStore.ts
import { create } from 'zustand';

interface GraphState {
  // 图谱交互状态
  selectedNodeId: string | null;
  highlightNodeId: string | null;
  searchQuery: string;
  minSimilarity: number;
  maxEdges: number;
  categoryFilter: string | null;
  zoomLevel: number;

  // Actions
  selectNode: (nodeId: string | null) => void;
  highlightNode: (nodeId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setMinSimilarity: (value: number) => void;
  setMaxEdges: (value: number) => void;
  setCategoryFilter: (categoryId: string | null) => void;
  setZoomLevel: (level: number) => void;
  resetView: () => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  selectedNodeId: null,
  highlightNodeId: null,
  searchQuery: '',
  minSimilarity: 0.1,
  maxEdges: 500,
  categoryFilter: null,
  zoomLevel: 1.0,

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  highlightNode: (nodeId) => set({ highlightNodeId: nodeId }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setMinSimilarity: (value) => set({ minSimilarity: Math.max(0, Math.min(1, value)) }),
  setMaxEdges: (value) => set({ maxEdges: Math.max(10, Math.min(2000, value)) }),
  setCategoryFilter: (categoryId) => set({ categoryFilter: categoryId }),
  setZoomLevel: (level) => set({ zoomLevel: level }),

  resetView: () =>
    set({
      selectedNodeId: null,
      highlightNodeId: null,
      searchQuery: '',
      zoomLevel: 1.0,
    }),
}));
```

### §5.7 settingsStore

```typescript
// src/stores/settingsStore.ts
import { create } from 'zustand';
import type { Settings } from '../api/types';

interface SettingsState {
  settings: Settings | null;
  isLoading: boolean;
  isTestingLLM: boolean;
  testResult: { success: boolean; latency_ms: number } | null;

  // Actions
  loadSettings: () => Promise<void>;
  updateSettings: (data: Partial<Settings>) => Promise<void>;
  testLLM: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoading: false,
  isTestingLLM: false,
  testResult: null,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const { getApi } = await import('../api/client');
      const api = getApi();
      const response = await api.getSettings();
      set({ settings: response.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateSettings: async (data) => {
    const { getApi } = await import('../api/client');
    const api = getApi();
    const response = await api.updateSettings(data);
    set({ settings: response.data });
  },

  testLLM: async () => {
    set({ isTestingLLM: true, testResult: null });
    try {
      const { getApi } = await import('../api/client');
      const api = getApi();
      const response = await api.testLLM();
      set({
        isTestingLLM: false,
        testResult: {
          success: response.data.success,
          latency_ms: response.data.latency_ms,
        },
      });
    } catch {
      set({
        isTestingLLM: false,
        testResult: { success: false, latency_ms: 0 },
      });
    }
  },
}));
```

### §5.8 userProfileStore

```typescript
// src/stores/userProfileStore.ts
import { create } from 'zustand';
import type { UserProfile } from '../api/types';
import { getApi } from '../api/client';

interface UserProfileState {
  profile: UserProfile | null;
  isLoading: boolean;

  loadProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

export const useUserProfileStore = create<UserProfileState>((set) => ({
  profile: null,
  isLoading: false,

  loadProfile: async () => {
    set({ isLoading: true });
    try {
      const api = getApi();
      const response = await api.getUserProfile();
      set({ profile: response.data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  updateProfile: async (data) => {
    const api = getApi();
    const response = await api.updateUserProfile(data);
    set({ profile: response.data });
  },
}));
```

---

## §6 页面规格

### §6.1 LoginPage

| 属性 | 值 |
|------|------|
| 路由 | `/login` |
| 职责 | 用户登录认证 |
| 数据来源 | authStore |

**组件树：**
```
LoginPage
├── LoginForm
│   ├── InputField (username, 3-32 字符)
│   ├── InputField (password, type=password)
│   ├── Button (提交)
│   └── Link (跳转 /register)
└── ErrorBanner (条件渲染)
```

**交互行为：**
1. 输入用户名和密码
2. 提交表单 → `authStore.login()`
3. 成功 → `navigate('/', { replace: true })`
4. 失败 → 显示错误消息（来自 authStore.error）
5. Enter 键提交
6. 已登录状态访问 /login → 重定向 /

**状态处理：**
- **加载态**：按钮显示 `LoadingSpinner` + "登录中..."，输入框 disabled
- **空态**：N/A
- **错误态**：表单上方显示红色 `ErrorBanner`，内容来自 `authStore.error`

**表单校验：**
```typescript
// 提交前校验
function validateLoginForm(username: string, password: string): string | null {
  if (!username || username.length < 3 || username.length > 32) {
    return '用户名长度需在 3-32 字符之间';
  }
  if (!password || password.length < 8) {
    return '密码长度至少 8 字符';
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return '密码需包含字母和数字';
  }
  return null;
}
```

### §6.2 RegisterPage

| 属性 | 值 |
|------|------|
| 路由 | `/register` |
| 职责 | 新用户注册 |
| 数据来源 | authStore |

**组件树：**
```
RegisterPage
├── RegisterForm
│   ├── InputField (username)
│   ├── InputField (password)
│   ├── InputField (confirmPassword)
│   ├── Button (提交)
│   └── Link (跳转 /login)
└── ErrorBanner (条件渲染)
```

**交互行为：**
1. 输入用户名、密码、确认密码
2. 提交前校验：密码一致性 + 密码强度
3. 提交 → `authStore.register()`
4. 成功 → 自动登录 → `navigate('/', { replace: true })`
5. 失败 → 显示错误（用户名已存在等）

**状态处理：**
- **加载态**：按钮显示 `LoadingSpinner` + "注册中..."
- **错误态**：`ErrorBanner` 显示 "用户名已存在" 等后端错误

### §6.3 DashboardPage

| 属性 | 值 |
|------|------|
| 路由 | `/` |
| 职责 | 项目列表 + 筛选 + 搜索 + 统计概览 |
| 数据来源 | react-query `useProjects` hook + projectStore（筛选状态） |

**组件树：**
```
DashboardPage
├── StatsCards (项目总数、各进度数量)
├── FilterBar
│   ├── SearchInput (防抖 300ms)
│   ├── CategorySelect
│   ├── LanguageSelect
│   ├── ProgressSelect
│   ├── TagSelect
│   ├── SortSelect
│   ├── ViewToggle (table / card)
│   └── Button (GitHub Star 导入)
├── ProjectTable (viewMode=table)
│   └── ProjectRow[] (点击跳转详情)
├── ProjectCard (viewMode=card)
│   └── ProjectCardItem[] (点击跳转详情)
├── Pagination
└── ImportDrawer (GitHub Star 选择导入)
```

**交互行为：**
1. 搜索框输入 → 防抖 300ms → 更新 projectStore.search → react-query 重新获取
2. 分类/语言/进度/标签筛选 → 更新对应 store → 重新获取
3. 排序切换 → 更新 sortBy/sortOrder → 重新获取
4. 视图切换（表格/卡片）
5. 点击项目行 → `navigate('/projects/:id')`
6. GitHub Star 导入按钮 → 打开 ImportDrawer → 选择 repos → 调用 `importProjects` → invalidate 项目列表缓存
7. 分页 → 更新 page → 重新获取

**状态处理：**
- **加载态**：表格区域显示骨架屏（Skeleton rows x 5）
- **空态**：`<EmptyState icon="inbox" title="还没有项目" description="从 GitHub Star 导入或手动添加" actionButton="导入项目" />`
- **错误态**：`<ErrorBanner message="获取项目列表失败" retryButton />`

### §6.4 ProjectDetailPage

| 属性 | 值 |
|------|------|
| 路由 | `/projects/:id` |
| 职责 | 项目详情 + README 查看 + 笔记管理 + Agent 分析入口 |
| 数据来源 | react-query `useProject(id)` + `useNotes(projectId)` |

**组件树：**
```
ProjectDetailPage
├── ProjectHeader
│   ├── ProjectName + Language + Stars
│   ├── ProgressBadge (可切换)
│   ├── TagEditor (可编辑)
│   └── ButtonGroup (Scout 分析 | 打开 GitHub | 删除)
├── Tabs
│   ├── Tab: README
│   │   └── MarkdownRenderer (readme 内容)
│   ├── Tab: Notes
│   │   ├── NoteList
│   │   └── NoteEditor (创建/编辑)
│   └── Tab: Agent
│       └── ChatPanel (嵌入 Agent 对话，自动触发 Scout 分析)
└── DeleteConfirmDialog (条件渲染)
```

**交互行为：**
1. 进度更新：点击 ProgressBadge → 下拉选择 → `useMutation` 调用 `updateProgress` → invalidate 缓存
2. 标签编辑：点击 TagEditor → 弹出标签选择器 → 多选 → `setProjectTags`
3. README 渲染：Markdown 渲染项目 README
4. 笔记 CRUD：创建/编辑/删除笔记（Tab: Notes）
5. Scout 分析：点击 "Scout 分析" 按钮 → 创建 Agent 会话 → `analyzeProject(projectId, 'scout')` → SSE 流式渲染
6. 删除项目：确认对话框 → `deleteProject(id)` → `navigate('/')`

**状态处理：**
- **加载态**：Header 区域骨架屏 + Tab 内容骨架屏
- **空态 (README)**：`<EmptyState title="暂无 README" description="项目尚未获取 README 内容" />`
- **空态 (Notes)**：`<EmptyState title="暂无笔记" description="点击 + 创建第一条笔记" />`
- **错误态**：项目不存在 → `navigate('/')` + Toast 提示 "项目不存在"

### §6.5 GraphPage

| 属性 | 值 |
|------|------|
| 路由 | `/graph` |
| 职责 | 知识图谱力导向图可视化 |
| 数据来源 | react-query `useGraph` hook + graphStore（交互状态） |

**组件树：**
```
GraphPage
├── GraphControls
│   ├── SearchInput (节点搜索高亮)
│   ├── SimilaritySlider (min_similarity: 0-1)
│   ├── MaxEdgesInput
│   ├── CategoryFilter
│   └── ButtonGroup (重置视图 | 缩放适配)
├── ForceGraph (D3.js SVG)
│   ├── Nodes (circle, 按 category 着色)
│   ├── Edges (line, 按 similarity 透明度)
│   └── Labels (text, 缩放 > 0.8 时显示)
└── NodeDetailPanel (条件渲染，右侧抽屉)
    ├── ProjectName + Language + Stars
    ├── ProgressBadge
    └── Button (跳转项目详情)
```

**D3.js 配置参数：**
```typescript
const FORCE_CONFIG = {
  alphaDecay: 0.02,        // 力模拟衰减速度
  velocityDecay: 0.3,      // 速度衰减（摩擦力）
  chargeStrength: -200,     // 节点间斥力
  linkDistance: 100,         // 边理想长度
  centerStrength: 0.05,     // 向心力
  collisionRadius: 20,      // 碰撞检测半径
} as const;
```

**节点视觉映射：**
| 属性 | 映射规则 |
|------|----------|
| 颜色 | `category_id` → CSS 变量 `--category-color-{n}` |
| 大小 | `Math.log2(stars + 1) * 2 + 4`，范围 [4, 20] px |
| 边框 | `progress === 'mastered'` → 2px solid gold |
| 高亮 | `highlightNodeId` 匹配 → 发光效果 + 放大 1.5x |

**边视觉映射：**
| 属性 | 映射规则 |
|------|----------|
| 透明度 | `similarity` 线性映射 [0.1, 0.8] |
| 宽度 | `similarity * 2`，范围 [0.5, 2] px |
| 颜色 | `var(--color-edge, #666)` |

**交互行为：**
1. 节点点击 → graphStore.selectNode → 显示 NodeDetailPanel
2. 节点双击 → `navigate('/projects/:id')`
3. 节点拖拽 → D3 drag behavior
4. 画布缩放 → D3 zoom behavior
5. 搜索 → 输入文字 → 匹配节点名称 → 高亮 + 居中
6. 分类筛选 → 非匹配分类节点降低透明度
7. Similarity 滑块 → 更新 `min_similarity` → 重新获取图谱数据

**性能要求：**
- 100 节点：< 2s 初始渲染
- 500 节点：< 2s 初始渲染（降低 label 显示）
- 1000+ 节点：显示 "数据量过大，请增加 min_similarity" 警告

**状态处理：**
- **加载态**：中央 `LoadingSpinner` + "正在计算图谱..."
- **空态**：`<EmptyState title="图谱为空" description="至少需要 2 个项目才能生成图谱" />`
- **错误态**：Toast "获取图谱数据失败"

### §6.6 AgentPage

| 属性 | 值 |
|------|------|
| 路由 | `/agent` 或 `/agent/sessions/:sessionId` |
| 职责 | Agent 对话 + SSE 流式渲染 + 反问面板 |
| 数据来源 | agentStore |

**组件树：**
```
AgentPage
├── Sidebar: SessionList
│   ├── Button (新建会话)
│   └── SessionItem[] (点击切换)
│       ├── Title + Agent 标识
│       ├── UpdatedAt
│       ├── UnreadBadge
│       └── DeleteButton
├── Main: ChatPanel
│   ├── AgentSelector (顶部 Agent 切换)
│   ├── MessageList
│   │   ├── MessageBubble[] (用户消息)
│   │   ├── MessageBubble[] (Agent 回复, Markdown)
│   │   ├── StreamRenderer (实时流式内容)
│   │   ├── ToolCallCard[] (工具调用)
│   │   └── QuestionPanel (反问面板, 条件渲染)
│   └── InputBar
│       ├── Textarea (多行输入, Shift+Enter 换行, Enter 发送)
│       └── Button (发送)
└── AgentInfoDrawer (Agent 能力说明)
```

**交互行为：**
1. 发送消息 → `agentStore.sendMessage(text)` → SSE 流式接收
2. 流式渲染：`StreamRenderer` 逐字符显示 + Markdown 实时解析
3. 反问出现 → `QuestionPanel` 渲染 → 用户回答 → `agentStore.answerQuestion()`
4. 跳过反问 → `agentStore.skipQuestion()`
5. Agent 切换 → `AgentSelector` 下拉选择 → `agentStore.setActiveAgent()`
6. 会话切换 → `agentStore.switchSession(id)` → 加载历史消息
7. 新建会话 → `agentStore.createSession()`
8. 删除会话 → `agentStore.deleteSession(id)` → 确认对话框
9. URL 包含 `:sessionId` → 自动切换到对应会话

**状态处理：**
- **加载态（会话列表）**：侧栏骨架屏 x 3
- **加载态（消息）**：消息区域骨架屏 x 5
- **空态（无会话）**：`<EmptyState title="开始对话" description="点击 '新建会话' 与 Agent 交流" />`
- **空态（无消息）**：`<EmptyState title="发送第一条消息" description="输入你的问题，Agent 会为你分析" />`
- **流式中**：InputBar disabled，显示 "Agent 思考中..." 动画
- **错误态**：Toast 显示错误信息，InputBar 恢复可用

### §6.7 NotesPage

| 属性 | 值 |
|------|------|
| 路由 | `/notes` |
| 职责 | 跨项目笔记管理 + 搜索 |
| 数据来源 | react-query `useAllNotes` + noteStore |

**组件树：**
```
NotesPage
├── NoteSidebar
│   ├── SearchInput
│   ├── Button (新建笔记)
│   └── NoteListItem[] (点击加载)
│       ├── Title
│       ├── ProjectName (来源项目)
│       └── UpdatedAt
├── NoteContent
│   ├── NoteHeader (标题 + 编辑/删除按钮)
│   ├── MarkdownRenderer (预览模式)
│   └── NoteEditor (编辑模式)
│       ├── TitleInput
│       ├── MarkdownTextarea
│       ├── PreviewPanel (实时预览)
│       └── ButtonGroup (保存 | 取消)
└── DeleteConfirmDialog
```

**交互行为：**
1. 搜索 → noteStore.searchQuery → 客户端过滤（Mock）/ API 搜索（Real）
2. 点击笔记 → noteStore.startEditing → 加载内容
3. 新建笔记 → 弹出项目选择 + 空白编辑器
4. 编辑 → 实时 Markdown 预览（分屏或 Tab 切换）
5. 保存 → `useMutation` → `updateNote` → invalidate 缓存
6. 删除 → 确认对话框 → `deleteNote` → invalidate 缓存

**状态处理：**
- **加载态**：侧栏骨架屏 + 内容区骨架屏
- **空态（列表）**：`<EmptyState title="暂无笔记" description="在项目详情页创建笔记" />`
- **空态（内容）**：`<EmptyState title="选择一条笔记" description="从左侧列表选择笔记查看" />`
- **错误态**：Toast "保存失败，请重试"

### §6.8 SettingsPage

| 属性 | 值 |
|------|------|
| 路由 | `/settings` |
| 职责 | 主题/字体/GitHub 账号/LLM 配置 |
| 数据来源 | settingsStore + react-query `useGithubAccounts` |

**组件树：**
```
SettingsPage
├── Section: 外观
│   ├── ThemeToggle (dark / light / system)
│   └── FontScaleSlider (0.8 - 1.4, step 0.1)
├── Section: GitHub 账号
│   ├── GitHubAccountList
│   │   └── GitHubAccountItem[] (头像 + 用户名 + 解绑按钮)
│   └── BindGitHubForm (用户名 + PAT 输入)
├── Section: LLM 配置
│   ├── ProviderSelect (OpenAI / Anthropic / Local)
│   ├── ModelInput
│   ├── ApiBaseInput (可选)
│   ├── ApiKeyInput (type=password, 显示脱敏值)
│   ├── Button (测试连通性)
│   └── TestResult (成功/失败 + 延迟)
├── Section: 账户
│   ├── UserInfo (用户名 + 创建时间)
│   ├── ChangePasswordForm
│   └── Button (退出登录)
└── Section: 数据
    ├── Button (导出所有项目 JSON)
    └── Button (导出所有笔记 JSON)
```

**交互行为：**
1. 主题切换 → `uiStore.setTheme()` → 即时生效（CSS 变量切换）
2. 字体缩放 → `uiStore.setFontScale()` → 即时生效
3. GitHub 绑定 → 输入用户名 + PAT → `bindGithub()` → 刷新列表
4. GitHub 解绑 → 确认对话框 → `unbindGithub(id)`
5. LLM 配置修改 → `updateSettings()` → 自动保存
6. 测试 LLM → `settingsStore.testLLM()` → 显示延迟结果
7. 修改密码 → 校验新旧密码 → `changePassword()` → 清空所有 token → 重定向登录
8. 退出登录 → `authStore.logout()` → `navigate('/login')`
9. 导出数据 → `exportProjects()` → 触发文件下载

**状态处理：**
- **加载态**：各 Section 骨架屏
- **空态**：N/A（设置页始终有内容）
- **错误态**：Section 级别 Toast 提示

---

## §7 核心组件规格

### §7.1 ForceGraph（D3.js 力导向图）

```typescript
// src/components/graph/ForceGraph.tsx

interface ForceGraphProps {
  data: GraphData;
  width: number;
  height: number;
  onNodeClick: (node: GraphNode) => void;
  onNodeDoubleClick: (node: GraphNode) => void;
  highlightNodeId?: string;
  categoryColors?: Record<string, string>;
}

export function ForceGraph({
  data,
  width,
  height,
  onNodeClick,
  onNodeDoubleClick,
  highlightNodeId,
  categoryColors = {},
}: ForceGraphProps): JSX.Element {
  // 实现：useRef<SVGSVGElement> + useEffect 初始化 D3 simulation
  // ...
}
```

**行为规格：**
- 节点颜色按 `category_id` 映射 CSS 变量 `--category-color-{index}`
- 节点大小按 `stars` 对数缩放：`Math.log2(stars + 1) * 2 + 4`，clamp [4, 20]
- 边透明度按 `similarity` 线性映射 [0.1, 0.8]
- 支持 D3 `zoom` + `drag` 行为
- `highlightNodeId` 节点显示发光环 + 放大 1.5x
- 缩放 > 0.8 时显示节点名称标签，< 0.8 隐藏标签提升性能
- 窗口 resize 时自动适配宽高

**性能约束：**
- 100 节点渲染 < 2s
- 500 节点渲染 < 2s（减少标签显示）
- 使用 `requestAnimationFrame` 节流 tick 回调

### §7.2 StreamRenderer（SSE 渲染器）

```typescript
// src/components/agent/StreamRenderer.tsx

interface StreamRendererProps {
  content: string;
  thinkingContent: string;
  toolCalls: Map<string, { name: string; args: Record<string, unknown>; result?: unknown }>;
  isStreaming: boolean;
  agentId: AgentId;
}

export function StreamRenderer({
  content,
  thinkingContent,
  toolCalls,
  isStreaming,
  agentId,
}: StreamRendererProps): JSX.Element {
  // 实现：useMemo 解析 Markdown + 实时渲染
  // ...
}
```

**行为规格：**
- 逐字符追加文本，每 50ms 批量渲染一次 Markdown（性能优化）
- 工具调用显示为可折叠 `<ToolCallCard />`，内联在文本流中
- thinking 内容显示为灰色半透明可折叠区域（默认折叠）
- 反问出现时暂停文本流，显示 `<QuestionPanel />`
- 流式结束（`isStreaming=false`）后移除光标动画
- 流式中显示闪烁光标 `▊`

### §7.3 MessageBubble（消息气泡）

```typescript
// src/components/agent/MessageBubble.tsx

interface MessageBubbleProps {
  message: AgentMessage;
  isLatest: boolean;
}

export function MessageBubble({ message, isLatest }: MessageBubbleProps): JSX.Element {
  // ...
}
```

**行为规格：**
- `role === 'user'`：右对齐，主色调背景
- `role === 'assistant'`：左对齐，卡片背景，内容 Markdown 渲染
- `role === 'tool'`：折叠显示，灰色背景
- `role === 'system'`：居中，小号字体，灰色文字
- 显示 Agent 头像（emoji）+ 时间戳
- 最新一条 assistant 消息（`isLatest`）允许复制操作

### §7.4 QuestionPanel（反问面板）

```typescript
// src/components/agent/QuestionPanel.tsx

interface QuestionPanelProps {
  question: AgentQuestion;
  onSubmit: (answers: QuestionAnswer[]) => void;
  onSkip: () => void;
  isSubmitting: boolean;
}

export function QuestionPanel({
  question,
  onSubmit,
  onSkip,
  isSubmitting,
}: QuestionPanelProps): JSX.Element {
  // ...
}
```

**行为规格：**
- 渲染 `question.intro.content`（Markdown）作为引导语
- 遍历 `question.questions` 数组，按 `type` 渲染对应子组件：

| type | 子组件 | UI 描述 |
|------|--------|---------|
| `radio` | `QuestionRadio` | 单选按钮组，每项可含 description，allow_other 展开 textarea |
| `checkbox` | `QuestionCheckbox` | 多选复选框组 |
| `slider` | `QuestionSlider` | 范围滑块，labels 显示关键刻度标记 |
| `drag_sort` | `QuestionDragSort` | 拖拽排序列表，上下拖动调整顺序 |
| `knowledge_map` | `QuestionKnowledgeMap` | 可展开树形结构，节点可勾选 |

- Submit 按钮 → 收集所有 answers → `onSubmit(answers)`
- Skip 按钮（`allow_skip === true` 时显示）→ `onSkip()`
- `isSubmitting` 时所有控件 disabled
- timeout 不为 null 时显示倒计时，超时自动 skip

### §7.5 ToolCallCard

```typescript
// src/components/agent/ToolCallCard.tsx

interface ToolCallCardProps {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  isExecuting: boolean;
}

export function ToolCallCard({
  callId,
  name,
  args,
  result,
  isExecuting,
}: ToolCallCardProps): JSX.Element {
  // ...
}
```

**行为规格：**
- 默认折叠，点击展开查看 args 和 result
- 执行中（`isExecuting = !result`）显示旋转图标 + "执行中..."
- 执行完成显示绿色勾号
- args 和 result 以 JSON 格式展示（`<pre>` + `JSON.stringify`）

### §7.6 AgentSelector

```typescript
// src/components/agent/AgentSelector.tsx

interface AgentSelectorProps {
  activeAgent: AgentId;
  agents: AgentProfile[];
  onSelect: (agentId: AgentId) => void;
}

export function AgentSelector({
  activeAgent,
  agents,
  onSelect,
}: AgentSelectorProps): JSX.Element {
  // ...
}
```

**行为规格：**
- 下拉菜单显示所有可用 Agent
- 每项显示：emoji + 名称 + 简短描述
- 当前选中 Agent 高亮
- 选择新 Agent → `onSelect()` → 在对话中显示 "切换到 {AgentName}" 系统消息

### §7.7 ProtectedRoute

```typescript
// src/components/layout/ProtectedRoute.tsx
// 已在 §3.2 详述
```

### §7.8 AppShell

```typescript
// src/components/layout/AppShell.tsx

interface AppShellProps {
  children?: React.ReactNode;
}

export function AppShell({ children }: AppShellProps): JSX.Element {
  // ...
}
```

**组件树：**
```
AppShell
├── Sidebar (左侧, 可折叠)
│   ├── Logo
│   ├── NavItems (Dashboard, Graph, Agent, Notes, Settings)
│   └── UserAvatar (底部)
├── Topbar (顶部)
│   ├── Breadcrumb
│   └── UserMenu (头像 + 下拉)
└── Main (内容区)
    └── <Outlet /> (react-router children)
```

**布局规格：**
- Sidebar 宽度：展开 240px，折叠 64px
- Topbar 高度：48px
- Main 区域：`flex: 1`，`overflow-y: auto`
- 响应式：窗口 < 768px 时 Sidebar 自动折叠为 overlay

### §7.9 MarkdownRenderer

```typescript
// src/components/common/MarkdownRenderer.tsx

interface MarkdownRendererProps {
  content: string;
  className?: string;
  allowHtml?: boolean; // 默认 false
}

export function MarkdownRenderer({
  content,
  className,
  allowHtml = false,
}: MarkdownRendererProps): JSX.Element {
  // 实现：react-markdown + remark-gfm
  // ...
}
```

**行为规格：**
- 使用 `react-markdown` + `remark-gfm` 渲染
- 支持 GFM 扩展语法：表格、任务列表、脚注、strikethrough
- 代码块高亮（使用 `react-syntax-highlighter` 或 `prism-react-renderer`）
- `allowHtml=false`（默认）：所有 HTML 标签被转义
- 链接在新窗口打开（`target="_blank" rel="noopener noreferrer"`）
- 图片懒加载（`loading="lazy"`）

### §7.10 EmptyState

```typescript
// src/components/common/EmptyState.tsx

interface EmptyStateProps {
  icon?: string;        // SVG icon 名称
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps): JSX.Element {
  // ...
}
```

### §7.11 LoadingSpinner

```typescript
// src/components/common/LoadingSpinner.tsx

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  fullScreen?: boolean;
  text?: string;
}

export function LoadingSpinner({
  size = 'md',
  fullScreen = false,
  text,
}: LoadingSpinnerProps): JSX.Element {
  // ...
}
```

### §7.12 Toast

```typescript
// src/components/common/Toast.tsx

interface ToastProps {
  toast: {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  };
  onClose: (id: string) => void;
}

export function Toast({ toast, onClose }: ToastProps): JSX.Element {
  // ...
}
```

**行为规格：**
- 从右侧滑入，3s 后自动滑出
- 不同类型不同颜色：success(绿), error(红), warning(橙), info(蓝)
- 可手动点击关闭
- 多条 Toast 堆叠显示（最多 3 条，超出排队）
- 通过 `uiStore.toasts` 驱动，全局只有一个 `<ToastContainer />` 在 AppShell 中

---

## §8 SSE 流式处理规格

### §8.1 SSE 消费方式

由于 Agent 端点需要 POST 请求（不能使用标准 `EventSource`），使用 `fetch` + `ReadableStream` 消费：

```typescript
// src/api/real/sse.ts

import type { SSEEvent, SSEEventType } from '../types';

/**
 * 消费 SSE 流式响应，返回 AsyncGenerator<SSEEvent>。
 * 适用于 POST 请求的 SSE 端点。
 */
export async function* consumeSSE(
  url: string,
  body: Record<string, unknown>,
  token: string
): AsyncGenerator<SSEEvent> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.json();
    throw errorBody;
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE 事件以 \n\n 分隔
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? ''; // 最后一个可能是不完整的块

      for (const block of blocks) {
        if (!block.trim()) continue;

        const eventMatch = block.match(/^event:\s*(.+)$/m);
        const dataMatch = block.match(/^data:\s*(.+)$/m);

        if (eventMatch?.[1] && dataMatch?.[1]) {
          const event: SSEEvent = {
            event: eventMatch[1].trim() as SSEEventType,
            data: JSON.parse(dataMatch[1].trim()),
          };
          yield event;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

### §8.2 Mock SSE 实现

```typescript
// src/api/mock/sse.ts

import type { SSEEvent, SSEEventType } from '../types';

const CHAR_DELAY = 12;      // 每字符间隔 ms（模拟打字速度）
const EVENT_DELAY = 100;    // 事件间间隔 ms

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock SSE 流：逐字符 yield text_delta，然后 yield 额外事件。
 */
export async function* mockSSEStream(
  text: string,
  extraEvents?: SSEEvent[]
): AsyncGenerator<SSEEvent> {
  // 1. 逐字符 yield text_delta
  for (const char of text) {
    await delay(CHAR_DELAY);
    yield {
      event: 'text_delta',
      data: { content: char },
    };
  }

  // 2. yield 额外事件（tool_call、question、agent_switch 等）
  if (extraEvents) {
    for (const evt of extraEvents) {
      await delay(EVENT_DELAY);
      yield evt;
    }
  }

  // 3. yield done
  await delay(EVENT_DELAY);
  yield {
    event: 'done',
    data: {
      usage: { tokens: Math.floor(Math.random() * 2000) + 500 },
      iterations: Math.floor(Math.random() * 5) + 1,
    },
  };
}

/**
 * Mock 带工具调用的 SSE 流。
 * 在文本中间穿插 tool_call / tool_result 事件。
 */
export async function* mockSSEWithTools(
  textBefore: string,
  toolCall: { call_id: string; name: string; args: Record<string, unknown> },
  toolResult: unknown,
  textAfter: string
): AsyncGenerator<SSEEvent> {
  // 文本前半段
  for (const char of textBefore) {
    await delay(CHAR_DELAY);
    yield { event: 'text_delta', data: { content: char } };
  }

  // 工具调用
  await delay(EVENT_DELAY);
  yield {
    event: 'tool_call',
    data: toolCall,
  };

  // 模拟工具执行延迟
  await delay(800);
  yield {
    event: 'tool_result',
    data: {
      call_id: toolCall.call_id,
      result: toolResult,
      duration_ms: 800,
    },
  };

  // 文本后半段
  for (const char of textAfter) {
    await delay(CHAR_DELAY);
    yield { event: 'text_delta', data: { content: char } };
  }

  // done
  await delay(EVENT_DELAY);
  yield {
    event: 'done',
    data: {
      usage: { tokens: 1234 },
      iterations: 2,
    },
  };
}

/**
 * Mock 带反问的 SSE 流。
 */
export async function* mockSSEWithQuestion(
  textBefore: string,
  question: import('../types').AgentQuestion
): AsyncGenerator<SSEEvent> {
  for (const char of textBefore) {
    await delay(CHAR_DELAY);
    yield { event: 'text_delta', data: { content: char } };
  }

  await delay(EVENT_DELAY);
  yield {
    event: 'question',
    data: question as unknown as Record<string, unknown>,
  };
}
```

### §8.3 八种事件的 UI 渲染映射表

| SSE Event Type | 数据字段 | UI 组件 | 渲染行为 |
|----------------|----------|---------|----------|
| `text_delta` | `{ content: string }` | `StreamRenderer` | 追加到流式文本，每 50ms 批量渲染 Markdown |
| `thinking` | `{ content: string }` | `StreamRenderer > ThinkingBlock` | 追加到灰色可折叠区域，默认折叠，标题 "思考过程" |
| `tool_call` | `{ call_id, name, args }` | `ToolCallCard` | 插入可折叠卡片，显示工具名 + JSON args，状态 "执行中" |
| `tool_result` | `{ call_id, result, duration_ms? }` | `ToolCallCard` (更新) | 更新对应卡片状态为 "完成"，显示 result JSON |
| `question` | `AgentQuestion` | `QuestionPanel` | 暂停文本流，渲染反面板，等待用户操作 |
| `agent_switch` | `{ from, to, reason }` | `SystemMessage` | 显示居中系统消息 "从 {from} 切换到 {to}: {reason}" |
| `done` | `{ usage, iterations }` | 无可见组件 | `streaming=false`，流式内容固化为 `AgentMessage` |
| `error` | `{ code, message }` | `Toast` | 显示红色 Toast 错误提示，`streaming=false` |

### §8.4 SSE 错误恢复策略

| 错误类型 | 处理方式 |
|----------|----------|
| 网络断开 | Toast "连接中断" + InputBar 恢复可用 + 用户可重新发送 |
| 401 未授权 | 自动 refresh token → 重试（Real 实现）/ 重定向登录 |
| 429 限流 | Toast "请求过于频繁，请稍后重试" + 30s 倒计时 |
| 500 服务器错误 | Toast "服务器错误，请稍后重试" |
| JSON 解析失败 | 跳过该事件块，继续处理后续 |

---

## §9 安全要求

### §9.1 JWT Token 存储

| 版本 | 存储方式 | 说明 |
|------|----------|------|
| v1.0 桌面端 | `localStorage` | pywebview 沙箱内可接受 |
| v1.1+ | `httpOnly cookie` | 后端 Set-Cookie，前端不接触 token |

- Token key: `rp_token`（access）, `rp_refresh`（refresh）
- 登出时清除所有 token
- 修改密码时后端清空所有 refresh_token，前端重新登录

### §9.2 API Key 安全

- 仅在 Settings 页面输入
- 前端不存储明文 — 后端脱敏返回 `sk-****xxxx`
- 输入框 `type="password"`，可切换显示
- 传输通过 HTTPS（生产环境 pywebview 内 localhost）

### §9.3 XSS 防护

- `react-markdown` 默认 escape HTML，不使用 `dangerouslySetInnerHTML`
- `allowHtml` prop 默认 `false`
- 用户输入（笔记标题、项目名）通过 React JSX 渲染，自动转义
- Agent 回复的 Markdown 内容通过 `react-markdown` 渲染，不执行脚本

### §9.4 SSRF 防护

- GitHub URL 输入前端校验：
  ```typescript
  const GITHUB_URL_REGEX = /^https:\/\/github\.com\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
  ```
- 后端二次校验（前端校验仅为 UX 优化）

### §9.5 密码强度

```typescript
function validatePasswordStrength(password: string): { valid: boolean; message: string } {
  if (password.length < 8) {
    return { valid: false, message: '密码长度至少 8 字符' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: '密码需包含至少一个字母' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: '密码需包含至少一个数字' };
  }
  return { valid: true, message: '' };
}
```

### §9.6 CSRF

- v1.0 桌面端不需要 CSRF token（无 cookie 认证，使用 Bearer token）
- v1.1+ 迁移 httpOnly cookie 时需同步添加 CSRF token

---

## §10 性能要求

### §10.1 核心性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 首次加载 (FCP) | < 1.5s | Lighthouse |
| 可交互时间 (TTI) | < 3s | Lighthouse |
| 路由切换 | < 300ms | 用户感知 |
| 项目列表渲染 (100 条) | < 500ms | Performance API |
| 图谱渲染 (100 节点) | < 2s | 从数据加载到 SVG 可见 |
| 图谱渲染 (500 节点) | < 2s | 从数据加载到 SVG 可见 |
| SSE 首字符延迟 | < 200ms (Mock) | 从发送到首个 text_delta yield |
| 包体积 (gzip) | < 300KB (initial) | Vite build report |

### §10.2 优化策略

#### 代码分割 (Code Splitting)

```typescript
// 路由级懒加载
import { lazy, Suspense } from 'react';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const GraphPage = lazy(() => import('./pages/GraphPage'));
const AgentPage = lazy(() => import('./pages/AgentPage'));
const NotesPage = lazy(() => import('./pages/NotesPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// D3.js 仅在 GraphPage 加载
// react-markdown 仅在需要渲染 Markdown 时加载
```

#### 虚拟列表

- 项目列表 > 50 条时启用虚拟滚动（`@tanstack/react-virtual`）
- Agent 消息列表 > 100 条时启用虚拟滚动

#### 防抖与节流

| 操作 | 策略 |
|------|------|
| 搜索输入 | 防抖 300ms |
| 窗口 resize | 节流 150ms |
| Markdown 实时预览 | 防抖 200ms |
| D3 tick 回调 | `requestAnimationFrame` |
| SSE text_delta 渲染 | 批量合并 50ms |

#### 图片优化

- 头像使用 `loading="lazy"`
- SVG 图标内联（不单独请求）

#### react-query 缓存策略

| 数据 | staleTime | gcTime | 说明 |
|------|-----------|--------|------|
| 项目列表 | 5min | 30min | 筛选变化时重新获取 |
| 项目详情 | 10min | 1h | 相对稳定 |
| 笔记列表 | 5min | 30min | 编辑后 invalidate |
| 图谱数据 | 15min | 1h | 计算开销大 |
| 分类/标签 | 30min | 2h | 变化很少 |
| Settings | 1h | 4h | 几乎不变 |
| Agent Sessions | 2min | 10min | 频繁更新 |

---

## §11 测试要求

### §11.1 单元测试（Vitest）

**覆盖率目标：Store + Utils >= 60%**

#### Store 测试

```typescript
// tests/unit/stores/authStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../../../src/stores/authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    localStorage.clear();
  });

  it('should initialize with default state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should set error on login failure', async () => {
    // Mock API 抛出错误
    // ...
  });

  it('should clear tokens on logout', async () => {
    // ...
  });
});
```

#### Utils 测试

```typescript
// tests/unit/utils/validators.test.ts
import { describe, it, expect } from 'vitest';
import {
  validateUsername,
  validatePassword,
  validateGithubUrl,
} from '../../../src/utils/validators';

describe('validators', () => {
  describe('validateUsername', () => {
    it('should accept valid username', () => {
      expect(validateUsername('zhang.jie')).toBeNull();
    });
    it('should reject too short', () => {
      expect(validateUsername('ab')).not.toBeNull();
    });
    it('should reject too long (> 32)', () => {
      expect(validateUsername('a'.repeat(33))).not.toBeNull();
    });
  });

  describe('validatePassword', () => {
    it('should accept valid password', () => {
      expect(validatePassword('demo1234')).toBeNull();
    });
    it('should reject no digit', () => {
      expect(validatePassword('abcdefgh')).not.toBeNull();
    });
    it('should reject no letter', () => {
      expect(validatePassword('12345678')).not.toBeNull();
    });
  });

  describe('validateGithubUrl', () => {
    it('should accept valid GitHub URL', () => {
      expect(validateGithubUrl('https://github.com/facebook/react')).toBeNull();
    });
    it('should reject non-GitHub URL', () => {
      expect(validateGithubUrl('https://gitlab.com/foo/bar')).not.toBeNull();
    });
  });
});
```

#### SSE Parser 测试

```typescript
// tests/unit/utils/sse-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseSSEBlock } from '../../../src/utils/sse-parser';

describe('parseSSEBlock', () => {
  it('should parse valid SSE block', () => {
    const block = 'event: text_delta\ndata: {"content":"hello"}';
    const result = parseSSEBlock(block);
    expect(result).toEqual({
      event: 'text_delta',
      data: { content: 'hello' },
    });
  });

  it('should return null for empty block', () => {
    expect(parseSSEBlock('')).toBeNull();
  });

  it('should return null for missing event field', () => {
    expect(parseSSEBlock('data: {"foo":"bar"}')).toBeNull();
  });
});
```

### §11.2 E2E 测试（Playwright）

5 条核心 happy path：

#### Test 1: 注册 → 登录 → Dashboard

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test('register and login flow', async ({ page }) => {
  // 1. 访问注册页
  await page.goto('/register');
  await page.fill('[name="username"]', 'testuser');
  await page.fill('[name="password"]', 'test1234');
  await page.fill('[name="confirmPassword"]', 'test1234');
  await page.click('button[type="submit"]');

  // 2. 验证跳转到 Dashboard
  await expect(page).toHaveURL('/');
  await expect(page.locator('[data-testid="stats-cards"]')).toBeVisible();
});

test('login with existing user', async ({ page }) => {
  await page.goto('/login');
  await page.fill('[name="username"]', 'testuser');
  await page.fill('[name="password"]', 'test1234');
  await page.click('button[type="submit"]');

  await expect(page).toHaveURL('/');
});
```

#### Test 2: GitHub Star 导入

```typescript
// tests/e2e/projects.spec.ts
test('import GitHub stars', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-testid="import-stars-btn"]');

  // Mock: 显示 Star 列表
  await expect(page.locator('[data-testid="star-list"]')).toBeVisible();

  // 选择前 3 个
  await page.locator('[data-testid="star-item"]').nth(0).click();
  await page.locator('[data-testid="star-item"]').nth(1).click();
  await page.locator('[data-testid="star-item"]').nth(2).click();

  await page.click('[data-testid="confirm-import"]');

  // 验证项目列表出现
  await expect(page.locator('[data-testid="project-table"] tr')).toHaveCount(
    expect.any(Number) // 至少 3 行
  );
});
```

#### Test 3: 项目详情 → README → 笔记

```typescript
// tests/e2e/notes.spec.ts
test('view project detail and create note', async ({ page }) => {
  // 进入第一个项目
  await page.goto('/');
  await page.locator('[data-testid="project-row"]').first().click();

  // 验证 README 渲染
  await expect(page.locator('[data-testid="readme-content"]')).toBeVisible();

  // 切换到 Notes Tab
  await page.click('[data-testid="tab-notes"]');

  // 创建笔记
  await page.click('[data-testid="create-note-btn"]');
  await page.fill('[data-testid="note-title"]', 'Test Note');
  await page.fill('[data-testid="note-content"]', '# Hello\nThis is a test');
  await page.click('[data-testid="save-note-btn"]');

  // 验证笔记出现
  await expect(page.locator('[data-testid="note-item"]').first()).toBeVisible();
});
```

#### Test 4: Agent 对话

```typescript
// tests/e2e/agent.spec.ts
test('agent chat with SSE response', async ({ page }) => {
  await page.goto('/agent');

  // 新建会话
  await page.click('[data-testid="new-session-btn"]');

  // 发送消息
  await page.fill('[data-testid="chat-input"]', '帮我分析一下 React');
  await page.press('[data-testid="chat-input"]', 'Enter');

  // 验证流式回复出现
  await expect(page.locator('[data-testid="stream-renderer"]')).toBeVisible({
    timeout: 5000,
  });

  // 等待流式完成
  await expect(page.locator('[data-testid="streaming-indicator"]')).toHaveCount(
    0,
    { timeout: 30000 }
  );

  // 验证消息固化
  await expect(
    page.locator('[data-testid="message-bubble"][data-role="assistant"]')
  ).toHaveCount(expect.any(Number));
});
```

#### Test 5: 知识图谱

```typescript
// tests/e2e/graph.spec.ts
test('graph visualization and node interaction', async ({ page }) => {
  await page.goto('/graph');

  // 等待图谱渲染
  await expect(page.locator('[data-testid="force-graph-svg"]')).toBeVisible({
    timeout: 5000,
  });

  // 点击节点
  await page.locator('[data-testid="graph-node"]').first().click();

  // 验证详情面板
  await expect(page.locator('[data-testid="node-detail-panel"]')).toBeVisible();

  // 双击跳转
  await page.locator('[data-testid="graph-node"]').first().dblclick();
  await expect(page).toHaveURL(/\/projects\//);
});
```

---

## §12 开发顺序

### Step 1: 项目骨架

| 项目 | 内容 |
|------|------|
| **输入** | 本文档 §1 + §2 |
| **输出** | 可运行的 Vite + React + TS 项目骨架 |
| **任务** | `npm create vite@latest frontend -- --template react-ts`，安装依赖，配置 tsconfig、ESLint、Prettier、路径别名 `@/*` |
| **验收** | `npm run dev` 启动成功，`npm run build` 无错误，ESLint 无警告 |

### Step 2: 设计系统 + App Shell

| 项目 | 内容 |
|------|------|
| **输入** | `design-system.css`（从原型迁移） |
| **输出** | AppShell + Sidebar + Topbar + 路由配置 |
| **任务** | 迁移 CSS 变量、实现 AppShell 布局、配置 react-router、实现 ProtectedRoute |
| **验收** | 页面切换正常，Sidebar 折叠/展开，主题切换生效，未登录重定向到 /login |

### Step 3: API 层搭建

| 项目 | 内容 |
|------|------|
| **输入** | 本文档 §4 |
| **输出** | types.ts + client.ts + MockApiClient 全部方法 |
| **任务** | 定义所有 TS 接口、实现 IApiClient 切换机制、编写 MockApiClient 全部方法 + Mock 数据 |
| **验收** | `MockApiClient` 所有方法可调用，返回正确格式数据，SSE Mock 可逐字符 yield |

### Step 4: Auth 页面

| 项目 | 内容 |
|------|------|
| **输入** | 本文档 §6.1 + §6.2 |
| **输出** | LoginPage + RegisterPage + authStore |
| **任务** | 实现登录/注册表单、表单校验、authStore 状态管理、ProtectedRoute 联调 |
| **验收** | 注册成功自动登录、登录成功跳转 Dashboard、错误提示正确、已登录访问 /login 重定向 |

### Step 5: Dashboard

| 项目 | 内容 |
|------|------|
| **输入** | 本文档 §6.3 |
| **输出** | DashboardPage + FilterBar + ProjectTable + useProjects hook |
| **任务** | 实现项目列表、筛选/搜索（防抖）、排序、分页、视图切换、统计卡片 |
| **验收** | 筛选生效、搜索防抖 300ms、分页正确、点击跳转详情、空态/加载态/错误态正确 |

### Step 6: 项目详情

| 项目 | 内容 |
|------|------|
| **输入** | 本文档 §6.4 |
| **输出** | ProjectDetailPage + MarkdownRenderer + ProgressBadge + TagEditor |
| **任务** | 实现项目详情 Tabs、README Markdown 渲染、进度更新、标签编辑 |
| **验收** | README 渲染正确（表格/代码/链接）、进度切换生效、标签编辑正确 |

### Step 7: 笔记系统

| 项目 | 内容 |
|------|------|
| **输入** | 本文档 §6.7 + §6.4 Notes Tab |
| **输出** | NotesPage + NoteEditor + NoteList + noteStore |
| **任务** | 实现笔记 CRUD、Markdown 编辑器（分屏预览）、跨项目搜索 |
| **验收** | 创建/编辑/删除笔记、Markdown 实时预览、搜索结果正确 |

### Step 8: 知识图谱

| 项目 | 内容 |
|------|------|
| **输入** | 本文档 §6.5 |
| **输出** | GraphPage + ForceGraph(D3) + GraphControls |
| **任务** | D3.js 力导向图实现、节点着色/缩放、交互（点击/搜索/筛选）、性能优化 |
| **验收** | 100 节点 < 2s 渲染、节点点击显示详情、双击跳转、搜索高亮、分类着色 |

### Step 9: Agent 对话

| 项目 | 内容 |
|------|------|
| **输入** | 本文档 §6.6 + §8 |
| **输出** | AgentPage + ChatPanel + StreamRenderer + QuestionPanel + agentStore |
| **任务** | SSE 流处理、消息渲染、流式 Markdown、反问面板（5 种类型）、工具调用卡片、会话管理 |
| **验收** | SSE 流式显示、Markdown 实时渲染、反问面板 5 种类型可交互、Agent 切换、会话 CRUD |

### Step 10: Settings

| 项目 | 内容 |
|------|------|
| **输入** | 本文档 §6.8 |
| **输出** | SettingsPage + settingsStore |
| **任务** | 主题切换、字体缩放、GitHub 绑定/解绑、LLM 配置 + 测试、密码修改、数据导出 |
| **验收** | 主题即时切换、LLM 测试显示延迟、GitHub 绑定列表正确、密码修改后重定向登录 |

### Step 11: 测试

| 项目 | 内容 |
|------|------|
| **输入** | 本文档 §11 |
| **输出** | Vitest 单元测试 + Playwright E2E 测试 |
| **任务** | Store 测试、Utils 测试、5 条 E2E happy path |
| **验收** | Store + Utils 覆盖率 >= 60%、5 条 E2E 全部通过 |

### Step 12: 性能优化 + 真实后端对接

| 项目 | 内容 |
|------|------|
| **输入** | 本文档 §10 + §14 |
| **输出** | 性能优化完成 + RealApiClient 实现 |
| **任务** | 路由懒加载、虚拟列表、D3 优化、包体积优化、RealApiClient 全部方法 + JWT 拦截器 |
| **验收** | Lighthouse 性能分 > 90、包体积 < 300KB gzip、RealApiClient 通过 Mock 对比测试 |

---

## §13 代码规范

### §13.1 ESLint 配置

```javascript
// .eslintrc.cjs
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'react-refresh'],
  rules: {
    // 禁止 any
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',

    // React
    'react-refresh/only-export-components': 'warn',

    // 禁止 console.log（允许 warn/error）
    'no-console': ['warn', { allow: ['warn', 'error'] }],

    // 未使用变量
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],

    // 强制 explicit return type on exported functions
    '@typescript-eslint/explicit-function-return-type': [
      'warn',
      { allowExpressions: true, allowTypedFunctionExpressions: true },
    ],
  },
};
```

### §13.2 Prettier 配置

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### §13.3 命名规范

| 类型 | 风格 | 示例 |
|------|------|------|
| 组件文件名 | PascalCase | `ChatPanel.tsx` |
| 组件名 | PascalCase | `export function ChatPanel()` |
| Hook 文件名 | camelCase | `useProjects.ts` |
| Hook 名 | camelCase + use 前缀 | `export function useProjects()` |
| Store 文件名 | camelCase | `authStore.ts` |
| Store Hook | use 前缀 + Store 后缀 | `useAuthStore` |
| 工具函数文件名 | kebab-case | `sse-parser.ts` |
| 工具函数名 | camelCase | `parseSSEBlock()` |
| 类型/接口名 | PascalCase | `AgentMessage` |
| 枚举类型 | PascalCase + union | `type AgentId = 'hub' \| 'scout'` |
| 常量 | UPPER_SNAKE_CASE | `const MAX_RETRY = 3` |
| CSS 变量 | kebab-case | `--color-primary` |
| CSS 类名 | BEM 或 kebab-case | `.chat-panel__message--user` |
| 测试文件名 | `.test.ts` 后缀 | `authStore.test.ts` |

### §13.4 文件组织规范

- **单文件单职责**：每个 `.ts` / `.tsx` 文件只导出一个主要实体（组件/Store/hook）
- **类型集中**：所有 API 类型在 `api/types.ts`，组件 Props 类型在组件文件内
- **import 顺序**：
  1. React / 第三方库
  2. 内部模块（`@/api`, `@/stores`, `@/hooks`, `@/components`）
  3. 相对路径模块（`./`, `../`）
  4. 样式文件（`.css`）
- **禁止循环依赖**：stores → api → types（单向依赖链）
- **组件最大行数**：300 行（超出需拆分）

### §13.5 Git 提交规范

```
<type>(<scope>): <subject>

type: feat | fix | refactor | test | docs | chore | style | perf
scope: api | auth | dashboard | project | agent | graph | notes | settings | shell
```

示例：`feat(agent): implement SSE stream renderer with Markdown support`

---

## §14 Mock → Real 迁移清单

后端开发完成后，按以下步骤对接真实 API：

### 14.1 前置检查

- [ ] 后端所有 §2 端点已实现并通过 Postman/curl 测试
- [ ] 响应格式符合 `ApiResponse<T>` / `ApiError` 统一格式
- [ ] SSE 端点返回正确的 `event:` / `data:` 格式
- [ ] CORS 允许 `http://localhost:*` 和 `http://127.0.0.1:*`
- [ ] JWT 签发/刷新/注销流程正常
- [ ] 速率限制按 API_SPEC §1.5 实现

### 14.2 RealApiClient 实现

- [ ] 创建 `src/api/real/index.ts`，实现 `IApiClient` 全部方法
- [ ] 实现 `src/api/real/interceptor.ts`：JWT 自动注入 + 401 自动 refresh + 重试
- [ ] 实现 `src/api/real/sse.ts`：`fetch` + `ReadableStream` SSE 消费
- [ ] 非 2xx 响应统一抛 `ApiError`
- [ ] 所有方法的请求/响应类型与 `types.ts` 一致

### 14.3 切换验证

- [ ] 修改 `.env` 为 `VITE_USE_MOCK=false`
- [ ] 注册 → 登录 → 获取 token → 存入 localStorage
- [ ] 刷新页面 → `fetchMe()` 成功恢复登录态
- [ ] 401 → 自动 refresh → 原请求重试成功
- [ ] refresh token 过期 → 清空 token → 重定向 /login
- [ ] 项目 CRUD 全流程测试
- [ ] 笔记 CRUD 全流程测试
- [ ] 图谱数据正确渲染
- [ ] Agent SSE 流式对话完整测试（text_delta / tool_call / question / done）
- [ ] 反问 5 种类型全部测试
- [ ] Settings 保存/读取/LLM 测试
- [ ] GitHub 绑定/解绑/Star 导入

### 14.4 回归测试

- [ ] Playwright 5 条 E2E 全部通过
- [ ] Vitest 单元测试全部通过
- [ ] 无 TypeScript 编译错误（`tsc --noEmit`）
- [ ] ESLint 无 error
- [ ] 性能指标达标（§10.1）

### 14.5 生产构建

- [ ] `npm run build` 成功
- [ ] 构建产物 < 300KB gzip
- [ ] pywebview 加载本地 SPA 正常
- [ ] `VITE_API_BASE_URL` 指向 `http://127.0.0.1:19876/api/v1`

---

> **文档结束。** 本文档是 RepoPilot v1.0 前端开发的唯一权威参考。任何与本文档不一致的实现都应被视为 bug。如有疑问，以本文档为准。
