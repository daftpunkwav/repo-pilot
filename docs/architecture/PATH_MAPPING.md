# 仓库路径对照表

> 版本: 2026-08-12 | 状态: 现行有效
>
> **用途：** 2026-07-05 起 RepoPilot 采用 Monorepo。历史文档中的 `frontend/`、`backend/` 等路径**按本表理解**，正文细节可逐步更新，不必一次性改完。

---

## 1. 顶层结构（现行）

```
RepoPilot/
├── apps/
│   ├── web/                 # 正式 Web 应用（Monorepo 目标位）
│   └── desktop/             # 桌面壳（规划中）
├── services/
│   ├── api/api_backend/     # FastAPI（import api_backend.*）
│   ├── agent/agent_core + agent_runtime
│   ├── graph_engine/graph_engine_core + graph_engine_runtime + layout
│   └── mcp/mcp_runtime      # MCP 运行层（占位，v1.4+）
├── packages/                # 跨服务共享库
├── docs/
│   └── design/v1/frontend/  # v1 设计归档（已迁入 apps/web）
├── data/                    # 本地 SQLite 等
└── archive/
```

权威布局说明：[`REPO_LAYOUT.md`](./REPO_LAYOUT.md) · 运行时架构：[`OVERVIEW.md`](./OVERVIEW.md)

---

## 2. 路径对照

| 文档/旧写法 | 现行路径 | 说明 |
|-------------|----------|------|
| `frontend/`（仓库根） | `apps/web/` | 正式 Web 应用（v1 已迁入） |
| `frontend/src/` | `apps/web/src/` | 同上 |
| `docs/design/v1/frontend/` | 设计归档 | **历史 Mock 沙盒**；主线代码在 `apps/web/` |
| `backend/`（仓库根） | `services/api/api_backend/` | API 服务 Python 包（import 为 `api_backend.*`） |
| `backend/api/` | `services/api/api_backend/api/` | FastAPI 路由 |
| `backend/agents/` | `services/agent/agent_core/agents/` | 物理实现已迁入 Agent 服务；api 直接 `import agent_core`（兼容 shim 已移除） |
| `backend/llm/` / `tools/` / `memory/` | `services/agent/agent_core/{llm,tools,memory}/` | 同上 |
| `backend/config.py` | `services/api/api_backend/config.py` | 配置入口 |
| `backend/migrations/` | `services/api/api_backend/migrations/` | **Alembic 已启用**（唯一迁移 `6096bed38e20_initial_schema`，启动期 `upgrade head`）；`schema_sync.py` 已废弃 |
| `backend/agents/hub.py` 等 | `services/agent/agent_core/agents/{hub,react,registry,intent,question,stream_events,...}.py` | 权威实现（2026-08-03 迁入；2026-08-12 移除 `api_backend` 兼容 shim，直接 import） |
| `pyproject.toml`（根） | 根 + `services/api/pyproject.toml` | 根为 workspace；API 依赖在 `services/api/` |
| `data/*.db` | `data/*.db`（仓库根） | 路径未变 |
| 外挂 `codebase-memory-mcp` / 全局 CBM | `services/graph_engine/graph_engine_core/` | 源码已迁入；对外二进制 `rp-graph-engine`；内部符号可仍为 `cbm_*` |
| `services/graph_engine/c/` | `services/graph_engine/graph_engine_core/` | 2026-08-12 按 agent 的 `_core` 命名对齐 |
| `services/graph_engine/python/` | `services/graph_engine/graph_engine_runtime/` | 同上，`_runtime`；import 仍为 `rp_graph` |
| `services/graph_engine/native/` | `services/graph_engine/layout/` | 布局加速 native 库 |
| `~/.cache/codebase-memory-mcp/` | `data/graph-engine-cache` 或 `RP_GRAPH_CACHE_DIR` / `CBM_CACHE_DIR` | API sidecar 写入 C 引擎的图谱 SQLite 根 |

---

## 3. 前端双轨策略（必读）

| 轨道 | 路径 | 阶段 |
|------|------|------|
| **设计归档** | `docs/design/v1/frontend/` | 审查记录、规格、HTML 原型 |
| **正式应用** | `apps/web/` | **现行**：已实现全部 MVP 页面与路由；`.env.development` 默认 `VITE_USE_MOCK=false`；未设置时客户端默认 Mock |

文档中出现 `frontend/` 时：

- 在 **`docs/design/`** 上下文 → 指设计归档 `docs/design/v1/frontend/`
- 在 **产品 SPEC / 路线图 / 开发** 上下文 → 指 `apps/web/`

---

## 4. 服务与进程（目标运行时）

| 服务 | 目录 | 典型端口 |
|------|------|----------|
| Web | `apps/web` | 5173 |
| API | `services/api` | **19878**（开发；Vite 代理目标。历史文档常写 19876） |
| Agent | `services/agent` | 19877（`npm run dev:agent`；独立进程可选，API 设 `AGENT_BASE_URL` 后 SSE 代理） |
| Graph Engine | `services/graph_engine` | **9750**（C sidecar `rp-graph-engine`；`RP_GRAPH_ENGINE_URL`） |
| MCP | `services/mcp` | stdio / HTTP（规划） |

---

## 5. 启动命令对照

| 旧写法 | 现行写法 |
|--------|----------|
| `cd frontend && npm run dev` | `npm run dev:web`（仓库根，`apps/web`） |
| Mock 设计沙盒（只读参考） | `cd docs/design/v1/frontend && npm run dev` |
| `pip install -e ".[dev]"` | `pip install -e "./services/api[dev]"` |
| `uvicorn backend.main:app ...` | `npm run dev:api`（`:19878`）或 `uvicorn ... --port 19878 --app-dir services/api` |
| `pytest backend/` | `pytest services/api/api_backend/` |
| `ruff check backend/` | `ruff check services/api/api_backend/` |
| 外挂 / 全局 `codebase-memory-mcp` | `.\services\graph_engine\graph_engine_core\scripts\build.ps1`；`RP_GRAPH_ENGINE_URL=http://127.0.0.1:9750` |
