"""
Agent API —— 会话管理、对话 SSE、反问、分析、专用入口
"""
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from backend.api.deps import get_current_user, get_db
from backend.config import get_settings
from backend.core.auth_cookies import get_access_token_from_request
from backend.core.limiter import limiter
from backend.core.responses import wrap_data
from backend.core.security import decode_token
from backend.models.user import User
from backend.schemas.agent import (
    AgentChatBody,
    AgentChatRequest,
    AgentPermissionsOut,
    AgentPermissionsUpdate,
    AgentProfileOut,
    AgentQuestionAnswer,
    AgentSessionDetailOut,
    AgentSessionOut,
    ContextWindowStatsOut,
    SessionUpdateBody,
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
    update_session,
)
from backend.services.project_service import get_project_owned_by_user

router = APIRouter(prefix="/agent", tags=["agent"])
settings = get_settings()


def _agent_rate_key(request: Request) -> str:
    """Agent SSE 端点限流 key:优先按登录用户,未识别时回落 IP。

    每次对话/分析都触发多轮 LLM 调用与多专家 dispatch,按用户限频
    可防止已登录用户高频调用放大 LLM API 成本。
    """
    try:
        token = get_access_token_from_request(request)
        if token:
            payload = decode_token(token)
            sub = (payload or {}).get("sub")
            if sub:
                return f"user:{sub}"
    except Exception:
        pass
    return get_remote_address(request)


class AnalyzeBody(BaseModel):
    depth: str = "quick"
    force_refresh: bool = False
    # 指定专家 Agent；缺省时 depth=quick→scout，deep→mentor
    agent_id: str | None = None


class ImportAssistBody(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
    context: dict[str, Any] = Field(default_factory=dict)


class GraphGuideBody(BaseModel):
    message: str = Field(..., min_length=1, max_length=8000)
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


@router.patch("/sessions/{session_id}", response_model=DataResponse[AgentSessionOut])
async def patch_agent_session(
    session_id: UUID,
    body: SessionUpdateBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # project_id / project_ids 显式 null 或空列表时清除
    clear_project = (
        ("project_id" in body.model_fields_set and body.project_id is None)
        or ("project_ids" in body.model_fields_set and body.project_ids is not None and len(body.project_ids) == 0)
    )
    try:
        updated = await update_session(
            db,
            current_user.id,
            session_id,
            title=body.title,
            project_id=body.project_id,
            project_ids=body.project_ids if not clear_project else None,
            clear_project=clear_project,
            active_agent=body.active_agent,
        )
    except ValueError as exc:
        if str(exc) == "PROJECT_NOT_OWNED":
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FORBIDDEN",
                    "message": "无权绑定该项目到会话",
                },
            ) from exc
        if str(exc) == "INVALID_ACTIVE_AGENT":
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "INVALID_ACTIVE_AGENT",
                    "message": "未知的 active_agent",
                },
            ) from exc
        raise
    if not updated:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Session not found"},
        )
    return wrap_data(updated)


@router.post("/sessions/{session_id}/chat")
@limiter.limit(settings.rate_limit_agent, key_func=_agent_rate_key)
async def chat_in_session(
    request: Request,
    response: Response,
    session_id: UUID,
    body: AgentChatBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async def event_gen():
        async for chunk in stream_chat(
            db,
            current_user,
            session_id,
            body.message,
            project_id=body.project_id,
        ):
            yield chunk

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.post("/chat")
@limiter.limit(settings.rate_limit_agent, key_func=_agent_rate_key)
async def chat_legacy(
    request: Request,
    response: Response,
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
@limiter.limit(settings.rate_limit_agent, key_func=_agent_rate_key)
async def answer_question(
    request: Request,
    response: Response,
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
@limiter.limit(settings.rate_limit_agent, key_func=_agent_rate_key)
async def analyze_project(
    request: Request,
    response: Response,
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
    agent_id = (body.agent_id if body else None) or None

    async def event_gen():
        async for chunk in stream_analyze(
            db,
            current_user,
            project_id,
            depth=depth,
            agent_id=agent_id,
        ):
            yield chunk

    return StreamingResponse(event_gen(), media_type="text/event-stream")


@router.post("/import-assist")
@limiter.limit(settings.rate_limit_agent, key_func=_agent_rate_key)
async def import_assist(
    request: Request,
    response: Response,
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
@limiter.limit(settings.rate_limit_agent, key_func=_agent_rate_key)
async def graph_guide(
    request: Request,
    response: Response,
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
@limiter.limit(settings.rate_limit_agent, key_func=_agent_rate_key)
async def trending_scout(
    request: Request,
    response: Response,
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
@limiter.limit(settings.rate_limit_agent, key_func=_agent_rate_key)
async def classify_project(
    request: Request,
    response: Response,
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
        f"请为项目 {project.name} ({project.url}) 完成分类并落库。"
        f"描述: {project.description or ''} 语言: {project.language or ''}。"
        f"用户提示: {hint}。"
        f"project_id={body.project_id}。"
        "必须调用 set_project_category（必要时 set_project_tags）真正写入，"
        "不要只 suggest；最后用一两句话说明结果与分类名。"
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
@limiter.limit(settings.rate_limit_agent, key_func=_agent_rate_key)
async def generate_note(
    request: Request,
    response: Response,
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
        f"请以 Scribe {mode} 模式为项目 {project.name} 生成学习笔记并保存到系统。"
        f"主题: {topic}。URL: {project.url}。project_id={body.project_id}。"
        f"{'检索相似已学项目做对比（仅当相似度高时），compare_project_ids 传入对比项' if mode == 'project' else '独立成文，不对比'}。"
        "必须调用 create_note 写入数据库（title + 完整 Markdown content），"
        "不要只输出草稿；落库后简述笔记标题与已保存。"
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


def _load_permissions(user: User) -> AgentPermissionsOut:
    import json

    try:
        raw = json.loads(user.agent_permissions or "{}")
    except json.JSONDecodeError:
        raw = {}
    if not isinstance(raw, dict):
        raw = {}
    return AgentPermissionsOut.model_validate(
        {**AgentPermissionsOut().model_dump(), **raw}
    )


@router.get("/permissions", response_model=DataResponse[AgentPermissionsOut])
async def get_permissions(current_user: User = Depends(get_current_user)):
    return wrap_data(_load_permissions(current_user))


@router.patch("/permissions", response_model=DataResponse[AgentPermissionsOut])
async def patch_permissions(
    body: AgentPermissionsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新当前用户 Agent 工具权限（敏感能力开关）。"""
    import json

    current = _load_permissions(current_user)
    updates = body.model_dump(exclude_unset=True)
    merged = current.model_dump()
    merged.update(updates)
    out = AgentPermissionsOut.model_validate(merged)
    current_user.agent_permissions = json.dumps(out.model_dump(), ensure_ascii=False)
    await db.commit()
    await db.refresh(current_user)
    return wrap_data(out)


@router.get("/context-window", response_model=DataResponse[ContextWindowStatsOut])
async def context_window(
    session_id: UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stats = await get_context_window(db, current_user.id, session_id)
    return wrap_data(stats)
