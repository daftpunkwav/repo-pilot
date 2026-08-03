# RepoPilot

AI 驱动的开源项目学习平台。

**技术栈版本：** FastAPI + React + TypeScript（代码版本已推进至 **v2.0.0**，产品文档层仍在向 v2 对齐；当前实现以 `apps/web` + `services/api` 为准，详见 `docs/product/`）

## Monorepo 结构

```
RepoPilot/
├── apps/
│   ├── web/          # React Web 前端
│   └── desktop/      # 桌面壳（规划中）
├── services/
│   ├── api/          # FastAPI 后端（含 Multi-Agent 运行时）
│   ├── agent/        # 独立 Agent 服务（预留扩展）
│   └── mcp/          # MCP Server（规划中）
├── packages/         # 共享库（types / ui / prompts / …）
├── docs/
└── archive/
```

完整说明见 [`docs/architecture/REPO_LAYOUT.md`](docs/architecture/REPO_LAYOUT.md)。

> **实现状态速览（截至 2026-08-03）：**
> - `apps/web`、`services/api` 已实现核心页面与端点；开发环境（`.env.development`）默认 `VITE_USE_MOCK=false` 走真实后端；未设置时客户端默认 Mock。
> - `packages/*`（types / ui / contracts / prompts / py-shared）目前多为空壳，前后端类型与契约仍分别维护在 `apps/web/src/api/types.ts` 与 `services/api/backend/schemas/`。
> - `services/agent`、`services/mcp`、`apps/desktop` 仅为占位或规划，尚未实现。

## 技术栈

- API：`services/api` — FastAPI + SQLAlchemy 2.0 + SQLite + LiteLLM Multi-Agent
- Web：`apps/web` — React 19 + TypeScript + Vite 7 + Zustand + React Query
- Agent：**7 个 Agent**：Hub 统筹调度 + Scout/Mentor/Navigator/Curator/Scribe/Atlas（BYOK）；Agent 运行时当前位于 `services/api/backend/agents/`，独立的 `services/agent` 仍为占位
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
python -m venv .venv
.venv\Scripts\activate
pip install -e "./services/api[dev]"
```

### API

```bash
# 推荐：与 Vite 代理一致（部分 Windows 环境 19876 会幽灵占用）
npm run dev:api
# 或：uvicorn backend.main:app --reload --host 127.0.0.1 --port 19878 --app-dir services/api
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
