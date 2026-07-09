"""
Agent Hub 占位 —— v1 推理循环将在此扩展。
"""


async def route_message(message: str, session_id: str | None = None) -> str:
    """最小占位：返回固定提示，供后续 ReAct / LiteLLM 替换。"""
    _ = session_id
    return f"Agent 服务开发中，已收到：{message[:200]}"
