"""Agent 会话与对话业务逻辑"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, AsyncIterator
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.agents.hub import HubService
from backend.llm.config import build_llm_config_from_user
from backend.memory.service import MemoryService
from backend.models.agent import AgentMessage, AgentSession
from backend.models.user import User
from backend.schemas.agent import (
    AgentMessageOut,
    AgentSessionDetailOut,
    AgentSessionOut,
    ContextWindowSegmentOut,
    ContextWindowStatsOut,
)
from backend.services.sse_stream import format_sse
from backend.tools.builtin import ensure_tools_loaded

ensure_tools_loaded()


def session_to_out(session: AgentSession) -> AgentSessionOut:
    return AgentSessionOut(
        id=session.id,
        title=session.title or "新对话",
        agent=session.active_agent or "hub",
        updated_at=(session.updated_at or session.created_at).isoformat() + "Z",
        unread=False,
        project_id=session.project_id,
    )


def message_to_out(msg: AgentMessage) -> AgentMessageOut:
    return AgentMessageOut(
        id=msg.id,
        session_id=msg.session_id,
        agent=msg.agent_id or "hub",
        role=msg.role,
        content=msg.content,
        created_at=msg.created_at.isoformat() + "Z",
    )


async def list_sessions(db: AsyncSession, user_id: UUID) -> list[AgentSessionOut]:
    result = await db.execute(
        select(AgentSession)
        .where(AgentSession.user_id == user_id)
        .order_by(AgentSession.updated_at.desc())
    )
    return [session_to_out(s) for s in result.scalars().all()]


async def get_session_detail(
    db: AsyncSession, user_id: UUID, session_id: UUID
) -> AgentSessionDetailOut | None:
    session = await db.get(AgentSession, session_id)
    if not session or session.user_id != user_id:
        return None
    msgs = (
        await db.execute(
            select(AgentMessage)
            .where(AgentMessage.session_id == session_id)
            .order_by(AgentMessage.created_at.asc())
        )
    ).scalars().all()
    base = session_to_out(session)
    return AgentSessionDetailOut(
        **base.model_dump(),
        messages=[message_to_out(m) for m in msgs],
    )


async def create_session(
    db: AsyncSession,
    user_id: UUID,
    *,
    project_id: UUID | None = None,
    title: str = "新对话",
) -> AgentSessionOut:
    session = AgentSession(
        user_id=user_id,
        title=title,
        active_agent="hub",
        project_id=project_id,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session_to_out(session)


async def update_session(
    db: AsyncSession,
    user_id: UUID,
    session_id: UUID,
    *,
    title: str | None = None,
    project_id: UUID | None = None,
    clear_project: bool = False,
) -> AgentSessionOut | None:
    session = await db.get(AgentSession, session_id)
    if not session or session.user_id != user_id:
        return None
    if title is not None:
        session.title = title
    if clear_project:
        session.project_id = None
    elif project_id is not None:
        session.project_id = project_id
    session.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(session)
    return session_to_out(session)


async def delete_session(db: AsyncSession, user_id: UUID, session_id: UUID) -> bool:
    session = await db.get(AgentSession, session_id)
    if not session or session.user_id != user_id:
        return False
    msgs = await db.execute(
        select(AgentMessage).where(AgentMessage.session_id == session_id)
    )
    for msg in msgs.scalars().all():
        await db.delete(msg)
    await db.delete(session)
    await db.commit()
    return True


async def append_message(
    db: AsyncSession,
    session: AgentSession,
    *,
    role: str,
    content: str,
    agent_id: str | None = None,
    content_type: str = "text",
    metadata: dict | None = None,
) -> AgentMessage:
    msg = AgentMessage(
        session_id=session.id,
        role=role,
        agent_id=agent_id or session.active_agent or "hub",
        content=content,
        content_type=content_type,
        message_meta=json.dumps(metadata or {}, ensure_ascii=False),
    )
    db.add(msg)
    session.updated_at = datetime.utcnow()
    if role == "user" and (not session.title or session.title == "新对话"):
        session.title = content[:32] + ("…" if len(content) > 32 else "")
    await db.commit()
    await db.refresh(msg)
    return msg


async def stream_chat(
    db: AsyncSession,
    user: User,
    session_id: UUID,
    message: str,
    *,
    project_id: UUID | None = None,
) -> AsyncIterator[str]:
    session = await db.get(AgentSession, session_id)
    if not session or session.user_id != user.id:
        yield format_sse("error", {"code": "NOT_FOUND", "message": "会话不存在"})
        return

    # 消息级 project_id 优先，并回写到会话
    if project_id is not None:
        session.project_id = project_id
        await db.commit()

    await append_message(db, session, role="user", content=message, agent_id="hub")

    hub = HubService(db)
    collected: list[str] = []
    last_agent = "hub"
    usage: dict[str, Any] = {}

    async for chunk in hub.handle_chat(
        user=user,
        session_id=session_id,
        message=message,
        project_id=session.project_id,
    ):
        # 解析部分事件以收集回复
        if chunk.startswith("event: text_delta"):
            try:
                data_line = chunk.split("data: ", 1)[1].strip()
                data = json.loads(data_line)
                collected.append(data.get("content") or "")
            except Exception:
                pass
        elif chunk.startswith("event: agent_switch"):
            try:
                data_line = chunk.split("data: ", 1)[1].strip()
                data = json.loads(data_line)
                last_agent = data.get("agent_id") or last_agent
                session.active_agent = last_agent
            except Exception:
                pass
        elif chunk.startswith("event: done"):
            try:
                data_line = chunk.split("data: ", 1)[1].strip()
                data = json.loads(data_line)
                usage = data.get("usage") or {}
            except Exception:
                pass
        elif chunk.startswith("event: question"):
            try:
                data_line = chunk.split("data: ", 1)[1].strip()
                data = json.loads(data_line)
                session.status = "pending_question"
                await append_message(
                    db,
                    session,
                    role="assistant",
                    content=json.dumps(data, ensure_ascii=False),
                    agent_id=last_agent,
                    content_type="question",
                    metadata=data,
                )
                await db.commit()
            except Exception:
                pass
        yield chunk

    reply = "".join(collected)
    if reply:
        await append_message(
            db,
            session,
            role="assistant",
            content=reply,
            agent_id=last_agent,
            metadata={"usage": usage},
        )
        session.active_agent = last_agent
        session.status = "active"
        await db.commit()


async def stream_question_answer(
    db: AsyncSession,
    user: User,
    session_id: UUID,
    question_id: str,
    answers: dict[str, Any],
    *,
    skipped: bool = False,
) -> AsyncIterator[str]:
    session = await db.get(AgentSession, session_id)
    if not session or session.user_id != user.id:
        yield format_sse("error", {"code": "NOT_FOUND", "message": "会话不存在"})
        return

    answer_text = (
        "[跳过反问]"
        if skipped
        else f"[反问回答] {json.dumps(answers, ensure_ascii=False)}"
    )
    await append_message(db, session, role="user", content=answer_text, agent_id="hub")
    session.status = "active"

    hub = HubService(db)
    collected: list[str] = []
    last_agent = session.active_agent or "mentor"

    async for chunk in hub.handle_question_answer(
        user=user,
        session_id=session_id,
        question_id=question_id,
        answers=answers,
        skipped=skipped,
        project_id=session.project_id,
    ):
        if chunk.startswith("event: text_delta"):
            try:
                data_line = chunk.split("data: ", 1)[1].strip()
                data = json.loads(data_line)
                collected.append(data.get("content") or "")
            except Exception:
                pass
        elif chunk.startswith("event: agent_switch"):
            try:
                data_line = chunk.split("data: ", 1)[1].strip()
                data = json.loads(data_line)
                last_agent = data.get("agent_id") or last_agent
            except Exception:
                pass
        yield chunk

    reply = "".join(collected)
    if reply:
        await append_message(
            db, session, role="assistant", content=reply, agent_id=last_agent
        )


async def stream_analyze(
    db: AsyncSession,
    user: User,
    project_id: UUID,
    *,
    depth: str = "quick",
) -> AsyncIterator[str]:
    from backend.services.project_service import get_project_owned_by_user

    project = await get_project_owned_by_user(db, project_id, user.id)
    if not project:
        yield format_sse(
            "error",
            {"code": "FORBIDDEN", "message": "项目不存在或不属于当前用户"},
        )
        return

    # 临时会话
    session = AgentSession(
        user_id=user.id,
        title=f"分析 {project.name}",
        active_agent="scout" if depth == "quick" else "mentor",
        project_id=project_id,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    agent_id = "scout" if depth == "quick" else "mentor"
    prompt = (
        f"请{'快速' if depth == 'quick' else '深入'}分析项目 {project.name} ({project.url})。"
        f"描述: {project.description or '无'}。语言: {project.language or '未知'}。"
    )
    await append_message(db, session, role="user", content=prompt, agent_id="hub")

    hub = HubService(db)
    collected: list[str] = []
    async for chunk in hub.handle_direct_agent(
        user=user,
        session_id=session.id,
        agent_id=agent_id,
        message=prompt,
        project_id=project_id,
    ):
        if chunk.startswith("event: text_delta"):
            try:
                data_line = chunk.split("data: ", 1)[1].strip()
                collected.append(json.loads(data_line.split("\n")[0]).get("content") or "")
            except Exception:
                pass
        yield chunk

    reply = "".join(collected)
    if reply:
        await append_message(db, session, role="assistant", content=reply, agent_id=agent_id)


async def stream_import_assist(
    db: AsyncSession,
    user: User,
    message: str,
    context: dict[str, Any],
) -> AsyncIterator[str]:
    session = AgentSession(
        user_id=user.id,
        title="导入助手",
        active_agent="curator",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    ctx_text = json.dumps(context, ensure_ascii=False)[:3000]
    prompt = (
        f"你是导入场景的 Curator/Scout 协作助手。\n"
        f"导入上下文: {ctx_text}\n"
        f"用户消息: {message}\n"
        "帮助用户理解待导入仓库、建议分类与是否值得加入学习库。"
    )
    hub = HubService(db)
    # 先 curator 分类视角
    async for chunk in hub.handle_direct_agent(
        user=user,
        session_id=session.id,
        agent_id="curator",
        message=prompt,
    ):
        yield chunk


async def stream_graph_guide(
    db: AsyncSession,
    user: User,
    message: str,
    *,
    selected_node_id: str | None = None,
) -> AsyncIterator[str]:
    session = AgentSession(
        user_id=user.id,
        title="图谱向导",
        active_agent="atlas",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    prompt = message
    if selected_node_id:
        prompt = f"用户选中了图谱节点 project_id={selected_node_id}。\n{message}"

    hub = HubService(db)
    project_uuid = None
    if selected_node_id:
        try:
            project_uuid = UUID(selected_node_id)
        except ValueError:
            project_uuid = None

    async for chunk in hub.handle_direct_agent(
        user=user,
        session_id=session.id,
        agent_id="atlas",
        message=prompt,
        project_id=project_uuid,
    ):
        yield chunk


async def stream_trending_scout(
    db: AsyncSession,
    user: User,
    params: dict[str, Any],
) -> AsyncIterator[str]:
    session = AgentSession(
        user_id=user.id,
        title="Trending Scout",
        active_agent="scout",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    name = params.get("full_name") or params.get("name") or "unknown"
    prompt = (
        f"用 Scout 风格快速介绍 trending 仓库 {name}。\n"
        f"描述: {params.get('description') or '无'}\n"
        f"语言: {params.get('language') or '未知'} Stars: {params.get('stars') or 0}\n"
        f"URL: {params.get('url') or ''}\n"
        "说明是否值得加入用户学习库。"
    )
    hub = HubService(db)
    async for chunk in hub.handle_direct_agent(
        user=user,
        session_id=session.id,
        agent_id="scout",
        message=prompt,
    ):
        yield chunk


async def get_context_window(
    db: AsyncSession, user_id: UUID, session_id: UUID | None
) -> ContextWindowStatsOut:
    memory = MemoryService(db)
    total = 0
    system_tokens = 800  # 估计 system prompt
    tool_tokens = 400
    memory_tokens = 0
    model = "gpt-4o"
    limit = 128_000

    llm_cfg = await build_llm_config_from_user(db, user_id)
    if llm_cfg:
        model = llm_cfg.model
        limit = llm_cfg.max_context_tokens

    if session_id:
        session = await db.get(AgentSession, session_id)
        if session and session.user_id == user_id:
            msgs = await memory.list_recent_messages(session_id, limit=100)
            total = sum(memory.estimate_tokens(m.content or "") for m in msgs)
            long_mem = await memory.get_long_memory(user_id)
            memory_tokens = sum(
                memory.estimate_tokens(str(m.get("content", ""))) for m in long_mem
            )

    segments = [
        ContextWindowSegmentOut(label="System / Soul", tokens=system_tokens, kind="system"),
        ContextWindowSegmentOut(label="长期记忆", tokens=memory_tokens, kind="memory"),
        ContextWindowSegmentOut(label="工具定义", tokens=tool_tokens, kind="tools"),
        ContextWindowSegmentOut(label="对话消息", tokens=total, kind="messages"),
    ]
    input_tokens = system_tokens + memory_tokens + tool_tokens + total
    return ContextWindowStatsOut(
        session_id=str(session_id) if session_id else None,
        model=model,
        context_limit=limit,
        input_tokens=input_tokens,
        output_tokens=0,
        total_tokens=input_tokens,
        segments=segments,
    )
