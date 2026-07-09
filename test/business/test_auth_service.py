"""认证 service 业务逻辑测试"""
import pytest
from uuid import uuid4
from datetime import datetime

from backend.database import get_session_factory, init_db, reset_database
from backend.models.user import User
from backend.core.security import hash_password
from backend.services.auth_service import issue_tokens, user_to_out
from backend.config import get_settings
import os


@pytest.fixture
async def db_session(tmp_path):
    os.environ["DATABASE_URL"] = f"sqlite:///{tmp_path / 'auth.db'}"
    get_settings.cache_clear()
    reset_database()
    await init_db()
    factory = get_session_factory()
    async with factory() as session:
        user = User(username="authuser", password_hash=hash_password("demo1234"))
        session.add(user)
        await session.commit()
        await session.refresh(user)
        yield session, user


@pytest.mark.asyncio
async def test_issue_tokens_returns_refresh(db_session):
    session, user = db_session
    tokens = await issue_tokens(session, user)
    assert tokens.access_token
    assert tokens.refresh_token
    assert tokens.user.username == "authuser"


def test_user_to_out_github_bound_false():
    user = User(
        id=uuid4(),
        username="u",
        password_hash="x",
        github_accounts="[]",
        created_at=datetime.utcnow(),
    )
    out = user_to_out(user)
    assert out.github_bound is False
