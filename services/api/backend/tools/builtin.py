"""内置 Agent 工具实现"""
from __future__ import annotations

import json
import re
from typing import Any
from uuid import UUID

from sqlalchemy import or_, select

from backend.models.category import Category
from backend.models.note import Note
from backend.models.project import Project, Tag
from backend.tools.registry import tool


def _uid(context) -> UUID:
    return context.user_id


@tool(
    name="query_user_projects",
    description="查询用户项目库。支持按名称、分类、语言、学习进度筛选。",
    parameters={
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "搜索关键词"},
            "language": {"type": "string"},
            "progress": {
                "type": "string",
                "enum": ["none", "learning", "learned", "mastered"],
            },
            "limit": {"type": "integer", "default": 20},
        },
    },
    allowed_agents=["scout", "mentor", "navigator", "curator", "scribe", "hub", "atlas"],
    timeout_ms=10_000,
)
async def query_user_projects(
    context=None,
    query: str = "",
    language: str = "",
    progress: str = "",
    limit: int = 20,
    **kw,
):
    db = context.db
    stmt = select(Project).where(Project.user_id == _uid(context))
    if query:
        like = f"%{query}%"
        stmt = stmt.where(
            or_(Project.name.ilike(like), Project.description.ilike(like))
        )
    if language:
        stmt = stmt.where(Project.language == language)
    if progress:
        stmt = stmt.where(Project.progress == progress)
    stmt = stmt.limit(min(limit or 20, 50))
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "count": len(rows),
        "projects": [
            {
                "id": str(p.id),
                "name": p.name,
                "url": p.url,
                "language": p.language,
                "stars": p.stars,
                "progress": p.progress,
                "description": (p.description or "")[:200],
                "category_id": str(p.category_id) if p.category_id else None,
            }
            for p in rows
        ],
    }


@tool(
    name="get_project_detail",
    description="获取单个项目的详细信息。",
    parameters={
        "type": "object",
        "properties": {"project_id": {"type": "string"}},
        "required": ["project_id"],
    },
    allowed_agents=["scout", "mentor", "navigator", "curator", "scribe", "hub", "atlas"],
)
async def get_project_detail(project_id: str, context=None, **kw):
    try:
        pid = UUID(project_id)
    except ValueError:
        return {"error": "无效 project_id"}
    p = await context.db.get(Project, pid)
    if not p or p.user_id != _uid(context):
        return {"error": "项目不存在"}
    return {
        "id": str(p.id),
        "name": p.name,
        "url": p.url,
        "language": p.language,
        "stars": p.stars,
        "progress": p.progress,
        "description": p.description,
        "note": p.note,
        "source": p.source,
        "category_id": str(p.category_id) if p.category_id else None,
    }


@tool(
    name="fetch_github_repo",
    description="通过 GitHub API 获取公开仓库元数据（owner/repo）。",
    parameters={
        "type": "object",
        "properties": {
            "owner": {"type": "string"},
            "repo": {"type": "string"},
            "full_name": {
                "type": "string",
                "description": "形如 owner/repo，可替代 owner+repo",
            },
        },
    },
    allowed_agents=["scout", "mentor", "curator", "hub", "navigator"],
    timeout_ms=15_000,
)
async def fetch_github_repo(
    context=None,
    owner: str = "",
    repo: str = "",
    full_name: str = "",
    **kw,
):
    if full_name and "/" in full_name:
        owner, repo = full_name.split("/", 1)
    if not owner or not repo:
        # 尝试从当前项目 URL 解析
        if context.project and context.project.url:
            m = re.search(r"github\.com/([^/]+)/([^/#?]+)", context.project.url)
            if m:
                owner, repo = m.group(1), m.group(2).removesuffix(".git")
    if not owner or not repo:
        return {"error": "需要 owner/repo"}
    from backend.services.github_client import fetch_repo_info

    return await fetch_repo_info(owner, repo)


@tool(
    name="fetch_readme",
    description="获取 GitHub 仓库 README 文本（截断）。",
    parameters={
        "type": "object",
        "properties": {
            "owner": {"type": "string"},
            "repo": {"type": "string"},
            "full_name": {"type": "string"},
            "max_chars": {"type": "integer", "default": 6000},
        },
    },
    allowed_agents=["scout", "mentor", "scribe", "curator"],
    timeout_ms=15_000,
)
async def fetch_readme(
    context=None,
    owner: str = "",
    repo: str = "",
    full_name: str = "",
    max_chars: int = 6000,
    **kw,
):
    if full_name and "/" in full_name:
        owner, repo = full_name.split("/", 1)
    if (not owner or not repo) and context.project and context.project.url:
        m = re.search(r"github\.com/([^/]+)/([^/#?]+)", context.project.url)
        if m:
            owner, repo = m.group(1), m.group(2).removesuffix(".git")
    if not owner or not repo:
        return {"error": "需要 owner/repo"}
    from backend.services.github_client import fetch_readme_text

    text = await fetch_readme_text(owner, repo)
    if text is None:
        return {"error": "无法获取 README", "owner": owner, "repo": repo}
    return {
        "owner": owner,
        "repo": repo,
        "readme": text[: max_chars or 6000],
        "truncated": len(text) > (max_chars or 6000),
    }


@tool(
    name="query_knowledge_graph",
    description="查询用户项目知识图谱：相似项目、关联边。",
    parameters={
        "type": "object",
        "properties": {
            "project_id": {"type": "string", "description": "中心项目，可选"},
            "min_similarity": {"type": "number", "default": 0.3},
            "limit": {"type": "integer", "default": 20},
        },
    },
    allowed_agents=["scout", "mentor", "navigator", "scribe", "atlas", "hub"],
)
async def query_knowledge_graph(
    context=None,
    project_id: str = "",
    min_similarity: float = 0.3,
    limit: int = 20,
    **kw,
):
    from backend.services.graph_service import build_graph

    graph = await build_graph(
        context.db,
        _uid(context),
        min_similarity=min_similarity,
        max_edges=limit or 20,
    )
    if project_id:
        edges = [
            e
            for e in graph["edges"]
            if e["source"] == project_id or e["target"] == project_id
        ]
        node_ids = {project_id}
        for e in edges:
            node_ids.add(e["source"])
            node_ids.add(e["target"])
        nodes = [n for n in graph["nodes"] if n["id"] in node_ids]
        return {"nodes": nodes, "edges": edges}
    return {
        "nodes": graph["nodes"][:50],
        "edges": graph["edges"][: limit or 20],
    }


@tool(
    name="list_categories",
    description="列出用户的项目分类。",
    parameters={"type": "object", "properties": {}},
    allowed_agents=["curator", "hub", "navigator", "scout"],
)
async def list_categories(context=None, **kw):
    result = await context.db.execute(
        select(Category).where(
            (Category.user_id == _uid(context)) | (Category.is_preset == True)  # noqa: E712
        )
    )
    cats = result.scalars().all()
    return {
        "categories": [
            {"id": str(c.id), "name": c.name, "is_preset": bool(c.is_preset)}
            for c in cats
        ]
    }


@tool(
    name="suggest_category",
    description="为项目建议分类名称（不直接写入，由用户确认）。可创建候选。",
    parameters={
        "type": "object",
        "properties": {
            "project_id": {"type": "string"},
            "category_name": {"type": "string"},
            "reason": {"type": "string"},
            "confidence": {"type": "number"},
        },
        "required": ["category_name"],
    },
    allowed_agents=["curator", "hub"],
)
async def suggest_category(
    context=None,
    project_id: str = "",
    category_name: str = "",
    reason: str = "",
    confidence: float = 0.7,
    **kw,
):
    return {
        "suggestion": {
            "project_id": project_id,
            "category_name": category_name,
            "reason": reason,
            "confidence": confidence,
            "status": "pending_user_confirm",
        }
    }


@tool(
    name="list_notes",
    description="列出用户笔记，可按项目过滤。",
    parameters={
        "type": "object",
        "properties": {
            "project_id": {"type": "string"},
            "limit": {"type": "integer", "default": 10},
        },
    },
    allowed_agents=["scribe", "mentor", "navigator", "hub"],
)
async def list_notes(context=None, project_id: str = "", limit: int = 10, **kw):
    stmt = select(Note).where(Note.user_id == _uid(context))
    if project_id:
        try:
            stmt = stmt.where(Note.project_id == UUID(project_id))
        except ValueError:
            return {"error": "无效 project_id"}
    stmt = stmt.order_by(Note.updated_at.desc()).limit(min(limit or 10, 30))
    rows = (await context.db.execute(stmt)).scalars().all()
    return {
        "notes": [
            {
                "id": str(n.id),
                "project_id": str(n.project_id),
                "title": n.title,
                "preview": (n.content or "")[:200],
            }
            for n in rows
        ]
    }


@tool(
    name="draft_note_outline",
    description="生成笔记大纲草稿（不直接写入数据库）。",
    parameters={
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "sections": {
                "type": "array",
                "items": {"type": "string"},
                "description": "章节标题列表",
            },
            "compare_with": {
                "type": "string",
                "description": "可选，对比的已学项目名",
            },
        },
        "required": ["title", "sections"],
    },
    allowed_agents=["scribe", "hub"],
)
async def draft_note_outline(
    context=None,
    title: str = "",
    sections: list | None = None,
    compare_with: str = "",
    **kw,
):
    sections = sections or []
    md = [f"# {title}", ""]
    for i, s in enumerate(sections, 1):
        md.append(f"## {i}. {s}")
        md.append("")
        md.append("<!-- 在此填写内容 -->")
        md.append("")
    if compare_with:
        md.append(f"## 与 {compare_with} 的对比")
        md.append("")
    return {"title": title, "markdown": "\n".join(md), "mode": "draft"}


@tool(
    name="ask_user",
    description=(
        "向用户发起结构化反问。暂停当前流程等待回答。"
        "items 为问题列表，每项含 id/prompt/type/options。"
        "type: single_choice | multi_choice | scale | text"
    ),
    parameters={
        "type": "object",
        "properties": {
            "title": {"type": "string"},
            "items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "prompt": {"type": "string"},
                        "type": {
                            "type": "string",
                            "enum": ["single_choice", "multi_choice", "scale", "text"],
                        },
                        "options": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "required": {"type": "boolean"},
                    },
                    "required": ["id", "prompt", "type"],
                },
            },
            "allow_skip": {"type": "boolean", "default": True},
        },
        "required": ["title", "items"],
    },
    allowed_agents=["mentor", "navigator", "hub", "curator", "scout", "scribe"],
)
async def ask_user(
    context=None,
    title: str = "",
    items: list | None = None,
    allow_skip: bool = True,
    **kw,
):
    """特殊工具：返回 __question__ 标记，由 ReAct 引擎拦截。"""
    return {
        "__question__": True,
        "title": title,
        "items": items or [],
        "allow_skip": allow_skip,
        "agent_id": getattr(context, "agent_id", "hub"),
    }


@tool(
    name="propose_memory",
    description=(
        "向 Hub 提交记忆/画像更新提案。"
        "kind: long_memory | profile_tech | preference。"
        "profile_tech 的 value 格式如 'Python:75' 或 JSON。"
    ),
    parameters={
        "type": "object",
        "properties": {
            "value": {"type": "string"},
            "confidence": {"type": "number"},
            "kind": {
                "type": "string",
                "enum": ["long_memory", "profile_tech", "preference"],
            },
            "evidence": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["value", "kind"],
    },
    allowed_agents=["scout", "mentor", "navigator", "curator", "scribe", "hub", "atlas"],
)
async def propose_memory(
    context=None,
    value: str = "",
    confidence: float = 0.7,
    kind: str = "long_memory",
    evidence: list | None = None,
    **kw,
):
    proposal = await context.memory.propose_memory(
        _uid(context),
        agent_id=context.agent_id,
        value=value,
        confidence=confidence,
        evidence=evidence or [],
        kind=kind,
    )
    return {"accepted": True, "proposal": proposal}


@tool(
    name="get_learning_stats",
    description="获取用户学习统计：项目数、进度分布、笔记数等。",
    parameters={"type": "object", "properties": {}},
    allowed_agents=["navigator", "hub", "mentor", "atlas"],
)
async def get_learning_stats(context=None, **kw):
    projects = (
        await context.db.execute(
            select(Project).where(Project.user_id == _uid(context))
        )
    ).scalars().all()
    notes = (
        await context.db.execute(select(Note).where(Note.user_id == _uid(context)))
    ).scalars().all()
    progress_dist: dict[str, int] = {}
    lang_dist: dict[str, int] = {}
    for p in projects:
        progress_dist[p.progress] = progress_dist.get(p.progress, 0) + 1
        if p.language:
            lang_dist[p.language] = lang_dist.get(p.language, 0) + 1
    return {
        "project_count": len(projects),
        "note_count": len(notes),
        "progress_distribution": progress_dist,
        "language_distribution": lang_dist,
    }


@tool(
    name="dispatch_agent",
    description=(
        "Hub 专用：将子任务派发给专业 Agent。"
        "target_agent: scout|mentor|navigator|curator|scribe。"
        "返回子任务描述，由 Hub 编排层实际执行。"
    ),
    parameters={
        "type": "object",
        "properties": {
            "target_agent": {
                "type": "string",
                "enum": ["scout", "mentor", "navigator", "curator", "scribe"],
            },
            "task": {"type": "string"},
            "reason": {"type": "string"},
        },
        "required": ["target_agent", "task"],
    },
    allowed_agents=["hub"],
)
async def dispatch_agent(
    context=None,
    target_agent: str = "",
    task: str = "",
    reason: str = "",
    **kw,
):
    return {
        "__dispatch__": True,
        "target_agent": target_agent,
        "task": task,
        "reason": reason or f"Hub 调度 {target_agent}",
    }


@tool(
    name="select_import_repos",
    description=(
        "导入场景专用：在左侧列表中勾选/取消勾选仓库。"
        "repo_keys 形如 owner/repo，必须来自 available_repo_keys。"
        "action=set 替换当前勾选；add 追加；remove 取消。"
        "勾选后向用户说明为何推荐这些项目，请用户确认后再点「导入选中」。"
    ),
    parameters={
        "type": "object",
        "properties": {
            "repo_keys": {
                "type": "array",
                "items": {"type": "string"},
                "description": "owner/repo 列表",
            },
            "action": {
                "type": "string",
                "enum": ["set", "add", "remove"],
                "default": "set",
            },
            "reason": {"type": "string", "description": "勾选理由，会展示给用户"},
        },
        "required": ["repo_keys"],
    },
    allowed_agents=["curator", "scout", "hub", "navigator"],
)
async def select_import_repos(
    context=None,
    repo_keys: list | None = None,
    action: str = "set",
    reason: str = "",
    **kw,
):
    keys = [str(k).strip() for k in (repo_keys or []) if str(k).strip()]
    # 与上下文 available 求交
    available = []
    if context and isinstance(getattr(context, "extra", None), dict):
        available = list(context.extra.get("available_repo_keys") or [])
    if available:
        avail_set = set(available)
        keys = [k for k in keys if k in avail_set]
    return {
        "__select_repos__": True,
        "repo_keys": keys,
        "action": action if action in ("set", "add", "remove") else "set",
        "reason": reason or "根据你的需求已在左侧勾选推荐仓库",
        "count": len(keys),
    }


def ensure_tools_loaded() -> None:
    """导入本模块以注册全部工具。"""
    return None
