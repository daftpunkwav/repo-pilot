---
type: 指南
title: 快速入门指南
description: RepoPilot 知识库入口——开发环境搭建与首次运行指南、全库章节导航，以及面向编码代理的变更任务路由表
tags: [quickstart, development, setup]
openwiki:
  roles: [delivery]
  validation_commands: [npm run dev:api, npm run dev:web]
---

# 快速入门指南

## 知识库导航

本知识库记录 RepoPilot（多智能体开源学习平台：FastAPI 后端 + React 前端 + 多 Agent AI 系统）的架构、模块、API、数据模型与核心工作流。

- **架构**：[系统架构](architecture/overview.md) · [Monorepo 布局](architecture/repo-layout.md) · [技术栈](architecture/tech-stack.md)
- **模块**：[API 服务](modules/api-service.md) · [Agent 系统](modules/agent-system.md) · [Web 前端](modules/web-frontend.md)
- **Agent**：[7 个 Agent 概述](agents/overview.md) · [24 个内置工具参考](agents/tools.md)
- **API**：[REST API 参考](api/rest-api.md) · [SSE 流式协议](api/sse-streaming.md)
- **数据模型**：[实体概览](data-model/overview.md) · [项目](data-model/projects.md) · [用户与认证](data-model/user-auth.md) · [Agent 会话与记忆](data-model/agent-system.md) · [笔记](data-model/notes.md)
- **工作流**：[智能体编排](workflow/agent-orchestration.md) · [认证](workflow/authentication.md) · [项目导入](workflow/project-import.md)

## 变更导航（任务路由表）

| 变更领域 / 意图 | 相关 Wiki 页面 | 源码入口 | 关键符号 / 类型 | 聚焦测试 | 最小验证命令 |
|------------------|----------------|----------|------------------|----------|--------------|
| 认证、登录、JWT、刷新令牌 | [认证工作流](workflow/authentication.md) · [用户与认证](data-model/user-auth.md) | `services/api/backend/api/auth.py`、`services/api/backend/services/auth_service.py` | `AuthService`、`RefreshToken` | `tests/integration/test_auth_api.py`、`test_auth_cookie_flow.py`、`tests/business/test_auth_service.py` | `pytest tests/integration/test_auth_api.py -q` |
| 新增 / 修改 REST 端点 | [REST API 参考](api/rest-api.md) · [API 服务模块](modules/api-service.md) | `services/api/backend/api/`、`services/api/backend/main.py` | `APIRouter`、各路由模块 | `tests/integration/test_*_api.py` | `pytest tests/integration -q` |
| Hub 编排、意图路由、Plan-and-Execute | [智能体编排工作流](workflow/agent-orchestration.md) · [Agent 系统模块](modules/agent-system.md) | `services/agent/agent_core/agents/hub.py`、`react.py`、`registry.py` | `Hub`、`ReActEngine`、`AgentDefinition` | `tests/unit/test_hub_handle_chat.py`、`test_hub_handle_dispatches.py`、`test_react_engine_run.py` | `pytest tests/unit/test_hub_handle_chat.py -q` |
| 新增 / 修改 Agent 工具 | [智能体工具参考](agents/tools.md) | `services/agent/agent_core/tools/builtin.py`、`tools/registry.py` | `@tool`、`ToolRegistry`、`TOOL_PERMISSION_MAP` | `tests/unit/test_tool_permissions.py`、`test_write_tools.py`、`test_tool_ports.py` | `pytest tests/unit/test_tool_permissions.py tests/unit/test_write_tools.py -q` |
| SSE 流式事件、思考流、取消 | [SSE 流式协议](api/sse-streaming.md) | `services/api/backend/services/sse_stream.py`、`services/api/backend/agents/stream_events.py`；前端 `apps/web/src/utils/agentSSEStream.ts` | 流事件类型、分段缓冲 | `tests/unit/test_think_stream.py`、`test_stream_cancel.py`、`test_agent_segment_buffer.py`；`apps/web/tests/unit/utils/agentSSEStream.test.ts` | `pytest tests/unit/test_think_stream.py -q`；前端 `npm run test:web -- agentSSEStream` |
| 数据模型、Schema、迁移 | [数据模型概览](data-model/overview.md) 及实体子页 | `services/api/backend/models/`、Alembic 迁移（`alembic.ini`） | SQLAlchemy 实体类 | `tests/unit/test_schema_sync.py`、`test_migration_roundtrip.py` | `pytest tests/unit/test_schema_sync.py tests/unit/test_migration_roundtrip.py -q` |
| 项目导入、GitHub 集成、分类 | [项目导入工作流](workflow/project-import.md) · [项目](data-model/projects.md) | `services/api/backend/api/projects.py`、`services/project_service.py`、`api/github.py` | `ProjectService` | `tests/integration/test_projects_api.py`、`tests/business/test_project_service.py` | `pytest tests/integration/test_projects_api.py -q` |
| 记忆、用户画像、上下文压缩 | [Agent 会话与记忆](data-model/agent-system.md) · [Agent 系统模块](modules/agent-system.md) | `services/agent/agent_core/memory/` | `MemoryService` | `tests/unit/test_memory_service.py`（`tests/module/`）、`test_memory_proposal_pending.py` | `pytest tests/module/test_memory_service.py -q` |
| 前端页面、状态、组件 | [Web 前端模块](modules/web-frontend.md) | `apps/web/src/`（`api/`、`stores/`、`components/`、`pages/`） | Zustand stores、API client | `apps/web/tests/unit/`（如 `stores/`、`utils/`） | `npm run test:web`（聚焦：`npm run test:web -- <文件名>`） |
| 前端 ↔ API 契约、共享类型 | [REST API 参考](api/rest-api.md) | `packages/types/`、`scripts/export_openapi.py` | 生成的 OpenAPI 类型 | `tests/unit/test_schemas.py`（`tests/module/`） | `npm run generate:types`（仅当 API schema 变更时，随后跑 `npm run typecheck:web`） |

> 全量校验（`npm run ci`：生成类型 + pytest + eslint + tsc + vitest）仅在跨边界变更或提交前使用；日常修改优先上表中的聚焦命令。

## 前置要求

- Python 3.10+
- Node.js 20+
- Git

## 1. 克隆与设置

```bash
git clone <repository-url>
cd repopilot
```

## 2. Python 环境

```bash
# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Activate (macOS/Linux)
source .venv/bin/activate

# Install API dependencies
pip install -e "./services/api[dev]"
```

## 3. Node 依赖

```bash
npm install
```

## 4. 环境配置

创建 `services/api/.env`：

```env
SECRET_KEY=your-secret-key-min-32-characters-long
DATABASE_URL=sqlite+aiosqlite:///data/repopilot.db
```

创建 `apps/web/.env.local`：

```env
VITE_USE_MOCK=false
```

## 5. 启动开发服务器

### 方式 A：独立终端

```bash
# Terminal 1 - API
npm run dev:api

# Terminal 2 - Web
npm run dev:web
```

### 方式 B：Windows PowerShell 脚本

```powershell
.\scripts\dev.ps1
```

## 6. 访问应用

- Web 界面：http://localhost:5173
- API 文档：http://localhost:19878/docs

## 7. 第一步

1. **注册账号**：访问 `/register`
2. **配置 LLM 设置**：在设置页面中
   - 添加你的 OpenAI 或 Anthropic API 密钥
3. **导入项目**：从 GitHub 导入
4. **与 AI 对话**：在 Agent 页面中

## 项目结构

```
RepoPilot/
├── apps/
│   └── web/          # React frontend
├── services/
│   ├── api/          # FastAPI backend
│   └── agent/        # Agent core
├── packages/
│   └── types/        # Shared TypeScript types
└── docs/             # Documentation
```

## 常用命令

| 命令 | 说明 |
|---------|-------------|
| `npm run dev:api` | 启动 API 服务器 |
| `npm run dev:web` | 启动 Web 开发服务器 |
| `npm run test:api` | 运行 API 测试 |
| `npm run test:web` | 运行 Web 测试 |
| `npm run generate:types` | 从 OpenAPI 生成 TypeScript 类型 |
| `npm run ci` | 完整 CI 流水线 |

## 故障排查

### 端口已被占用

如果端口 19876 被占用，API 默认使用 19878。

### 数据库错误

删除 `data/repopilot.db` 并重启即可重置。

### Mock 模式

在 `apps/web/.env.local` 中设置 `VITE_USE_MOCK=true`，即可在无后端的情况下使用模拟数据。