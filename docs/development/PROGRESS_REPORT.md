# RepoPilot 开发进度报告

> 报告日期：2026-07-23  
> 代码版本：`2.0.0`（根 `package.json` / `apps/web/package.json`）  
> 报告范围：`services/api/backend/`、`apps/web/src/`、`packages/*`

---

## 1. 总体结论

RepoPilot v1.0 的核心产品闭环已经在代码层面基本跑通：

- 后端 `services/api/backend/` 已具备完整的认证、项目/分类/标签/笔记/图谱 CRUD、GitHub 集成、LLM BYOK、Agent 运行时（Hub + 6 个专业 Agent）和 SSE 流式对话能力。
- 前端 `apps/web/src/` 已完成所有 MVP 页面、路由、状态管理、Mock/Real 双轨 API 客户端、Agent Chat、图谱、笔记编辑器。
- 测试体系已建立，覆盖单元、模块、集成和部分业务场景。

但文档层（PRD / SPEC / MVP_SCOPE / 路线图）仍停留在 v1.0 草案状态，与代码存在显著差距；部分基础设施（共享包、Alembic 迁移、独立服务进程）尚未落地。

---

## 2. 已实现功能

### 2.1 后端（`services/api/backend/`）

| 模块 | 已实现能力 | 关键文件 |
|------|-----------|---------|
| **认证** | 注册/登录/refresh/logout/修改密码；JWT + httpOnly Cookie 双通道；refresh token 哈希与轮换；`token_version` 改密失效；SlowAPI 限流 | `api/auth.py`、`services/auth_service.py`、`core/security.py`、`core/auth_cookies.py` |
| **用户/设置** | 用户信息更新、用户画像 CRUD、设置读写、LLM API Key 加密存储与脱敏、LLM 连通性测试 | `api/user.py`、`api/settings.py`、`services/settings_service.py`、`services/profile_service.py` |
| **GitHub 集成** | PAT 绑定/解绑、Star 列表分页拉取、仓库搜索、README 拉取、批量导入（≤500 条/次） | `api/github.py`、`services/github_client.py`、`services/project_service.py` |
| **项目/分类/标签/笔记** | 完整 CRUD、筛选/排序/分页、进度更新、统计、预设分类种子、自定义分类、多标签绑定 | `api/projects.py`、`api/categories.py`、`api/tags.py`、`api/notes.py`、对应 `services/*` |
| **图谱** | 基于 TF-IDF + 语言 + 分类 + 名称 token 重叠的多信号相似度，实时计算力导向图节点/边 | `api/graph.py`、`services/graph_service.py` |
| **LLM** | LiteLLM 统一封装；流式/非流式补全；JSON 输出；多 provider 前缀处理；连接测试 | `llm/provider.py`、`llm/config.py` |
| **Agent 运行时** | 7 个 Agent 注册（Hub + Scout/Mentor/Navigator/Curator/Scribe/Atlas）；Hub Plan-and-Execute、ReAct 工具循环、意图分类、CoT/ToT/Reflexion 工作流、反问拦截、SSE 真流式 | `agents/registry.py`、`agents/hub.py`、`agents/react.py`、`agents/intent.py`、`services/agent_service.py` |
| **Memory** | 短期/长期记忆、用户画像提案、证据加权合并、历史压缩、上下文构建 | `memory/service.py`、`memory/context.py` |
| **Tools** | 15 个内置工具注册与权限校验；OpenAI function 格式；执行超时 | `tools/registry.py`、`tools/builtin.py` |
| **安全/中间件** | CORS、SlowAPI 限流、URL 安全校验、Fernet 加密、全局异常处理 | `core/middleware.py`、`core/limiter.py`、`core/url_safety.py`、`core/security.py` |

### 2.2 前端（`apps/web/src/`）

| 模块 | 已实现能力 | 关键文件 |
|------|-----------|---------|
| **页面/路由** | `/login`、`/register`、`/`、`/projects`、`/projects/:id`、`/agent`、`/graph`、`/notes`、`/settings`、`/profile` | `App.tsx`、各 `pages/*.tsx` |
| **布局/导航** | Sidebar + Topbar + AppShell、ProtectedRoute、主题切换 | `components/layout/*`、`components/auth/*` |
| **项目库** | 表格列表、筛选面板、批量操作、GitHub Star 抽屉导入、URL 批量导入、分类/标签管理、编辑项目 | `pages/ProjectsPage.tsx`、`components/project/*` |
| **项目详情** | 基础信息、README 查看器、笔记面板、学习进度、Scout 快速分析入口、右侧专家 Agent 面板 | `pages/ProjectDetailPage.tsx` |
| **Agent Chat** | 会话列表、ChatPanel、MessageBubble、StreamRenderer、5 种反问组件（radio/checkbox/slider/drag_sort/knowledge_map）、Agent 切换、上下文窗口统计 | `pages/AgentPage.tsx`、`components/agent/*` |
| **图谱** | D3 力导向图、节点点击、缩放/拖拽、图谱向导 | `pages/GraphPage.tsx`、`components/graph/*` |
| **笔记** | 笔记列表、分屏编辑/实时预览、Scribe 辅助生成 | `pages/NotesPage.tsx`、`components/note/*` |
| **设置** | 外观、GitHub 绑定、LLM BYOK、数据导出 | `pages/SettingsPage.tsx` |
| **状态/API** | Zustand stores、TanStack Query hooks、Mock/Real 统一 API 客户端、SSE 解析工具 | `stores/*`、`hooks/*`、`api/*`、`utils/*` |

### 2.3 共享包（`packages/*`）

| 包 | 状态 |
|---|---|
| `packages/types` | 仅 `export {}` 空壳 |
| `packages/ui` | 仅 `export {}` 空壳 |
| `packages/contracts` | 仅 `README.md` |
| `packages/prompts` | 仅 `README.md` |
| `packages/py-shared` | 仅版本号 docstring |
| `packages/config` | 目录存在，未深入 |

实际类型/契约仍分散维护在前端 `apps/web/src/api/types.ts` 与后端 `services/api/backend/schemas/*.py`。

### 2.4 测试

- 后端：`tests/` 下已覆盖单元、模块、集成、业务、功能测试，使用 `pytest` + `httpx` + 异步 SQLAlchemy fixture。
- 前端：`vitest` 单元测试 + `playwright` E2E 测试骨架已就位。

---

## 3. 实现方式概述

### 3.1 后端架构

```
FastAPI Router  →  Service  →  SQLAlchemy 2.0 Async ORM  →  aiosqlite
        ↓
    JWT/Cookie Auth + SlowAPI Limiter
        ↓
    Agent Service  →  Hub / ReAct Engine  →  LiteLLM
        ↓
    Tool Registry  +  Memory Service  +  Graph Service
```

- **数据库**：使用 `metadata.create_all()` 在启动时建表，辅以 `migrations/schema_sync.py` 做列补齐；**未启用 Alembic**。
- **认证**：采用 access token（15min）+ refresh token（7d）双 token；refresh token 以 SHA256 哈希存表，支持轮换与吊销；密码修改时提升 `token_version` 使已签发 access token 失效。
- **LLM**：通过 `LLMProvider` 封装 LiteLLM，支持流式补全与 `test_connection()`；用户 Key 经 Fernet 加密后存 `users.settings_json`。
- **Agent**：
  - `AgentRegistry`（`agents/registry.py`）用 dataclass 定义 7 个 Agent 的 soul、workflow、tools 白名单。
  - `HubService`（`agents/hub.py`）负责意图路由、Plan-and-Execute、多 Agent 派发、反问续答。
  - `ReActEngine`（`agents/react.py`）实现工具循环、CoT 两阶段真流式、无工具兜底收口。
  - 工具统一注册在 `tools/builtin.py`，权限在 `tools/registry.py` 校验。
- **图谱**：`graph_service.py` 使用 scikit-learn `TfidfVectorizer` 计算项目描述向量，叠加语言、分类、名称重叠信号，实时生成节点/边。

### 3.2 前端架构

```
Vite + React 19 + TypeScript
  ↓
React Router 7  +  Zustand 5  +  TanStack Query 5
  ↓
IApiClient 契约  →  Mock 实现 / Real HTTP 实现
  ↓
SSE 流式解析  +  Agent 反问渲染  +  D3 图谱  +  react-markdown
```

- **API 双轨**：`api/client.ts` 统一接口；`VITE_USE_MOCK=false` 时切换为真实后端。
- **状态**：按领域拆分 store（auth/project/note/agent/graph/settings/ui）。
- **SSE**：通过 `EventSource` 或 fetch ReadableStream 消费后端 SSE，解析 `text_delta/tool_call/question/thinking` 等事件类型。

### 3.3 Monorepo 现状

- `apps/web` 与 `services/api` 是实际工作的两个主体。
- `services/agent`、`services/mcp`、`apps/desktop` 仅为占位服务，尚未实现。
- `packages/*` 共享库尚未填充。

---

## 4. 文档与代码的主要差距

| 文档声明 | 代码实际 | 说明 |
|---|---|---|
| README/PRD 称当前 v1.0 | 包版本 `2.0.0`，`docs/product/v2/` 已存在 | 版本标识与文档层级未对齐 |
| PRD/MVP 列 6 个 Agent | 代码注册 7 个（含 Atlas） | 产品文档未纳入 Atlas |
| MVP 预设分类 12 个 | 实际种子只有 5 个 | `seed_service.py` 已简化 |
| MVP 数据模型 14 张表 | 实际 11 张表；`user_github_accounts`、`user_settings`、`graph_cache` 未独立建表 | 相关数据以 JSON 字段或运行时计算存在 |
| MVP 端点清单含 `/export`、`/search`、`/compare`、`/recommend`、`/config` 等 | 这些端点尚未实现 | 详见 `MVP_SCOPE.md` §4.1 已标注 |
| MVP 称 README 存 `projects.readme` | 实际通过 `/projects/{id}/readme` 按需拉取 | 无持久化缓存 |
| 路线图 Phase 0-11 未勾选 | 实际开发已跨越多个 Phase | 路线图已失去进度跟踪作用 |
| 架构文档称 `packages/*` 为共享契约 | 实际为空壳 | 类型/契约分散维护 |

---

## 5. 修改建议

### 5.1 文档层

1. **统一版本叙事**：在 `README.md`、`docs/product/README.md` 及 `MVP_SCOPE.md` 中明确“代码包版本为 2.0.0，产品文档正在从 v1.0 草案向 v2 对齐”，避免新人混淆。
2. **继续补充事实标注**：PRD / SPEC / AGENT_SPEC 中涉及具体实现形态（Agent 数量、分类列表、数据模型、端点）的章节，应参照 `MVP_SCOPE.md` 的标注方式补充“与代码实际差异”说明，或启动 v2 版本重写。
3. **路线图重构**：`DEVELOPMENT_ROADMAP.md` 当前是预实施计划，建议改为“已完成 / 进行中 / 待办”形式的实际进度看板，或另建 `PROGRESS_BOARD.md`。
4. **维护 `PROGRESS_REPORT.md`**：本报告应定期（如每轮迭代后）更新，作为新成员和面试官了解项目的第一手资料。

### 5.2 代码组织（不修改代码，仅建议）

1. **共享包落地**：优先把 `packages/types` 和 `packages/py-shared` 填起来，让前后端共享 Pydantic / TypeScript 模型，减少两边维护同一份契约的成本。
2. **启用 Alembic**：目前使用 `create_all` + `schema_sync.py`，随着模型迭代会越来越难维护。建议补充 `alembic/versions/` 初始迁移。
3. **拆分数据表**：按 SPEC 规划，将 `users.github_accounts` 和 `users.settings_json` 拆为独立表 `user_github_accounts` / `user_settings`，并补 `graph_cache` 表以支持图谱缓存。
4. **补齐缺失端点**：按业务优先级实现 `/projects/export`、`/notes/search`、`/agent/compare`、`/agent/recommend`、`/agent/config`、`/agent/profiles/{id}`、`/agent/user-profile` 等。
5. **README 缓存策略**：导入时预存 `projects.readme` 并设置 TTL，避免每次打开详情页都调用 GitHub API，降低速率限制风险。
6. **Agent 配置目录化**：如果未来需要支持动态加载/插件化，可把 `agents/registry.py` 中的硬编码配置迁移到 `scout/AGENT.md`、`scout/SOUL.md` 等文件结构。
7. **OAuth 与 Desktop/MCP**：这些是明确的后排项，可在文档中保持“v1.1+ / v1.4+”规划，不必急于实现。

### 5.3 质量与可维护性

1. **测试覆盖率**：继续补齐 Service 层覆盖率，重点覆盖无 Key 降级路径、Agent 工具权限、图谱相似度计算。
2. **E2E**：完成 5 条核心 happy path（注册 → 导入 → 图谱 → 笔记 → Agent 对话）。
3. **Lint/TypeCheck**：保持 `eslint --max-warnings 0` 和 `tsc --noEmit` 清零。
4. **API 文档**：利用 FastAPI 自动 OpenAPI，为尚未补充 description 的端点补齐说明。

---

## 6. 关键文件速查

| 目的 | 路径 |
|---|---|
| 后端入口 | `services/api/backend/main.py` |
| 认证 | `services/api/backend/api/auth.py`、`services/auth_service.py` |
| 项目/分类/标签/笔记 | `services/api/backend/api/{projects,categories,tags,notes}.py` |
| Agent API | `services/api/backend/api/agent.py` |
| Agent 运行时 | `services/api/backend/agents/{registry,hub,react,intent}.py` |
| 工具 | `services/api/backend/tools/{registry,builtin}.py` |
| Memory | `services/api/backend/memory/{service,context}.py` |
| 图谱 | `services/api/backend/services/graph_service.py` |
| LLM | `services/api/backend/llm/{provider,config}.py` |
| 前端入口 | `apps/web/src/App.tsx` |
| API 客户端 | `apps/web/src/api/client.ts`、`api/real/`、`api/mock/` |
| 页面 | `apps/web/src/pages/*.tsx` |
| Agent 组件 | `apps/web/src/components/agent/*.tsx` |
| 测试 | `tests/`、`apps/web/tests/` |

---

*本报告基于对 `services/api/backend/`、`apps/web/src/`、`packages/*` 的代码检查生成，具体实现以代码为准。*
