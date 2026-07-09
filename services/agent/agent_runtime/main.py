"""
Agent 独立服务入口（占位）。

v1.0 主路径仍在 services/api/backend/agents/；
本进程用于未来与 API 解耦后的 Agent 运行时。
"""
from fastapi import FastAPI

app = FastAPI(title="RepoPilot Agent Runtime", version="0.1.0")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "agent-runtime", "version": "0.1.0"}
