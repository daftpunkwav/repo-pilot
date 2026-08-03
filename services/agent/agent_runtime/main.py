"""
Agent 独立运行时入口。

核心实现位于 agent_core（agents/llm/tools/memory）；
共享持久化仍经 services/api 的 backend.database / models / agent_service。
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from uuid import UUID

from fastapi import FastAPI, Header, HTTPException, Request, status
from fastapi.responses import StreamingResponse

_AGENT_ROOT = Path(__file__).resolve().parents[1]
_REPO = _AGENT_ROOT.parents[1]
_API_ROOT = _REPO / "services" / "api"

# agent_core 与 backend 均需可导入
for p in (_AGENT_ROOT, _API_ROOT):
    s = str(p)
    if s not in sys.path:
        sys.path.insert(0, s)

os.environ.setdefault(
    "SECRET_KEY", os.environ.get("SECRET_KEY", "agent-dev-secret-key-32bytes-min!!")
)

app = FastAPI(title="RepoPilot Agent Runtime", version="0.3.0")


def _require_internal_token(token: str | None) -> None:
    from backend.config import get_settings

    expected = (get_settings().agent_internal_token or "").strip()
    if not expected:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "AGENT_TOKEN_UNSET", "message": "未配置 agent_internal_token"},
        )
    if not token or token.strip() != expected:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "无效内部令牌"},
        )


@app.get("/health")
async def health():
    # 验证 agent_core 本地可导入
    import agent_core  # noqa: F401
    from agent_core.agents.registry import get_registry

    return {
        "status": "ok",
        "service": "agent-runtime",
        "version": "0.3.0",
        "mode": "agent_core",
        "agents": sorted(d.id for d in get_registry().list_all()),
    }


@app.post("/v1/sessions/{session_id}/chat")
async def chat_session(
    session_id: UUID,
    request: Request,
    x_agent_internal_token: str | None = Header(default=None),
):
    """
    内部 SSE 入口：由 API 鉴权用户后转发。
    Body: {user_id, message, project_id?}
    """
    _require_internal_token(x_agent_internal_token)
    body = await request.json()
    try:
        user_id = UUID(str(body.get("user_id") or ""))
    except ValueError as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "user_id 无效"},
        ) from exc
    message = str(body.get("message") or "")
    if not message.strip():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "message 不能为空"},
        )
    project_id = None
    raw_pid = body.get("project_id")
    if raw_pid:
        try:
            project_id = UUID(str(raw_pid))
        except ValueError as exc:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                detail={"code": "VALIDATION_ERROR", "message": "project_id 无效"},
            ) from exc

    from backend.database import get_session_factory
    from backend.models.user import User
    from backend.services.agent_service import stream_chat
    from agent_core.agents.stream_events import encode_stream_item

    factory = get_session_factory()

    async def gen():
        async with factory() as db:
            user = await db.get(User, user_id)
            if not user:
                from agent_core.agents.stream_events import format_sse

                yield format_sse(
                    "error",
                    {"code": "NOT_FOUND", "message": "用户不存在"},
                ).to_sse()
                return
            async for chunk in stream_chat(
                db,
                user,
                session_id,
                message,
                project_id=project_id,
                force_local=True,
            ):
                yield encode_stream_item(chunk)

    return StreamingResponse(gen(), media_type="text/event-stream")
