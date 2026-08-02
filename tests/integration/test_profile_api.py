"""用户画像 API 集成测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_profile_get_and_patch(client: AsyncClient, auth_headers: dict):
    get_res = await client.get("/api/v1/user/profile", headers=auth_headers)
    assert get_res.status_code == 200
    assert "memory_items" in get_res.json()["data"]

    patch_res = await client.patch(
        "/api/v1/user/profile",
        headers=auth_headers,
        json={"history_summary": "测试摘要"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["data"]["history_summary"] == "测试摘要"


@pytest.mark.asyncio
async def test_clear_user_memory(client: AsyncClient, auth_headers: dict):
    """清除画像记忆后字段为空，会话仍可列出。"""
    await client.patch(
        "/api/v1/user/profile",
        headers=auth_headers,
        json={
            "history_summary": "应被清除",
            "tech_proficiency": {"Python": 3},
            "learning_preferences": {"pace": "slow"},
            "goals": [{"title": "学 Rust", "priority": 1, "status": "active"}],
            "memory_items": [
                {
                    "id": "m1",
                    "category": "preference",
                    "content": "喜欢简洁回答",
                    "created_at": "2026-01-01T00:00:00Z",
                }
            ],
        },
    )

    # 创建会话，确认清除记忆后仍在
    create_res = await client.post("/api/v1/agent/sessions", headers=auth_headers)
    assert create_res.status_code in (200, 201)
    session_id = create_res.json()["data"]["id"]

    clear_res = await client.post(
        "/api/v1/user/profile/clear-memory",
        headers=auth_headers,
    )
    assert clear_res.status_code == 200
    data = clear_res.json()["data"]
    assert data["history_summary"] == ""
    assert data["tech_proficiency"] == {}
    assert data["learning_preferences"] == {}
    assert data["goals"] == []
    assert data["memory_items"] == []

    list_res = await client.get("/api/v1/agent/sessions", headers=auth_headers)
    assert list_res.status_code == 200
    ids = [s["id"] for s in list_res.json()["data"]]
    assert session_id in ids
