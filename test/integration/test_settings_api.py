"""设置 API 集成测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_settings_roundtrip(client: AsyncClient, auth_headers: dict):
    get_res = await client.get("/api/v1/settings/", headers=auth_headers)
    assert get_res.status_code == 200
    assert "data" in get_res.json()
    assert get_res.json()["data"]["theme"] in ("dark", "light")

    put_res = await client.put(
        "/api/v1/settings/",
        headers=auth_headers,
        json={"theme": "dark", "font_scale": 1.1},
    )
    assert put_res.status_code == 200
    assert put_res.json()["data"]["theme"] == "dark"
    assert put_res.json()["data"]["font_scale"] == 1.1
