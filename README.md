# RepoPilot

AI 驱动的开源项目学习平台。

**技术栈版本：** FastAPI + React + TypeScript（产品版本 v1.0，详见 `docs/product/`）

## 技术栈

- 后端：FastAPI + SQLAlchemy 2.0 + SQLite + LiteLLM
- 前端：React 18 + TypeScript + Vite + Tailwind CSS + Zustand
- 桌面壳：pywebview

## 快速开始

### 后端

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
uvicorn backend.main:app --reload
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

## 文档

权威来源声明：**PRD > SPEC > MVP_SCOPE**（产品需求优先于技术规格，MVP 实施规格从属前两者）。

- 产品需求 PRD：[`docs/product/v1/PRD/PRD.md`](docs/product/v1/PRD/PRD.md)
- Agent 系统 PRD：[`docs/product/v1/PRD/AGENT_PRD.md`](docs/product/v1/PRD/AGENT_PRD.md)
- 技术规范 SPEC：[`docs/product/v1/SPEC/TECHNICAL_SPEC.md`](docs/product/v1/SPEC/TECHNICAL_SPEC.md)
- Agent 系统 SPEC：[`docs/product/v1/SPEC/AGENT_SPEC.md`](docs/product/v1/SPEC/AGENT_SPEC.md)
- v1.0 MVP 实施范围：[`docs/product/v1/MVP/MVP_SCOPE.md`](docs/product/v1/MVP/MVP_SCOPE.md)
- 开发路线图：[`docs/development/DEVELOPMENT_ROADMAP.md`](docs/development/DEVELOPMENT_ROADMAP.md)
- 开发流程规范：[`docs/development/guides/DEVELOPMENT_PROCESS.md`](docs/development/guides/DEVELOPMENT_PROCESS.md)
- 文档审查报告：[`docs/product/v1/RepoPilot-v1-文档审查报告-2026-07-03-v2.md`](docs/product/v1/RepoPilot-v1-文档审查报告-2026-07-03-v2.md)

## 版本

- v0.x：旧版 Flask + 原生 JS，已归档至 `archive/`
- v1.0：当前版本 FastAPI + React + TypeScript
