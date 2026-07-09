# RepoPilot

AI 驱动的开源项目学习平台。

**技术栈版本：** FastAPI + React + TypeScript（产品版本 v1.0，详见 `docs/product/`）

## Monorepo 结构

```
RepoPilot/
├── apps/
│   ├── web/          # React Web 前端
│   └── desktop/      # 桌面壳（规划中）
├── services/
│   ├── api/          # 传统后端 API
│   ├── agent/        # Agent 运行时（占位）
│   └── mcp/          # MCP Server（占位）
├── packages/         # 共享库（types / ui / prompts / …）
├── docs/
└── archive/
```

完整说明见 [`docs/architecture/REPO_LAYOUT.md`](docs/architecture/REPO_LAYOUT.md)。

## 技术栈

- API：`services/api` — FastAPI + SQLAlchemy 2.0 + SQLite + LiteLLM
- Web：`apps/web` — React 19 + TypeScript + Vite 7 + Zustand + React Query（Mock 默认开启）
- 桌面：`apps/desktop` — pywebview（规划）

## 快速开始

### 环境

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e "./services/api[dev]"
```

### API

```bash
uvicorn backend.main:app --reload --port 19876
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

- 产品需求 PRD：[`docs/product/v1/PRD/PRD.md`](docs/product/v1/PRD/PRD.md)
- Agent 系统 PRD：[`docs/product/v1/PRD/AGENT_PRD.md`](docs/product/v1/PRD/AGENT_PRD.md)
- 技术规范 SPEC：[`docs/product/v1/SPEC/TECHNICAL_SPEC.md`](docs/product/v1/SPEC/TECHNICAL_SPEC.md)
- Agent 系统 SPEC：[`docs/product/v1/SPEC/AGENT_SPEC.md`](docs/product/v1/SPEC/AGENT_SPEC.md)
- v1.0 MVP 实施范围：[`docs/product/v1/MVP/MVP_SCOPE.md`](docs/product/v1/MVP/MVP_SCOPE.md)
- 仓库布局：[`docs/architecture/REPO_LAYOUT.md`](docs/architecture/REPO_LAYOUT.md)
- 开发路线图：[`docs/development/DEVELOPMENT_ROADMAP.md`](docs/development/DEVELOPMENT_ROADMAP.md)

## 版本

- v0.x：旧版 Flask + 原生 JS，已归档至 `archive/`
- v1.0：当前版本 FastAPI + React + TypeScript（Monorepo）
