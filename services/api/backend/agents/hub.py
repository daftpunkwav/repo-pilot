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

# 汇总时传给 Hub 的专家正文上限（过短会导致 Hub 误判「专家没写完」而再次 dispatch）
_EXPERT_SUMMARY_CHARS = 12000


def _clip_expert_text(text: str, limit: int = _EXPERT_SUMMARY_CHARS) -> str:
    t = (text or "").strip()
    if len(t) <= limit:
        return t
    return t[:limit] + "\n…(已截断)"


def apply_merge_mode(agent_def):
    """汇总轮：强制 CoT 无工具，避免再次 dispatch 被外层丢弃。"""
    from dataclasses import replace

    return replace(
        agent_def,
        workflow="cot",
        tools=[],
        max_iterations=1,
        system_prompt=(
            (agent_def.system_prompt or "")
            + "\n\n【本轮强制】你正在合并已返回的专家结果。"
            "禁止规划、禁止工具、禁止 dispatch；直接写最终用户可见正文。"
        ),
    )


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

        # 意图：force_agent 才直达专家；普通会话一律经 Hub 编排（hub→专家→hub）
        if force_agent and self.registry.has(force_agent):
            intent = IntentResult(agent_id=force_agent, confidence=1.0)
        else:
            intent = await classifier.classify(message)

        yield format_sse(
            "thinking",
            {
                "content": (
                    f"意图识别: {intent.agent_id} (confidence={intent.confidence:.2f})"
                    + (f" multi=[{intent.plan_summary}]" if intent.is_multi else "")
                    + ("" if force_agent else " → 经 Hub 编排")
                    + "\n"
                ),
            },
        )

        history = await self.context_builder.load_chat_history(session_id)

        if intent.is_multi and intent.sub_intents and not force_agent:
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

        # 单 Agent：仅 force_agent 直达；否则固定 Hub，由 dispatch_agent 调度
        if force_agent and self.registry.has(force_agent):
            target = force_agent
        else:
            target = "hub"

        if target != "hub":
            yield format_sse(
                "agent_switch",
                {
                    "agent_id": target,
                    "from": "hub",
                    "to": target,
                    "reason": f"强制直达 {target}",
                },
            )

        # 把意图提示给 Hub，便于其决定是否 dispatch（不绕过 Hub）
        run_message = message
        if target == "hub" and intent.agent_id != "hub":
            run_message = (
                f"[编排提示] 本轮意图偏向 {intent.agent_id}"
                f"（confidence={intent.confidence:.2f}）。"
                "若属专业任务请用 dispatch_agent 调度对应专家，"
                "专家结束后由你汇总；不要自己代替专家做深度分析。\n\n"
                f"{message}"
            )

        result_text_parts: list[str] = []
        async for item in self._run_agent(
            agent_id=target,
            user=user,
            session_id=session_id,
            message=run_message,
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
            f"{summary}\n\n请根据以上信息继续编排："
            "若仍需专家深入，使用 dispatch_agent；否则由你直接给出完整回答。"
        )
        history = await self.context_builder.load_chat_history(session_id)

        yield format_sse(
            "agent_switch",
            {
                "agent_id": "hub",
                "from": "hub",
                "to": "hub",
                "reason": "反问结束，回到 Hub 继续编排",
            },
        )
        async for item in self._run_agent(
            agent_id="hub",
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
                if item.question:
                    return
                if item.dispatches:
                    async for chunk in self._handle_dispatches(
                        dispatches=item.dispatches,
                        user=user,
                        session_id=session_id,
                        original_message=followup,
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
        from backend.llm.config import build_llm_bundle_from_user

        # 配置/诊断/override 同源：一次查库
        llm_config, key_status, raw_settings = await build_llm_bundle_from_user(
            self.db, user.id
        )
        llm = LLMProvider(llm_config)
        permissions = {}
        try:
            # permissions 也尽量刷新
            await self.db.refresh(user, attribute_names=["agent_permissions"])
            permissions = json.loads(user.agent_permissions or "{}")
        except Exception:
            try:
                permissions = json.loads(user.agent_permissions or "{}")
            except json.JSONDecodeError:
                permissions = {}

        if not llm.available:
            if key_status == "decrypt_failed":
                msg = (
                    "API Key 解密失败（可能更换过 SECRET_KEY）。"
                    "请到设置页重新保存 LLM API Key 后再试。"
                )
            else:
                msg = "未配置 LLM API Key，请到设置页填写并保存后再试。"
            yield format_sse("error", {"code": "LLM_NOT_CONFIGURED", "message": msg})
            yield format_sse(
                "text_delta",
                {"content": f"【{agent_id}】{msg}"},
            )
            yield format_sse(
                "done",
                {"usage": {"tokens": 0}, "iterations": 0, "degraded": True},
            )
            return

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
            disable_questions=True,
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
            summaries.append(
                f"[{sub.agent_id}] {_clip_expert_text(agent_text)}"
            )

        # Hub 合并（禁止再调度）
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
            merge_msg = self._merge_prompt(summaries, message)
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
                merge_mode=True,
            ):
                if isinstance(item, EngineResult):
                    if item.dispatches:
                        logger.warning(
                            "merge_mode Hub 仍返回 dispatches，已忽略: %s",
                            [d.get("target_agent") for d in item.dispatches],
                        )
                    continue
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
            summaries.append(f"[{target}] {_clip_expert_text(text)}")

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
            merge = self._merge_prompt(summaries, original_message)
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
                merge_mode=True,
            ):
                if isinstance(item, EngineResult):
                    if item.dispatches:
                        logger.warning(
                            "merge_mode Hub 仍返回 dispatches，已忽略: %s",
                            [d.get("target_agent") for d in item.dispatches],
                        )
                    continue
                yield item

    @staticmethod
    def _merge_prompt(summaries: list[str], user_message: str) -> str:
        """专家已返回后的 Hub 汇总提示：禁止再规划/再调度。"""
        return (
            "【汇总任务 · 禁止再调度】专家已完成工作，下面是他们的完整输出。"
            "请直接合并为面向用户的最终 Markdown 答复："
            "突出关键路径与下一步，可适度精简重复，不要整段照抄；"
            "若专家已给出分支选项，保留并引导用户选择。"
            "严禁再次调用任何工具或 dispatch_agent；"
            "严禁再输出「执行计划」或「正在调度」。\n\n"
            + "\n\n".join(summaries)
            + f"\n\n用户原话：{user_message}"
        )

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
        disable_questions: bool = False,
        merge_mode: bool = False,
    ) -> AsyncIterator[str | EngineResult]:
        from dataclasses import replace

        agent_def = self.registry.get(agent_id)
        # per-agent model override
        override = get_agent_model_override(raw_settings, agent_id)
        if override:
            agent_def = replace(agent_def, model_override=override)

        # 汇总轮：强制 CoT 无工具，避免 plan_execute 再次 dispatch 后外层丢弃导致假卡住
        if merge_mode:
            agent_def = apply_merge_mode(agent_def)

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
        # 详情页 / 导入等无反问 UI 的入口：禁止挂起 question 事件
        if disable_questions:
            ctx.extra["disable_questions"] = True
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
