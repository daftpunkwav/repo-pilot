"""ReAct / Plan-Execute / Reflexion 执行引擎"""
from __future__ import annotations

import json
import logging
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
        CoT / 无工具：直接真流式吐 token。
        ReAct 有工具时：工具轮非流式，最终回答轮再流式（见循环内分支）。
        """
        if not getattr(agent_def, "streaming", True):
            return False
        wf = (agent_def.workflow or "react").lower()
        if wf in ("cot", "direct"):
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
                    # 原生 reasoning：始终进 thinking 通道
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
        # CoT 工作流强制空工具表，避免走慢速工具环
        if (agent_def.workflow or "").lower() in ("cot", "direct"):
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

        # —— 流式快路径 ——
        # cot/direct：两阶段（真思考 + 正文）；其它无工具 workflow：单次正文流式
        wf = (agent_def.workflow or "react").lower()
        if self._prefer_token_stream(agent_def, tools):
            if wf in ("cot", "direct"):
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
            # 无工具的非 CoT：单次流式，不硬塞「先写思路」
            if emit_sse:
                yield format_sse(
                    "thinking",
                    {
                        "content": f"[状态] {agent_def.name} · 流式生成\n",
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

        while iteration < max_iter:
            iteration += 1
            if emit_sse:
                yield format_sse(
                    "thinking",
                    {
                        "content": f"{agent_def.name} 推理中 (第 {iteration}/{max_iter} 轮 · {agent_def.workflow})",
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
                if think and emit_sse:
                    yield format_sse("thinking", {"content": think + "\n"})
                final_text = body or result.text
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
                        # 详情页等无 question UI 时，至少给一段可读说明，避免空正文
                        if not final_text.strip():
                            fallback_q = "需要你补充一些信息后才能继续深入分析。请在对话中说明你的基础与目标。"
                            final_text = fallback_q
                            step = 32
                            for i in range(0, len(final_text), step):
                                yield format_sse(
                                    "text_delta",
                                    {"content": final_text[i : i + step]},
                                )
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
                        text=final_text,
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

        # 若有 dispatch 且尚无最终文本，生成简短说明
        if dispatches and not final_text:
            final_text = "正在调度专业 Agent 处理…"
            if emit_sse:
                yield format_sse("text_delta", {"content": final_text})

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
                        "不要 emoji，不要只写一句话敷衍。"
                    ),
                }
            )
            async for item in self._stream_plain_text(
                llm=llm,
                messages=messages,
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
                "工作流: Plan-and-Execute。先简短规划，再 dispatch_agent，"
                "收集结果后合并回答。不要一次调度超过 3 个 Agent。禁止 emoji。"
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
    for it in items:
        if not isinstance(it, dict):
            continue
        qtype = it.get("type") or "single_choice"
        qid_item = it.get("id") or f"item_{len(questions)}"
        prompt = it.get("prompt") or it.get("text") or "请选择"
        options = it.get("options") or []
        if qtype in ("single_choice", "radio"):
            questions.append(
                {
                    "id": qid_item,
                    "text": prompt,
                    "type": "radio",
                    "options": [
                        {"value": str(o), "label": str(o)}
                        if not isinstance(o, dict)
                        else {
                            "value": str(o.get("value", o.get("label", ""))),
                            "label": str(o.get("label", o.get("value", ""))),
                        }
                        for o in options
                    ]
                    or [
                        {"value": "beginner", "label": "初学"},
                        {"value": "intermediate", "label": "了解"},
                        {"value": "advanced", "label": "掌握"},
                        {"value": "expert", "label": "精通"},
                    ],
                    "allow_other": True,
                }
            )
        elif qtype in ("multi_choice", "checkbox"):
            questions.append(
                {
                    "id": qid_item,
                    "text": prompt,
                    "type": "checkbox",
                    "options": [
                        {"value": str(o), "text": str(o)}
                        if not isinstance(o, dict)
                        else {
                            "value": str(o.get("value", o.get("text", ""))),
                            "text": str(o.get("text", o.get("value", ""))),
                        }
                        for o in options
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
            # text → 用 radio + other
            questions.append(
                {
                    "id": qid_item,
                    "text": prompt,
                    "type": "radio",
                    "options": [{"value": "other", "label": "自由填写"}],
                    "allow_other": True,
                }
            )
    if not questions:
        questions.append(
            {
                "id": "default",
                "text": title,
                "type": "radio",
                "options": [
                    {"value": "beginner", "label": "初学"},
                    {"value": "intermediate", "label": "了解"},
                    {"value": "advanced", "label": "掌握"},
                ],
                "allow_other": True,
            }
        )
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
