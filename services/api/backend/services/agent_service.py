"""Agent 会话与对话业务逻辑"""
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.agents.hub import route_message
from backend.models.agent import AgentMessage, AgentSession
from backend.schemas.agent import (
    AgentMessageOut,
    AgentSessionDetailOut,
    AgentSessionOut,
    ContextWindowSegmentOut,
    ContextWindowStatsOut,
)
from backend.services.sse_stream import format_sse


def session_to_out(session: AgentSession) -> AgentSessionOut:
    return AgentSessionOut(
        id=session.id,
        title=session.title or "新对话",
        agent=session.active_agent or "hub",
        updated_at=(session.updated_at or session.created_at).isoformat() + "Z",
        unread=False,
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


async def create_session(db: AsyncSession, user_id: UUID) -> AgentSessionOut:
    session = AgentSession(user_id=user_id, title="新对话", active_agent="hub")
    db.add(session)
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
) -> AgentMessage:
    msg = AgentMessage(
        session_id=session.id,
        role=role,
        agent_id=agent_id or session.active_agent or "hub",
        content=content,
    )
    db.add(msg)
    session.updated_at = datetime.utcnow()
    if role == "user" and session.title == "新对话":
        session.title = content[:32] + ("…" if len(content) > 32 else "")
    await db.commit()
    await db.refresh(msg)
    return msg


async def stream_chat(
    db: AsyncSession,
    user_id: UUID,
    session_id: UUID,
    message: str,
):
    session = await db.get(AgentSession, session_id)
    if not session or session.user_id != user_id:
        yield format_sse("error", {"code": "NOT_FOUND", "message": "会话不存在"})
        return

    await append_message(db, session, role="user", content=message)
    reply = await route_message(message, session_id=str(session_id))

    for ch in reply:
        yield format_sse("text_delta", {"content": ch})

    await append_message(
        db,
        session,
        role="assistant",
        content=reply,
        agent_id=session.active_agent or "hub",
    )
    yield format_sse("done", {"usage": {"tokens": len(reply)}, "iterations": 1})


async def get_context_window(
    db: AsyncSession, user_id: UUID, session_id: UUID | None
) -> ContextWindowStatsOut:
    total = 0
    if session_id:
        session = await db.get(AgentSession, session_id)
        if session and session.user_id == user_id:
            msgs = (
                await db.execute(
                    select(AgentMessage).where(AgentMessage.session_id == session_id)
                )
            ).scalars().all()
            total = sum(len(m.content or "") for m in msgs)
    segments = [
        ContextWindowSegmentOut(label="对话消息", tokens=total, kind="messages"),
    ]
    return ContextWindowStatsOut(
        session_id=str(session_id) if session_id else None,
        model="gpt-4o",
        context_limit=128_000,
        input_tokens=total,
        output_tokens=0,
        total_tokens=total,
        segments=segments,
    )
