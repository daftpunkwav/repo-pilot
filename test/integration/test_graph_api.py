"""图谱 API 集成测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_graph_empty(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/graph/", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["nodes"] == []
    assert data["edges"] == []


@pytest.mark.asyncio
async def test_graph_with_edges(client: AsyncClient, auth_headers: dict):
    for name, lang in [("a/b", "Go"), ("c/d", "Go")]:
        await client.post(
            "/api/v1/projects/",
            headers=auth_headers,
            json={"name": name, "url": f"https://github.com/{name}", "language": lang},
        )
    res = await client.get(
        "/api/v1/graph/", headers=auth_headers, params={"min_similarity": 0.5}
    )
    assert res.status_code == 200
    assert len(res.json()["data"]["edges"]) >= 1
