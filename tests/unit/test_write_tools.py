"""Agent 写库工具：笔记 / 分类 / 标签 / 进度"""
from __future__ import annotations

import os
from types import SimpleNamespace
from uuid import uuid4

import pytest

from backend.config import get_settings
from backend.core.security import hash_password
from backend.database import get_session_factory, init_db, reset_database
from backend.models.project import Project
from backend.models.user import User
from backend.tools.builtin import (
    create_note_tool,
    ensure_tools_loaded,
    set_project_category,
    set_project_tags_tool,
    update_project_progress,
)
from backend.tools.registry import global_registry
from backend.agents.registry import AGENT_DEFINITIONS


@pytest.fixture
async def tool_ctx(tmp_path):
    os.environ["DATABASE_URL"] = f"sqlite:///{tmp_path / 'write_tools.db'}"
    get_settings.cache_clear()
    reset_database()
    await init_db()
    factory = get_session_factory()
    async with factory() as session:
        user = User(username=f"u_{uuid4().hex[:8]}", password_hash=hash_password("demo1234"))
        session.add(user)
        await session.flush()
        project = Project(
            user_id=user.id,
            name="owner/demo",
            url="https://github.com/owner/demo",
            source="github",
            progress="none",
        )
        session.add(project)
        await session.commit()
        await session.refresh(user)
        await session.refresh(project)
        ctx = SimpleNamespace(
            db=session,
            user_id=user.id,
            session_id=uuid4(),
            agent_id="scribe",
            permissions={
                "allow_note_write": True,
                "allow_project_write": True,
            },
            memory=None,
            extra={},
        )
        yield ctx, project


@pytest.mark.asyncio
async def test_create_note_persists(tool_ctx):
    ctx, project = tool_ctx
    ctx.agent_id = "scribe"
    result = await create_note_tool(
        context=ctx,
        project_id=str(project.id),
        title="对比学习笔记",
        content="## 要点\n\n- a\n- b\n",
        compare_project_ids=[],
    )
    assert result.get("ok") is True
    assert result.get("__action__") == "note_created"
    assert result["resource"]["title"] == "对比学习笔记"
    note_id = result["resource"]["id"]

    from backend.models.note import Note
    from uuid import UUID

    note = await ctx.db.get(Note, UUID(note_id))
    assert note is not None
    assert note.user_id == ctx.user_id
    assert "要点" in (note.content or "")


@pytest.mark.asyncio
async def test_set_category_and_tags_and_progress(tool_ctx):
    ctx, project = tool_ctx
    ctx.agent_id = "curator"

    cat = await set_project_category(
        context=ctx,
        project_id=str(project.id),
        category_name="游戏引擎",
    )
    assert cat.get("__action__") == "category_applied"
    assert cat["resource"]["category_name"] == "游戏引擎"

    tags = await set_project_tags_tool(
        context=ctx,
        project_id=str(project.id),
        tag_names=["引擎", "Godot"],
        mode="replace",
    )
    assert tags.get("__action__") == "tags_applied"
    assert len(tags["resource"]["tags"]) == 2

    prog = await update_project_progress(
        context=ctx,
        project_id=str(project.id),
        progress="mastered",
    )
    assert prog.get("__action__") == "progress_updated"
    await ctx.db.refresh(project)
    assert project.progress == "mastered"
    assert project.category_id is not None


@pytest.mark.asyncio
async def test_write_tools_permission_blocked(tool_ctx):
    ctx, project = tool_ctx
    ensure_tools_loaded()
    ctx.agent_id = "scribe"
    ctx.permissions = {"allow_note_write": False}
    result = await global_registry.execute(
        "create_note",
        {
            "project_id": str(project.id),
            "title": "x",
            "content": "y",
        },
        ctx,
    )
    assert "error" in result
    assert "allow_note_write" in result["error"]


def test_scribe_curator_whitelist_includes_write_tools():
    assert "create_note" in AGENT_DEFINITIONS["scribe"].tools
    assert "update_note" in AGENT_DEFINITIONS["scribe"].tools
    assert "set_project_category" in AGENT_DEFINITIONS["curator"].tools
    assert "set_project_tags" in AGENT_DEFINITIONS["curator"].tools
    assert "import_github_repos" in AGENT_DEFINITIONS["curator"].tools
    assert "update_project_progress" in AGENT_DEFINITIONS["navigator"].tools
