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
