"""上下文工程 —— 按需检索、过滤、压缩"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.llm.config import LLMConfig
from backend.llm.provider import LLMProvider
from backend.memory.service import MemoryService
from backend.models.project import Project
from backend.tools.registry import ToolRegistry, global_registry


@dataclass
class AgentRunContext:
    """单次 Agent 执行上下文。"""

    user_id: UUID
    session_id: UUID
    agent_id: str
    db: AsyncSession
    llm: LLMProvider
    llm_config: LLMConfig | None
    memory: MemoryService
    tool_registry: ToolRegistry = field(default_factory=lambda: global_registry)
    project_id: UUID | None = None
    project: Project | None = None
    user_profile: dict[str, Any] = field(default_factory=dict)
    long_memory: list[dict] = field(default_factory=list)
    short_memory: list[dict] = field(default_factory=list)
    speaking_style: str = "default"
    permissions: dict[str, Any] = field(default_factory=dict)
    extra: dict[str, Any] = field(default_factory=dict)


STYLE_HINTS = {
    "default": "语气专业、清晰、有条理。",
    "gentle": "语气温和耐心，多用鼓励。",
    "strict": "语气严厉直接，指出关键问题与风险。",
    "sarcastic": "可用轻微毒舌幽默，但不人身攻击。",
    "casual": "语气轻松随意，像技术好友。",
}


class ContextBuilder:
    """组装 Agent 的 system prompt 与消息列表。"""

    def __init__(self, db: AsyncSession, memory: MemoryService):
        self.db = db
        self.memory = memory

    async def build_run_context(
        self,
        *,
        user_id: UUID,
        session_id: UUID,
        agent_id: str,
        llm: LLMProvider,
        llm_config: LLMConfig | None,
        project_id: UUID | None = None,
        speaking_style: str = "default",
        permissions: dict | None = None,
    ) -> AgentRunContext:
        project = None
        if project_id:
            project = await self.db.get(Project, project_id)
            if project and project.user_id != user_id:
                project = None
                project_id = None

        profile = await self.memory.get_user_profile_dict(user_id)
        long_mem = await self.memory.get_long_memory(user_id)
        short_mem = await self.memory.get_short_memory(user_id, agent_id)

        return AgentRunContext(
            user_id=user_id,
            session_id=session_id,
            agent_id=agent_id,
            db=self.db,
            llm=llm,
            llm_config=llm_config,
            memory=self.memory,
            project_id=project_id,
            project=project,
            user_profile=profile,
            long_memory=long_mem,
            short_memory=short_mem,
            speaking_style=speaking_style,
            permissions=permissions or {},
        )

    def build_system_prompt(self, agent_def: Any, ctx: AgentRunContext) -> str:
        from backend.agents.registry import render_soul

        parts = [
            agent_def.system_prompt.strip(),
            "",
            "## 行为灵魂 (SOUL)",
            render_soul(agent_def.soul, ctx.speaking_style),
            "",
            "## 用户画像",
            self._format_profile(ctx.user_profile),
            "",
            "## 长期记忆（共享）",
            self._format_memory_items(ctx.long_memory),
            "",
            "## 本 Agent 短期记忆",
            self._format_short(ctx.short_memory),
        ]
        if ctx.project:
            parts.extend(
                [
                    "",
                    "## 当前项目上下文",
                    f"- 名称: {ctx.project.name}",
                    f"- URL: {ctx.project.url}",
                    f"- 语言: {ctx.project.language or '未知'}",
                    f"- Stars: {ctx.project.stars}",
                    f"- 进度: {ctx.project.progress}",
                    f"- 描述: {(ctx.project.description or '')[:500]}",
                ]
            )
        style = STYLE_HINTS.get(ctx.speaking_style, STYLE_HINTS["default"])
        parts.extend(["", f"## 风格: {style}"])
        parts.extend(
            [
                "",
                "## 输出规范",
                "- 使用中文回答（用户明确要求其他语言除外）。",
                "- 需要反问时，调用 ask_user 工具，不要只在正文里提问。",
                "- 可调用工具获取真实数据，不要编造用户库中不存在的项目。",
                "- 更新用户画像或长期记忆时，调用 propose_memory 工具提交提案。",
            ]
        )
        return "\n".join(parts)

    async def build_messages(
        self,
        *,
        agent_def: Any,
        ctx: AgentRunContext,
        user_message: str,
        history: list[dict[str, Any]] | None = None,
        prior_agent_summary: str | None = None,
    ) -> list[dict[str, Any]]:
        system = self.build_system_prompt(agent_def, ctx)
        messages: list[dict[str, Any]] = [{"role": "system", "content": system}]
        if prior_agent_summary:
            messages.append(
                {
                    "role": "system",
                    "content": f"[前序 Agent 协作摘要]\n{prior_agent_summary}",
                }
            )
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_message})
        return await self.memory.compress_history_if_needed(messages)

    async def load_chat_history(
        self, session_id: UUID, limit: int = 20
    ) -> list[dict[str, Any]]:
        msgs = await self.memory.list_recent_messages(session_id, limit=limit)
        out: list[dict[str, Any]] = []
        for m in msgs:
            if m.role in ("user", "assistant", "system", "tool"):
                item: dict[str, Any] = {"role": m.role, "content": m.content or ""}
                # tool 消息可能需要 tool_call_id，简化：只保留 user/assistant
                if m.role in ("user", "assistant"):
                    out.append(item)
        return out

    def context_segments(
        self, messages: list[dict[str, Any]], agent_id: str
    ) -> list[dict[str, Any]]:
        """用于 context-window 统计。"""
        system_tokens = 0
        msg_tokens = 0
        for m in messages:
            t = MemoryService.estimate_tokens(m.get("content") or "")
            if m.get("role") == "system":
                system_tokens += t
            else:
                msg_tokens += t
        tools = global_registry.get_tools_for_agent(agent_id)
        tool_tokens = MemoryService.estimate_tokens(
            json.dumps([t.name for t in tools])
        )
        return [
            {"label": "System / Soul", "tokens": system_tokens, "kind": "system"},
            {"label": "对话消息", "tokens": msg_tokens, "kind": "messages"},
            {"label": "工具定义", "tokens": tool_tokens, "kind": "tools"},
            {
                "label": "记忆",
                "tokens": max(0, system_tokens // 4),
                "kind": "memory",
            },
        ]

    @staticmethod
    def _format_profile(profile: dict) -> str:
        if not profile:
            return "（暂无）"
        tech = profile.get("tech_proficiency") or {}
        prefs = profile.get("learning_preferences") or {}
        goals = profile.get("goals") or []
        summary = profile.get("history_summary") or ""
        lines = [
            f"技术熟练度: {json.dumps(tech, ensure_ascii=False) if tech else '未知'}",
            f"学习偏好: {json.dumps(prefs, ensure_ascii=False) if prefs else '未知'}",
            f"目标: {json.dumps(goals, ensure_ascii=False) if goals else '未设定'}",
            f"历史摘要: {summary or '无'}",
        ]
        return "\n".join(lines)

    @staticmethod
    def _format_memory_items(items: list[dict]) -> str:
        if not items:
            return "（暂无长期记忆）"
        lines = []
        for it in items[-15:]:
            if isinstance(it, dict):
                content = it.get("content") or it.get("value") or ""
                conf = it.get("confidence", "")
                lines.append(f"- {content} (confidence={conf})")
        return "\n".join(lines) if lines else "（暂无）"

    @staticmethod
    def _format_short(items: list[dict]) -> str:
        if not items:
            return "（暂无）"
        lines = []
        for it in items[-8:]:
            if isinstance(it, dict):
                lines.append(f"- {it.get('summary') or it.get('content') or it}")
        return "\n".join(lines)
