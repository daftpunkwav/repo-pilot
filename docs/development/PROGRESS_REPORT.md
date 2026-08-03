# RepoPilot 开发进度报告

> 报告日期：2026-08-03  
> 代码版本：`2.0.0`（根 `package.json` / `apps/web/package.json` / `services/api` pyproject / FastAPI `version`）  
> 报告范围：`services/api/backend/`、`apps/web/src/`、`packages/*`  
> 上一版：2026-07-23

---

## 1. 总体结论

RepoPilot v1.0 的核心产品闭环已在代码层面跑通，并在 2026-07 下旬至 08 月初完成一轮 **Agent Chat 编排与写工具落库** 升级：

- 后端 `services/api/backend/`：认证、项目/分类/标签/笔记/图谱/Overview CRUD、GitHub 集成、LLM BYOK、Hub + 6 专家、约 **24** 个内置工具、SSE 流式对话。
- 前端 `apps/web/src/`：全部 MVP 页面与路由（含 `/agent/sessions/:sessionId`）、Mock/Real 双轨 API、Agent Chat 流式渲染与结果卡。
- 开发默认：API **`:19878`**（与 Vite 代理一致）；`.env.development` 中 `VITE_USE_MOCK=false`。

文档层（PRD / SPEC）仍大量停留在 v1.0 草案；`MVP_SCOPE.md` 已有部分与代码差异标注。共享包、Alembic、独立 Agent/MCP/Desktop 进程尚未落地。

---

## 2. 已实现功能

### 2.1 后端（`services/api/backend/`）

| 模块 | 已实现能力 | 关键文件 |
|------|-----------|---------|
| **认证** | 注册/登录/refresh/logout/修改密码；JWT + httpOnly Cookie；refresh 哈希轮换；`token_version`；SlowAPI 限流 | `api/auth.py`、`services/auth_service.py`、`core/security.py` |
| **用户/设置** | 用户信息、画像 CRUD、记忆提案接受/拒绝、清除记忆、设置读写、LLM Key 加密、连通性测试、Agent 行为准则 | `api/user.py`、`api/settings.py`、对应 services |
| **GitHub** | PAT 绑定/解绑、Star 分页、搜索、README、批量导入（≤500） | `api/github.py`、`services/github_client.py` |
| **项目/分类/标签/笔记** | CRUD、筛选排序分页、进度、预设 **5** 类种子、多标签 | `api/{projects,categories,tags,notes}.py` |
| **Overview** | 活动、最近笔记、推荐、Trending 聚合 | `api/overview.py` |
| **图谱** | TF-IDF + 语言/分类/名称重叠，实时力导向图 | `api/graph.py`、`services/graph_service.py` |
| **LLM** | LiteLLM 流式/非流式、JSON、多 provider、连接测试 | `llm/provider.py`、`llm/config.py` |
| **Agent** | 7 Agent 注册；Hub Plan-and-Execute、评估再调度、舞台直出专家结果；ReAct；反问；SSE | `agents/{registry,hub,react,intent}.py`、`api/agent.py` |
| **Memory** | 短期/长期、画像提案合并、压缩、上下文 | `memory/` |
| **Tools** | **约 24 个**内置工具（含笔记/分类/标签/进度/导入写操作 + 调度/反问） | `tools/builtin.py`、`tools/registry.py` |
| **安全** | CORS、限流、URL 校验、Fernet、XSS/调度上限等加固 | `core/` |

**路由前缀：** `/api/v1` 下挂载 `auth` / `projects` / `categories` / `tags` / `notes` / `graph` / `overview` / `user` / `agent` / `github` / `settings`；另有 `GET /health`。

### 2.2 前端（`apps/web/src/`）

| 模块 | 已实现能力 | 关键文件 |
|------|-----------|---------|
| **路由** | `/login`、`/register`、`/`、`/projects`、`/projects/:id`、`/agent`、`/agent/sessions/:sessionId`、`/graph`、`/notes`、`/settings`、`/profile` | `App.tsx` |
| **项目库/详情** | 列表筛选批量导入、README、进度、嵌入式 Agent 对话区 | `pages/Projects*.tsx`、`ProjectDetailPage.tsx` |
| **Agent Chat** | 会话、SSE（text/thinking/tool/subagent）、反问五形态、思考折叠、Mermaid、结果卡、流中止 | `components/agent/*`、`stores/agentStore.ts`、`StreamRenderer.tsx` |
| **图谱 / 笔记 / 设置 / 画像** | D3 力导向、笔记分屏、BYOK、画像与记忆确认 | 对应 pages/components |
| **API** | `IApiClient` Mock/Real；`VITE_USE_MOCK !== 'false'` 时走 Mock | `api/client.ts` |

### 2.3 共享包（`packages/*`）

仍为空壳或仅 README（`types`/`ui`/`contracts`/`prompts`/`py-shared`/`config`）。契约仍在 `apps/web/src/api/types.ts` 与 `services/api/backend/schemas/`。

### 2.4 测试

- 后端：`tests/`（unit / function / module / business / integration）
- 前端：Vitest + Playwright E2E 骨架

---

## 3. 自 2026-07-23 以来的主要增量（核实于提交与源码）

| 主题 | 说明 |
|------|------|
| Hub 编排 | 评估再调度、舞台直出专家结果、调度踪迹可回看 |
| 写工具落库 | 专家可真实创建/更新笔记、分类、标签、进度、导入，并展示结果卡 |
| Chat UX | 分段落库、思考区过滤、Mermaid、切换条与状态展示 |
| 安全 | Agent Chat XSS、记忆确认、调度上限 |
| 设置 | Agent 行为准则、清除记忆 |
| 工程 | 忽略 `tmp/`，防止本地冒烟与密钥泄漏 |

**未纳入：** CrewAI 集成、Shell 类工具、独立 `services/agent` 推理进程（仍为占位）。

---

## 4. 实现方式概述

### 4.1 后端

```
FastAPI Router → Service → SQLAlchemy 2.0 Async → aiosqlite
        ↓
JWT/Cookie + SlowAPI
        ↓
Agent Service → Hub / ReAct → LiteLLM
        ↓
Tool Registry + Memory + Graph
```

- DB：`create_all` + `migrations/schema_sync.py`；**无 Alembic versions**。
- 表：`users`、`refresh_tokens`、`categories`、`tags`、`projects`、`notes`、`user_profiles`、`agent_sessions`、`agent_messages`、`project_analyses` + 关联 `project_tags`、`agent_session_projects`。
- Agent：`AgentRegistry` 7 个；`HubService` 路由与派发；`ReActEngine` 工具循环。

### 4.2 前端

Vite + React 19 + Router + Zustand + TanStack Query → Mock/Real → SSE 解析 + 图谱 + Markdown/Mermaid。

### 4.3 开发端口

| 服务 | 端口 |
|------|------|
| Web | 5173 |
| API | **19878**（`npm run dev:api` / Vite proxy） |
| Agent 占位 | 19877 |

---

## 5. 文档与代码的主要差距

| 文档声明 | 代码实际 |
|---|---|
| 部分 PRD 仍写 6 个 Agent | 注册 **7** 个（含 Atlas） |
| 早期 MVP/路线图写 12 预设分类 | 种子 **5** 个 |
| SPEC 14 张独立表 | **10** 张命名表 + 2 关联；无独立 `user_github_accounts` / `user_settings` / `graph_cache` |
| MVP 工具清单与命名 | 约 **24** 个工具，命名不完全一致 |
| `/export`、`/search`、`/compare`、`/recommend`、部分 `/agent/config` 等 | **尚未实现**（见 `MVP_SCOPE.md`） |
| `DEVELOPMENT_ROADMAP` Phase 复选框未勾 | 核心 Phase 能力大多已落地，路线图作历史计划保留 |
| `packages/*` 为共享契约 | 空壳 |
| 历史文档端口 19876 | 现行开发 **19878** |

---

## 6. 修改建议（文档优先）

1. 继续在 `MVP_SCOPE` / 未来 v2 PRD 中对齐 Agent 数、表结构、端点与工具清单。
2. 新成员先读本报告 + `REPO_LAYOUT.md`，再读产品 PRD。
3. 代码侧：共享包、Alembic、缺失端点、README 缓存等仍按优先级推进（不在本报告实现）。

---

## 7. 关键文件速查

| 目的 | 路径 |
|---|---|
| 后端入口 | `services/api/backend/main.py` |
| Agent API / Hub / Tools | `api/agent.py`、`agents/hub.py`、`tools/builtin.py` |
| 前端入口 / Agent 状态 | `apps/web/src/App.tsx`、`stores/agentStore.ts`、`components/agent/StreamRenderer.tsx` |
| 进度/路线图 | 本文件 · `DEVELOPMENT_ROADMAP.md` |
| 产品差异标注 | `docs/product/v1/MVP/MVP_SCOPE.md` |

---

*本报告基于对仓库代码与近期提交的检查生成；具体实现以代码为准。*
