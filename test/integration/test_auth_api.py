"""认证 API 集成测试"""
import pytest
from httpx import AsyncClient

from backend.core.limiter import limiter


@pytest.fixture
def rate_limit_enabled():
    """临时开启限流并清空存储，测试结束后恢复。"""
    original = limiter.enabled
    limiter.enabled = True
    limiter.reset()
    yield
    limiter.enabled = original
    limiter.reset()


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


@pytest.mark.asyncio
async def test_update_password_revokes_refresh_tokens(client: AsyncClient):
    # 用户注册并获取 refresh token
    reg = await client.post(
        "/api/v1/auth/register",
        json={"username": "pwdchangeuser", "password": "demo1234"},
    )
    assert reg.status_code == 200
    tokens = reg.json()["data"]
    access_token = tokens["access_token"]
    old_refresh = tokens["refresh_token"]

    # 修改密码
    res = await client.put(
        "/api/v1/auth/password",
        json={"old_password": "demo1234", "new_password": "newpass5678"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert res.status_code == 200

    # 旧 refresh token 应失效，无法刷新
    refresh_res = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": old_refresh}
    )
    assert refresh_res.status_code == 401


@pytest.mark.asyncio
async def test_register_rate_limit(client: AsyncClient, rate_limit_enabled):
    """register 按 IP 限流 3/小时，第 4 次应返回 429。"""
    for i in range(3):
        res = await client.post(
            "/api/v1/auth/register",
            json={"username": f"ratelimit_reg_{i}", "password": "demo1234"},
        )
        assert res.status_code == 200, res.text

    res = await client.post(
        "/api/v1/auth/register",
        json={"username": "ratelimit_reg_blocked", "password": "demo1234"},
    )
    assert res.status_code == 429


@pytest.mark.asyncio
async def test_login_rate_limit(client: AsyncClient, rate_limit_enabled):
    """login 按 IP + 用户名限流 5/分钟，第 6 次应返回 429。"""
    reg = await client.post(
        "/api/v1/auth/register",
        json={"username": "ratelimit_login", "password": "demo1234"},
    )
    assert reg.status_code == 200

    for i in range(5):
        res = await client.post(
            "/api/v1/auth/login",
            json={"username": "ratelimit_login", "password": "demo1234"},
        )
        assert res.status_code == 200, f"第 {i + 1} 次登录失败: {res.text}"

    res = await client.post(
        "/api/v1/auth/login",
        json={"username": "ratelimit_login", "password": "demo1234"},
    )
    assert res.status_code == 429


@pytest.mark.asyncio
async def test_refresh_rate_limit(client: AsyncClient, rate_limit_enabled):
    """refresh 按 IP 限流 20/分钟，第 21 次应返回 429。"""
    reg = await client.post(
        "/api/v1/auth/register",
        json={"username": "ratelimit_refresh", "password": "demo1234"},
    )
    assert reg.status_code == 200
    refresh_token = reg.json()["data"]["refresh_token"]

    for i in range(20):
        res = await client.post(
            "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
        )
        assert res.status_code == 200, f"第 {i + 1} 次刷新失败: {res.text}"
        refresh_token = res.json()["data"]["refresh_token"]

    res = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert res.status_code == 429
