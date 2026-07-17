"""依赖注入集成测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_missing_authorization_returns_401(client: AsyncClient):
    """未携带 Authorization 头且无 Cookie 访问受保护端点应返回 401。"""
    res = await client.get("/api/v1/auth/me")
    assert res.status_code == 401
    assert res.json()["detail"]["code"] == "UNAUTHORIZED"
    assert "认证" in res.json()["detail"]["message"] or "凭证" in res.json()["detail"]["message"]


@pytest.mark.asyncio
async def test_invalid_authorization_scheme_returns_401(client: AsyncClient):
    """Authorization scheme 非 Bearer 时应返回 401。"""
    res = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Basic xxx"},
    )
    assert res.status_code == 401
    assert res.json()["detail"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_jwt_sub_non_uuid_returns_401(client: AsyncClient):
    """JWT sub 非 UUID 时不应 500，应返回 401。"""
    from backend.core.security import create_access_token

    token = create_access_token({"sub": "not-a-uuid"})
    res = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 401
    assert res.json()["detail"]["code"] == "UNAUTHORIZED"
