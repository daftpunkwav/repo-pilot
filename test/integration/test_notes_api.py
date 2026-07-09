"""笔记 API 集成测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_notes_flow(client: AsyncClient, auth_headers: dict):
    project = await client.post(
        "/api/v1/projects/",
        headers=auth_headers,
        json={"name": "n/p", "url": "https://github.com/n/p"},
    )
    pid = project.json()["data"]["id"]

    create = await client.post(
        f"/api/v1/notes/projects/{pid}/notes",
        headers=auth_headers,
        json={"title": "笔记1", "content": "hello"},
    )
    assert create.status_code == 200
    note_id = create.json()["data"]["id"]

    listed = await client.get(
        f"/api/v1/notes/projects/{pid}/notes", headers=auth_headers
    )
    assert listed.status_code == 200
    assert len(listed.json()["data"]) == 1

    all_notes = await client.get("/api/v1/notes/", headers=auth_headers)
    assert all_notes.status_code == 200
    assert len(all_notes.json()["data"]) >= 1

    updated = await client.put(
        f"/api/v1/notes/{note_id}",
        headers=auth_headers,
        json={"title": "更新"},
    )
    assert updated.status_code == 200
    assert updated.json()["data"]["title"] == "更新"
