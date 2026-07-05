"""
Agent 运行时占位包。

v1.0 阶段 Agent 逻辑仍在 services/api/backend/agents/，
待 API 与 Agent 进程边界稳定后，迁移至本服务：

- Hub 路由与意图分类
- ReAct 引擎与 Tool 调用
- 记忆系统（UserProfile / 会话压缩）
- SSE 流式输出

与 API 的通信方式（规划）：
- 内网 HTTP / gRPC，或
- 消息队列（若引入 worker）
"""

__version__ = "0.1.0"
