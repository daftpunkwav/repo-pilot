# 仓库路径对照表

> 版本: 2026-07-05 | 状态: 现行有效
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
│   ├── agent/               # Agent 运行时（占位，逻辑暂在 api）
│   └── mcp/                 # MCP Server（占位，v1.4+）
├── packages/                # 跨服务共享库
├── docs/
│   └── design/v1/frontend/  # Mock UI 开发沙盒（当前主战场）
├── data/                    # 本地 SQLite 等
└── archive/
```

权威布局说明：[`REPO_LAYOUT.md`](./REPO_LAYOUT.md) · 运行时架构：[`OVERVIEW.md`](./OVERVIEW.md)

---

## 2. 路径对照

| 文档/旧写法 | 现行路径 | 说明 |
|-------------|----------|------|
| `frontend/`（仓库根） | `apps/web/` | 正式 Web 应用目录；**审查通过前可为脚手架** |
| `frontend/src/` | `apps/web/src/` | 同上 |
| `docs/design/v1/frontend/` | 不变 | **当前 UI + Mock 主开发位置** |
| `backend/`（仓库根） | `services/api/backend/` | API 服务 Python 包（import 仍为 `backend.*`） |
| `backend/api/` | `services/api/backend/api/` | FastAPI 路由 |
| `backend/agents/` | `services/api/backend/agents/` | v1.0 实现位置；未来迁至 `services/agent/` |
| `backend/config.py` | `services/api/backend/config.py` | 配置入口 |
| `backend/migrations/` | `services/api/backend/migrations/` | Alembic |
| `pyproject.toml`（根） | 根 + `services/api/pyproject.toml` | 根为 workspace；API 依赖在 `services/api/` |
| `data/*.db` | `data/*.db`（仓库根） | 路径未变 |

---

## 3. 前端双轨策略（必读）

| 轨道 | 路径 | 阶段 |
|------|------|------|
| **Mock 开发** | `docs/design/v1/frontend/` | **现在**：Phase 0–9 + 审查门禁 |
| **正式应用** | `apps/web/` | **以后**：审查通过后迁入，再接 Real API |

文档中出现 `frontend/` 时：

- 在 **`docs/design/`** 上下文 → 指 `docs/design/v1/frontend/`
- 在 **产品 SPEC / 路线图** 上下文 → 优先指 `apps/web/`，或按上表对照

---

## 4. 服务与进程（目标运行时）

| 服务 | 目录 | 典型端口 |
|------|------|----------|
| Web | `apps/web` | 5173 |
| API | `services/api` | 19876 |
| Agent | `services/agent` | 19877（规划） |
| MCP | `services/mcp` | stdio / HTTP（规划） |

---

## 5. 启动命令对照

| 旧写法 | 现行写法 |
|--------|----------|
| `cd frontend && npm run dev` | `cd docs/design/v1/frontend && npm run dev`（Mock 开发） |
| | `npm run dev:web`（仓库根，`apps/web`） |
| `pip install -e ".[dev]"` | `pip install -e "./services/api[dev]"` |
| `uvicorn backend.main:app ...` | 同上（在 `services/api` 或已 editable 安装后） |
| `pytest backend/` | `pytest services/api/backend/` |
| `ruff check backend/` | `ruff check services/api/backend/` |
