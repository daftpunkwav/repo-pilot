# RepoPilot Agent 服务

相对独立的 **AI Agent 运行时**：核心逻辑在 `agent_core/`，HTTP 入口在 `agent_runtime/`。

## 布局

| 路径 | 说明 |
|------|------|
| `agent_core/agents` | Hub / ReAct / 意图 / StreamEvent |
| `agent_core/llm` | LLM 配置与 Provider |
| `agent_core/tools` | 工具注册与 builtin |
| `agent_core/memory` | 运行上下文与记忆服务 |
| `agent_runtime` | FastAPI：`/health`、内部 SSE chat |

API 侧 `services/api/api_backend` 直接 import `agent_core`（2026-08-12 移除兼容 shim）；测试与服务用 `from agent_core.agents...`。

## 启动

```bash
# 仓库根（需与 API 共享 DATABASE_URL / SECRET_KEY / AGENT_INTERNAL_TOKEN）
npm run dev:agent
# 或：uvicorn agent_runtime.main:app --reload --port 19877 --app-dir services/agent
```

主 API 开发端口为 **19878**；设置 `AGENT_BASE_URL=http://127.0.0.1:19877` 后 API 将 SSE 代理到本服务。

## 与 API 的边界

- **API**：认证、CRUD、会话 HTTP、落库编排入口（可代理）
- **Agent**：推理循环、工具、记忆、LLM；仍通过 `api_backend.models` / `api_backend.services` / `api_backend.database` 访问共享持久化层
