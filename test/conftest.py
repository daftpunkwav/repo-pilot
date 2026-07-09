"""
全局 pytest 配置与 fixtures
"""
from __future__ import annotations

import os
from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

# 必须在导入 backend 之前设置
os.environ.setdefault("SECRET_KEY", "pytest-secret-key-do-not-use-in-prod")
os.environ.setdefault("DEBUG", "false")


@pytest.fixture
async def client(tmp_path) -> AsyncIterator[AsyncClient]:
    """每个测试用例使用独立 SQLite 文件。"""
    from backend.config import get_settings
    from backend.database import get_session_factory, init_db, reset_database

    db_path = tmp_path / "pytest.db"
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path}"
    get_settings.cache_clear()
    reset_database()

    # 延迟导入 app，确保数据库配置生效
    from backend.main import app
    from backend.services.seed_service import seed_preset_categories

    await init_db()
    factory = get_session_factory()
    async with factory() as session:
        await seed_preset_categories(session)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    """注册并返回 Bearer 头。"""
    res = await client.post(
        "/api/v1/auth/register",
        json={"username": "testuser", "password": "demo1234"},
    )
    assert res.status_code == 200, res.text
    token = res.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}
