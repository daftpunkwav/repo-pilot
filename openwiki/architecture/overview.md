---
type: 架构概览
title: RepoPilot 系统架构
description: RepoPilot 的高层架构——一个多智能体开源学习平台，采用 FastAPI 后端与 React 前端
tags: [architecture, overview, fastapi, react, multi-agent]
openwiki:
  roles: [architecture]
  source_paths: [docs/architecture/OVERVIEW.md, services/api/backend/main.py, apps/web/src/App.tsx]
---

# RepoPilot 系统架构

## 概述

RepoPilot 是一个**多智能体开源学习平台**，通过 AI 驱动的分析、个性化学习路径和交互式知识图谱，帮助开发者从 GitHub 仓库中学习。

## 设计原则

| 原则 | 描述 |
|-----------|-------------|
| 进程分离 | Web、API、Agent 和 MCP 可以独立启动与部署 |
| 数据主权 | 持久化与 JWT 归属 **API 服务**；Agent 通过 API 或共享契约读取上下文 |
| Mock 优先 | v1 UI 先在 `docs/design/v1/frontend/` 中完成原型，随后迁移至 `apps/web`；当前 `apps/web` 可连接真实的 `services/api` 后端 |
| 共享契约 | **`packages/types`** 已实现：`scripts/export_openapi.py` 导出 `packages/contracts/openapi.json`，由 `apps/web` 通过 `@repopilot/types` 消费 |

## 目标运行时架构

<!-- openwiki: mermaid parse failed and this diagram was converted to a text fence so it does not break rendering. Fix the diagram source and restore the mermaid fence. Parser error: Heuristic: an unescaped angle bracket inside a label breaks rendering; rephrase the label. -->
```text
flowchart TB
    subgraph clients["Clients"]
        WEB["apps/web<br/>React SPA"]
        DESK["apps/desktop<br/>(Planned)"]
        EXT["External AI Clients"]
    end

    subgraph services["Services"]
        API["services/api<br/>CRUD · Auth · Data"]
        AGENT["services/agent<br/>Hub · LLM · SSE"]
        MCP["services/mcp<br/>MCP Tools (Planned)"]
    end

    WEB -->|REST| API
    WEB -->|SSE| AGENT
    DESK --> WEB
    API -->|Optional Forward| AGENT
    AGENT -->|Read Context| API
    EXT -->|MCP| MCP
    MCP --> API
    MCP --> AGENT
```

## 当前实现状态

| 模块 | 路径（权威） | 职责 |
|--------|---------------------|----------------|
| Hub | `services/agent/agent_core/agents/hub.py` | 意图路由、Plan-and-Execute、多智能体编排 |
| ReAct | `services/agent/agent_core/agents/react.py` | 推理循环、工具调用、问题拦截 |
| Registry | `services/agent/agent_core/agents/registry.py` | Hub/Scout/Mentor/Navigator/Curator/Scribe/Atlas |
| LLM | `services/agent/agent_core/llm/provider.py` | LiteLLM BYOK 流式/非流式 |
| Memory | `services/agent/agent_core/memory/` | 短期/长期记忆、用户画像提案合并、上下文压缩 |
| Tools | `services/agent/agent_core/tools/builtin.py` | 24 个内置工具：项目/图谱/GitHub/笔记/分类/标签/进度/导入/问题/调度 |

## 仓库分层

```
apps/        → 面向用户（Web、Desktop）
services/    → 可部署的后端（api、agent、mcp）
packages/    → 无运行时依赖的共享库（types、ui、prompts、contracts……）
```

## 技术栈

### 后端（`services/api`）
- **框架**：FastAPI
- **ORM**：SQLAlchemy 2.0
- **数据库**：SQLite（本地）/ PostgreSQL（可用于生产）
- **认证**：JWT + 刷新令牌，httpOnly Cookie
- **限流**：slowapi
- **迁移**：Alembic

### Agent 系统（`services/agent`）
- **核心**：`agent_core` —— 权威的多智能体实现
- **运行时**：`agent_runtime` —— 可选的独立 SSE 服务器
- **LLM**：LiteLLM，支持多供应商
- **记忆**：短期/长期混合，支持上下文压缩

### 前端（`apps/web`）
- **框架**：React 19 + TypeScript
- **构建**：Vite 7
- **状态**：Zustand（客户端）+ React Query（服务端）
- **路由**：React Router
- **样式**：自研 CSS 设计系统（Liquid Glass UI，无 Tailwind 运行时依赖）

## 服务拆分触发条件

当满足以下任一条件时，将 Agent 从 API 迁移至 `services/agent/`：

1. Agent 需要独立扩缩容，或与 API 采用不同的发布周期
2. LLM 长任务影响 API 请求延迟（需要进程隔离）
3. 需要多实例 Agent + 单实例 API 的部署方式

## 文档与代码映射

| 文档层级 | 目录 | 职责 |
|----------------|-----------|----------------|
| 产品 | `docs/product/` | 构建什么（PRD > SPEC > MVP） |
| 架构 | `docs/architecture/` | 如何组织（本文档、目录布局、路径映射） |
| 设计/Mock | `docs/design/v1/` | UI 原型 + mock 前端实现 |
| 开发 | `docs/development/` | 如何演进（路线图、流程、日志） |

**冲突解决**：路径遵循 `PATH_MAPPING.md`；产品行为遵循 PRD > SPEC > MVP。