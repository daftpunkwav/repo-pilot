"""Agent API 集成测试"""
import pytest
from httpx import AsyncClient


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

    ctx = await client.get(
        "/api/v1/agent/context-window",
        headers=auth_headers,
        params={"session_id": sid},
    )
    assert ctx.status_code == 200

    delete = await client.delete(f"/api/v1/agent/sessions/{sid}", headers=auth_headers)
    assert delete.status_code == 200
