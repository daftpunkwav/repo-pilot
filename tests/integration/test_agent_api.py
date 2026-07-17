"""Agent API 集成测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_agent_question_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/agent/question")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_agent_analyze_requires_auth(client: AsyncClient):
    res = await client.post("/api/v1/agent/analyze/00000000-0000-0000-0000-000000000000")
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_agent_analyze_forbidden_for_other_user(client: AsyncClient):
    # 注册用户 A 并创建一个项目
    a = await client.post(
        "/api/v1/auth/register",
        json={"username": "agent_user_a", "password": "demo1234"},
    )
    assert a.status_code == 200
    token_a = a.json()["data"]["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    create = await client.post(
        "/api/v1/projects/",
        headers=headers_a,
        json={"name": "foo/bar", "url": "https://github.com/foo/bar"},
    )
    assert create.status_code == 200
    project_id = create.json()["data"]["id"]

    # 注册用户 B 并尝试分析 A 的项目
    b = await client.post(
        "/api/v1/auth/register",
        json={"username": "agent_user_b", "password": "demo1234"},
    )
    assert b.status_code == 200
    token_b = b.json()["data"]["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    res = await client.post(f"/api/v1/agent/analyze/{project_id}", headers=headers_b)
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_agent_sessions_and_profiles(client: AsyncClient, auth_headers: dict):
    create = await client.post("/api/v1/agent/sessions", headers=auth_headers)
    assert create.status_code == 200
    sid = create.json()["data"]["id"]

    listing = await client.get("/api/v1/agent/sessions", headers=auth_headers)
    assert listing.status_code == 200
    assert len(listing.json()["data"]) >= 1

    detail = await client.get(f"/api/v1/agent/sessions/{sid}", headers=auth_headers)
    assert detail.status_code == 200

    profiles = await client.get("/api/v1/agent/profiles", headers=auth_headers)
    assert profiles.status_code == 200
    assert len(profiles.json()["data"]) >= 6

    perms = await client.get("/api/v1/agent/permissions", headers=auth_headers)
    assert perms.status_code == 200

    patched = await client.patch(
        "/api/v1/agent/permissions",
        headers=auth_headers,
        json={"allow_github_api": False, "max_iterations": 5},
    )
    assert patched.status_code == 200
    pdata = patched.json()["data"]
    assert pdata["allow_github_api"] is False
    assert pdata["max_iterations"] == 5
    # 未传字段保持默认
    assert pdata["allow_web_search"] is True

    again = await client.get("/api/v1/agent/permissions", headers=auth_headers)
    assert again.json()["data"]["allow_github_api"] is False

    bad = await client.patch(
        "/api/v1/agent/permissions",
        headers=auth_headers,
        json={"max_iterations": 0},
    )
    assert bad.status_code == 422

    ctx = await client.get(
        "/api/v1/agent/context-window",
        headers=auth_headers,
        params={"session_id": sid},
    )
    assert ctx.status_code == 200

    patch = await client.patch(
        f"/api/v1/agent/sessions/{sid}",
        headers=auth_headers,
        json={"active_agent": "scout", "title": "Scout 会话"},
    )
    assert patch.status_code == 200
    assert patch.json()["data"]["agent"] == "scout"
    assert patch.json()["data"]["title"] == "Scout 会话"

    bad_agent = await client.patch(
        f"/api/v1/agent/sessions/{sid}",
        headers=auth_headers,
        json={"active_agent": "not-an-agent"},
    )
    assert bad_agent.status_code == 422

    delete = await client.delete(f"/api/v1/agent/sessions/{sid}", headers=auth_headers)
    assert delete.status_code == 200
