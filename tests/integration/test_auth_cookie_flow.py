"""认证 Cookie 集成 / 安全测试：浏览器主路径不依赖 Authorization 头"""
import pytest
from httpx import AsyncClient

from backend.core.auth_cookies import ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE


def _csrf(client: AsyncClient) -> dict[str, str]:
    tok = client.cookies.get(CSRF_COOKIE)
    return {"X-CSRF-Token": tok} if tok else {}


@pytest.mark.asyncio
async def test_register_sets_httponly_cookies(client: AsyncClient):
    res = await client.post(
        "/api/v1/auth/register",
        json={"username": "cookie_reg", "password": "demo1234"},
    )
    assert res.status_code == 200
    assert client.cookies.get(ACCESS_COOKIE)
    assert client.cookies.get(REFRESH_COOKIE)
    assert client.cookies.get(CSRF_COOKIE)
    # 浏览器路径：JSON 默认不含 token
    assert res.json()["data"].get("access_token") in (None, "")
    assert res.json()["data"].get("refresh_token") in (None, "")
    assert res.json()["data"]["user"]["username"] == "cookie_reg"


@pytest.mark.asyncio
async def test_me_with_cookie_only_no_authorization_header(client: AsyncClient):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"username": "cookie_me", "password": "demo1234"},
    )
    assert reg.status_code == 200
    me = await client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["data"]["username"] == "cookie_me"


@pytest.mark.asyncio
async def test_refresh_rotates_cookies_without_body(client: AsyncClient):
    await client.post(
        "/api/v1/auth/register",
        json={"username": "cookie_ref", "password": "demo1234"},
    )
    old_refresh = client.cookies.get(REFRESH_COOKIE)
    assert old_refresh

    res = await client.post("/api/v1/auth/refresh", json={}, headers=_csrf(client))
    assert res.status_code == 200
    new_refresh = client.cookies.get(REFRESH_COOKIE)
    assert new_refresh
    assert new_refresh != old_refresh

    me = await client.get("/api/v1/auth/me")
    assert me.status_code == 200


@pytest.mark.asyncio
async def test_logout_clears_cookies_and_revokes(client: AsyncClient):
    await client.post(
        "/api/v1/auth/register",
        json={"username": "cookie_out", "password": "demo1234"},
    )
    assert client.cookies.get(ACCESS_COOKIE)

    out = await client.post("/api/v1/auth/logout", json={}, headers=_csrf(client))
    assert out.status_code == 200

    me = await client.get("/api/v1/auth/me")
    assert me.status_code == 401


@pytest.mark.asyncio
async def test_bearer_header_still_works_alongside_cookies(client: AsyncClient):
    """双通道：Bearer 仍可用（不依赖 Cookie 会话）。"""
    reg = await client.post(
        "/api/v1/auth/register?include_tokens=true",
        json={"username": "cookie_bearer", "password": "demo1234"},
    )
    token = reg.json()["data"]["access_token"]
    client.cookies.clear()
    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 200


@pytest.mark.asyncio
async def test_password_change_clears_cookies(client: AsyncClient):
    reg = await client.post(
        "/api/v1/auth/register",
        json={"username": "cookie_pwd", "password": "demo1234"},
    )
    assert reg.status_code == 200
    assert client.cookies.get(ACCESS_COOKIE)

    res = await client.put(
        "/api/v1/auth/password",
        json={"old_password": "demo1234", "new_password": "newpass5678"},
        headers=_csrf(client),
    )
    assert res.status_code == 200

    me = await client.get("/api/v1/auth/me")
    assert me.status_code == 401


@pytest.mark.asyncio
async def test_cookie_csrf_required_for_mutating_cookie_session(client: AsyncClient):
    await client.post(
        "/api/v1/auth/register",
        json={"username": "csrf_chk", "password": "demo1234"},
    )
    # 有 Cookie 会话但无 CSRF → 业务写接口 403（auth 路径豁免）
    res = await client.post(
        "/api/v1/projects/",
        json={"name": "x/y", "url": "https://github.com/x/y"},
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_cookie_not_readable_as_non_httponly_flag_in_set_cookie(client: AsyncClient):
    """安全：access/refresh Set-Cookie 必须带 HttpOnly。"""
    login = await client.post(
        "/api/v1/auth/register",
        json={"username": "httponly_chk", "password": "demo1234"},
    )
    assert login.status_code == 200
    set_cookies = []
    if hasattr(login.headers, "get_list"):
        set_cookies = login.headers.get_list("set-cookie")
    else:
        set_cookies = [v for k, v in login.headers.multi_items() if k.lower() == "set-cookie"]
    auth_cookies = [c for c in set_cookies if "rp_access=" in c or "rp_refresh=" in c]
    assert auth_cookies, f"missing set-cookie: {set_cookies}"
    for c in auth_cookies:
        assert "httponly" in c.lower()
