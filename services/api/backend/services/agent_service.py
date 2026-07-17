"""Agent 会话与对话业务逻辑"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import Any, AsyncIterator
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.agents.hub import HubService
from backend.llm.config import build_llm_config_from_user
from backend.memory.service import MemoryService
from backend.models.agent import AgentMessage, AgentSession
from backend.models.user import User
from backend.schemas.agent import (
    AgentMessageOut,
    AgentSessionDetailOut,
    AgentSessionOut,
    ContextWindowSegmentOut,
    ContextWindowStatsOut,
)
from backend.services.project_service import get_project_owned_by_user
from backend.services.sse_stream import format_sse
from backend.tools.builtin import ensure_tools_loaded

ensure_tools_loaded()

# 会话级流控：同 session 新流会 set 旧 Event，旧流停止 yield 与最终落库
_session_stream_cancel: dict[UUID, asyncio.Event] = {}


def _begin_session_stream(session_id: UUID) -> asyncio.Event:
    prev = _session_stream_cancel.get(session_id)
    if prev is not None:
        prev.set()
    ev = asyncio.Event()
    _session_stream_cancel[session_id] = ev
    return ev


def _end_session_stream(session_id: UUID, ev: asyncio.Event) -> None:
    if _session_stream_cancel.get(session_id) is ev:
        _session_stream_cancel.pop(session_id, None)


def session_to_out(session: AgentSession) -> AgentSessionOut:
    return AgentSessionOut(
        id=session.id,
        title=session.title or "新对话",
        agent=session.active_agent or "hub",
        updated_at=(session.updated_at or session.created_at).isoformat() + "Z",
        unread=False,
        project_id=session.project_id,
    )


def message_to_out(msg: AgentMessage) -> AgentMessageOut:
    return AgentMessageOut(
        id=msg.id,
        session_id=msg.session_id,
        agent=msg.agent_id or "hub",
        role=msg.role,
        content=msg.content,
        created_at=msg.created_at.isoformat() + "Z",
    )


async def list_sessions(db: AsyncSession, user_id: UUID) -> list[AgentSessionOut]:
    result = await db.execute(
        select(AgentSession)
        .where(AgentSession.user_id == user_id)
        .order_by(AgentSession.updated_at.desc())
    )
    return [session_to_out(s) for s in result.scalars().all()]


async def get_session_detail(
    db: AsyncSession, user_id: UUID, session_id: UUID
) -> AgentSessionDetailOut | None:
    session = await db.get(AgentSession, session_id)
    if not session or session.user_id != user_id:
        return None
    msgs = (
        await db.execute(
            select(AgentMessage)
            .where(AgentMessage.session_id == session_id)
            .order_by(AgentMessage.created_at.asc())
        )
    ).scalars().all()
    base = session_to_out(session)
    return AgentSessionDetailOut(
        **base.model_dump(),
        messages=[message_to_out(m) for m in msgs],
    )


async def create_session(
    db: AsyncSession,
    user_id: UUID,
    *,
    project_id: UUID | None = None,
    title: str = "新对话",
) -> AgentSessionOut:
    session = AgentSession(
        user_id=user_id,
        title=title,
        active_agent="hub",
        project_id=project_id,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session_to_out(session)


async def update_session(
    db: AsyncSession,
    user_id: UUID,
    session_id: UUID,
    *,
    title: str | None = None,
    project_id: UUID | None = None,
    clear_project: bool = False,
    active_agent: str | None = None,
) -> AgentSessionOut | None:
    """更新会话。返回 None 表示会话不存在；非法字段抛 ValueError。"""
    from backend.agents.registry import AGENT_DEFINITIONS

    session = await db.get(AgentSession, session_id)
    if not session or session.user_id != user_id:
        return None
    if title is not None:
        session.title = title
    if clear_project:
        session.project_id = None
    elif project_id is not None:
        owned = await get_project_owned_by_user(db, project_id, user_id)
        if not owned:
            raise ValueError("PROJECT_NOT_OWNED")
        session.project_id = project_id
    if active_agent is not None:
        agent_id = active_agent.strip().lower()
        if agent_id not in AGENT_DEFINITIONS:
            raise ValueError("INVALID_ACTIVE_AGENT")
        session.active_agent = agent_id
    session.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(session)
    return session_to_out(session)


async def delete_session(db: AsyncSession, user_id: UUID, session_id: UUID) -> bool:
    session = await db.get(AgentSession, session_id)
    if not session or session.user_id != user_id:
        return False
    msgs = await db.execute(
        select(AgentMessage).where(AgentMessage.session_id == session_id)
    )
    for msg in msgs.scalars().all():
        await db.delete(msg)
    await db.delete(session)
    await db.commit()
    return True


async def append_message(
    db: AsyncSession,
    session: AgentSession,
    *,
    role: str,
    content: str,
    agent_id: str | None = None,
    content_type: str = "text",
    metadata: dict | None = None,
) -> AgentMessage:
    msg = AgentMessage(
        session_id=session.id,
        role=role,
        agent_id=agent_id or session.active_agent or "hub",
        content=content,
        content_type=content_type,
        message_meta=json.dumps(metadata or {}, ensure_ascii=False),
    )
    db.add(msg)
    session.updated_at = datetime.utcnow()
    if role == "user" and (not session.title or session.title == "新对话"):
        session.title = content[:32] + ("…" if len(content) > 32 else "")
    await db.commit()
    await db.refresh(msg)
    return msg


async def stream_chat(
    db: AsyncSession,
    user: User,
    session_id: UUID,
    message: str,
    *,
    project_id: UUID | None = None,
) -> AsyncIterator[str]:
    session = await db.get(AgentSession, session_id)
    if not session or session.user_id != user.id:
        yield format_sse("error", {"code": "NOT_FOUND", "message": "会话不存在"})
        return

    # 消息级 project_id 优先，并回写到会话（仅允许绑定当前用户拥有的项目）
    if project_id is not None:
        owned = await get_project_owned_by_user(db, project_id, user.id)
        if not owned:
            yield format_sse(
                "error",
                {"code": "FORBIDDEN", "message": "无权绑定该项目到会话"},
            )
            return
        session.project_id = project_id
        await db.commit()

    await append_message(db, session, role="user", content=message, agent_id="hub")

    cancel_ev = _begin_session_stream(session_id)
    hub = HubService(db)
    collected: list[str] = []
    last_agent = "hub"
    usage: dict[str, Any] = {}
    aborted = False
    # question 已落库时，不再把同轮 text_delta 再写成 assistant 气泡
    saw_question = False

    try:
        async for chunk in hub.handle_chat(
            user=user,
            session_id=session_id,
            message=message,
            project_id=session.project_id,
        ):
            if cancel_ev.is_set():
                aborted = True
                break
            # 解析部分事件以收集回复
            if chunk.startswith("event: text_delta"):
                try:
                    data_line = chunk.split("data: ", 1)[1].strip()
                    data = json.loads(data_line)
                    collected.append(data.get("content") or "")
                except Exception:
                    pass
            elif chunk.startswith("event: agent_switch"):
                try:
                    data_line = chunk.split("data: ", 1)[1].strip()
                    data = json.loads(data_line)
                    last_agent = data.get("agent_id") or last_agent
                    session.active_agent = last_agent
                except Exception:
                    pass
            elif chunk.startswith("event: done"):
                try:
                    data_line = chunk.split("data: ", 1)[1].strip()
                    data = json.loads(data_line)
                    usage = data.get("usage") or {}
                except Exception:
                    pass
            elif chunk.startswith("event: question"):
                try:
                    data_line = chunk.split("data: ", 1)[1].strip()
                    data = json.loads(data_line)
                    session.status = "pending_question"
                    saw_question = True
                    await append_message(
                        db,
                        session,
                        role="assistant",
                        content=json.dumps(data, ensure_ascii=False),
                        agent_id=last_agent,
                        content_type="question",
                        metadata=data,
                    )
                    await db.commit()
                except Exception:
                    pass
            yield chunk

        # 客户端断开（生成器 CancelledError）或被同会话新流抢占时，不落最终 assistant 文本
        if aborted or cancel_ev.is_set():
            return

        # 已有 question 消息时跳过文本落库，避免同轮双气泡
        if saw_question:
            return

        reply = "".join(collected)
        if reply:
            await append_message(
                db,
                session,
                role="assistant",
                content=reply,
                agent_id=last_agent,
                metadata={"usage": usage},
            )
            session.active_agent = last_agent
            session.status = "active"
            await db.commit()
    except asyncio.CancelledError:
        # 传输层取消：跳过最终落库，避免半截流与库内不一致
        raise
    finally:
        _end_session_stream(session_id, cancel_ev)


async def stream_question_answer(
    db: AsyncSession,
    user: User,
    session_id: UUID,
    question_id: str,
    answers: dict[str, Any],
    *,
    skipped: bool = False,
) -> AsyncIterator[str]:
    session = await db.get(AgentSession, session_id)
    if not session or session.user_id != user.id:
        yield format_sse("error", {"code": "NOT_FOUND", "message": "会话不存在"})
        return

    answer_text = (
        "[跳过反问]"
        if skipped
        else f"[反问回答] {json.dumps(answers, ensure_ascii=False)}"
    )
    await append_message(db, session, role="user", content=answer_text, agent_id="hub")
    session.status = "active"

    hub = HubService(db)
    collected: list[str] = []
    last_agent = session.active_agent or "mentor"

    async for chunk in hub.handle_question_answer(
        user=user,
        session_id=session_id,
        question_id=question_id,
        answers=answers,
        skipped=skipped,
        project_id=session.project_id,
    ):
        if chunk.startswith("event: text_delta"):
            try:
                data_line = chunk.split("data: ", 1)[1].strip()
                data = json.loads(data_line)
                collected.append(data.get("content") or "")
            except Exception:
                pass
        elif chunk.startswith("event: agent_switch"):
            try:
                data_line = chunk.split("data: ", 1)[1].strip()
                data = json.loads(data_line)
                last_agent = data.get("agent_id") or last_agent
            except Exception:
                pass
        yield chunk

    reply = "".join(collected)
    if reply:
        await append_message(
            db, session, role="assistant", content=reply, agent_id=last_agent
        )


_ANALYZE_PROMPTS: dict[str, str] = {
    "scout": (
        "请在 30 秒级给出项目速览：一句话定位、核心功能、技术栈、适合谁、学习门槛、下一步建议。"
        "控制篇幅，禁止 emoji。"
    ),
    "mentor": (
        "请深入讲解该项目的架构、核心设计与关键路径，按初学者到进阶分层说明。"
        "禁止 emoji。"
    ),
    "navigator": (
        "请为学习该项目制定分阶段计划：前置知识、阅读顺序、里程碑与练习。"
        "禁止 emoji。"
    ),
    "curator": (
        "请为该项目建议分类、标签与归类理由（对照常见预设：前端/后端/AI-ML/DevOps/其他）。"
        "禁止 emoji。"
    ),
    "scribe": (
        "请基于项目信息生成结构化学习笔记大纲（标题 + 小节要点），便于保存为笔记。"
        "禁止 emoji。"
    ),
    "atlas": (
        "请从知识图谱视角说明该项目与常见生态/技术栈的关联，以及可迁移学习路径。"
        "禁止 emoji。"
    ),
}


async def stream_analyze(
    db: AsyncSession,
    user: User,
    project_id: UUID,
    *,
    depth: str = "quick",
    agent_id: str | None = None,
) -> AsyncIterator[str]:
    from backend.agents.registry import get_registry
    from backend.services.project_service import get_project_owned_by_user

    project = await get_project_owned_by_user(db, project_id, user.id)
    if not project:
        yield format_sse(
            "error",
            {"code": "FORBIDDEN", "message": "项目不存在或不属于当前用户"},
        )
        return

    # 解析 Agent：显式 agent_id 优先；否则 depth 兼容旧客户端
    resolved = (agent_id or "").strip().lower() or (
        "mentor" if depth == "deep" else "scout"
    )
    # 禁止 hub 作为详情分析入口；未知 id 回退 scout
    if resolved == "hub" or not get_registry().has(resolved):
        resolved = "scout"

    # 临时会话
    session = AgentSession(
        user_id=user.id,
        title=f"{resolved} · {project.name}",
        active_agent=resolved,
        project_id=project_id,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    role_hint = _ANALYZE_PROMPTS.get(resolved, _ANALYZE_PROMPTS["scout"])
    prompt = (
        f"{role_hint}\n\n"
        f"项目: {project.name}\n"
        f"URL: {project.url}\n"
        f"描述: {project.description or '无'}\n"
        f"语言: {project.language or '未知'}\n"
        f"Stars: {project.stars}\n"
        f"学习进度: {project.progress}\n"
        "请用中文简洁输出，可用 Markdown。禁止任何 emoji。"
    )
    await append_message(db, session, role="user", content=prompt, agent_id="hub")

    yield format_sse(
        "agent_switch",
        {
            "agent_id": resolved,
            "from": "hub",
            "to": resolved,
            "reason": "项目详情分析",
        },
    )
    # 状态行（带换行），避免与后续思考内容粘连；真正的模型推理在 THINK 通道
    yield format_sse(
        "thinking",
        {
            "content": (
                f"[状态] 角色={resolved} 项目={project.name}\n"
                f"[上下文] 语言={project.language or '未知'} · "
                f"stars={project.stars} · 进度={project.progress}\n"
            )
        },
    )

    hub = HubService(db)
    collected: list[str] = []
    async for chunk in hub.handle_direct_agent(
        user=user,
        session_id=session.id,
        agent_id=resolved,
        message=prompt,
        project_id=project_id,
    ):
        if chunk.startswith("event: text_delta"):
            try:
                data_line = chunk.split("data: ", 1)[1].strip()
                collected.append(json.loads(data_line.split("\n")[0]).get("content") or "")
            except Exception:
                pass
        yield chunk

    reply = "".join(collected)
    if reply:
        await append_message(db, session, role="assistant", content=reply, agent_id=resolved)


async def stream_import_assist(
    db: AsyncSession,
    user: User,
    message: str,
    context: dict[str, Any],
) -> AsyncIterator[str]:
    """导入助手：精简工具 + 寒暄快路径 + 空正文兜底。"""
    import re
    from dataclasses import replace

    from backend.agents.react import EngineResult, ReActEngine
    from backend.agents.registry import get_registry
    from backend.llm.config import build_llm_config_from_user
    from backend.llm.provider import LLMProvider
    from backend.memory.context import ContextBuilder
    from backend.memory.service import MemoryService
    from backend.services.sse_stream import format_sse
    from backend.tools.registry import ToolRegistry, global_registry

    available = list(context.get("available_repo_keys") or [])
    selected = list(context.get("selected_repo_keys") or [])
    mode = context.get("mode") or "stars"
    available_repos = list(context.get("available_repos") or [])
    imported_from_client = list(context.get("imported_projects") or [])
    msg = (message or "").strip()

    # 服务端补齐：用户库项目 + Stars 缓存（即使前端未传也能回答）
    from sqlalchemy import func, select

    from backend.models.project import Project

    proj_rows = (
        await db.execute(
            select(Project)
            .where(Project.user_id == user.id)
            .order_by(Project.stars.desc())
            .limit(80)
        )
    ).scalars().all()
    imported_projects = imported_from_client or [
        {
            "name": p.name,
            "language": p.language,
            "progress": p.progress,
            "stars": p.stars,
            "description": (p.description or "")[:120],
        }
        for p in proj_rows
    ]
    progress_rows = (
        await db.execute(
            select(Project.progress, func.count())
            .where(Project.user_id == user.id)
            .group_by(Project.progress)
        )
    ).all()
    progress_stats = {str(prog or "none"): int(cnt) for prog, cnt in progress_rows}

    # Stars 缓存（settings_json.github_stars_cache）
    stars_cache_items: list[dict] = []
    try:
        settings_raw = json.loads(user.settings_json or "{}")
        cache = settings_raw.get("github_stars_cache") if isinstance(settings_raw, dict) else None
        if isinstance(cache, dict) and isinstance(cache.get("items"), list):
            stars_cache_items = cache["items"][:120]
    except (json.JSONDecodeError, TypeError):
        stars_cache_items = []

    if not available and stars_cache_items and mode == "stars":
        available = [
            f"{it.get('owner')}/{it.get('name') or it.get('repo')}"
            for it in stars_cache_items
            if it.get("owner") and (it.get("name") or it.get("repo"))
        ]
    if not available_repos and stars_cache_items:
        available_repos = [
            {
                "key": f"{it.get('owner')}/{it.get('name') or it.get('repo')}",
                "language": it.get("language"),
                "stars": it.get("stars", 0),
                "already_imported": False,
                "description": (it.get("description") or "")[:120],
            }
            for it in stars_cache_items
            if it.get("owner") and (it.get("name") or it.get("repo"))
        ][:80]

    def _emit_text(text: str):
        for i in range(0, len(text), 40):
            yield format_sse("text_delta", {"content": text[i : i + 40]})

    def _keyword_hits(limit: int = 12) -> list[str]:
        q = msg.lower()
        parts = [p for p in re.split(r"[\s,，、/]+", q) if len(p) > 1]
        hits = [
            k
            for k in available
            if any(p in k.lower() for p in parts)
        ][:limit]
        return hits

    # —— 寒暄快路径：不调 LLM、不调外网工具 ——
    if re.fullmatch(
        r"(你好|您好|嗨|哈喽|hi|hello|hey|在吗|早上好|下午好|晚上好)[！!。.~～]*",
        msg,
        flags=re.I,
    ):
        n = len(available)
        n_imp = len(imported_projects)
        text = (
            f"你好！我是导入助手（用户 **{user.username}**）。\n\n"
            f"左侧候选 **{n}** 个仓库；你库中已导入 **{n_imp}** 个项目。\n"
            "你可以直接说：\n"
            "- 「我 star 的项目都是什么类型」\n"
            "- 「推荐和我已学项目类似的仓库」\n"
            "- 「勾选前端相关 / 选 5 个高 star」\n\n"
            "我会结合 Stars、已导入与学习进度回答，并在左侧**自动勾选**。"
        )
        for chunk in _emit_text(text):
            yield chunk
        yield format_sse("done", {"usage": {"tokens": len(text)}, "iterations": 0})
        return

    # —— 无 LLM：规则降级 ——
    llm_cfg = await build_llm_config_from_user(db, user.id)
    if not llm_cfg:
        hits = _keyword_hits()
        if not hits and available:
            hits = available[:5]
        if hits:
            yield format_sse(
                "select_repos",
                {
                    "repo_keys": hits,
                    "action": "set",
                    "reason": "降级模式：按关键词匹配勾选",
                    "count": len(hits),
                },
            )
        text = (
            "【降级模式】未检测到可用 LLM Key（设置页测试通过后若仍出现，请重新保存 Key 再试）。\n\n"
            + (
                f"已在左侧勾选 **{len(hits)}** 个仓库：\n"
                + "\n".join(f"- `{k}`" for k in hits)
                + "\n\n请确认后点击「导入选中」。"
                if hits
                else "左侧暂无候选仓库。请先同步 Stars 或完成搜索。"
            )
        )
        for chunk in _emit_text(text):
            yield chunk
        yield format_sse(
            "done", {"usage": {"tokens": len(text)}, "iterations": 0, "degraded": True}
        )
        return

    # —— LLM 路径：仅允许 select_import_repos，避免 fetch_github 超时导致空响应 ——
    session = AgentSession(
        user_id=user.id,
        title="导入助手",
        active_agent="curator",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    preview_keys = available[:80]
    # 语言分布（基于候选摘要）
    lang_counter: dict[str, int] = {}
    for r in available_repos[:120]:
        if not isinstance(r, dict):
            continue
        lang = (r.get("language") or "Unknown") or "Unknown"
        lang_counter[str(lang)] = lang_counter.get(str(lang), 0) + 1
    top_langs = sorted(lang_counter.items(), key=lambda x: -x[1])[:12]

    ctx_text = json.dumps(
        {
            "user": {"username": user.username},
            "mode": mode,
            "available_count": len(available),
            "available_repo_keys_preview": preview_keys,
            "available_repos_sample": available_repos[:40],
            "stars_language_distribution": top_langs,
            "selected_repo_keys": selected,
            "imported_count": len(imported_projects),
            "imported_projects_sample": imported_projects[:40],
            "progress_stats": progress_stats,
        },
        ensure_ascii=False,
    )
    prompt = (
        "你是 RepoPilot **导入助手**。用中文简洁回复。\n"
        "你掌握：① 用户 Stars/搜索候选 ② 左侧勾选 ③ 已导入项目与学习进度 ④ 用户名。\n"
        "能力：\n"
        "- 回答「star 了哪些类型 / 语言分布」：基于 stars_language_distribution 与 available_repos_sample。\n"
        "- 对比已学项目推荐类似仓库：用 imported_projects_sample + progress_stats。\n"
        "- 筛选/推荐并勾选：必须调用 select_import_repos，repo_keys 只能来自 available_repo_keys_preview。\n"
        "- 查询库内项目可用 query_user_projects / get_learning_stats（本地库，勿打外网）。\n"
        "勾选后请用户点「导入选中」；不要声称已完成导入。不要空回复。\n"
        f"上下文: {ctx_text}\n"
        f"用户: {msg}"
    )

    memory = MemoryService(db)
    builder = ContextBuilder(db, memory)
    llm = LLMProvider(llm_cfg)
    # 本地工具 + 勾选：不挂 fetch_github / fetch_readme，避免外网超时
    slim_tools = [
        "select_import_repos",
        "query_user_projects",
        "get_learning_stats",
        "get_project_detail",
    ]
    agent_def = replace(
        get_registry().get("curator"),
        max_tokens=1536,
        temperature=0.4,
        tools=slim_tools,
    )
    slim_reg = ToolRegistry()
    for tname in slim_tools:
        t = global_registry.get(tname)
        if t:
            slim_reg.register(t)

    ctx = await builder.build_run_context(
        user_id=user.id,
        session_id=session.id,
        agent_id="curator",
        llm=llm,
        llm_config=llm_cfg,
        speaking_style="default",
    )
    ctx.tool_registry = slim_reg
    ctx.extra["available_repo_keys"] = available
    ctx.extra["selected_repo_keys"] = selected
    ctx.extra["disable_questions"] = True  # 嵌入式 UI 无反问面板
    messages = await builder.build_messages(
        agent_def=agent_def,
        ctx=ctx,
        user_message=prompt,
        history=[],
    )

    yield format_sse(
        "agent_switch",
        {
            "agent_id": "curator",
            "from": "hub",
            "to": "curator",
            "reason": "导入助手",
        },
    )
    yield format_sse(
        "thinking",
        {
            "content": (
                f"分析候选 {len(available)} 个、已导入 {len(imported_projects)} 个、"
                f"勾选 {len(selected)} 个；进度统计 {progress_stats}…"
            )
        },
    )

    engine = ReActEngine(max_iterations=4)
    had_text = False
    try:
        async for item in engine.run(
            agent_def=agent_def, ctx=ctx, messages=messages, emit_sse=True
        ):
            if isinstance(item, EngineResult):
                if item.text and item.text.strip():
                    had_text = True
                continue
            if isinstance(item, str) and "event: text_delta" in item:
                had_text = True
            yield item
    except Exception as e:
        logger = __import__("logging").getLogger(__name__)
        logger.exception("import assist failed")
        err = f"导入助手出错：{e}"
        for chunk in _emit_text(err):
            yield chunk
        yield format_sse("done", {"usage": {"tokens": 0}, "iterations": 0})
        return

    if not had_text:
        # 最后兜底：规则勾选 + 说明
        hits = _keyword_hits() or available[:5]
        if hits:
            yield format_sse(
                "select_repos",
                {
                    "repo_keys": hits,
                    "action": "set",
                    "reason": "自动兜底勾选",
                    "count": len(hits),
                },
            )
        text = (
            "我在这边了。左侧候选 "
            f"**{len(available)}** 个"
            + (
                f"，已为你勾选 {len(hits)} 个示例：\n"
                + "\n".join(f"- `{k}`" for k in hits)
                + "\n\n可以说「只要 Python」或「前端框架」让我重新勾选。"
                if hits
                else "。请先加载 Stars/搜索结果，或直接描述想导入的技术栈。"
            )
        )
        for chunk in _emit_text(text):
            yield chunk
        yield format_sse("done", {"usage": {"tokens": len(text)}, "iterations": 0})


async def stream_graph_guide(
    db: AsyncSession,
    user: User,
    message: str,
    *,
    selected_node_id: str | None = None,
) -> AsyncIterator[str]:
    from backend.services.sse_stream import format_sse

    session = AgentSession(
        user_id=user.id,
        title="图谱向导",
        active_agent="atlas",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    prompt = message
    if selected_node_id:
        prompt = f"用户选中了图谱节点 project_id={selected_node_id}。\n{message}"

    hub = HubService(db)
    project_uuid = None
    if selected_node_id:
        try:
            project_uuid = UUID(selected_node_id)
        except ValueError:
            project_uuid = None

    had_text = False
    try:
        async for chunk in hub.handle_direct_agent(
            user=user,
            session_id=session.id,
            agent_id="atlas",
            message=prompt,
            project_id=project_uuid,
        ):
            if isinstance(chunk, str) and "event: text_delta" in chunk:
                had_text = True
            yield chunk
    except Exception as e:
        err = f"图谱向导出错：{e}"
        for i in range(0, len(err), 40):
            yield format_sse("text_delta", {"content": err[i : i + 40]})
        yield format_sse("done", {"usage": {"tokens": 0}, "iterations": 0})
        return

    if not had_text:
        text = (
            "我是 Atlas 图谱向导。请在左侧点选节点，或问我「这些项目怎么关联」。"
            "若持续无回复，请到设置确认 LLM 测试通过。"
        )
        for i in range(0, len(text), 40):
            yield format_sse("text_delta", {"content": text[i : i + 40]})
        yield format_sse("done", {"usage": {"tokens": len(text)}, "iterations": 0})


async def stream_trending_scout(
    db: AsyncSession,
    user: User,
    params: dict[str, Any],
) -> AsyncIterator[str]:
    session = AgentSession(
        user_id=user.id,
        title="Trending Scout",
        active_agent="scout",
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    name = params.get("full_name") or params.get("name") or "unknown"
    prompt = (
        f"用 Scout 风格快速介绍 trending 仓库 {name}。\n"
        f"描述: {params.get('description') or '无'}\n"
        f"语言: {params.get('language') or '未知'} Stars: {params.get('stars') or 0}\n"
        f"URL: {params.get('url') or ''}\n"
        "说明是否值得加入用户学习库。"
    )
    hub = HubService(db)
    async for chunk in hub.handle_direct_agent(
        user=user,
        session_id=session.id,
        agent_id="scout",
        message=prompt,
    ):
        yield chunk


async def get_context_window(
    db: AsyncSession, user_id: UUID, session_id: UUID | None
) -> ContextWindowStatsOut:
    memory = MemoryService(db)
    total = 0
    system_tokens = 800  # 估计 system prompt
    tool_tokens = 400
    memory_tokens = 0
    model = "gpt-4o"
    limit = 128_000

    llm_cfg = await build_llm_config_from_user(db, user_id)
    if llm_cfg:
        model = llm_cfg.model
        limit = llm_cfg.max_context_tokens

    if session_id:
        session = await db.get(AgentSession, session_id)
        if session and session.user_id == user_id:
            msgs = await memory.list_recent_messages(session_id, limit=100)
            total = sum(memory.estimate_tokens(m.content or "") for m in msgs)
            long_mem = await memory.get_long_memory(user_id)
            memory_tokens = sum(
                memory.estimate_tokens(str(m.get("content", ""))) for m in long_mem
            )

    segments = [
        ContextWindowSegmentOut(label="System / Soul", tokens=system_tokens, kind="system"),
        ContextWindowSegmentOut(label="长期记忆", tokens=memory_tokens, kind="memory"),
        ContextWindowSegmentOut(label="工具定义", tokens=tool_tokens, kind="tools"),
        ContextWindowSegmentOut(label="对话消息", tokens=total, kind="messages"),
    ]
    input_tokens = system_tokens + memory_tokens + tool_tokens + total
    return ContextWindowStatsOut(
        session_id=str(session_id) if session_id else None,
        model=model,
        context_limit=limit,
        input_tokens=input_tokens,
        output_tokens=0,
        total_tokens=input_tokens,
        segments=segments,
    )
