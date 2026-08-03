"""ReAct / Plan-Execute / Reflexion 执行引擎"""
from __future__ import annotations

import json
import logging
import re
import uuid
from dataclasses import dataclass, field
from typing import Any, AsyncIterator

from backend.agents.registry import AgentDefinition
from backend.llm.provider import LLMCompleteResult, LLMProvider
from backend.memory.context import AgentRunContext
from backend.services.sse_stream import format_sse

logger = logging.getLogger(__name__)


@dataclass
class EngineResult:
    text: str = ""
    agent_id: str = "hub"
    usage: dict[str, int] = field(default_factory=dict)
    iterations: int = 0
    question: dict[str, Any] | None = None
    dispatches: list[dict[str, Any]] = field(default_factory=list)
    pending_status: str | None = None


class ReActEngine:
    MAX_ITERATIONS = 8

    def __init__(self, max_iterations: int | None = None):
        self.max_iterations = max_iterations or self.MAX_ITERATIONS

    def _effective_max_iter(self, agent_def: AgentDefinition) -> int:
        """优先使用 Agent 定义的 max_iterations。"""
        defined = getattr(agent_def, "max_iterations", None)
        if isinstance(defined, int) and defined > 0:
            return min(defined, self.max_iterations)
        return self.max_iterations

    def _prefer_token_stream(self, agent_def: AgentDefinition, tools: list) -> bool:
        """
        direct / 无工具：直接真流式吐 token。
        cot 仅在无工具时走两阶段流式；有工具则走工具环。
        ReAct 有工具时：工具轮非流式，最终回答轮再流式（见循环内分支）。
        """
        if not getattr(agent_def, "streaming", True):
            return False
        wf = (agent_def.workflow or "react").lower()
        if wf == "direct":
            return True
        if not tools:
            return True
        return False

    async def _stream_plain_text(
        self,
        *,
        llm: LLMProvider,
        messages: list[dict[str, Any]],
        agent_def: AgentDefinition,
        emit_sse: bool,
        channel: str = "text",
        max_tokens: int | None = None,
    ) -> AsyncIterator[str | Any]:
        """纯流式：channel=text→text_delta，channel=thinking→thinking。最后 yield LLMCompleteResult。"""
        from backend.llm.provider import LLMChunk, LLMCompleteResult as LCR

        full = ""
        usage: dict[str, int] = {}
        event_name = "thinking" if channel == "thinking" else "text_delta"
        try:
            stream = await llm.complete(
                messages,
                tools=None,
                temperature=agent_def.temperature,
                max_tokens=max_tokens or agent_def.max_tokens,
                stream=True,
                model_override=agent_def.model_override,
            )
            assert not isinstance(stream, LCR)
            async for chunk in stream:
                if not isinstance(chunk, LLMChunk):
                    continue
                if chunk.type == "text" and chunk.text:
                    full += chunk.text
                    if emit_sse:
                        yield format_sse(event_name, {"content": chunk.text})
                elif chunk.type == "thinking" and chunk.text:
                    # 原生 reasoning：始终进 thinking 通道；
                    # 当本段目标就是 thinking 时，一并计入 full（供规划注入后续消息）
                    if channel == "thinking":
                        full += chunk.text
                    if emit_sse:
                        yield format_sse("thinking", {"content": chunk.text})
                elif chunk.type == "done":
                    usage = chunk.usage or {}
                elif chunk.type == "error":
                    err = chunk.error or "LLM 流式错误"
                    if emit_sse:
                        yield format_sse("error", {"code": "LLM_ERROR", "message": err})
                    yield LCR(text=full or err, usage=usage, failed=True)
                    return
        except Exception as e:
            logger.exception("LLM stream error in engine")
            err = f"LLM 调用失败：{e}"
            if emit_sse:
                yield format_sse("error", {"code": "LLM_ERROR", "message": err})
            yield LCR(text=full or err, usage=usage, failed=True)
            return
        yield LCR(text=full, usage=usage, failed=False)

    async def _cot_two_phase_stream(
        self,
        *,
        llm: LLMProvider,
        messages: list[dict[str, Any]],
        agent_def: AgentDefinition,
        emit_sse: bool,
        total_usage: dict[str, int],
    ) -> AsyncIterator[str | EngineResult]:
        """
        CoT 两阶段（不依赖模型自觉写标记）：
        1) 流式生成短推理 → thinking 通道
        2) 流式生成正文 → text_delta 通道
        """
        if emit_sse:
            yield format_sse(
                "thinking",
                {
                    "content": (
                        f"[状态] {agent_def.name} · {agent_def.workflow or 'cot'}\n"
                        f"[阶段 1/2] 生成分析思路…\n"
                    )
                },
            )

        think_messages = list(messages) + [
            {
                "role": "user",
                "content": (
                    "先只输出分析思路（3-6 句要点），说明你会看哪些方面、结论方向。"
                    "不要写最终完整正文，不要标题装饰，不要 emoji。"
                ),
            }
        ]
        think_text = ""
        phase1_failed = False
        async for item in self._stream_plain_text(
            llm=llm,
            messages=think_messages,
            agent_def=agent_def,
            emit_sse=emit_sse,
            channel="thinking",
            max_tokens=min(320, agent_def.max_tokens),
        ):
            if isinstance(item, str):
                yield item
            else:
                think_text = (item.text or "").strip()
                phase1_failed = bool(getattr(item, "failed", False))
                for k in total_usage:
                    total_usage[k] = total_usage.get(k, 0) + (item.usage or {}).get(k, 0)

        if phase1_failed:
            if emit_sse:
                yield format_sse(
                    "done",
                    {
                        "usage": {
                            "tokens": total_usage.get("total_tokens", 0),
                            **total_usage,
                        },
                        "iterations": 1,
                        "agent_id": agent_def.id,
                        "failed": True,
                    },
                )
            yield EngineResult(
                text=think_text or "LLM 调用失败",
                agent_id=agent_def.id,
                usage=total_usage,
                iterations=1,
            )
            return

        if emit_sse and not think_text:
            yield format_sse(
                "thinking",
                {"content": "（思路阶段无内容，继续生成正文）\n"},
            )
        elif emit_sse and think_text and not think_text.endswith("\n"):
            yield format_sse("thinking", {"content": "\n"})

        if emit_sse:
            yield format_sse(
                "thinking",
                {"content": "[阶段 2/2] 基于思路流式输出正文…\n"},
            )

        answer_messages = list(messages)
        if think_text:
            answer_messages = list(messages) + [
                {
                    "role": "assistant",
                    "content": f"分析思路：\n{think_text}",
                },
                {
                    "role": "user",
                    "content": (
                        "请基于上述思路输出完整正文（Markdown）。"
                        "不要重复思路段落，不要 emoji，直接给用户可读结论。"
                    ),
                },
            ]

        final_text = ""
        async for item in self._stream_plain_text(
            llm=llm,
            messages=answer_messages,
            agent_def=agent_def,
            emit_sse=emit_sse,
            channel="text",
            max_tokens=agent_def.max_tokens,
        ):
            if isinstance(item, str):
                yield item
            else:
                final_text = (item.text or "").strip()
                for k in total_usage:
                    total_usage[k] = total_usage.get(k, 0) + (item.usage or {}).get(k, 0)

        if not final_text:
            final_text = (
                f"我是 {agent_def.name}，已收到你的消息。"
                "请补充更具体的需求（例如技术栈、学习目标），我会继续帮你。"
            )
            if emit_sse:
                yield format_sse("text_delta", {"content": final_text})

        if emit_sse:
            yield format_sse(
                "done",
                {
                    "usage": {
                        "tokens": total_usage.get("total_tokens", 0),
                        **total_usage,
                    },
                    "iterations": 2,
                    "agent_id": agent_def.id,
                    "streamed": True,
                    "cot_two_phase": True,
                },
            )
        yield EngineResult(
            text=final_text,
            agent_id=agent_def.id,
            usage=total_usage,
            iterations=2,
        )


    async def _plan_phase_to_thinking(
        self,
        *,
        llm: LLMProvider,
        messages: list[dict[str, Any]],
        agent_def: AgentDefinition,
        emit_sse: bool,
        total_usage: dict[str, int],
        workflow: str,
    ) -> AsyncIterator[str | list[dict[str, Any]]]:
        """多步工作流：先流式生成真实行动计划 → thinking，再把计划注入后续消息。"""
        if emit_sse:
            yield format_sse(
                "thinking",
                {
                    "content": (
                        f"[规划] {agent_def.name} · {workflow}\n"
                        "正在生成行动计划…\n\n"
                    )
                },
            )

        if workflow == "plan_execute":
            plan_prompt = (
                "先只输出本轮行动计划（3-6 条短句要点），说明："
                "1) 用户意图理解；2) 是否需要调度专家（谁/为何）；"
                "3) 自己直接回答什么。不要写给用户看的最终正文，不要 emoji。"
            )
            exec_prompt = (
                "请按上述计划立刻执行，不要再复述或改写「执行计划」列表。"
                "需要调度专家时必须调用 dispatch_agent（可一次多个，默认≤2）；"
                "可直接回答则输出用户可见的完整正文（Markdown）。"
                "禁止只宣布计划、禁止 emoji。"
            )
        elif workflow == "tot":
            plan_prompt = (
                "先只输出讲解路径比较（2-3 条）并标明将展开哪一条。"
                "不要写完整讲解正文，不要 emoji。"
            )
            exec_prompt = (
                "请按选定路径立刻写出用户可见的完整 Markdown 正文。"
                "仅可使用你当前可用的工具白名单；禁止调用或提及 dispatch_agent。"
                "禁止只宣布计划、禁止 emoji。"
            )
        else:
            plan_prompt = (
                "先只输出方案要点与自我检查清单（3-5 条）。"
                "不要写最终建议正文，不要 emoji。"
            )
            exec_prompt = (
                "请按检查清单立刻写出用户可见的完整 Markdown 正文。"
                "仅可使用你当前可用的工具白名单；禁止调用或提及 dispatch_agent。"
                "禁止只宣布计划、禁止 emoji。"
            )

        # 高置信快速编排：压缩规划 token；tot 讲解路径需要略宽
        plan_cap = min(420, agent_def.max_tokens)
        if workflow == "tot":
            plan_cap = min(900, agent_def.max_tokens)
        blob = " ".join(
            str(m.get("content") or "") for m in messages if m.get("role") == "user"
        )
        if "[快速编排]" in blob:
            plan_cap = min(280, plan_cap)
            plan_prompt = (
                "用 ≤3 条极短要点写出行动计划（意图 / 调度谁 / 是否自答），"
                "不要最终正文，不要 emoji。"
            )

        plan_messages = list(messages) + [{"role": "user", "content": plan_prompt}]
        plan_text = ""
        async for item in self._stream_plain_text(
            llm=llm,
            messages=plan_messages,
            agent_def=agent_def,
            emit_sse=emit_sse,
            channel="thinking",
            max_tokens=plan_cap,
        ):
            if isinstance(item, str):
                yield item
            else:
                plan_text = (item.text or "").strip()
                for k in total_usage:
                    total_usage[k] = total_usage.get(k, 0) + (item.usage or {}).get(k, 0)

        if emit_sse:
            yield format_sse("thinking", {"content": "\n[规划完成] 开始执行…\n"})

        next_messages = list(messages)
        if plan_text:
            next_messages = list(messages) + [
                {"role": "assistant", "content": f"行动计划：\n{plan_text}"},
                {"role": "user", "content": exec_prompt},
            ]
        yield next_messages

    async def run(
        self,
        *,
        agent_def: AgentDefinition,
        ctx: AgentRunContext,
        messages: list[dict[str, Any]],
        emit_sse: bool = True,
    ) -> AsyncIterator[str | EngineResult]:
        """
        执行推理循环。yield SSE 字符串；最后 yield EngineResult。

        - cot / 无工具：真 token 流式
        - react 有工具：工具轮非流式；无工具后的最终回答流式
        """
        from backend.llm.provider import LLMCompleteResult

        llm = ctx.llm
        if not llm.available:
            text = self._degraded_reply(agent_def, messages)
            if emit_sse:
                for i in range(0, len(text), 40):
                    yield format_sse("text_delta", {"content": text[i : i + 40]})
                yield format_sse(
                    "done",
                    {"usage": {"tokens": len(text)}, "iterations": 0, "degraded": True},
                )
            yield EngineResult(text=text, agent_id=agent_def.id, iterations=0)
            return

        tools = ctx.tool_registry.openai_tools_for(agent_def.id)
        # 仅暴露 AgentDefinition.tools 白名单，避免 registry 里 allowed_agents 过宽
        if agent_def.tools:
            allow = set(agent_def.tools)
            tools = [
                t
                for t in tools
                if (t.get("function") or {}).get("name") in allow
            ]
        else:
            tools = []
        # direct = 汇总/强制无工具快路径；cot 保留工具能力（由白名单决定）
        wf = (agent_def.workflow or "react").lower()
        if wf == "direct":
            tools = []

        # 工作流提示注入
        workflow_hint = self._workflow_hint(agent_def)
        if workflow_hint:
            messages = list(messages)
            messages.insert(1, {"role": "system", "content": workflow_hint})

        total_usage: dict[str, int] = {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }
        final_text = ""
        dispatches: list[dict[str, Any]] = []
        iteration = 0
        max_iter = self._effective_max_iter(agent_def)
        # plan_execute 偶发把「执行计划」当最终答复；最多纠正 2 次
        plan_nudge_used = 0

        # —— 流式快路径 ——
        # cot：两阶段；direct / 其它无工具：单次正文流式
        if self._prefer_token_stream(agent_def, tools):
            if wf == "cot":
                async for item in self._cot_two_phase_stream(
                    llm=llm,
                    messages=messages,
                    agent_def=agent_def,
                    emit_sse=emit_sse,
                    total_usage=total_usage,
                ):
                    if isinstance(item, EngineResult):
                        yield item
                        return
                    yield item
                return
            # direct / 无工具：Hub 汇总轮已有「汇总中」状态，勿再叠「生成中」
            if emit_sse and agent_def.id != "hub":
                yield format_sse(
                    "thinking",
                    {
                        "content": f"[状态] {agent_def.name} · 生成中\n",
                    },
                )
            async for item in self._stream_plain_text(
                llm=llm,
                messages=messages,
                agent_def=agent_def,
                emit_sse=emit_sse,
                channel="text",
            ):
                if isinstance(item, str):
                    yield item
                else:
                    final_text = (item.text or "").strip()
                    for k in total_usage:
                        total_usage[k] = total_usage.get(k, 0) + (
                            item.usage or {}
                        ).get(k, 0)
                    if getattr(item, "failed", False):
                        if emit_sse:
                            yield format_sse(
                                "done",
                                {
                                    "usage": total_usage,
                                    "iterations": 1,
                                    "agent_id": agent_def.id,
                                    "failed": True,
                                },
                            )
                        yield EngineResult(
                            text=final_text or "LLM 调用失败",
                            agent_id=agent_def.id,
                            usage=total_usage,
                            iterations=1,
                        )
                        return
            if emit_sse:
                yield format_sse(
                    "done",
                    {
                        "usage": {
                            "tokens": total_usage.get("total_tokens", 0),
                            **total_usage,
                        },
                        "iterations": 1,
                        "agent_id": agent_def.id,
                        "streamed": True,
                    },
                )
            yield EngineResult(
                text=final_text,
                agent_id=agent_def.id,
                usage=total_usage,
                iterations=1,
            )
            return

        # —— 多步工作流：先流式输出真实规划到 thinking，再进入工具环 ——
        if wf in ("plan_execute", "tot", "reflexion"):
            async for item in self._plan_phase_to_thinking(
                llm=llm,
                messages=messages,
                agent_def=agent_def,
                emit_sse=emit_sse,
                total_usage=total_usage,
                workflow=wf,
            ):
                if isinstance(item, list):
                    messages = item
                elif isinstance(item, str):
                    yield item

        while iteration < max_iter:
            iteration += 1
            if emit_sse:
                yield format_sse(
                    "thinking",
                    {
                        "content": (
                            f"[状态] 执行 · {agent_def.name} · "
                            f"{iteration}/{max_iter}\n"
                        ),
                        "iteration": iteration,
                    },
                )

            try:
                result = await llm.complete(
                    messages,
                    tools=tools if tools else None,
                    temperature=agent_def.temperature,
                    max_tokens=agent_def.max_tokens,
                    stream=False,
                    model_override=agent_def.model_override,
                )
            except Exception as e:
                logger.exception("LLM error in ReAct")
                err = f"LLM 调用失败：{e}"
                if emit_sse:
                    yield format_sse("error", {"code": "LLM_ERROR", "message": err})
                yield EngineResult(text=err, agent_id=agent_def.id, iterations=iteration)
                return

            assert isinstance(result, LLMCompleteResult)
            for k in total_usage:
                total_usage[k] = total_usage.get(k, 0) + result.usage.get(k, 0)

            # 原生 reasoning 立刻进思考区（工具轮非流式时尤其重要）
            native_reason = (getattr(result, "reasoning", None) or "").strip()
            if native_reason and emit_sse:
                yield format_sse(
                    "thinking",
                    {"content": f"[中间推理]\n{native_reason}\n"},
                )

            # assistant message
            assistant_msg: dict[str, Any] = {
                "role": "assistant",
                "content": result.text or None,
            }
            if result.tool_calls:
                assistant_msg["tool_calls"] = result.tool_calls
            messages.append(assistant_msg)

            # 工具轮若附带部分正文，先记入思考区，避免信息丢失
            if result.tool_calls and result.text and emit_sse:
                yield format_sse(
                    "thinking",
                    {"content": f"[中间推理]\n{(result.text or '').strip()}\n"},
                )

            if result.text and not result.tool_calls:
                from backend.agents.think_stream import split_complete_text

                think, body = split_complete_text(result.text)
                candidate = (body or result.text or "").strip()
                # Hub/plan_execute：只宣布「执行计划」而未调工具 → 纠正后继续，避免假完成
                if (
                    wf == "plan_execute"
                    and iteration < max_iter
                    and plan_nudge_used < 2
                    and is_plan_announcement(candidate, agent_id=agent_def.id)
                ):
                    plan_nudge_used += 1
                    if emit_sse:
                        yield format_sse(
                            "thinking",
                            {
                                "content": (
                                    f"[纠正] 检测到仅宣布计划、未真正执行"
                                    f"（第 {plan_nudge_used} 次），要求继续…\n"
                                    f"{candidate[:500]}\n"
                                )
                            },
                        )
                    messages.append(
                        {
                            "role": "user",
                            "content": (
                                "上一段只是在复述/宣布计划，对用户没有完成交付。"
                                "请立刻执行：要么调用 dispatch_agent（可一次多个）"
                                "调度计划中的专家；要么直接输出完整可用的 Markdown 答复。"
                                "禁止再只输出「执行计划」列表或「开始分派」之类宣告。"
                            ),
                        }
                    )
                    continue
                if think and emit_sse:
                    yield format_sse("thinking", {"content": think + "\n"})
                final_text = candidate or result.text
                if emit_sse:
                    step = 24
                    for i in range(0, len(final_text), step):
                        yield format_sse(
                            "text_delta", {"content": final_text[i : i + step]}
                        )
                break

            if not result.tool_calls:
                # 无工具调用且正文为空：不要在这里填弱占位并结束。
                # 弱占位会让 final_text 非空，从而跳过循环后的「强制无工具收口」，
                # 这是 Mentor/ToT 工具轮后空正文的主要失败路径。
                break

            # 处理工具调用
            question_payload = None
            for tc in result.tool_calls:
                fn = tc.get("function") or {}
                name = fn.get("name") or ""
                raw_args = fn.get("arguments") or "{}"
                try:
                    args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                except json.JSONDecodeError:
                    args = {}
                tc_id = tc.get("id") or f"call_{uuid.uuid4().hex[:8]}"

                if emit_sse:
                    yield format_sse(
                        "tool_call",
                        {
                            "call_id": tc_id,
                            "id": tc_id,
                            "name": name,
                            "status": "running",
                            "args": args,
                        },
                    )

                tool_result = await ctx.tool_registry.execute(name, args, ctx)

                # 反问拦截
                if isinstance(tool_result, dict) and tool_result.get("__question__"):
                    # 嵌入式导入助手等场景禁用反问面板 → 转成文字追问
                    if ctx.extra.get("disable_questions"):
                        q = _normalize_question(tool_result, agent_id=agent_def.id)
                        title = ""
                        intro = q.get("intro") or {}
                        if isinstance(intro, dict):
                            title = intro.get("content") or ""
                        qs = q.get("questions") or []
                        lines = [title or "想再确认几点："]
                        for item in qs[:5]:
                            if isinstance(item, dict):
                                lines.append(f"- {item.get('text') or item.get('prompt') or ''}")
                        text_q = "\n".join([ln for ln in lines if ln]).strip()
                        if emit_sse:
                            yield format_sse(
                                "tool_result",
                                {
                                    "call_id": tc_id,
                                    "id": tc_id,
                                    "name": name,
                                    "status": "success",
                                    "preview": "转为文字追问",
                                    "result": {"converted": True},
                                },
                            )
                            if text_q:
                                step = 32
                                for i in range(0, len(text_q), step):
                                    yield format_sse(
                                        "text_delta",
                                        {"content": text_q[i : i + step]},
                                    )
                        messages.append(
                            {
                                "role": "tool",
                                "tool_call_id": tc_id,
                                "content": json.dumps(
                                    {
                                        "ok": True,
                                        "message": "反问已转为文字，请直接用自然语言继续回答用户",
                                    },
                                    ensure_ascii=False,
                                ),
                            }
                        )
                        final_text = text_q
                        # 继续循环让模型基于「反问已转文字」生成完整答复
                        continue

                    question_payload = _normalize_question(
                        tool_result, agent_id=agent_def.id
                    )
                    if emit_sse:
                        yield format_sse(
                            "tool_result",
                            {
                                "call_id": tc_id,
                                "id": tc_id,
                                "name": name,
                                "status": "success",
                                "preview": "等待用户回答",
                                "result": {"status": "waiting_user"},
                            },
                        )
                        yield format_sse("question", question_payload)
                        # 有结构化反问面板时，不再追加 text_delta，避免前端出现
                        # 「弹窗 + 半截回复」叠在一起，以及后续轮次状态错乱
                        yield format_sse(
                            "done",
                            {
                                "usage": total_usage,
                                "iterations": iteration,
                                "agent_id": agent_def.id,
                                "pending_question": True,
                            },
                        )
                    # 持久化 pending 到 extra
                    ctx.extra["pending_question"] = question_payload
                    yield EngineResult(
                        text="",
                        agent_id=agent_def.id,
                        usage=total_usage,
                        iterations=iteration,
                        question=question_payload,
                        pending_status="pending_question",
                    )
                    return

                # Hub 调度拦截
                if isinstance(tool_result, dict) and tool_result.get("__dispatch__"):
                    dispatches.append(tool_result)
                    if emit_sse:
                        yield format_sse(
                            "tool_result",
                            {
                                "call_id": tc_id,
                                "id": tc_id,
                                "name": name,
                                "status": "success",
                                "preview": f"调度 {tool_result.get('target_agent')}",
                                "result": tool_result,
                            },
                        )
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc_id,
                            "content": json.dumps(
                                {
                                    "ok": True,
                                    "message": f"已记录调度 {tool_result.get('target_agent')}",
                                },
                                ensure_ascii=False,
                            ),
                        }
                    )
                    continue

                # 会话项目上下文变更 → 前端刷新右栏
                if isinstance(tool_result, dict) and tool_result.get("__session_projects__"):
                    if emit_sse:
                        yield format_sse(
                            "tool_result",
                            {
                                "call_id": tc_id,
                                "id": tc_id,
                                "name": name,
                                "status": "success",
                                "preview": f"上下文项目 {tool_result.get('count', 0)} 个",
                                "result": tool_result,
                            },
                        )
                        yield format_sse(
                            "session_projects",
                            {
                                "project_ids": tool_result.get("project_ids") or [],
                                "action": tool_result.get("action") or "add",
                                "count": tool_result.get("count") or 0,
                            },
                        )
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc_id,
                            "content": json.dumps(
                                {
                                    "ok": True,
                                    "project_ids": tool_result.get("project_ids") or [],
                                    "message": "已更新会话项目上下文",
                                },
                                ensure_ascii=False,
                            ),
                        }
                    )
                    continue

                # 导入助手：勾选仓库（前端同步左侧 checkbox）
                if isinstance(tool_result, dict) and tool_result.get("__select_repos__"):
                    if emit_sse:
                        yield format_sse(
                            "tool_result",
                            {
                                "call_id": tc_id,
                                "id": tc_id,
                                "name": name,
                                "status": "success",
                                "preview": f"勾选 {tool_result.get('count', 0)} 个仓库",
                                "result": tool_result,
                            },
                        )
                        yield format_sse(
                            "select_repos",
                            {
                                "repo_keys": tool_result.get("repo_keys") or [],
                                "action": tool_result.get("action") or "set",
                                "reason": tool_result.get("reason") or "",
                                "count": tool_result.get("count") or 0,
                            },
                        )
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc_id,
                            "content": json.dumps(
                                {
                                    "ok": True,
                                    "selected": tool_result.get("repo_keys") or [],
                                    "message": "已在界面勾选，请用文字向用户说明清单",
                                },
                                ensure_ascii=False,
                            ),
                        }
                    )
                    continue

                preview = _preview(tool_result)
                if emit_sse:
                    yield format_sse(
                        "tool_result",
                        {
                            "call_id": tc_id,
                            "id": tc_id,
                            "name": name,
                            "status": "success"
                            if not (
                                isinstance(tool_result, dict)
                                and tool_result.get("error")
                            )
                            else "error",
                            "preview": preview,
                            "result": tool_result
                            if _small_enough(tool_result)
                            else {"preview": preview},
                        },
                    )
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc_id,
                        "content": json.dumps(tool_result, ensure_ascii=False, default=str)[
                            :12000
                        ],
                    }
                )

            # 若本轮有 dispatch，结束循环让 Hub 外层编排
            if dispatches:
                # 让模型再生成一句说明，或直接结束
                if not final_text:
                    final_text = ""
                break

        # 若有 dispatch：正文预告由 Hub._handle_dispatches 发出，此处不占位
        if dispatches and not final_text:
            final_text = ""

        # 工具轮结束后仍无正文：强制无工具再答一轮（Mentor/ToT 常见只调工具不写正文）
        if not (final_text or "").strip() and not dispatches:
            if emit_sse:
                yield format_sse(
                    "thinking",
                    {
                        "content": (
                            f"[收口] {agent_def.name} 工具轮结束仍无正文，"
                            "改为直接生成分析…\n"
                        )
                    },
                )
            messages.append(
                {
                    "role": "user",
                    "content": (
                        "请停止调用任何工具，直接用中文输出完整分析正文（Markdown）。"
                        "基于上文已有的工具结果与项目上下文作答。"
                        "必须写完：完整句、完整列表与闭合括号；不要半截收尾。"
                        "不要 emoji，不要只写一句话敷衍。"
                    ),
                }
            )
            # 收口正文单独抬高 token 下限，避免专家 max_tokens 偏紧时半截截断
            close_tokens = max(int(agent_def.max_tokens or 0), 2048)
            async for item in self._stream_plain_text(
                llm=llm,
                messages=messages,
                agent_def=agent_def,
                emit_sse=emit_sse,
                channel="text",
                max_tokens=close_tokens,
            ):
                if isinstance(item, str):
                    yield item
                else:
                    final_text = (item.text or "").strip()
                    for k in total_usage:
                        total_usage[k] = total_usage.get(k, 0) + (
                            item.usage or {}
                        ).get(k, 0)

            if not (final_text or "").strip():
                final_text = (
                    f"【{agent_def.name}】本轮未能生成分析正文。"
                    "可能是模型只调用了工具或返回为空；请重试，或先用 Scout 快速分析。"
                )
                if emit_sse:
                    step = 40
                    for i in range(0, len(final_text), step):
                        yield format_sse(
                            "text_delta", {"content": final_text[i : i + step]}
                        )

        if emit_sse:
            yield format_sse(
                "done",
                {
                    "usage": {
                        "tokens": total_usage.get("total_tokens", 0),
                        **total_usage,
                    },
                    "iterations": iteration,
                    "agent_id": agent_def.id,
                },
            )

        yield EngineResult(
            text=final_text,
            agent_id=agent_def.id,
            usage=total_usage,
            iterations=iteration,
            dispatches=dispatches,
        )

    def _workflow_hint(self, agent_def: AgentDefinition) -> str:
        wf = (agent_def.workflow or "react").lower()
        if wf in ("cot", "direct"):
            return (
                "工作流: Chain-of-Thought（快速）。"
                "直接基于已有上下文给出答案，优先速度与信息密度；"
                "不要假装调用工具，不要输出 emoji。"
            )
        if wf == "plan_execute":
            return (
                "工作流: Plan-and-Execute。规划只在思考区；执行阶段必须真正行动："
                "需要专家时调用 dispatch_agent，可直接答则写完整 Markdown 正文。"
                "禁止把「执行计划」列表当作最终答复。不要一次调度超过 3 个 Agent。"
                "禁止 emoji。"
            )
        if wf == "reflexion":
            return (
                "工作流: Reflexion。提出方案 → 自我评估（重复/命名/过细）→ 反思改进，"
                "最多 2 轮，最终给出建议。禁止 emoji。"
            )
        if wf == "tot":
            return (
                "工作流: Tree-of-Thoughts。对复杂问题在内部比较 2-3 种路径，"
                "只展开最适合用户的一种；输出最终讲解即可。禁止 emoji。"
            )
        return (
            "工作流: ReAct。需要数据时先调用工具再回答；"
            "能直接答则不要硬调工具。禁止 emoji。"
        )

    def _degraded_reply(
        self, agent_def: AgentDefinition, messages: list[dict[str, Any]]
    ) -> str:
        user_msgs = [m.get("content", "") for m in messages if m.get("role") == "user"]
        last = user_msgs[-1] if user_msgs else ""
        return (
            f"【降级模式 · {agent_def.name}】未配置 LLM API Key。\n\n"
            f"已收到：{last[:300]}\n\n"
            "系统将仅使用规则/图谱/GitHub 公开数据能力。"
            "请前往设置页配置 BYOK API Key 以启用完整多 Agent 推理。"
        )


_PLAN_HEADER_RE = re.compile(
    r"(?m)^\s*(执行计划|行动计划|计划步骤)\s*[:：]?",
)
_DISPATCH_HINT_RE = re.compile(
    r"(调度|分派|dispatch).{0,24}(mentor|curator|navigator|scout|scribe|atlas)",
    re.IGNORECASE,
)
_PLAN_ANNOUNCE_RE = re.compile(
    r"(开始分派|开始执行|现开始|接下来将调度|正在调度专业|待\s*\d+\s*位专家)",
)


def is_plan_announcement(text: str, *, agent_id: str = "") -> bool:
    """判断正文是否像「宣布执行计划」而非用户可见的完整交付。

    Hub 在 plan_execute 下常输出「执行计划：1.调度 mentor…」后直接结束，
    前端会停在第 1 轮，看起来像卡住。
    """
    t = (text or "").strip()
    if len(t) < 20:
        return False
    has_header = bool(_PLAN_HEADER_RE.search(t)) or t.startswith(
        ("执行计划", "行动计划", "计划步骤")
    )
    dispatch_hits = len(_DISPATCH_HINT_RE.findall(t))
    announce = bool(_PLAN_ANNOUNCE_RE.search(t))
    if has_header and (dispatch_hits >= 1 or announce):
        return True
    if agent_id == "hub" and dispatch_hits >= 2 and len(t) < 1200:
        return True
    if announce and dispatch_hits >= 1 and len(t) < 800:
        return True
    return False


def _preview(result: Any, limit: int = 200) -> str:
    try:
        s = json.dumps(result, ensure_ascii=False, default=str)
    except Exception:
        s = str(result)
    return s[:limit]


def _small_enough(result: Any, limit: int = 4000) -> bool:
    try:
        return len(json.dumps(result, default=str)) < limit
    except Exception:
        return False


def _normalize_question(tool_result: dict[str, Any], *, agent_id: str) -> dict[str, Any]:
    """将 ask_user 工具结果转为前端 AgentQuestion 结构。"""
    qid = f"q_{uuid.uuid4().hex[:12]}"
    title = tool_result.get("title") or "请回答以下问题"
    items = tool_result.get("items") or []
    questions: list[dict[str, Any]] = []

    def _clean_options(raw: Any) -> list[dict[str, str]]:
        """过滤空选项；兼容字符串/字母键字典/JSON；拒绝字符串被逐字拆开。"""
        list_raw: list[Any] = []
        if isinstance(raw, str):
            t = raw.strip()
            # 优先按 A/B/C 行解析
            letter_opts = _parse_letter_options(t)
            if len(letter_opts) >= 2:
                return letter_opts
            if t.startswith("["):
                try:
                    parsed = json.loads(t)
                    if isinstance(parsed, list):
                        list_raw = parsed
                except json.JSONDecodeError:
                    list_raw = [x.strip() for x in re.split(r"[,，;；|]", t) if x.strip()]
            elif "\n" in t:
                list_raw = [x.strip() for x in t.split("\n") if x.strip()]
            elif t:
                list_raw = [x.strip() for x in re.split(r"[,，;；|]", t) if x.strip()]
        elif isinstance(raw, list):
            # 防护：list("abc") → ['a','b','c']；保留合法的 ['A','B','C']
            if (
                len(raw) >= 2
                and all(isinstance(x, str) and len(x) <= 1 for x in raw)
                and not all(
                    isinstance(x, str) and re.match(r"^[A-Da-d]$", x) for x in raw
                )
            ):
                list_raw = []
            else:
                list_raw = raw
        elif isinstance(raw, dict):
            items = list(raw.items())
            if len(items) >= 2 and all(
                str(k).isdigit() and isinstance(v, str) and len(v) <= 1
                for k, v in items
            ):
                list_raw = []
            else:
                list_raw = [{"value": k, "label": v} for k, v in items]

        out: list[dict[str, str]] = []
        for o in list_raw:
            if o is None:
                continue
            if isinstance(o, (str, int, float)):
                s = str(o).strip()
                if not s:
                    continue
                m = re.match(r"^([A-Da-d])[.、)）：:\s]+\s*(.+)$", s)
                if m:
                    letter = m.group(1).upper()
                    out.append({"value": letter, "label": f"{letter}. {m.group(2).strip()}"})
                else:
                    out.append({"value": s, "label": s})
                continue
            if isinstance(o, (list, tuple)) and len(o) >= 2:
                letter = str(o[0]).strip()
                label = str(o[1]).strip()
                if label:
                    if re.match(r"^[A-Da-d]$", letter):
                        out.append(
                            {
                                "value": letter.upper(),
                                "label": f"{letter.upper()}. {label}",
                            }
                        )
                    else:
                        out.append({"value": letter, "label": label})
                continue
            if isinstance(o, dict):
                label = str(
                    o.get("label")
                    or o.get("text")
                    or o.get("name")
                    or o.get("content")
                    or o.get("desc")
                    or o.get("description")
                    or o.get("answer")
                    or o.get("option")
                    or o.get("choice")
                    or o.get("body")
                    or ""
                ).strip()
                value = str(o.get("value") or o.get("id") or o.get("key") or "").strip()
                if (not label or (re.match(r"^[A-Da-d]$", label) and label == value)) and o.get(
                    "description"
                ):
                    label = str(o.get("description") or "").strip()
                if not label and not value:
                    # 单键 {"A": "文案"} 或过滤 correct 后仅剩一键
                    pairs = [
                        (k, v)
                        for k, v in o.items()
                        if k not in ("correct", "is_correct", "score")
                    ]
                    if len(pairs) == 1:
                        k, v = pairs[0]
                        value = str(k).strip()
                        label = str(v).strip()
                if not label and value:
                    label = value
                if not value and label:
                    value = label
                if not label and not value:
                    continue
                # 纯题号无正文 → 跳过（交给题干解析 / 文本兜底）
                if re.match(r"^[A-Da-d]$", label) and label == value:
                    continue
                # 丢弃无意义单字符（非 A-D 题号）
                if len(label) <= 1 and not re.match(r"^[A-Da-d]$", label):
                    continue
                item: dict[str, str] = {"value": value, "label": label}
                desc = o.get("description")
                if desc and str(desc).strip() != label:
                    item["description"] = str(desc)
                out.append(item)

        # 再防一层：多数选项仍是单字符 → 视为损坏
        if len(out) >= 2:
            short = sum(1 for x in out if len(x.get("label") or "") <= 1)
            if short >= max(2, (len(out) + 1) // 2):
                return []
            # 假「选项 A」占位也视为损坏
            placeholders = sum(
                1
                for x in out
                if re.match(r"^选项\s*[A-Da-d]$", (x.get("label") or "").strip())
            )
            if placeholders >= min(2, len(out)):
                return []
        return out

    def _parse_letter_options(text: str) -> list[dict[str, str]]:
        out: list[dict[str, str]] = []
        seen: set[str] = set()
        for m in re.finditer(
            r"(?:^|\n)\s*(?:[-*•]\s*)?(?:\*\*)?([A-Da-d])(?:\*\*)?[.、)）：:]\s*(.+?)(?=(?:\n\s*(?:[-*•]\s*)?(?:\*\*)?[A-Da-d](?:\*\*)?[.、)）：:])|\n\n|$)",
            text,
            flags=re.S,
        ):
            letter = m.group(1).upper()
            label = re.sub(r"\*\*", "", m.group(2)).strip()
            if not label or letter in seen:
                continue
            # 跳过假占位
            if re.match(r"^选项\s*[A-Da-d]$", label):
                continue
            seen.add(letter)
            out.append({"value": letter, "label": f"{letter}. {label}"})
        return out

    def _default_options(qid_item: str, prompt: str) -> list[dict[str, str]]:
        key = f"{qid_item} {prompt}".lower()
        if any(k in key for k in ("水平", "level", "掌握", "熟练", "程度")):
            return [
                {"value": "beginner", "label": "初学 · 刚接触"},
                {"value": "intermediate", "label": "了解 · 能读简单代码"},
                {"value": "advanced", "label": "掌握 · 能独立改功能"},
                {"value": "expert", "label": "精通 · 能讲架构与设计"},
            ]
        if any(k in key for k in ("语言", "language", "tech", "技术栈", "想学")):
            return [
                {"value": "python", "label": "Python"},
                {"value": "typescript", "label": "TypeScript / JavaScript"},
                {"value": "go", "label": "Go"},
                {"value": "rust", "label": "Rust"},
                {"value": "cpp", "label": "C / C++"},
                {"value": "other", "label": "其他（下方填写）"},
            ]
        if any(k in key for k in ("想做", "目标", "goal", "这次", "目的")):
            return [
                {"value": "overview", "label": "快速了解某个项目"},
                {"value": "learn", "label": "系统学习 / 跟读源码"},
                {"value": "path", "label": "规划学习路径"},
                {"value": "compare", "label": "对比多个项目"},
            ]
        # 测验类禁止假「选项 A」——返回空，由上层改成可填写
        return []

    for it in items:
        if not isinstance(it, dict):
            continue
        qtype = it.get("type") or "single_choice"
        qid_item = it.get("id") or f"item_{len(questions)}"
        prompt = it.get("prompt") or it.get("text") or "请选择"
        options = it.get("options") or it.get("choices") or it.get("answers") or []
        if qtype in ("single_choice", "radio", "quiz"):
            opt_list = _clean_options(options)
            if len(opt_list) < 2:
                opt_list = _parse_letter_options(str(prompt))
            if len(opt_list) < 2:
                opt_list = _default_options(str(qid_item), str(prompt))
            exam = qtype == "quiz" or bool(
                re.search(r"测验|考试|小测试|考考你|掌握度|第\s*\d+\s*题", f"{prompt} {title}")
            )
            if len(opt_list) < 2:
                questions.append(
                    {
                        "id": qid_item,
                        "text": f"{prompt}\n\n（选项未能解析，请直接填写你的答案）",
                        "type": "radio",
                        "options": [
                            {"value": "other", "label": "自由填写（下方输入）"}
                        ],
                        "allow_other": True,
                        "exam": False,
                    }
                )
            else:
                questions.append(
                    {
                        "id": qid_item,
                        "text": prompt,
                        "type": "radio",
                        "options": opt_list,
                        "allow_other": not exam,
                        "exam": exam,
                    }
                )
        elif qtype in ("multi_choice", "checkbox"):
            opt_list = _clean_options(options)
            if len(opt_list) < 2:
                opt_list = _parse_letter_options(str(prompt))
            if len(opt_list) < 2:
                opt_list = _default_options(str(qid_item), str(prompt))
            questions.append(
                {
                    "id": qid_item,
                    "text": prompt,
                    "type": "checkbox",
                    "options": [
                        {"value": o["value"], "text": o["label"]} for o in opt_list
                    ],
                }
            )
        elif qtype in ("scale", "slider"):
            questions.append(
                {
                    "id": qid_item,
                    "text": prompt,
                    "type": "slider",
                    "min": int(it.get("min", 0)),
                    "max": int(it.get("max", 100)),
                    "labels": it.get("labels") or {"0": "不懂", "100": "精通"},
                }
            )
        else:
            # text → 短答用滑块式自由填写入口
            questions.append(
                {
                    "id": qid_item,
                    "text": prompt,
                    "type": "radio",
                    "options": [{"value": "other", "label": "自由填写（下方输入）"}],
                    "allow_other": True,
                }
            )
    if not questions:
        # 禁止把面板标题当成题干（否则出现 Q1=「请回答以下问题」）
        questions.append(
            {
                "id": "default",
                "text": "你的编程 / 技术掌握水平大致处于哪个阶段？",
                "type": "radio",
                "options": _default_options("level", "水平"),
                "allow_other": True,
            }
        )
    else:
        # 题干缺失或与标题撞车时，按选项语义补一句真正的问题
        generic = {"请回答以下问题", "请选择", "请选择最符合的一项", ""}
        title_s = str(title or "").strip()
        for q in questions:
            text = str(q.get("text") or "").strip()
            if text and text not in generic and text != title_s:
                continue
            labels = " ".join(
                str((o.get("label") if isinstance(o, dict) else o) or "")
                for o in (q.get("options") or [])
            )
            if any(k in labels for k in ("初学", "了解", "掌握", "精通")):
                q["text"] = "你的编程 / 技术掌握水平大致处于哪个阶段？"
            elif any(k in labels for k in ("Python", "TypeScript", "Go", "Rust")):
                q["text"] = "你更熟悉 / 想用哪一类技术栈？"
            elif text in generic or text == title_s:
                q["text"] = "请选择最符合你情况的一项："
    return {
        "question_id": qid,
        "agent_id": agent_id,
        "intro": {"type": "markdown", "content": f"**{title}**"},
        "questions": questions,
        "actions": {
            "submit": {"text": "提交", "style": "primary"},
            "skip": {"text": "跳过", "style": "ghost"},
        },
        "allow_skip": bool(tool_result.get("allow_skip", True)),
        "timeout": None,
    }
