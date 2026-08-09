---
type: 仓库布局
title: RepoPilot Monorepo 布局
description: RepoPilot monorepo 的目录结构与组织方式，包括 apps、services 和 packages
tags: [architecture, monorepo, layout, structure]
openwiki:
  roles: [architecture, repository]
  source_paths: [docs/architecture/REPO_LAYOUT.md]
---

# RepoPilot Monorepo 布局

## 目录总览

```
RepoPilot/
├── apps/                    # User-facing clients
│   ├── web/                 # React Web SPA
│   └── desktop/             # Desktop shell (pywebview → Tauri)
│
├── services/                # Independently deployable backend services
│   ├── api/                 # Traditional API (Auth, CRUD, Graph)
│   ├── agent/               # Agent runtime (agent_core authoritative + agent_runtime standalone)
│   └── mcp/                 # MCP Server (placeholder, v1.4+)
│
├── packages/                # Shared libraries across apps/services
│   ├── types/               # TS types (OpenAPI generated)
│   ├── ui/                  # Shared React components
│   ├── prompts/             # Prompt template library
│   ├── config/              # Shared TS/ESLint/Tailwind config
│   ├── contracts/           # OpenAPI / event contracts
│   └── py-shared/           # Shared Python models & utilities
│
├── scripts/                 # Development/build/release scripts
├── docs/                    # Product & design documentation
├── archive/                 # v0.x archived code
└── data/                    # Local SQLite and runtime data
```

## 职责边界

| 路径 | 职责 | 消费方 |
|------|----------------|-----------|
| `apps/web` | UI、路由、客户端状态 | 浏览器 |
| `apps/desktop` | 打包、系统托盘、本地 API 启动 | 桌面用户 |
| `services/api` | REST API、JWT、数据库 | Web / Desktop |
| `services/agent` | LLM 推理、Hub 路由、记忆、SSE | API 转发或直连 |
| `services/mcp` | MCP 协议工具暴露 | Cursor 及其他外部客户端 |
| `packages/*` | 无运行时，纯共享代码 | apps + services |

## 实现与占位状态

| 模块 | 状态 | 代码位置 |
|--------|--------|---------------|
| Web | 已实现 | `apps/web/`（全部 MVP 页面、路由、Mock/Real 双轨 API 客户端） |
| API | 已实现 | `services/api/backend/`（Auth/Projects/Categories/Tags/Notes/Graph/Settings/Agent） |
| Agent | 核心已迁移 | 实现位于 `services/agent/agent_core/`；`services/api/backend/{agents,llm,tools,memory}` 为兼容垫片；`agent_runtime` 独立 SSE（:19877，通过 `AGENT_BASE_URL` 代理） |
| MCP | 占位 | `services/mcp/`（v1.4+ 规划） |
| Desktop | 占位 | `apps/desktop/`（规划中，未实现） |
| Packages | 部分实现 | `types/` 由 OpenAPI 生成并被 `apps/web` 使用（`@repopilot/types`）；`contracts/` 包含 openapi.json；`ui/prompts/py-shared/config` 仍为占位 |

## Python 包说明

API 服务内部的 Python 包仍命名为 `backend`（`from backend.xxx`），与目录 `services/api` 共存。未来可选重命名为 `repopilot_api`——非阻塞事项。

## 数据目录

SQLite 与本地文件默认位于仓库根目录 `data/`，由 `services/api/backend/config.py` 解析（`REPO_ROOT / "data"`），与各服务的 cwd 无关。

## 开发命令

```bash
# Python (API) — Development port 19878, consistent with Vite proxy
pip install -e "./services/api[dev]"
npm run dev:api
# Or: uvicorn backend.main:app --reload --host 127.0.0.1 --port 19878 --app-dir services/api

# Node (Web, run from root)
npm install
npm run dev:web
```

## 未来顶层目录（尚未创建）

| 目录 | 用途 | 何时需要 |
|-----------|---------|-------------|
| `services/worker` | 后台任务（GitHub 同步、图谱重建、定时任务） | 出现长时间运行的异步任务时 |
| `services/gateway` | 统一入口、路由、限流 | 多服务对外暴露并需要统一域名时 |
| `apps/cli` | `repopilot` 命令行工具 | 需要脚本化/运维命令时 |
| `packages/sdk` | 对外 JS/Python SDK | 开放第三方集成时 |
| `infra/` | Docker Compose、K8s、Terraform | 团队部署或多环境时 |
| `tests/e2e` | 跨服务端到端测试 | CI 主流程覆盖时 |