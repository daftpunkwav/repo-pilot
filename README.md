# RepoPilot

AI 驱动的开源项目学习平台。

**技术栈版本：** FastAPI + React + TypeScript（代码版本已推进至 **v2.0.0**，产品文档层仍在向 v2 对齐；当前实现以 `apps/web` + `services/api` + `services/agent` + `services/graph_engine` 为准，详见 `docs/product/`）

## Monorepo 结构

```
RepoPilot/
├── apps/
│   ├── web/          # React Web 前端
│   └── desktop/      # 桌面壳（规划中）
├── services/
│   ├── api/          # FastAPI 后端（api_backend/：认证/CRUD/图谱 REST；import agent_core）
│   ├── agent/        # Agent（agent_core 权威实现 + agent_runtime 独立进程）
│   ├── graph_engine/ # 图谱（graph_engine_core + graph_engine_runtime + layout）
│   └── mcp/          # MCP Server（规划中）
├── packages/         # 共享库（types 已生成契约 / ui / prompts / …）
├── docs/
└── archive/
```

完整说明见 [`docs/architecture/REPO_LAYOUT.md`](docs/architecture/REPO_LAYOUT.md)。

> **实现状态速览（截至 2026-08-12）：**
> - `apps/web`、`services/api` 已实现核心页面与端点；Agent 权威代码在 `services/agent/agent_core/`（默认与 API 同进程，可经 `AGENT_BASE_URL` 独立部署）。开发环境（`.env.development`）默认 `VITE_USE_MOCK=false` 走真实后端；未设置时客户端默认 Mock。
> - 图谱引擎在 `services/graph_engine/`：`graph_engine_core`（C sidecar `rp-graph-engine`）+ `graph_engine_runtime`（Python 回退 `rp_graph`）+ `layout`（可选 native 布局）。
> - `packages/types` 已由 OpenAPI 生成契约并被 `apps/web` 使用（`@repopilot/types`）；`contracts/` 含 openapi.json；`ui` / `prompts` / `py-shared` / `config` 仍为占位。
> - `services/mcp`、`apps/desktop` 仍为占位或规划。

## 技术栈

- API：`services/api` — FastAPI + SQLAlchemy 2.0 + SQLite + LiteLLM Multi-Agent
- Web：`apps/web` — React 19 + TypeScript + Vite 7 + Zustand + React Query
- Agent：**7 个 Agent**：Hub 统筹调度 + Scout/Mentor/Navigator/Curator/Scribe/Atlas（BYOK）；权威实现在 `services/agent/agent_core/`（api 直接 import），默认与 API 同进程
- 图谱：`services/graph_engine` — C sidecar（`graph_engine_core` / `rp-graph-engine`）+ Python 回退（`graph_engine_runtime` / `rp_graph`）
- 桌面：`apps/desktop` — pywebview（规划中，尚未实现）

### 启用真实后端（关闭 Mock）

```bash
# apps/web/.env.local（或沿用 .env.development）
VITE_USE_MOCK=false
# 开发代理目标见 apps/web/vite.config.ts（默认 127.0.0.1:19878）
```

配置 `SECRET_KEY`（≥32 字节）后启动 API；在设置页填入 LLM API Key（BYOK）即可使用完整 Agent 能力。无 Key 时自动降级为规则/图谱模式。

## 快速开始

### 环境

```bash
uv sync          # Python 依赖（uv workspace，等价于下方 venv 方式）
npm install      # Node 依赖（npm workspaces）
```

或使用传统 venv：

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e "./services/api[dev]"
```

### API

```bash
# 推荐：与 Vite 代理一致（部分 Windows 环境 19876 会幽灵占用）
npm run dev:api
# 或：uvicorn api_backend.main:app --reload --host 127.0.0.1 --port 19878 --app-dir services/api
```

### Web

```bash
npm install
npm run dev:web
```

或进入 `apps/web`：`npm install && npm run dev`

### 一键开发（Windows）

```powershell
.\scripts\dev.ps1
```

## 端口与环境变量

| 服务 | 默认端口 | 绑定地址 | 环境变量覆盖 |
|------|----------|----------|--------------|
| Web（Vite dev） | 5173 | 127.0.0.1 | `VITE_PORT` |
| API（uvicorn） | 19878 | 127.0.0.1（显式） | `API_PORT` |
| Agent Runtime（uvicorn） | 19877 | 127.0.0.1（显式） | `AGENT_PORT` |
| 图谱引擎 sidecar | 9750 | 127.0.0.1 | `RP_GRAPH_ENGINE_PORT` |

- **开发代理目标**：`apps/web/vite.config.ts`，默认 `http://127.0.0.1:19878`，可用 `VITE_API_TARGET` 覆盖；同时代理 `/api` 与 `/health`（后端健康检查）。
- **Vite 端口占用**：已启用 `strictPort`，占用即报错，不会静默顺延；显式改端口请用 `VITE_PORT=xxxx npm run dev:web`。
- **后端端口覆盖**：`API_PORT=19999 npm run dev:api`（`AGENT_PORT` 同理）；`scripts/dev.ps1` 也读取 `API_PORT`。
- **端口占用排查**：启动报 `Address already in use` / `WinError 10048` 时——
  ```bash
  # Windows
  netstat -ano | findstr 19878
  # Linux / macOS
  lsof -i :19878
  ```
- **CORS 白名单**：后端 `CORS_ALLOW_ORIGINS`（默认含 5173/5174/5175/4173/5193 的 localhost 与 127.0.0.1 双写）。**同源代理模式（`VITE_API_BASE_URL` 留空）改前端端口无需处理 CORS**；**直连跨源模式（设置了 `VITE_API_BASE_URL`）改动前端端口必须同步该变量**，否则 REST/SSE 被浏览器拦截。配置含 `*` 时启动会 fail-fast 报错（与 `allow_credentials=True` 冲突）。
- 完整环境变量清单见 `.env.example`。

## 生产部署

本项目定位**本地单机**（默认全部绑定 `127.0.0.1`，无内置鉴权）。如需在局域网/公网提供访问，请遵循以下安全指引：

1. **前端构建产物**：`npm run build:web` → `apps/web/dist/`，用 Nginx/Caddy 托管，并反向代理 `/api`、`/health` 到 API（`127.0.0.1:19878`）。
2. **环境变量**：`.env` 必须显式配置——`SECRET_KEY` ≥32 字节随机值、`DEBUG=false`、`CORS_ALLOW_ORIGINS` 设为实际域名、`SECRETS_ENCRYPTION_KEY` 独立设置；启用独立 Agent 进程时配 `AGENT_BASE_URL` + `AGENT_INTERNAL_TOKEN`。
3. **防火墙与暴露面**：不要直接把 uvicorn 端口（19878/19877/9750）暴露到公网；由反向代理统一对外（HTTPS），内部服务仅监听 127.0.0.1。
4. **HTTPS**：公网访问必须启用 TLS（反向代理终结），并保持 `AUTH_COOKIE_SECURE=true`、`AUTH_COOKIE_SAMESITE=lax`。
5. **依赖安全**：CI 自动执行 `npm audit` / `pip-audit`；依赖更新由 Dependabot（`.github/dependabot.yml`）接管。
6. **数据备份**：SQLite 数据库位于 `data/repopilot.db`，请纳入常规备份（`data/*.db` 与备份文件均已被 .gitignore 排除）。

> ⚠️ 本项目当前无用户鉴权体系（本地单机假设）。暴露到不可信网络前，必须先加反向代理层鉴权（如 Basic Auth / 应用内 SSO）。

## 文档

权威来源声明：**PRD > SPEC > MVP_SCOPE**（产品需求优先于技术规格，MVP 实施规格从属前两者）。

- 文档中心：[`docs/README.md`](docs/README.md)
- 产品需求 PRD：[`docs/product/v1/PRD/PRD.md`](docs/product/v1/PRD/PRD.md)
- Agent 系统 PRD：[`docs/product/v1/PRD/AGENT_PRD.md`](docs/product/v1/PRD/AGENT_PRD.md)
- 技术规范 SPEC：[`docs/product/v1/SPEC/TECHNICAL_SPEC.md`](docs/product/v1/SPEC/TECHNICAL_SPEC.md)
- Agent 系统 SPEC：[`docs/product/v1/SPEC/AGENT_SPEC.md`](docs/product/v1/SPEC/AGENT_SPEC.md)
- v1.0 MVP 实施范围：[`docs/product/v1/MVP/MVP_SCOPE.md`](docs/product/v1/MVP/MVP_SCOPE.md)
- 仓库布局：[`docs/architecture/REPO_LAYOUT.md`](docs/architecture/REPO_LAYOUT.md)
- 开发路线图（历史计划草案）：[`docs/development/DEVELOPMENT_ROADMAP.md`](docs/development/DEVELOPMENT_ROADMAP.md)
- **当前实现状态**：[`docs/development/PROGRESS_REPORT.md`](docs/development/PROGRESS_REPORT.md)

## 版本

- v0.x：旧版 Flask + 原生 JS，已归档至 `archive/`
- v1.0 / v2.0.0：当前版本 FastAPI + React + TypeScript（Monorepo）；代码包版本为 v2.0.0，产品文档层仍在对齐中
