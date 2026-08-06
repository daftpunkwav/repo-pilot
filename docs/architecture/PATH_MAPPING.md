# 仓库路径对照表

> 版本: 2026-08-04 | 状态: 现行有效
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
│   ├── api/                 # 传统后端 API
│   ├── agent/               # Agent 运行时（agent_core 权威实现 + agent_runtime 独立进程）
│   └── mcp/                 # MCP Server（占位，v1.4+）
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
| `backend/`（仓库根） | `services/api/backend/` | API 服务 Python 包（import 仍为 `backend.*`） |
| `backend/api/` | `services/api/backend/api/` | FastAPI 路由 |
| `backend/agents/` | `services/agent/agent_core/agents/`（权威）；`services/api/backend/agents/` 为 shim | 物理实现已迁入 Agent 服务；API 侧保留 `backend.agents.*` 导入兼容 |
| `backend/llm/` / `tools/` / `memory/` | `services/agent/agent_core/{llm,tools,memory}/` | 同上 |
| `backend/config.py` | `services/api/backend/config.py` | 配置入口 |
| `backend/migrations/` | `services/api/backend/migrations/` | **Alembic 已启用**（唯一迁移 `6096bed38e20_initial_schema`，启动期 `upgrade head`）；`schema_sync.py` 已废弃 |
| `backend/agents/hub.py` 等 | `services/agent/agent_core/agents/{hub,react,registry,intent,question,stream_events,...}.py` | 权威实现（2026-08-03 迁入）；`services/api/backend/agents/*` 仅为转发 shim |
| `pyproject.toml`（根） | 根 + `services/api/pyproject.toml` | 根为 workspace；API 依赖在 `services/api/` |
| `data/*.db` | `data/*.db`（仓库根） | 路径未变 |

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
| MCP | `services/mcp` | stdio / HTTP（规划） |

---

## 5. 启动命令对照

| 旧写法 | 现行写法 |
|--------|----------|
| `cd frontend && npm run dev` | `npm run dev:web`（仓库根，`apps/web`） |
| Mock 设计沙盒（只读参考） | `cd docs/design/v1/frontend && npm run dev` |
| `pip install -e ".[dev]"` | `pip install -e "./services/api[dev]"` |
| `uvicorn backend.main:app ...` | `npm run dev:api`（`:19878`）或 `uvicorn ... --port 19878 --app-dir services/api` |
| `pytest backend/` | `pytest services/api/backend/` |
| `ruff check backend/` | `ruff check services/api/backend/` |
