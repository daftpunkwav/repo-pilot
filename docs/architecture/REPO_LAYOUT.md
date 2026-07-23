# RepoPilot Monorepo 布局

> 版本: 2026-07-05 | 状态: 已落地目录骨架，服务逐步填充
>
> **相关文档：** 运行时架构 [`OVERVIEW.md`](./OVERVIEW.md) · 路径对照 [`PATH_MAPPING.md`](./PATH_MAPPING.md)

## 目录总览

```
RepoPilot/
├── apps/                    # 面向用户的客户端
│   ├── web/                 # React Web SPA
│   └── desktop/             # 桌面壳（pywebview → Tauri）
│
├── services/                # 可独立部署的后端服务
│   ├── api/                 # 传统 API（认证、CRUD、图谱）
│   ├── agent/               # Agent 运行时（占位，代码暂在 api）
│   └── mcp/                 # MCP Server（占位，v1.4+）
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
| `services/mcp` | MCP 协议工具暴露 | Cursor 等外部客户端 |
| `packages/*` | 无运行时，纯共享代码 | apps + services |

## 当前实现 vs 占位

| 模块 | 状态 | 代码位置 |
|------|------|----------|
| Web | ✅ 已实现核心功能 | `apps/web/`（全部 MVP 页面、路由、Mock/Real 双轨 API 客户端已就位） |
| API | ✅ 已实现核心端点 | `services/api/backend/`（Auth/Projects/Categories/Tags/Notes/Graph/Settings/Agent 等） |
| Agent | 🟡 运行时占位 | 核心逻辑在 `services/api/backend/agents/`，独立进程 `services/agent/` 尚未实现 |
| MCP | ⬜ 占位 | `services/mcp/`（v1.4+ 规划） |
| Desktop | ⬜ 占位 | `apps/desktop/`（规划中，尚未实现） |
| Packages | 🟡 空壳 | `packages/types/ui/contracts/prompts/py-shared` 目录已建，实际共享代码尚未抽取 |

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

API 服务内 Python 包仍名为 `backend`（`from backend.xxx`），与目录 `services/api` 并存。  
后续可选重命名为 `repopilot_api`，非阻塞项。

## 数据目录

SQLite 与本地文件默认在仓库根 `data/`，由 `services/api/backend/config.py` 的 `REPO_ROOT / "data"` 解析，与各服务 cwd 无关。

## 开发命令速查

```bash
# Python（API）
pip install -e "./services/api[dev]"
uvicorn backend.main:app --reload --port 19876

# Node（Web，需在根目录 npm install）
npm install
npm run dev:web

# 并行启动（Windows）
.\scripts\dev.ps1
```
