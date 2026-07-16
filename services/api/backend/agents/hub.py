"""
Hub 服务 —— 意图路由、多 Agent 编排、Plan-and-Execute
"""
from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from backend.agents.intent import IntentClassifier, IntentResult
from backend.agents.react import EngineResult, ReActEngine
from backend.agents.registry import get_registry
from backend.llm.config import (
    build_llm_config_from_user,
    get_agent_model_override,
    get_agent_speaking_style,
)
from backend.llm.provider import LLMProvider
from backend.memory.context import ContextBuilder
from backend.memory.service import MemoryService
from backend.models.user import User
from backend.services.sse_stream import format_sse
from backend.tools.builtin import ensure_tools_loaded

logger = logging.getLogger(__name__)

# 确保工具注册
ensure_tools_loaded()


async def route_message(message: str, session_id: str | None = None) -> str:
    """兼容旧测试的占位接口。"""
    _ = session_id
    return f"Agent 服务已接入 Hub，请通过 SSE 对话接口使用。消息摘要：{message[:200]}"


class HubService:
    """对话管家。"""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.registry = get_registry()
        self.memory = MemoryService(db)
        self.context_builder = ContextBuilder(db, self.memory)
        self.engine = ReActEngine()

    async def handle_chat(
        self,
        *,
        user: User,
        session_id: UUID,
        message: str,
        project_id: UUID | None = None,
        force_agent: str | None = None,
    ) -> AsyncIterator[str]:
        """主对话入口，yield SSE 字符串。"""
        llm_config = await build_llm_config_from_user(self.db, user.id)
        llm = LLMProvider(llm_config)
        classifier = IntentClassifier(llm if llm.available else None)

        # 用户 settings 中的风格
        raw_settings = {}
        try:
            raw_settings = json.loads(user.settings_json or "{}")
        except json.JSONDecodeError:
            pass

        permissions = {}
        try:
            permissions = json.loads(user.agent_permissions or "{}")
        except json.JSONDecodeError:
            pass

        # 意图
        if force_agent and self.registry.has(force_agent):
            intent = IntentResult(agent_id=force_agent, confidence=1.0)
        else:
            intent = await classifier.classify(message)

        yield format_sse(
            "thinking",
            {
                "content": f"意图识别: {intent.agent_id} (confidence={intent.confidence:.2f})"
                + (f" multi=[{intent.plan_summary}]" if intent.is_multi else ""),
            },
        )

        history = await self.context_builder.load_chat_history(session_id)

        if intent.is_multi and intent.sub_intents:
            async for chunk in self._orchestrate_multi(
                user=user,
                session_id=session_id,
                message=message,
                intent=intent,
                llm=llm,
                llm_config=llm_config,
                raw_settings=raw_settings,
                permissions=permissions,
                project_id=project_id,
                history=history,
            ):
                yield chunk
            return

        # 单 Agent：非 hub 直接执行；hub 则走 plan-execute（可能再 dispatch）
        target = intent.agent_id if self.registry.has(intent.agent_id) else "hub"
        if target != "hub":
            yield format_sse(
                "agent_switch",
                {
                    "agent_id": target,
                    "from": "hub",
                    "to": target,
                    "reason": f"意图路由 confidence={intent.confidence:.2f}",
                },
            )

        result_text_parts: list[str] = []
        async for item in self._run_agent(
            agent_id=target,
            user=user,
            session_id=session_id,
            message=message,
            llm=llm,
            llm_config=llm_config,
            raw_settings=raw_settings,
            permissions=permissions,
            project_id=project_id,
            history=history,
        ):
            if isinstance(item, EngineResult):
                if item.question:
                    # 反问已发出，结束
                    return
                if item.dispatches:
                    # Hub 触发了 dispatch
                    async for chunk in self._handle_dispatches(
                        dispatches=item.dispatches,
                        user=user,
                        session_id=session_id,
                        original_message=message,
                        llm=llm,
                        llm_config=llm_config,
                        raw_settings=raw_settings,
                        permissions=permissions,
                        project_id=project_id,
                        history=history,
                        hub_preamble=item.text,
                    ):
                        yield chunk
                    return
                result_text_parts.append(item.text)
            else:
                # 单 Agent 正常结束仍需要 done；dispatch 前的 done 会在子流程里再发
                yield item

        # 更新短期记忆
        await self.memory.append_short_memory(
            user.id,
            target,
            {"summary": (message[:80] + " → " + ("".join(result_text_parts)[:120]))},
        )

    async def handle_question_answer(
        self,
        *,
        user: User,
        session_id: UUID,
        question_id: str,
        answers: dict[str, Any],
        skipped: bool = False,
        project_id: UUID | None = None,
    ) -> AsyncIterator[str]:
        """用户回答反问后继续对话。"""
        llm_config = await build_llm_config_from_user(self.db, user.id)
        llm = LLMProvider(llm_config)
        raw_settings = {}
        try:
            raw_settings = json.loads(user.settings_json or "{}")
        except json.JSONDecodeError:
            pass
        permissions = {}
        try:
            permissions = json.loads(user.agent_permissions or "{}")
        except json.JSONDecodeError:
            pass

        summary = "用户跳过了反问" if skipped else f"用户反问回答: {json.dumps(answers, ensure_ascii=False)}"
        # 写入画像提案
        if not skipped and answers:
            await self.memory.propose_memory(
                user.id,
                agent_id="hub",
                value=json.dumps(answers, ensure_ascii=False)[:500],
                confidence=0.75,
                evidence=[f"question:{question_id}"],
                kind="preference",
            )

        followup = (
            f"{summary}\n\n请根据以上信息继续之前的任务，给出完整回答。"
        )
        history = await self.context_builder.load_chat_history(session_id)

        yield format_sse(
            "agent_switch",
            {
                "agent_id": "mentor",
                "from": "hub",
                "to": "mentor",
                "reason": "继续反问后的讲解",
            },
        )
        async for item in self._run_agent(
            agent_id="mentor",
            user=user,
            session_id=session_id,
            message=followup,
            llm=llm,
            llm_config=llm_config,
            raw_settings=raw_settings,
            permissions=permissions,
            project_id=project_id,
            history=history,
        ):
            if isinstance(item, EngineResult):
                pass
            else:
                yield item

    async def handle_direct_agent(
        self,
        *,
        user: User,
        session_id: UUID,
        agent_id: str,
        message: str,
        project_id: UUID | None = None,
    ) -> AsyncIterator[str]:
        """页面直调某 Agent（如 Scout 分析、Scribe 笔记、Atlas 图谱）。"""
        if not self.registry.has(agent_id):
            yield format_sse(
                "error",
                {"code": "AGENT_NOT_FOUND", "message": f"未知 Agent: {agent_id}"},
            )
            return
        llm_config = await build_llm_config_from_user(self.db, user.id)
        llm = LLMProvider(llm_config)
        raw_settings = {}
        try:
            raw_settings = json.loads(user.settings_json or "{}")
        except json.JSONDecodeError:
            pass
        permissions = {}
        try:
            permissions = json.loads(user.agent_permissions or "{}")
        except json.JSONDecodeError:
            pass

        yield format_sse(
            "agent_switch",
            {
                "agent_id": agent_id,
                "from": "hub",
                "to": agent_id,
                "reason": "页面直调",
            },
        )
        async for item in self._run_agent(
            agent_id=agent_id,
            user=user,
            session_id=session_id,
            message=message,
            llm=llm,
            llm_config=llm_config,
            raw_settings=raw_settings,
            permissions=permissions,
            project_id=project_id,
            history=[],
        ):
            if isinstance(item, EngineResult):
                pass
            else:
                yield item

    async def _orchestrate_multi(
        self,
        *,
        user: User,
        session_id: UUID,
        message: str,
        intent: IntentResult,
        llm: LLMProvider,
        llm_config,
        raw_settings: dict,
        permissions: dict,
        project_id: UUID | None,
        history: list,
    ) -> AsyncIterator[str]:
        yield format_sse(
            "thinking",
            {"content": f"多 Agent 编排: {intent.plan_summary or 'sequential'}"},
        )
        summaries: list[str] = []
        for sub in intent.sub_intents:
            if not self.registry.has(sub.agent_id):
                continue
            yield format_sse(
                "agent_switch",
                {
                    "agent_id": sub.agent_id,
                    "from": "hub",
                    "to": sub.agent_id,
                    "reason": sub.reason or "多意图编排",
                },
            )
            prior = "\n".join(summaries) if summaries else None
            agent_text = ""
            async for item in self._run_agent(
                agent_id=sub.agent_id,
                user=user,
                session_id=session_id,
                message=sub.message or message,
                llm=llm,
                llm_config=llm_config,
                raw_settings=raw_settings,
                permissions=permissions,
                project_id=project_id,
                history=history,
                prior_summary=prior,
            ):
                if isinstance(item, EngineResult):
                    agent_text = item.text
                    if item.question:
                        return
                else:
                    if isinstance(item, str) and item.startswith("event: done"):
                        continue
                    yield item
            summaries.append(f"[{sub.agent_id}] {agent_text[:500]}")

        # Hub 合并
        if summaries and llm.available:
            yield format_sse(
                "agent_switch",
                {
                    "agent_id": "hub",
                    "from": intent.sub_intents[-1].agent_id
                    if intent.sub_intents
                    else "hub",
                    "to": "hub",
                    "reason": "合并多 Agent 结果",
                },
            )
            merge_msg = (
                "请将以下专业 Agent 输出合并为对用户友好的统一回答：\n\n"
                + "\n\n".join(summaries)
                + f"\n\n用户原话：{message}"
            )
            async for item in self._run_agent(
                agent_id="hub",
                user=user,
                session_id=session_id,
                message=merge_msg,
                llm=llm,
                llm_config=llm_config,
                raw_settings=raw_settings,
                permissions=permissions,
                project_id=project_id,
                history=[],
            ):
                if not isinstance(item, EngineResult):
                    yield item
        # 多 Agent 流程结束信号（子 Agent 的中间 done 已被过滤）
        yield format_sse(
            "done",
            {"usage": {"tokens": 0}, "iterations": len(summaries), "agent_id": "hub"},
        )

    async def _handle_dispatches(
        self,
        *,
        dispatches: list[dict],
        user: User,
        session_id: UUID,
        original_message: str,
        llm: LLMProvider,
        llm_config,
        raw_settings: dict,
        permissions: dict,
        project_id: UUID | None,
        history: list,
        hub_preamble: str,
    ) -> AsyncIterator[str]:
        if hub_preamble:
            # 已在引擎中 stream，这里不再重复
            pass
        summaries: list[str] = []
        for d in dispatches[:3]:
            target = d.get("target_agent") or "scout"
            task = d.get("task") or original_message
            reason = d.get("reason") or "Hub 调度"
            if not self.registry.has(target):
                yield format_sse(
                    "thinking",
                    {"content": f"跳过未注册 Agent: {target}（接口已保留，待未来接入）"},
                )
                continue
            yield format_sse(
                "agent_switch",
                {
                    "agent_id": target,
                    "from": "hub",
                    "to": target,
                    "reason": reason,
                },
            )
            text = ""
            async for item in self._run_agent(
                agent_id=target,
                user=user,
                session_id=session_id,
                message=task,
                llm=llm,
                llm_config=llm_config,
                raw_settings=raw_settings,
                permissions=permissions,
                project_id=project_id,
                history=history,
                prior_summary="\n".join(summaries) if summaries else None,
            ):
                if isinstance(item, EngineResult):
                    text = item.text
                    if item.question:
                        return
                else:
                    # 子 Agent 的中间 done 会让前端误追加多条；过滤掉
                    if isinstance(item, str) and item.startswith("event: done"):
                        continue
                    yield item
            summaries.append(f"[{target}] {text[:800]}")

        if summaries:
            yield format_sse(
                "agent_switch",
                {
                    "agent_id": "hub",
                    "from": dispatches[-1].get("target_agent", "hub")
                    if dispatches
                    else "hub",
                    "to": "hub",
                    "reason": "汇总调度结果",
                },
            )
            merge = (
                "作为 Hub，合并以下专家输出，给用户最终答复：\n"
                + "\n".join(summaries)
                + f"\n用户问题：{original_message}"
            )
            async for item in self._run_agent(
                agent_id="hub",
                user=user,
                session_id=session_id,
                message=merge,
                llm=llm,
                llm_config=llm_config,
                raw_settings=raw_settings,
                permissions=permissions,
                project_id=project_id,
                history=[],
            ):
                if not isinstance(item, EngineResult):
                    yield item

    async def _run_agent(
        self,
        *,
        agent_id: str,
        user: User,
        session_id: UUID,
        message: str,
        llm: LLMProvider,
        llm_config,
        raw_settings: dict,
        permissions: dict,
        project_id: UUID | None,
        history: list,
        prior_summary: str | None = None,
    ) -> AsyncIterator[str | EngineResult]:
        agent_def = self.registry.get(agent_id)
        # per-agent model override
        override = get_agent_model_override(raw_settings, agent_id)
        if override:
            agent_def = agent_def  # frozen-like; set on copy
            from dataclasses import replace

            agent_def = replace(agent_def, model_override=override)

        style = get_agent_speaking_style(raw_settings, agent_id)
        ctx = await self.context_builder.build_run_context(
            user_id=user.id,
            session_id=session_id,
            agent_id=agent_id,
            llm=llm,
            llm_config=llm_config,
            project_id=project_id,
            speaking_style=style,
            permissions=permissions,
        )
        messages = await self.context_builder.build_messages(
            agent_def=agent_def,
            ctx=ctx,
            user_message=message,
            history=history,
            prior_agent_summary=prior_summary,
        )
        async for item in self.engine.run(
            agent_def=agent_def, ctx=ctx, messages=messages, emit_sse=True
        ):
            yield item
