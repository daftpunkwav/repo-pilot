"""
Agent 独立运行时入口。

当 API 配置 AGENT_BASE_URL 指向本服务时，由 API 反向代理 SSE。
本进程复用 services/api 的 Hub / stream_chat（过渡期 import），共享 DATABASE_URL。
后续将把 agents/llm/tools/memory 物理迁入本包。
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from uuid import UUID

from fastapi import FastAPI, Header, HTTPException, Request, status
from fastapi.responses import StreamingResponse

_REPO = Path(__file__).resolve().parents[2]
_API_ROOT = _REPO / "services" / "api"
if str(_API_ROOT) not in sys.path:
    sys.path.insert(0, str(_API_ROOT))

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
    return {
        "status": "ok",
        "service": "agent-runtime",
        "version": "0.3.0",
        "mode": "embedded-hub",
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
    from backend.services.sse_stream import encode_stream_item

    factory = get_session_factory()

    async def gen():
        async with factory() as db:
            user = await db.get(User, user_id)
            if not user:
                from backend.services.sse_stream import format_sse

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
