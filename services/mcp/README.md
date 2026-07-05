# RepoPilot MCP 服务

独立的 **Model Context Protocol** 服务，供 Cursor、Claude Desktop 等客户端调用。

## 当前状态

占位目录，PRD 规划在 v1.4+ 实现（见 `docs/product/v1/MVP/MVP_SCOPE.md` §2.2）。

## 未来职责

- 暴露 RepoPilot 领域工具（项目库、笔记、图谱查询）
- 集成外部 MCP（GitHub、文档源）
- 与 `services/agent` 的 Tool 层对接，或直接被 Agent 以 MCP 客户端身份调用

## 启动（规划）

```bash
cd services/mcp
pip install -e .
python -m mcp_server
```

## 与 Agent 的区别

| | Agent 服务 | MCP 服务 |
|---|-----------|----------|
| 协议 | 内部 HTTP/SSE | MCP (stdio/HTTP) |
| 消费者 | RepoPilot Web/Desktop | 外部 AI 客户端 |
| 职责 | 推理、对话、记忆 | 标准化工具暴露 |
