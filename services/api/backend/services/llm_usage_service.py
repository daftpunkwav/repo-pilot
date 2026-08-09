"""LLM 用量记录与聚合。"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.llm_usage import LlmUsageEvent

logger = logging.getLogger(__name__)


async def record_usage(
    db: AsyncSession,
    *,
    model: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    total_tokens: int = 0,
    provider: str = "",
    session_id: str | None = None,
    agent_id: str | None = None,
    meta: dict[str, Any] | None = None,
) -> None:
    """写入用量事件；调用方应吞掉异常以免影响主路径。"""
    total = total_tokens or (prompt_tokens + completion_tokens)
    ev = LlmUsageEvent(
        id=uuid4(),
        created_at=datetime.utcnow(),
        model=(model or "")[:128],
        provider=(provider or "")[:64],
        session_id=(session_id or None),
        agent_id=(agent_id or None),
        prompt_tokens=int(prompt_tokens or 0),
        completion_tokens=int(completion_tokens or 0),
        total_tokens=int(total),
        meta_json=json.dumps(meta, ensure_ascii=False) if meta else None,
    )
    db.add(ev)
    await db.commit()


def record_usage_fire_and_forget(**kwargs: Any) -> None:
    """同步上下文尽力落库（Agent LLM 回调）。"""
    try:
        import asyncio

        from backend.database import get_session_factory

        async def _run() -> None:
            factory = get_session_factory()
            async with factory() as db:
                await record_usage(db, **kwargs)

        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_run())
        except RuntimeError:
            asyncio.run(_run())
    except Exception:
        logger.debug("LLM 用量写入跳过", exc_info=True)


async def usage_summary(db: AsyncSession, *, days: int = 30) -> dict[str, Any]:
    since = datetime.utcnow() - timedelta(days=max(1, days))
    q = await db.execute(
        select(
            LlmUsageEvent.model,
            func.sum(LlmUsageEvent.prompt_tokens),
            func.sum(LlmUsageEvent.completion_tokens),
            func.sum(LlmUsageEvent.total_tokens),
            func.count(),
        )
        .where(LlmUsageEvent.created_at >= since)
        .group_by(LlmUsageEvent.model)
        .order_by(func.sum(LlmUsageEvent.total_tokens).desc())
    )
    by_model = [
        {
            "model": row[0] or "(unknown)",
            "prompt_tokens": int(row[1] or 0),
            "completion_tokens": int(row[2] or 0),
            "total_tokens": int(row[3] or 0),
            "calls": int(row[4] or 0),
        }
        for row in q.all()
    ]

    day_q = await db.execute(
        select(
            func.date(LlmUsageEvent.created_at),
            func.sum(LlmUsageEvent.total_tokens),
            func.count(),
        )
        .where(LlmUsageEvent.created_at >= since)
        .group_by(func.date(LlmUsageEvent.created_at))
        .order_by(func.date(LlmUsageEvent.created_at))
    )
    by_day = [
        {
            "date": str(row[0]),
            "total_tokens": int(row[1] or 0),
            "calls": int(row[2] or 0),
        }
        for row in day_q.all()
    ]

    recent = await db.execute(
        select(LlmUsageEvent)
        .order_by(LlmUsageEvent.created_at.desc())
        .limit(50)
    )
    recent_items = [
        {
            "id": str(e.id),
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "model": e.model,
            "provider": e.provider,
            "session_id": e.session_id,
            "agent_id": e.agent_id,
            "prompt_tokens": e.prompt_tokens,
            "completion_tokens": e.completion_tokens,
            "total_tokens": e.total_tokens,
        }
        for e in recent.scalars().all()
    ]

    totals = {
        "prompt_tokens": sum(x["prompt_tokens"] for x in by_model),
        "completion_tokens": sum(x["completion_tokens"] for x in by_model),
        "total_tokens": sum(x["total_tokens"] for x in by_model),
        "calls": sum(x["calls"] for x in by_model),
    }
    return {
        "days": days,
        "totals": totals,
        "by_model": by_model,
        "by_day": by_day,
        "recent": recent_items,
    }
