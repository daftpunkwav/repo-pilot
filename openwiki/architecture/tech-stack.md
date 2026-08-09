---
type: 技术栈
title: RepoPilot 技术栈
description: RepoPilot 完整技术栈概览，包括后端、前端、智能体系统和开发工具
tags: [architecture, tech-stack, fastapi, react, typescript]
openwiki:
  roles: [architecture]
  source_paths: [package.json, services/api/pyproject.toml, apps/web/package.json]
---

# RepoPilot 技术栈

## 后端（`services/api`）

| 类别 | 技术 | 版本 | 用途 |
|----------|-----------|---------|---------|
| 框架 | FastAPI | 最新 | 高性能异步 API 框架 |
| ORM | SQLAlchemy 2.0 | 2.0+ | 支持异步的数据库 ORM |
| 数据库 | SQLite | 3.x | 本地开发数据库（可迁移至 PostgreSQL） |
| 身份认证 | python-jose | - | JWT 令牌处理 |
| 密码哈希 | bcrypt | - | 安全的密码哈希 |
| 限流 | slowapi | - | API 限流 |
| 数据库迁移 | Alembic | - | 数据库模式迁移 |
| 数据校验 | Pydantic | 2.x | 请求/响应校验 |
| HTTP 客户端 | httpx | - | 用于 GitHub API 的异步 HTTP 客户端 |

### 核心 Python 依赖

```toml
[project]
dependencies = [
    "fastapi>=0.115",
    "sqlalchemy[asyncio]>=2.0",
    "aiosqlite>=0.20",
    "pydantic>=2.8",
    "pydantic-settings>=2.3",
    "python-jose[cryptography]>=3.3",
    "bcrypt>=4.1",
    "slowapi>=0.1",
    "alembic>=1.13",
    "httpx>=0.27",
    "litellm>=1.0",  # Multi-provider LLM support
]
```

## 智能体系统（`services/agent`）

| 组件 | 技术 | 用途 |
|-----------|-----------|---------|
| LLM 提供商 | LiteLLM | 多 LLM 提供商的统一接口 |
| 记忆系统 | 自研 | 混合式短期/长期记忆系统 |
| 工具注册表 | 自研 | 24 个内置智能体操作工具 |
| SSE 流式传输 | FastAPI | 用于实时智能体响应的服务器发送事件 |

### 智能体架构模式

- **Hub**：用于任务编排的 Plan-and-Execute（规划-执行）工作流
- **Experts**：用于专业智能体的 ReAct（推理 + 行动）循环
- **Curator**：用于分类任务的 Reflexion（反思）工作流
- **Mentor**：ReAct 教学循环（ToT 规划预热已移除以加快首字延迟，见 `registry.py` 注释）

## 前端（`apps/web`）

| 类别 | 技术 | 版本 | 用途 |
|----------|-----------|---------|---------|
| 框架 | React | 19.2.7 | UI 库 |
| 语言 | TypeScript | 5.x | 类型安全的 JavaScript |
| 构建工具 | Vite | 7.x | 快速开发与构建 |
| 路由 | React Router | 7.x | 客户端路由 |
| 状态管理（客户端） | Zustand | 5.x | 轻量级状态管理 |
| 状态管理（服务端） | TanStack Query | 5.x | 服务端状态缓存与同步 |
| HTTP 客户端 | 原生 fetch | - | API 通信（`api/real/http.ts`，httpOnly Cookie + credentials） |
| 样式 | 自研 CSS 设计系统 | - | Liquid Glass 设计系统（`styles/design-system.css` 等，无 Tailwind 依赖） |
| Markdown | react-markdown + rehype-sanitize/dompurify | 10.x | 渲染并消毒 Markdown 内容 |
| 图表 | Mermaid | 11.x | 图形可视化 |
| 图可视化 | D3 | 7.x | 知识图谱力导向渲染 |

### 核心 npm 依赖

```json
{
  "dependencies": {
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "react-router-dom": "^7.18.1",
    "@tanstack/react-query": "^5.101.2",
    "zustand": "^5.0.14",
    "@repopilot/types": "*",
    "mermaid": "^11.16.0",
    "d3": "^7.9.0",
    "react-markdown": "^10.1.0",
    "rehype-sanitize": "^6.0.0",
    "rehype-highlight": "^7.0.2",
    "dompurify": "^3.4.12",
    "remark-gfm": "^4.0.1",
    "clsx": "^2.1.1"
  }
}
```

## 开发工具

| 类别 | 工具 | 用途 |
|----------|------|---------|
| 包管理器 | npm + workspaces | Monorepo 包管理 |
| Python 环境 | venv + uv | Python 虚拟环境 |
| 代码检查（JS） | ESLint | 代码质量 |
| 代码检查（Python） | ruff + mypy | Python 代码检查与类型检查 |
| 测试（JS） | Vitest + Playwright | 单元测试与端到端测试 |
| 测试（Python） | pytest | Python 测试 |
| 代码格式化 | Prettier | 代码格式化 |
| CI | GitHub Actions | `.github/workflows/ci.yml`（backend pytest + frontend lint/typecheck/test 双 job）；`.github/workflows/markdown-link-check.yml`（Markdown 链接检查） |

## 运行时架构

```
┌─────────────────────────────────────────────────────────────┐
│                         Clients                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Web (React) │  │ Desktop      │  │ External AI  │      │
│  │  Port: 5173  │  │ (Planned)    │  │ Clients      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼─────────────────┼─────────────────┼──────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          │           API Gateway              │
          │        services/api (19878)        │
          └─────────────────┬─────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
   ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐
   │  REST API   │  │  Agent SSE  │  │    MCP      │
   │  (CRUD)     │  │  (19877)    │  │  (Future)   │
   └─────────────┘  └─────────────┘  └─────────────┘
```

## 环境配置

### API 环境变量

```bash
# Required
SECRET_KEY="your-32-byte-secret-key"

# Optional
DATABASE_URL="sqlite+aiosqlite:///data/repopilot.db"
AGENT_BASE_URL="http://127.0.0.1:19877"  # For standalone agent
```

### Web 环境变量

```bash
# .env.development
VITE_USE_MOCK=false  # Use real backend instead of mock data
VITE_API_BASE_URL="/api/v1"
```