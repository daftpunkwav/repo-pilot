"""认证 API 集成测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_login_me_flow(client: AsyncClient):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"username": "flowuser", "password": "demo1234"},
    )
    assert reg.status_code == 200
    data = reg.json()["data"]
    assert data["access_token"]
    assert data["refresh_token"]
    assert data["user"]["username"] == "flowuser"

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {data['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["data"]["username"] == "flowuser"


@pytest.mark.asyncio
async def test_login_invalid_credentials(client: AsyncClient):
    res = await client.post(
        "/api/v1/auth/login",
        json={"username": "nobody", "password": "demo1234"},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"username": "refreshuser", "password": "demo1234"},
    )
    refresh = reg.json()["data"]["refresh_token"]
    res = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["access_token"]
    assert data["refresh_token"]
    assert data["token_type"] == "bearer"

    # 新 access token 可正常访问受保护端点
    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {data['access_token']}"},
    )
    assert me.status_code == 200

    # 旧 refresh token 再次使用应失败（重放检测）
    replay = await client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert replay.status_code == 401
