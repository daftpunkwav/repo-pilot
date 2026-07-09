"""设置 API 集成测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_settings_roundtrip(client: AsyncClient, auth_headers: dict):
    get_res = await client.get("/api/v1/settings/", headers=auth_headers)
    assert get_res.status_code == 200
    data = get_res.json()["data"]
    assert isinstance(data["agent_llm_configs"], list)
    assert len(data["agent_llm_configs"]) >= 6

    put_res = await client.put(
        "/api/v1/settings/",
        headers=auth_headers,
        json={"theme": "dark", "font_scale": 1.1},
    )
    assert put_res.status_code == 200
    assert put_res.json()["data"]["theme"] == "dark"
    assert put_res.json()["data"]["font_scale"] == 1.1


@pytest.mark.asyncio
async def test_settings_rejects_localhost_api_base(client: AsyncClient, auth_headers: dict):
    res = await client.put(
        "/api/v1/settings/",
        headers=auth_headers,
        json={"llm_api_base": "https://localhost:11434/v1"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_settings_rejects_private_ip_api_base(client: AsyncClient, auth_headers: dict):
    res = await client.put(
        "/api/v1/settings/",
        headers=auth_headers,
        json={"llm_api_base": "https://192.168.1.1/v1"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_settings_rejects_http_api_base(client: AsyncClient, auth_headers: dict):
    res = await client.put(
        "/api/v1/settings/",
        headers=auth_headers,
        json={"llm_api_base": "http://api.openai.com/v1"},
    )
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_settings_api_key_too_long_returns_422(client: AsyncClient, auth_headers: dict):
    res = await client.put(
        "/api/v1/settings/",
        headers=auth_headers,
        json={"llm_api_key": "x" * 1025},
    )
    assert res.status_code == 422
