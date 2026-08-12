# RepoPilot Monorepo 布局

> 版本: 2026-08-12 | 状态: `apps/web` + `services/api` + `services/agent`（agent_core）+ `services/graph_engine` 核心已落地；mcp/desktop 与部分 packages 仍为占位
>
> **相关文档：** 运行时架构 [`OVERVIEW.md`](./OVERVIEW.md) · 路径对照 [`PATH_MAPPING.md`](./PATH_MAPPING.md) · 进度 [`../development/PROGRESS_REPORT.md`](../development/PROGRESS_REPORT.md)

## 目录总览

```
RepoPilot/
├── apps/                    # 面向用户的客户端
│   ├── web/                 # React Web SPA
│   └── desktop/             # 桌面壳（pywebview → Tauri）
│
├── services/                # 可独立部署的后端服务
│   ├── api/
│   │   └── api_backend/         # FastAPI 包（import api_backend.*，遗留名）
│   ├── agent/
│   │   ├── agent_core/      # 权威实现（agents / llm / memory / tools）
│   │   └── agent_runtime/   # 独立进程入口（main.py）
│   ├── graph_engine/
│   │   ├── graph_engine_core/     # C 索引 sidecar（对外 rp-graph-engine）
│   │   ├── graph_engine_runtime/  # Python 回退（import rp_graph）
│   │   └── layout/                # 可选 native 布局（CMake / rp_layout）
│   └── mcp/
│       └── mcp_server/      # MCP 包（占位，v1.4+）
│
├── packages/                # 跨应用/服务共享库
│   ├── types/               # TS 类型（OpenAPI 生成）
│   ├── ui/                  # 共享 React 组件
│   ├── prompts/             # Prompt 模板库
│   ├── config/              # 共享 TS/ESLint/Tailwind 配置
│   ├── contracts/           # OpenAPI / 事件契约
│   └── py-shared/           # 共享 Python 模型与工具
│
├── scripts/                 # 开发/构建/发布脚本
├── docs/                    # 产品与设计文档（非对外文档站）
├── archive/                 # v0.x 归档
└── data/                    # 本地 SQLite 等运行时数据
```

## 职责边界

| 路径 | 职责 | 消费者 |
|------|------|--------|
| `apps/web` | UI、路由、客户端状态 | 浏览器 |
| `apps/desktop` | 打包、系统托盘、本地启动 API | 桌面用户 |
| `services/api` | REST API、JWT、数据库 | Web / Desktop |
| `services/agent` | LLM 推理、Hub 路由、记忆、SSE | API 转发或直连 |
| `services/graph_engine` | 代码图谱索引与查询 sidecar | API（`RP_GRAPH_*`） |
| `services/mcp` | MCP 协议工具暴露 | Cursor 等外部客户端 |
| `packages/*` | 无运行时，纯共享代码 | apps + services |

## 当前实现 vs 占位

| 模块 | 状态 | 代码位置 |
|------|------|----------|
| Web | ✅ 已实现核心功能 | `apps/web/`（全部 MVP 页面、路由、Mock/Real 双轨 API 客户端已就位） |
| API | ✅ 已实现核心端点 | `services/api/api_backend/`（Auth/Projects/Categories/Tags/Notes/Graph/Settings/Agent 等） |
| Agent | ✅ 核心已迁入 | 实现在 `services/agent/agent_core/`（agents/llm/tools/memory，api 直接 import）；`agent_runtime` 可独立 SSE（:19877，经 `AGENT_BASE_URL` 代理） |
| Graph Engine | ✅ 已落地 | `graph_engine_core/`（C sidecar `rp-graph-engine`）；`graph_engine_runtime/rp_graph` 回退；`layout/`（CMake：`rp_layout` + `rp-layout-cli`） |
| MCP | ⬜ 占位 | `services/mcp/`（v1.4+ 规划） |
| Desktop | ⬜ 占位 | `apps/desktop/`（规划中，尚未实现） |
| Packages | 🟡 部分落地 | `types/` 已由 OpenAPI 生成并被 `apps/web` 使用（`@repopilot/types`）；`contracts/` 含 openapi.json；`ui/prompts/py-shared/config` 仍为占位 |

## 默认运行拓扑（本地工具模式）

默认**严格两进程**，所有服务能力内聚到后端单进程：

| 进程 | 端口 | 包含 |
|------|------|------|
| 前端 Web | 5173 | `apps/web`（Vite dev） |
| 后端 API | 19878 | `api_backend`（REST/CRUD）+ `agent_core`（import）+ `rp_graph`（Python 回退） |

`services/` 下的多目录（`api`/`agent`/`graph_engine`/`mcp`）是**逻辑/功能分区**（代码维护用），不是进程划分：`agent_core`、`rp_graph` 都是后端进程 import 的库，默认无独立端口。

**可选独立进程**（需要隔离/扩缩容时显式启用）：
- Agent Runtime `:19877`（`npm run dev:agent` + api 设 `AGENT_BASE_URL`）
- Graph C sidecar `:9750`（设 `RP_GRAPH_ENGINE_URL` + 构建二进制；默认空 = Python 回退）
- MCP（v1.4+ 规划，stdio/HTTP）

## 服务拆分触发条件

在以下条件**任一满足**时，将 Agent 从 API 迁出至 `services/agent/`：

1. Agent 需要独立扩缩容或与 API 不同发布节奏
2. LLM 长任务拖垮 API 请求延迟（需进程隔离）
3. 多实例 Agent + 单实例 API 的部署需求出现

将 MCP 落地至 `services/mcp/` 的触发条件：

1. PRD v1.4 MCP 集成启动
2. 需对 Cursor / Claude Desktop 暴露标准 MCP 接口

## 未来可能新增的顶层目录

以下**尚未创建**，按需在对应阶段加入，避免过早抽象：

| 目录 | 用途 | 何时需要 |
|------|------|----------|
| `services/worker` | 后台任务（GitHub 同步、图谱重建、定时任务） | 出现长耗时异步作业 |
| `services/gateway` | 统一入口、路由、限流 | 多服务对外暴露且需统一域名 |
| `apps/cli` | `repopilot` 命令行工具 | 需脚本化/运维命令 |
| `packages/sdk` | 对外发布的 JS/Python SDK | 开放第三方集成 |
| `infra/` | Docker Compose、K8s、Terraform | 团队部署或多环境 |
| `tests/e2e` | 跨服务端到端测试 | CI 覆盖主流程 |

## Python 包名说明

| 服务目录 | 发行名 / import | 说明 |
|----------|-----------------|------|
| `services/api` | 发行 `repopilot-api`；import `api_backend.*` | 包名已从 `backend` 对齐为 `api_backend`（与 agent_core/graph_engine_core/mcp_server 一致） |
| `services/agent` | 发行 `repopilot-agent`；import `agent_core` / `agent_runtime` | 与目录名一致 |
| `services/graph_engine` | 发行 `repopilot-graph-engine`；import `rp_graph` | 代码在 `graph_engine_runtime/rp_graph/`；C sidecar 二进制名仍为 `rp-graph-engine`（与发行包名区分） |
| `services/mcp` | 发行 `repopilot-mcp`；import `mcp_server` | 占位 |

## 数据目录

SQLite 与本地文件默认在仓库根 `data/`，由 `services/api/api_backend/config.py` 的 `REPO_ROOT / "data"` 解析，与各服务 cwd 无关。

## 开发命令速查

```bash
# Python（API）— 开发端口 19878，与 Vite 代理一致
pip install -e "./services/api[dev]"
npm run dev:api
# 或：uvicorn api_backend.main:app --reload --host 127.0.0.1 --port 19878 --app-dir services/api

# Node（Web，需在根目录 npm install）
npm install
npm run dev:web

# 并行启动（Windows）
.\scripts\dev.ps1

# 图谱 C 引擎（可选 sidecar）
.\services\graph_engine\graph_engine_core\scripts\build.ps1
```
