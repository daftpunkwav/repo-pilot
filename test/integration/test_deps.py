"""依赖注入集成测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_missing_authorization_returns_401(client: AsyncClient):
    """未携带 Authorization 头访问受保护端点应返回 401。"""
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 401
    assert res.json()["detail"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_invalid_authorization_scheme_returns_401(client: AsyncClient):
    """Authorization scheme 非 Bearer 时应返回 401。"""
    res = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Basic xxx"},
    )
    assert res.status_code == 401
    assert res.json()["detail"]["code"] == "UNAUTHORIZED"
