"""
Agent API —— 会话管理、对话 SSE、反问、分析、专用入口
"""
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.core.responses import wrap_data
from backend.models.user import User
from backend.schemas.agent import (
    AgentChatBody,
    AgentChatRequest,
    AgentPermissionsOut,
    AgentProfileOut,
    AgentQuestionAnswer,
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
    stream_analyze,
    stream_chat,
    stream_graph_guide,
    stream_import_assist,
    stream_question_answer,
    stream_trending_scout,
)
from backend.services.project_service import get_project_owned_by_user

router = APIRouter(prefix="/agent", tags=["agent"])


class AnalyzeBody(BaseModel):
    depth: str = "quick"
    force_refresh: bool = False


class ImportAssistBody(BaseModel):
    message: str = Field(..., min_length=1)
    context: dict[str, Any] = Field(default_factory=dict)


class GraphGuideBody(BaseModel):
    message: str = Field(..., min_length=1)
    selected_node_id: Optional[str] = None


class TrendingScoutBody(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    description: Optional[str] = None
    language: Optional[str] = None
    stars: Optional[int] = None
    url: Optional[str] = None


class NoteGenerateBody(BaseModel):
    project_id: UUID
    mode: str = "project"  # project | standalone
    topic: Optional[str] = None


class ClassifyBody(BaseModel):
    project_id: UUID
    user_hint: Optional[str] = None


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
        async for chunk in stream_chat(
            db, current_user, session_id, body.message
        ):
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
            db,
            current_user,
            body.session_id,
            body.message,
            project_id=body.project_id,
        ):
            yield chunk

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.post("/question")
async def answer_question(
    body: AgentQuestionAnswer,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    session_id: UUID | None = Query(None, description="会话 ID（也可放 body）"),
):
    sid = body.session_id or session_id
    if not sid:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail={"code": "VALIDATION_ERROR", "message": "session_id is required"},
        )
    # 前端可能传 QuestionAnswer[]，统一转为 dict
    raw = body.answers
    answers: dict = {}
    if isinstance(raw, dict):
        answers = raw
    elif isinstance(raw, list):
        for item in raw:
            if isinstance(item, dict) and "question_id" in item:
                answers[item["question_id"]] = item
            elif isinstance(item, dict) and "id" in item:
                answers[item["id"]] = item
            else:
                answers[str(len(answers))] = item

    async def event_gen():
        async for chunk in stream_question_answer(
            db,
            current_user,
            sid,
            body.question_id,
            answers,
            skipped=body.skipped,
        ):
            yield chunk

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.post("/analyze/{project_id}")
async def analyze_project(
    project_id: UUID,
    body: AnalyzeBody | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_owned_by_user(db, project_id, current_user.id)
    if not project:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Project does not belong to current user"},
        )
    depth = (body.depth if body else "quick") or "quick"

    async def event_gen():
        async for chunk in stream_analyze(db, current_user, project_id, depth=depth):
            yield chunk

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.post("/import-assist")
async def import_assist(
    body: ImportAssistBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async def event_gen():
        async for chunk in stream_import_assist(
            db, current_user, body.message, body.context
        ):
            yield chunk

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.post("/graph-guide")
async def graph_guide(
    body: GraphGuideBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async def event_gen():
        async for chunk in stream_graph_guide(
            db,
            current_user,
            body.message,
            selected_node_id=body.selected_node_id,
        ):
            yield chunk

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.post("/trending-scout")
async def trending_scout(
    body: TrendingScoutBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async def event_gen():
        async for chunk in stream_trending_scout(
            db, current_user, body.model_dump()
        ):
            yield chunk

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.post("/classify")
async def classify_project(
    body: ClassifyBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_owned_by_user(db, body.project_id, current_user.id)
    if not project:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Project not found"},
        )
    from backend.services.agent_service import create_session
    from backend.agents.hub import HubService

    session = await create_session(
        db, current_user.id, project_id=body.project_id, title=f"分类 {project.name}"
    )
    hint = body.user_hint or ""
    prompt = (
        f"请用 Curator Reflexion 流程为项目 {project.name} ({project.url}) 建议分类。"
        f"描述: {project.description or ''} 语言: {project.language or ''}。"
        f"用户提示: {hint}"
    )

    async def event_gen():
        hub = HubService(db)
        async for chunk in hub.handle_direct_agent(
            user=current_user,
            session_id=session.id,
            agent_id="curator",
            message=prompt,
            project_id=body.project_id,
        ):
            yield chunk

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.post("/note/generate")
async def generate_note(
    body: NoteGenerateBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await get_project_owned_by_user(db, body.project_id, current_user.id)
    if not project:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Project not found"},
        )
    from backend.services.agent_service import create_session
    from backend.agents.hub import HubService

    session = await create_session(
        db, current_user.id, project_id=body.project_id, title=f"笔记 {project.name}"
    )
    mode = body.mode or "project"
    topic = body.topic or project.name
    prompt = (
        f"请以 Scribe {mode} 模式为项目 {project.name} 生成学习笔记大纲与正文草稿。"
        f"主题: {topic}。URL: {project.url}。"
        f"{'检索相似已学项目做对比（仅当相似度高时）' if mode == 'project' else '独立成文，不对比'}。"
    )

    async def event_gen():
        hub = HubService(db)
        async for chunk in hub.handle_direct_agent(
            user=current_user,
            session_id=session.id,
            agent_id="scribe",
            message=prompt,
            project_id=body.project_id,
        ):
            yield chunk

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.get("/profiles", response_model=DataResponse[list[AgentProfileOut]])
async def list_profiles():
    return wrap_data(AGENT_PROFILES)


@router.get("/permissions", response_model=DataResponse[AgentPermissionsOut])
async def get_permissions(current_user: User = Depends(get_current_user)):
    import json

    try:
        raw = json.loads(current_user.agent_permissions or "{}")
    except json.JSONDecodeError:
        raw = {}
    return wrap_data(
        AgentPermissionsOut.model_validate(
            {**AgentPermissionsOut().model_dump(), **raw}
        )
    )


@router.get("/context-window", response_model=DataResponse[ContextWindowStatsOut])
async def context_window(
    session_id: UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stats = await get_context_window(db, current_user.id, session_id)
    return wrap_data(stats)
