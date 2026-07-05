# RepoPilot Agent 服务

相对独立的 **AI Agent 运行时**，与传统 CRUD API 解耦。

## 当前状态

**占位服务。** v1.0 实现位于 `services/api/backend/agents/`，与本目录并行存在；  
拆分触发条件见 `docs/architecture/REPO_LAYOUT.md`。

## 未来职责

| 模块 | 说明 |
|------|------|
| Hub | 统一对话入口、意图分类、多 Agent 派发 |
| Agents | Scout / Mentor / Navigator / Curator / Scribe |
| Memory | 用户画像、会话历史压缩 |
| Tools | LLM Tool 注册与执行（非 MCP 协议层） |
| Prompts | 从 `packages/prompts` 加载模板 |

## 启动（规划）

```bash
cd services/agent
pip install -e ".[dev]"
uvicorn agent_runtime.main:app --reload --port 19877
```

## 与 API 的边界

- **API**：用户认证、项目/笔记/图谱 CRUD、转发 Agent 请求
- **Agent**：LLM 调用、推理循环、流式 SSE、记忆读写
