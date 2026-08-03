"""
Hub 服务 —— 意图路由、多 Agent 编排、Plan-and-Execute
"""
from __future__ import annotations

import json
import logging
import re
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
_EXPERT_SUMMARY_CHARS = 6000
# 专家 run 只带最近若干条历史，避免 Hub 长规划污染
_EXPERT_HISTORY_WINDOW = 6
# 学习/教学类串行；其余可并行
_SERIAL_DISPATCH_AGENTS = frozenset({"mentor", "navigator", "scribe"})


def _clip_expert_text(text: str, limit: int = _EXPERT_SUMMARY_CHARS) -> str:
    t = (text or "").strip()
    if len(t) <= limit:
        return t
    return t[:limit] + "\n…(已截断)"


def structure_expert_summary(agent_id: str, text: str) -> str:
    """结构化专家摘要：标题要点 + 正文摘录，供 Hub 汇总与专家交接。"""
    t = (text or "").strip()
    if not t:
        return f"[{agent_id}] （空输出）"
    headings: list[str] = []
    for ln in t.splitlines():
        s = ln.strip()
        if not s:
            continue
        if s.startswith("#") or re.match(r"^(\d+[\.\)、]|[-*])\s+\S", s):
            headings.append(s[:120])
        if len(headings) >= 16:
            break
    body = _clip_expert_text(t, _EXPERT_SUMMARY_CHARS)
    parts = [f"[{agent_id}]"]
    if headings:
        parts.append("要点：")
        parts.extend(f"- {h}" for h in headings)
        parts.append("")
    parts.append("正文摘录：")
    parts.append(body)
    return "\n".join(parts)


# 单专家直出；多专家走 Hub 汇总

_AGENT_DISPLAY_NAMES = {
    "hub": "Hub",
    "scout": "Scout",
    "mentor": "Mentor",
    "navigator": "Navigator",
    "curator": "Curator",
    "scribe": "Scribe",
    "atlas": "Atlas",
}

# 切换条默认角色提示（无有效 reason 时用）
_AGENT_ROLE_HINTS = {
    "scout": "快速分析",
    "mentor": "深度讲解",
    "navigator": "学习路径",
    "curator": "分类整理",
    "scribe": "笔记整理",
    "atlas": "知识图谱",
    "hub": "对话管家",
}


def _prefix_expert_thinking_sse(chunk: str, expert_name: str) -> str:
    """把专家 thinking 挂到 Hub 舞台时加署名，便于嵌进 Hub 气泡。"""
    if not chunk.startswith("event: thinking"):
        return chunk
    try:
        # event: thinking\ndata: {...}\n\n
        lines = chunk.strip().split("\n")
        data_line = next((ln for ln in lines if ln.startswith("data: ")), "")
        if not data_line:
            return chunk
        payload = json.loads(data_line[6:])
        content = str(payload.get("content") or "")
        if not content:
            return chunk
        if content.lstrip().startswith(f"【{expert_name}】") or content.lstrip().startswith(
            f"[{expert_name}]"
        ):
            return chunk
        payload["content"] = f"【{expert_name}】\n{content}"
        return format_sse("thinking", payload)
    except Exception:
        return chunk


def should_skip_hub_merge(expert_results: list[tuple[str, str]]) -> bool:
    """单专家：直出交舞台；多专家：Hub 汇总。"""
    return len(expert_results) == 1


def clean_dispatch_reason(reason: str | None) -> str:
    """清洗模型 reason：压空白、去掉无意义的默认调度前缀。"""
    r = re.sub(r"\s+", " ", (reason or "").strip())
    if not r or r.startswith("Hub 调度"):
        return ""
    return r


def _clip_reason_at_break(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    cut = text[:limit]
    for sep in ("。", "；", "！", "？", "，", ",", ";", " "):
        i = cut.rfind(sep)
        if i >= max(24, limit // 2):
            end = i + (1 if sep in "。；！？" else 0)
            return cut[:end].rstrip("，,;； ") + "…"
    return cut.rstrip("，,;； ") + "…"


def format_switch_reason(dispatch: dict, *, limit: int = 72) -> str:
    """切换条副标题：一句短说明，避免模型长推理/约束原文。"""
    target = str(dispatch.get("target_agent") or "scout")
    r = clean_dispatch_reason(dispatch.get("reason"))
    if not r:
        return _AGENT_ROLE_HINTS.get(target, "")
    return _clip_reason_at_break(r, limit)


def format_dispatch_status(dispatch: dict) -> str:
    """调度短状态（thinking 脚手架，禁止塞完整 task 进正文）。"""
    target = str(dispatch.get("target_agent") or "scout")
    name = _AGENT_DISPLAY_NAMES.get(target, target)
    reason_short = format_switch_reason(dispatch, limit=64)
    if reason_short:
        return f"[状态] 调度 · {name} · {reason_short}\n"
    return f"[状态] 调度 · {name}\n"


def format_dispatch_notice(dispatch: dict) -> str:
    """用户可见的短调度说明（一两句，不含完整 task / 禁止事项清单）。"""
    target = str(dispatch.get("target_agent") or "scout")
    name = _AGENT_DISPLAY_NAMES.get(target, target)
    reason_short = format_switch_reason(dispatch, limit=96)
    hint = _AGENT_ROLE_HINTS.get(target, "")
    if reason_short and reason_short != hint:
        return f"先交由 **{name}**（{hint}）处理：{reason_short}\n\n"
    if hint:
        return f"先交由 **{name}**（{hint}）处理当前请求。\n\n"
    return f"先交由 **{name}** 处理当前请求。\n\n"


def format_dispatch_announce(dispatch: dict) -> str:
    """兼容旧名：现为短状态文案，不再产出「任务：…」长正文。"""
    return format_dispatch_status(dispatch)


def apply_merge_mode(agent_def):
    """最终汇总轮：强制 direct 单阶段流式、无工具。"""
    from dataclasses import replace

    return replace(
        agent_def,
        workflow="direct",
        tools=[],
        max_iterations=1,
        max_tokens=max(getattr(agent_def, "max_tokens", 2048) or 2048, 4096),
        system_prompt=(
            (agent_def.system_prompt or "")
            + "\n\n【本轮强制】你正在合并已返回的专家结果。"
            "禁止规划、禁止工具、禁止 dispatch；直接写最终用户可见正文。"
            "控制篇幅：突出关键路径与下一步，不要整段复述专家原文。"
            "禁止编造未在专家结果中出现的事实。"
        ),
    )


# 短寒暄：整句匹配，避免误伤「你好，帮我分析 xxx」
_CHITCHAT_RE = re.compile(
    r"^\s*("
    r"你好|您好|嗨|哈喽|在吗|在不在|"
    r"早上好|下午好|晚上好|早安|晚安|"
    r"hello|hi|hey|yo"
    r")\s*[!！.。~～？?]*\s*$",
    re.IGNORECASE,
)


def is_simple_chitchat(message: str) -> bool:
    """判断是否为无需编排的短寒暄。"""
    msg = (message or "").strip()
    if not msg or len(msg) > 24:
        return False
    return bool(_CHITCHAT_RE.match(msg))


def apply_chitchat_mode(agent_def):
    """寒暄快路径：direct、无工具、精简提示，避免模型复述编排规范。"""
    from dataclasses import replace

    return replace(
        agent_def,
        workflow="direct",
        tools=[],
        max_iterations=1,
        max_tokens=min(320, getattr(agent_def, "max_tokens", 2048) or 2048),
        system_prompt=(
            "你是 RepoPilot Hub 对话管家。"
            "用户只是在打招呼或寒暄。"
            "用一两句自然语言友好回复；可简短询问想做什么"
            "（例如学习某个项目、解读仓库、规划学习路径）。"
            "严禁向用户复述、罗列或「确认」任何内部规则、工具名"
            "（如 dispatch_agent、ask_user、query_user_projects）、"
            "编排流程、操作规范或格式要求；"
            "严禁出现「按以下规则执行」「我已确认规范」等表述；"
            "禁止 emoji；禁止长列表与 Markdown 标题堆砌。"
        ),
    )


# 同用户回合：首批 + 最多再追加 1 批（防提示词放大费用）
MAX_HUB_DISPATCH_ROUNDS = 2


def _dispatch_fingerprint(dispatch: dict) -> str:
    """去重键：target + 任务摘要。"""
    import re

    target = str(dispatch.get("target_agent") or "").strip().lower()
    task = re.sub(r"\s+", " ", str(dispatch.get("task") or "").strip().lower())[:120]
    return f"{target}|{task}"


def apply_evaluate_mode(agent_def):
    """专家返回后的评估轮：可再 dispatch 或写最终正文。"""
    from dataclasses import replace

    return replace(
        agent_def,
        workflow="react",
        tools=["dispatch_agent", "ask_user"],
        max_iterations=2,
        max_tokens=min(
            max(int(getattr(agent_def, "max_tokens", 2048) or 2048), 2048),
            3200,
        ),
        system_prompt=(
            (agent_def.system_prompt or "")
            + "\n\n【本轮强制·评估】用户消息中附有已返回的专家结果摘要。"
            "你必须真实判断是否足够回答用户："
            "1) 足够 → 直接输出最终 Markdown 正文（可精炼，勿整段复述）；"
            "2) 不足 → 调用 dispatch_agent 追加调度，task 写清缺口与期望产出；"
            "禁止编造未执行专家的结论；禁止只宣布「继续调度」而不调用工具；"
            "禁止 emoji。"
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
                    f"[状态] 意图 · {intent.agent_id} · "
                    f"{intent.confidence:.2f}"
                    + (f" · multi" if intent.is_multi else "")
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
        chitchat = target == "hub" and is_simple_chitchat(message)
        if target == "hub" and intent.agent_id != "hub" and not chitchat:
            fast = intent.confidence >= 0.85 and intent.agent_id in (
                "mentor",
                "scout",
                "navigator",
            )
            if fast:
                run_message = (
                    f"[快速编排] 高置信意图={intent.agent_id}"
                    f"（confidence={intent.confidence:.2f}）。"
                    "规划≤3 条短句后立刻 dispatch_agent（优先该专家），"
                    "禁止冗长分析，禁止把计划当最终正文。\n\n"
                    f"{message}"
                )
            else:
                run_message = (
                    f"[编排提示] 本轮意图偏向 {intent.agent_id}"
                    f"（confidence={intent.confidence:.2f}）。"
                    "若属专业任务请用 dispatch_agent 调度对应专家，"
                    "专家结束后由你汇总；不要自己代替专家做深度分析。"
                    "一次调度默认不超过 2 个专家；学习类优先 mentor，"
                    "仅当需要独立路线图时再加 navigator。\n\n"
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
            chitchat_mode=chitchat,
        ):
            if isinstance(item, EngineResult):
                if item.question:
                    # 反问已发出，结束
                    return
                if item.dispatches:
                    async for chunk in self._dispatch_evaluate_loop(
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
                apply=True,  # 用户显式作答，可立即写入
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
                    async for chunk in self._dispatch_evaluate_loop(
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
        subs = [s for s in intent.sub_intents if self.registry.has(s.agent_id)]
        if not subs:
            yield format_sse(
                "done",
                {"usage": {"tokens": 0}, "iterations": 0, "agent_id": "hub"},
            )
            return

        direct = len(subs) == 1
        summaries: list[str] = []
        expert_results: list[tuple[str, str]] = []
        expert_history = list(history[-_EXPERT_HISTORY_WINDOW :]) if history else []

        # 调度：thinking 状态 + 短正文说明（不含完整 task）
        for sub in subs:
            d = {
                "target_agent": sub.agent_id,
                "task": sub.message or message,
                "reason": sub.reason or "多意图编排",
            }
            yield format_sse(
                "thinking",
                {"content": format_dispatch_status(d)},
            )
            yield format_sse(
                "text_delta",
                {"content": format_dispatch_notice(d)},
            )

        for sub in subs:
            prior = "\n".join(summaries) if summaries else None
            agent_text = ""
            expert_name = _AGENT_DISPLAY_NAMES.get(sub.agent_id, sub.agent_id)
            switch_d = {
                "target_agent": sub.agent_id,
                "reason": sub.reason or "多意图编排",
            }

            if direct:
                # 与 _handle_dispatches 单专家一致：Hub 舞台直出
                yield format_sse(
                    "subagent_start",
                    {
                        "agent_id": sub.agent_id,
                        "task": (sub.message or message)[:200],
                        "reason": format_switch_reason(switch_d),
                    },
                )
                yield format_sse(
                    "thinking",
                    {"content": f"[状态] {expert_name} · 执行中\n"},
                )
            else:
                yield format_sse(
                    "subagent_start",
                    {
                        "agent_id": sub.agent_id,
                        "task": (sub.message or message)[:200],
                        "reason": format_switch_reason(switch_d),
                    },
                )

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
                history=expert_history,
                prior_summary=prior,
            ):
                if isinstance(item, EngineResult):
                    agent_text = item.text
                    if item.question:
                        yield format_sse(
                            "subagent_done",
                            {
                                "agent_id": sub.agent_id,
                                "status": "question",
                            },
                        )
                        return
                else:
                    if isinstance(item, str) and item.startswith("event: done"):
                        continue
                    if direct:
                        if isinstance(item, str) and item.startswith(
                            "event: thinking"
                        ):
                            yield _prefix_expert_thinking_sse(item, expert_name)
                        else:
                            yield item
                    elif isinstance(item, str) and (
                        item.startswith("event: question")
                        or item.startswith("event: error")
                    ):
                        yield item

            yield format_sse(
                "subagent_done",
                {"agent_id": sub.agent_id, "status": "ok"},
            )

            expert_results.append((sub.agent_id, agent_text or ""))
            summaries.append(
                structure_expert_summary(sub.agent_id, agent_text)
            )

        if should_skip_hub_merge(expert_results):
            agent_id, _ = expert_results[0]
            await self.memory.append_short_memory(
                user.id,
                "hub",
                {
                    "summary": (
                        message[:80] + f" → {agent_id} 直出（跳过汇总）"
                    )
                },
            )
            yield format_sse(
                "done",
                {
                    "usage": {"tokens": 0},
                    "iterations": len(summaries),
                    "agent_id": "hub",
                    "skip_merge": True,
                },
            )
            return

        # Hub 合并：舞台未离开 hub，无需 switch；仅状态 + 汇总正文
        if summaries and llm.available:
            yield format_sse(
                "thinking",
                {"content": "[状态] Hub · 汇总中…\n"},
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
                        yield format_sse(
                            "thinking",
                            {
                                "content": (
                                    "[纠正] 汇总轮试图再次调度，已拦截；"
                                    "以上专家输出即最终依据。\n"
                                )
                            },
                        )
                    continue
                yield item
        yield format_sse(
            "done",
            {"usage": {"tokens": 0}, "iterations": len(summaries), "agent_id": "hub"},
        )

    async def _dispatch_evaluate_loop(
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
        """专家批次 → Hub 评估（可再 dispatch）→ 上限内循环 → 收口。"""
        seen: set[str] = set()
        all_summaries: list[str] = []
        pending = list(dispatches)
        last_direct_agent: str | None = None
        had_extra_rounds = False

        for round_i in range(MAX_HUB_DISPATCH_ROUNDS):
            fresh: list[dict] = []
            for d in pending:
                key = _dispatch_fingerprint(d)
                if key in seen:
                    logger.info("跳过重复调度: %s", key[:80])
                    continue
                seen.add(key)
                fresh.append(d)
            if not fresh:
                break

            bag: dict = {
                "summaries": [],
                "expert_results": [],
                "had_question": False,
                "direct_streamed": False,
            }
            async for chunk in self._handle_dispatches(
                dispatches=fresh,
                user=user,
                session_id=session_id,
                original_message=original_message,
                llm=llm,
                llm_config=llm_config,
                raw_settings=raw_settings,
                permissions=permissions,
                project_id=project_id,
                history=history,
                hub_preamble=hub_preamble if round_i == 0 else "",
                finalize=False,
                result_bag=bag,
                force_subagent=round_i > 0,
            ):
                yield chunk

            if bag.get("had_question"):
                return

            summaries = list(bag.get("summaries") or [])
            results = list(bag.get("expert_results") or [])
            all_summaries.extend(summaries)

            # 单专家已在 Hub 气泡直出（含专家思考）：跳过评估重写，避免双气泡
            if bag.get("hub_passthrough") and len(results) == 1:
                target = results[0][0]
                await self.memory.append_short_memory(
                    user.id,
                    "hub",
                    {
                        "summary": (
                            original_message[:80]
                            + f" → {target}（Hub 舞台直出）"
                        )
                    },
                )
                yield format_sse(
                    "done",
                    {
                        "usage": {"tokens": 0},
                        "iterations": 1,
                        "agent_id": "hub",
                        "skip_merge": True,
                    },
                )
                return

            if bag.get("direct_streamed") and len(results) == 1:
                last_direct_agent = results[0][0]
                # 舞台回到 Hub，便于评估轮流式与后续 announce
                yield format_sse(
                    "agent_switch",
                    {
                        "agent_id": "hub",
                        "from": last_direct_agent,
                        "to": "hub",
                        "reason": "评估专家结果",
                    },
                )

            if not all_summaries:
                break

            yield format_sse(
                "thinking",
                {"content": "[状态] Hub · 评估专家结果…\n"},
            )
            eval_msg = self._evaluate_prompt(
                all_summaries, original_message, round_i
            )
            eval_result: EngineResult | None = None
            async for item in self._run_agent(
                agent_id="hub",
                user=user,
                session_id=session_id,
                message=eval_msg,
                llm=llm,
                llm_config=llm_config,
                raw_settings=raw_settings,
                permissions=permissions,
                project_id=project_id,
                history=[],
                evaluate_mode=True,
            ):
                if isinstance(item, EngineResult):
                    eval_result = item
                    if item.question:
                        await self.memory.append_short_memory(
                            user.id,
                            "hub",
                            {
                                "summary": (
                                    original_message[:80]
                                    + " → pending_question"
                                )
                            },
                        )
                        return
                    continue
                if isinstance(item, str) and item.startswith("event: done"):
                    continue
                yield item

            if eval_result is None:
                break

            if eval_result.dispatches:
                if round_i + 1 >= MAX_HUB_DISPATCH_ROUNDS:
                    yield format_sse(
                        "thinking",
                        {
                            "content": (
                                "[状态] 已达调度轮次上限，改为汇总…\n"
                            )
                        },
                    )
                    break
                had_extra_rounds = True
                pending = list(eval_result.dispatches)
                hub_preamble = ""
                continue

            final_text = (eval_result.text or "").strip()
            if final_text:
                mem = " | ".join(
                    s.split("\n", 1)[0] for s in all_summaries[:3]
                )
                await self.memory.append_short_memory(
                    user.id,
                    "hub",
                    {
                        "summary": (
                            original_message[:80] + " → " + mem[:200]
                        )
                    },
                )
                return

            # 评估空转：首批单专家直出且未追加 → 接受专家正文
            if (
                last_direct_agent
                and not had_extra_rounds
                and len(all_summaries) == 1
            ):
                await self.memory.append_short_memory(
                    user.id,
                    "hub",
                    {
                        "summary": (
                            original_message[:80]
                            + f" → {last_direct_agent} 直出（评估通过）"
                        )
                    },
                )
                yield format_sse(
                    "done",
                    {
                        "usage": {"tokens": 0},
                        "iterations": 1,
                        "agent_id": last_direct_agent,
                        "skip_merge": True,
                    },
                )
                return
            break

        # 达上限或评估空转：短汇总收口（仍由 LLM 写）
        if all_summaries:
            async for chunk in self._run_merge_finalize(
                summaries=all_summaries,
                user=user,
                session_id=session_id,
                original_message=original_message,
                llm=llm,
                llm_config=llm_config,
                raw_settings=raw_settings,
                permissions=permissions,
                project_id=project_id,
            ):
                yield chunk
            return

        yield format_sse(
            "done",
            {"usage": {"tokens": 0}, "iterations": 0, "agent_id": "hub"},
        )

    async def _run_merge_finalize(
        self,
        *,
        summaries: list[str],
        user: User,
        session_id: UUID,
        original_message: str,
        llm: LLMProvider,
        llm_config,
        raw_settings: dict,
        permissions: dict,
        project_id: UUID | None,
    ) -> AsyncIterator[str]:
        """强制短汇总收口。"""
        yield format_sse(
            "thinking",
            {"content": "[状态] Hub · 汇总中…\n"},
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
                    yield format_sse(
                        "thinking",
                        {
                            "content": (
                                "[纠正] 汇总轮试图再次调度，已拦截；"
                                "以上专家输出即最终依据。\n"
                            )
                        },
                    )
                continue
            yield item

        mem = " | ".join(s.split("\n", 1)[0] for s in summaries[:3])
        await self.memory.append_short_memory(
            user.id,
            "hub",
            {"summary": (original_message[:80] + " → " + mem[:200])},
        )

    @staticmethod
    def _evaluate_prompt(
        summaries: list[str], user_message: str, round_i: int
    ) -> str:
        """评估轮用户消息：附专家摘要，由 LLM 决定再调度或作答。"""
        return (
            f"【评估任务 · 第 {round_i + 1} 批专家已返回】"
            "判断现有结果是否足以回答用户。"
            "足够则直接写最终 Markdown；不足则调用 dispatch_agent 追加调度。"
            "禁止编造未出现在摘要中的专家结论。\n\n"
            + "\n\n".join(summaries)
            + f"\n\n用户原话：{user_message}"
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
        finalize: bool = True,
        result_bag: dict | None = None,
        force_subagent: bool = False,
    ) -> AsyncIterator[str]:
        # preamble 已在引擎中以 text_delta 发出（若有）；此处再发具体调度预告
        _ = hub_preamble
        capped = list(dispatches[:3])
        # 过滤未注册
        valid: list[dict] = []
        for d in capped:
            target = d.get("target_agent") or "scout"
            if not self.registry.has(target):
                yield format_sse(
                    "thinking",
                    {
                        "content": (
                            f"跳过未注册 Agent: {target}"
                            "（接口已保留，待未来接入）"
                        )
                    },
                )
                continue
            valid.append(d)
        if not valid:
            return

        # 追加批次强制 Subagent，最终由 Hub 收口，避免舞台乱跳
        direct = len(valid) == 1 and not force_subagent
        targets = [(d.get("target_agent") or "scout") for d in valid]
        must_serial = (
            any(t in _SERIAL_DISPATCH_AGENTS for t in targets) or len(valid) <= 1
        )
        expert_history = list(history[-_EXPERT_HISTORY_WINDOW :]) if history else []
        summaries: list[str] = []
        expert_results: list[tuple[str, str]] = []

        # 调度：thinking 状态 + 短正文说明；详情见 subagent_start
        for d in valid:
            yield format_sse(
                "thinking", {"content": format_dispatch_status(d)}
            )
            yield format_sse(
                "text_delta", {"content": format_dispatch_notice(d)}
            )

        async def _run_one_silent(
            d: dict, prior: str | None
        ) -> tuple[str, str, list[str], dict | None]:
            """并行静默路径：只收集结果与 question/error SSE。"""
            target = d.get("target_agent") or "scout"
            task = d.get("task") or original_message
            passthrough: list[str] = []
            text = ""
            question = None
            passthrough.append(
                format_sse(
                    "subagent_start",
                    {
                        "agent_id": target,
                        "task": task[:200],
                        "reason": format_switch_reason(d),
                    },
                )
            )
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
                history=expert_history,
                prior_summary=prior,
            ):
                if isinstance(item, EngineResult):
                    text = item.text
                    if item.question:
                        question = item.question
                elif isinstance(item, str):
                    if item.startswith("event: question") or item.startswith(
                        "event: error"
                    ):
                        passthrough.append(item)
            passthrough.append(
                format_sse(
                    "subagent_done",
                    {
                        "agent_id": target,
                        "status": "question" if question else "ok",
                    },
                )
            )
            return target, text, passthrough, question

        if direct:
            d = valid[0]
            target = d.get("target_agent") or "scout"
            expert_name = _AGENT_DISPLAY_NAMES.get(target, target)
            # Hub 保留舞台：专家静默跑完，思考/正文并入 Hub 气泡，避免 Mentor+Hub 双份
            yield format_sse(
                "subagent_start",
                {
                    "agent_id": target,
                    "task": (d.get("task") or original_message)[:200],
                    "reason": format_switch_reason(d),
                },
            )
            yield format_sse(
                "thinking",
                {"content": f"[状态] {expert_name} · 执行中\n"},
            )
            text = ""
            async for item in self._run_agent(
                agent_id=target,
                user=user,
                session_id=session_id,
                message=d.get("task") or original_message,
                llm=llm,
                llm_config=llm_config,
                raw_settings=raw_settings,
                permissions=permissions,
                project_id=project_id,
                history=expert_history,
                prior_summary=None,
            ):
                if isinstance(item, EngineResult):
                    text = item.text
                    if item.question:
                        yield format_sse(
                            "subagent_done",
                            {"agent_id": target, "status": "question"},
                        )
                        if result_bag is not None:
                            result_bag["had_question"] = True
                        await self.memory.append_short_memory(
                            user.id,
                            "hub",
                            {
                                "summary": (
                                    original_message[:80]
                                    + " → pending_question"
                                )
                            },
                        )
                        return
                else:
                    if isinstance(item, str) and item.startswith("event: done"):
                        continue
                    if isinstance(item, str) and item.startswith("event: thinking"):
                        yield _prefix_expert_thinking_sse(item, expert_name)
                        continue
                    # text_delta / question / error：留在 Hub 舞台
                    yield item
            yield format_sse(
                "subagent_done",
                {"agent_id": target, "status": "ok"},
            )
            expert_results.append((target, text or ""))
            summaries.append(structure_expert_summary(target, text))
            if result_bag is not None:
                result_bag["expert_results"] = expert_results
                result_bag["summaries"] = summaries
                result_bag["direct_streamed"] = True
                result_bag["hub_passthrough"] = True
            if not finalize:
                return
            await self.memory.append_short_memory(
                user.id,
                "hub",
                {
                    "summary": (
                        original_message[:80]
                        + f" → {target}（Hub 舞台直出）"
                    )
                },
            )
            yield format_sse(
                "done",
                {
                    "usage": {"tokens": 0},
                    "iterations": 1,
                    "agent_id": "hub",
                    "skip_merge": True,
                },
            )
            return

        # 多专家：静默 Subagent，Hub 留在舞台
        if must_serial:
            for d in valid:
                target = d.get("target_agent") or "scout"
                prior = None
                if summaries:
                    prior = (
                        "前序专家已覆盖内容（勿重复，只补缺口）：\n"
                        + "\n\n".join(summaries)
                    )
                yield format_sse(
                    "subagent_start",
                    {
                        "agent_id": target,
                        "task": (d.get("task") or original_message)[:200],
                        "reason": format_switch_reason(d),
                    },
                )
                text = ""
                async for item in self._run_agent(
                    agent_id=target,
                    user=user,
                    session_id=session_id,
                    message=d.get("task") or original_message,
                    llm=llm,
                    llm_config=llm_config,
                    raw_settings=raw_settings,
                    permissions=permissions,
                    project_id=project_id,
                    history=expert_history,
                    prior_summary=prior,
                ):
                    if isinstance(item, EngineResult):
                        text = item.text
                        if item.question:
                            yield format_sse(
                                "subagent_done",
                                {"agent_id": target, "status": "question"},
                            )
                            if result_bag is not None:
                                result_bag["had_question"] = True
                            await self.memory.append_short_memory(
                                user.id,
                                "hub",
                                {
                                    "summary": (
                                        original_message[:80]
                                        + " → pending_question"
                                    )
                                },
                            )
                            return
                    elif isinstance(item, str):
                        if item.startswith("event: question") or item.startswith(
                            "event: error"
                        ):
                            yield item
                yield format_sse(
                    "subagent_done",
                    {"agent_id": target, "status": "ok"},
                )
                expert_results.append((target, text or ""))
                summaries.append(structure_expert_summary(target, text))
        else:
            import asyncio

            results = await asyncio.gather(
                *[_run_one_silent(d, None) for d in valid],
                return_exceptions=True,
            )
            for r in results:
                if isinstance(r, Exception):
                    logger.exception("并行调度失败: %s", r)
                    yield format_sse(
                        "error",
                        {"code": "DISPATCH_ERROR", "message": str(r)},
                    )
                    continue
                target, text, chunks, question = r
                for c in chunks:
                    yield c
                if question:
                    if result_bag is not None:
                        result_bag["had_question"] = True
                    await self.memory.append_short_memory(
                        user.id,
                        "hub",
                        {
                            "summary": (
                                original_message[:80] + " → pending_question"
                            )
                        },
                    )
                    return
                expert_results.append((target, text or ""))
                summaries.append(structure_expert_summary(target, text))

        if result_bag is not None:
            result_bag["expert_results"] = expert_results
            result_bag["summaries"] = summaries

        if not finalize:
            return

        if summaries:
            async for chunk in self._run_merge_finalize(
                summaries=summaries,
                user=user,
                session_id=session_id,
                original_message=original_message,
                llm=llm,
                llm_config=llm_config,
                raw_settings=raw_settings,
                permissions=permissions,
                project_id=project_id,
            ):
                yield chunk

    @staticmethod
    def _merge_prompt(summaries: list[str], user_message: str) -> str:
        """多专家返回后的 Hub 汇总：短合并，禁止整段复述。"""
        return (
            "【汇总任务 · 禁止再调度】多位专家已完成工作。"
            "请写一段短合并答复（约 120–250 字 Markdown）："
            "只提炼共识、分歧与下一步；不要整段照抄专家原文；"
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
        evaluate_mode: bool = False,
        chitchat_mode: bool = False,
    ) -> AsyncIterator[str | EngineResult]:
        from dataclasses import replace

        agent_def = self.registry.get(agent_id)
        # per-agent model override
        override = get_agent_model_override(raw_settings, agent_id)
        if override:
            agent_def = replace(agent_def, model_override=override)

        # 汇总轮：强制 direct 无工具，避免 plan_execute 再次 dispatch
        if merge_mode:
            agent_def = apply_merge_mode(agent_def)
        elif evaluate_mode:
            agent_def = apply_evaluate_mode(agent_def)
        elif chitchat_mode:
            agent_def = apply_chitchat_mode(agent_def)

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

        if chitchat_mode:
            # 跳过完整上下文（SOUL/输出规范/短期记忆），避免模型把规则复述成正文
            messages = [
                {"role": "system", "content": agent_def.system_prompt},
                {"role": "user", "content": message},
            ]
        else:
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
