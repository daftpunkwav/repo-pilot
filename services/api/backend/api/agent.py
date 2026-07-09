"""
Agent API —— 会话管理、对话 SSE、配置元数据
"""
import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.core.responses import wrap_data
from backend.models.user import User
from backend.schemas.agent import (
    AgentChatBody,
    AgentChatRequest,
    AgentPermissionsOut,
    AgentProfileOut,
    AgentSessionDetailOut,
    AgentSessionOut,
    ContextWindowStatsOut,
)
from backend.schemas.common import DataResponse
from backend.services.agent_catalog import AGENT_PROFILES
from backend.services.agent_service import (
    create_session,
    delete_session,
    get_context_window,
    get_session_detail,
    list_sessions,
    stream_chat,
)
from backend.services.project_service import get_project_owned_by_user

router = APIRouter(prefix="/agent", tags=["agent"])


@router.get("/sessions", response_model=DataResponse[list[AgentSessionOut]])
async def list_agent_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return wrap_data(await list_sessions(db, current_user.id))


@router.post("/sessions", response_model=DataResponse[AgentSessionOut])
async def create_agent_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return wrap_data(await create_session(db, current_user.id))


@router.get("/sessions/{session_id}", response_model=DataResponse[AgentSessionDetailOut])
async def get_agent_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    detail = await get_session_detail(db, current_user.id, session_id)
    if not detail:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Session not found"},
        )
    return wrap_data(detail)


@router.delete("/sessions/{session_id}", response_model=DataResponse[dict])
async def delete_agent_session(
    session_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await delete_session(db, current_user.id, session_id)
    if not ok:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Session not found"},
        )
    return wrap_data({"success": True})


@router.post("/sessions/{session_id}/chat")
async def chat_in_session(
    session_id: UUID,
    body: AgentChatBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async def event_gen():
        async for chunk in stream_chat(db, current_user.id, session_id, body.message):
            yield chunk

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.post("/chat")
async def chat_legacy(
    body: AgentChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.session_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "session_id is required"},
        )

    async def event_gen():
        async for chunk in stream_chat(
            db, current_user.id, body.session_id, body.message
        ):
            yield chunk

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.post("/question")
async def answer_question(
    current_user: User = Depends(get_current_user),
):
    raise HTTPException(
        status.HTTP_501_NOT_IMPLEMENTED,
        detail={"code": "NOT_IMPLEMENTED", "message": "Agent question flow pending LLM integration"},
    )


@router.post("/analyze/{project_id}")
async def analyze_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_owned_by_user(db, project_id, current_user.id)
    if not project:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Project does not belong to current user"},
        )
    raise HTTPException(
        status.HTTP_501_NOT_IMPLEMENTED,
        detail={"code": "NOT_IMPLEMENTED", "message": "Project analyze pending LLM integration"},
    )


@router.get("/profiles", response_model=DataResponse[list[AgentProfileOut]])
async def list_profiles():
    return wrap_data(AGENT_PROFILES)


@router.get("/permissions", response_model=DataResponse[AgentPermissionsOut])
async def get_permissions(current_user: User = Depends(get_current_user)):
    try:
        raw = json.loads(current_user.agent_permissions or "{}")
    except json.JSONDecodeError:
        raw = {}
    return wrap_data(AgentPermissionsOut.model_validate({**AgentPermissionsOut().model_dump(), **raw}))


@router.get("/context-window", response_model=DataResponse[ContextWindowStatsOut])
async def context_window(
    session_id: UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stats = await get_context_window(db, current_user.id, session_id)
    return wrap_data(stats)
