"""项目 API 集成测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_project_crud(client: AsyncClient, auth_headers: dict):
    create = await client.post(
        "/api/v1/projects/",
        headers=auth_headers,
        json={
            "name": "foo/bar",
            "url": "https://github.com/foo/bar",
            "language": "TypeScript",
        },
    )
    assert create.status_code == 200
    project = create.json()["data"]
    pid = project["id"]
    assert project["name"] == "foo/bar"

    listing = await client.get("/api/v1/projects/", headers=auth_headers)
    assert listing.status_code == 200
    body = listing.json()
    assert body["data"]["total"] >= 1
    assert len(body["data"]["items"]) >= 1

    got = await client.get(f"/api/v1/projects/{pid}", headers=auth_headers)
    assert got.status_code == 200

    prog = await client.put(
        f"/api/v1/projects/{pid}/progress",
        headers=auth_headers,
        params={"progress": "learning"},
    )
    assert prog.status_code == 200
    assert prog.json()["data"]["progress"] == "learning"

    delete = await client.delete(f"/api/v1/projects/{pid}", headers=auth_headers)
    assert delete.status_code == 200


@pytest.mark.asyncio
async def test_import_projects(client: AsyncClient, auth_headers: dict):
    res = await client.post(
        "/api/v1/projects/import",
        headers=auth_headers,
        json={
            "repos": [
                {"owner": "a", "repo": "b", "url": "https://github.com/a/b"},
            ]
        },
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["succeeded"] == 1


@pytest.mark.asyncio
async def test_project_stats(client: AsyncClient, auth_headers: dict):
    res = await client.get("/api/v1/projects/stats", headers=auth_headers)
    assert res.status_code == 200
    assert "total" in res.json()["data"]
