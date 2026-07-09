"""项目 service 业务逻辑测试"""
import pytest
from uuid import uuid4

from backend.database import get_session_factory, init_db, reset_database
from backend.models.user import User
from backend.core.security import hash_password
from backend.schemas.project import ImportRepoItem
from backend.services.project_service import import_repos, project_stats
from backend.config import get_settings
import os


@pytest.fixture
async def db_session(tmp_path):
    os.environ["DATABASE_URL"] = f"sqlite:///{tmp_path / 'biz.db'}"
    get_settings.cache_clear()
    reset_database()
    await init_db()
    factory = get_session_factory()
    async with factory() as session:
        user = User(username="bizuser", password_hash=hash_password("demo1234"))
        session.add(user)
        await session.commit()
        await session.refresh(user)
        yield session, user


@pytest.mark.asyncio
async def test_import_repos_dedup(db_session):
    session, user = db_session
    repos = [
        ImportRepoItem(owner="a", repo="b", url="https://github.com/a/b"),
        ImportRepoItem(owner="a", repo="b", url="https://github.com/a/b"),
    ]
    result = await import_repos(session, user.id, repos)
    assert result.succeeded == 1
    assert result.failed == 1


@pytest.mark.asyncio
async def test_project_stats_empty(db_session):
    session, user = db_session
    stats = await project_stats(session, user.id)
    assert stats.total == 0
    assert stats.by_progress == {}
