"""单测：跨 worker 会话流取消信号（§4.1.1 / S-05）。"""

from __future__ import annotations

import datetime
import secrets
import sys
import uuid
from pathlib import Path

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


# 让测试可通过 backend.* 与 agent_core.* 解析
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "services" / "api"))
sys.path.insert(0, str(ROOT / "services" / "agent"))
sys.path.insert(0, str(ROOT / "services" / "agent" / "agent_core"))


@pytest_asyncio.fixture
async def db() -> AsyncSession:
    """每用例独立 in-memory SQLite + Base.metadata.create_all。"""
    from backend.database import Base
    import backend.models  # noqa: F401

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    maker = async_sessionmaker(engine, expire_on_commit=False)
    async with maker() as session:
        yield session
    await engine.dispose()


async def _create_session(db: AsyncSession) -> uuid.UUID:
    from backend.models.user import User
    from backend.models.agent import AgentSession

    user_id = uuid.uuid4()
    db.add(User(
        id=user_id,
        username="streamcancel_test_" + secrets.token_hex(4),
        password_hash="x",
        email=None,
        avatar_url=None,
        github_accounts="[]",
        agent_permissions="{}",
        settings_json="{}",
        token_version=0,
        created_at=datetime.datetime.utcnow(),
        updated_at=None,
    ))
    await db.flush()
    sid = uuid.uuid4()
    db.add(AgentSession(
        id=sid,
        user_id=user_id,
        title="t",
        project_id=None,
        source="chat",
        active_agent="hub",
        status="active",
        created_at=datetime.datetime.utcnow(),
        updated_at=None,
    ))
    await db.commit()
    return sid


@pytest.mark.asyncio
async def test_begin_returns_token(db: AsyncSession) -> None:
    from backend.core import stream_cancel

    sid = await _create_session(db)
    token1 = await stream_cancel.begin(db, sid)
    assert token1 and isinstance(token1, str)


@pytest.mark.asyncio
async def test_poll_returns_false_when_token_matches(db: AsyncSession) -> None:
    from backend.core import stream_cancel

    sid = await _create_session(db)
    token = await stream_cancel.begin(db, sid)
    assert await stream_cancel.poll(db, sid, token) is False


@pytest.mark.asyncio
async def test_begin_overrides_previous_token(db: AsyncSession) -> None:
    from backend.core import stream_cancel

    sid = await _create_session(db)
    old = await stream_cancel.begin(db, sid)
    new = await stream_cancel.begin(db, sid)
    assert old != new
    # old token 已不再匹配
    assert await stream_cancel.poll(db, sid, old) is True
    # new token 仍为自身
    assert await stream_cancel.poll(db, sid, new) is False


@pytest.mark.asyncio
async def test_clear_only_removes_own_token(db: AsyncSession) -> None:
    from backend.core import stream_cancel

    sid = await _create_session(db)
    token = await stream_cancel.begin(db, sid)
    # 用错 token 调 clear：不应删除
    await stream_cancel.clear(db, sid, "bogus_token_xyz")
    # 自己 token 仍有效
    assert await stream_cancel.poll(db, sid, token) is False
    # 正确 clear 后可以重新 begin
    await stream_cancel.clear(db, sid, token)
    again = await stream_cancel.begin(db, sid)
    assert again and again != token