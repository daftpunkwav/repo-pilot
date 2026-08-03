# RepoPilot Agent 服务

相对独立的 **AI Agent 运行时**，与传统 CRUD API 解耦。

## 当前状态

**占位服务**（仅 `/health` 等骨架）。v1/v2 实现位于 `services/api/backend/agents/`，与本目录并行；  
拆分触发条件见 `docs/architecture/REPO_LAYOUT.md`。

当前同进程实现共 **7** 个 Agent：Hub + Scout / Mentor / Navigator / Curator / Scribe / **Atlas**。

## 未来职责

| 模块 | 说明 |
|------|------|
| Hub | 统一对话入口、意图分类、多 Agent 派发 |
| Agents | Scout / Mentor / Navigator / Curator / Scribe / Atlas |
| Memory | 用户画像、会话历史压缩 |
| Tools | LLM Tool 注册与执行（非 MCP 协议层） |
| Prompts | 从 `packages/prompts` 加载模板 |

## 启动（占位）

```bash
# 仓库根
npm run dev:agent
# 或：uvicorn agent_runtime.main:app --reload --port 19877 --app-dir services/agent
```

> 注意：主 API 开发端口为 **19878**；**19877** 仅用于本占位服务，勿与 Vite 代理混淆。

## 与 API 的边界

- **API**：用户认证、项目/笔记/图谱 CRUD、当前阶段同时承载 Agent 请求
- **Agent（目标）**：LLM 调用、推理循环、流式 SSE、记忆读写
