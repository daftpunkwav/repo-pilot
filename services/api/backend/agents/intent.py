"""意图分类 —— 规则 + 多意图 + LLM"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional

from backend.llm.provider import LLMProvider


@dataclass
class SubIntent:
    agent_id: str
    message: str
    reason: str


@dataclass
class IntentResult:
    agent_id: str
    confidence: float
    is_multi: bool = False
    sub_intents: list[SubIntent] = field(default_factory=list)
    plan_summary: str = ""


class IntentClassifier:
    """Hub 意图识别。"""

    FAST_RULES: list[tuple[re.Pattern[str], str]] = [
        (re.compile(r"(快速)?(分析|扫一眼|速览|overview|scout)", re.I), "scout"),
        (re.compile(r"(讲解|深入|教我|怎么理解|讲讲|mentor)", re.I), "mentor"),
        (re.compile(r"(规划|路线|学习路径|怎么学|roadmap|navigator)", re.I), "navigator"),
        (re.compile(r"(分类|整理|标签|归类|curator)", re.I), "curator"),
        (re.compile(r"(笔记|总结|摘要|outline|scribe)", re.I), "scribe"),
        (re.compile(r"(图谱|关联|相似项目|知识图|atlas)", re.I), "atlas"),
        (re.compile(r"(对比|比较|区别|差异|\bvs\b)", re.I), "scout"),
    ]

    MULTI_KEYWORDS = ["并且", "同时", "另外", "还有", "以及", "并帮我", "再帮我", "然后"]

    def __init__(self, llm: LLMProvider | None = None):
        self.llm = llm

    async def classify(
        self, message: str, context: dict[str, Any] | None = None
    ) -> IntentResult:
        msg = (message or "").strip()
        if not msg:
            return IntentResult(agent_id="hub", confidence=1.0)

        # 多意图
        multi = self._rule_multi(msg)
        if multi:
            return IntentResult(
                agent_id="hub",
                confidence=0.85,
                is_multi=True,
                sub_intents=multi,
                plan_summary=" → ".join(s.agent_id for s in multi),
            )

        # 快速规则
        for pattern, agent_id in self.FAST_RULES:
            if pattern.search(msg):
                return IntentResult(agent_id=agent_id, confidence=0.9)

        # LLM 分类
        if self.llm and self.llm.available:
            try:
                return await self._llm_classify(msg, context)
            except Exception:
                pass

        return IntentResult(agent_id="hub", confidence=0.5)

    def _rule_multi(self, message: str) -> list[SubIntent] | None:
        if not any(kw in message for kw in self.MULTI_KEYWORDS):
            return None
        hits: list[SubIntent] = []
        for pattern, agent_id in self.FAST_RULES:
            if pattern.search(message):
                hits.append(
                    SubIntent(
                        agent_id=agent_id,
                        message=message,
                        reason=f"规则匹配 {agent_id}",
                    )
                )
        # 去重 agent
        seen = set()
        unique: list[SubIntent] = []
        for h in hits:
            if h.agent_id not in seen and h.agent_id != "hub":
                seen.add(h.agent_id)
                unique.append(h)
        return unique if len(unique) >= 2 else None

    async def _llm_classify(
        self, message: str, context: dict[str, Any] | None
    ) -> IntentResult:
        assert self.llm is not None
        prompt = (
            "判断用户消息应由哪个 Agent 处理。只返回 JSON。\n"
            "可选: scout(速览), mentor(教学), navigator(规划), curator(分类), "
            "scribe(笔记), atlas(图谱), hub(通用)。\n"
            f"用户消息: {message}\n"
            '格式: {"agent_id":"...","confidence":0.0,"is_multi":false,'
            '"sub_intents":[{"agent_id":"...","message":"...","reason":"..."}]}'
        )
        data = await self.llm.complete_json(
            [{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=400,
        )
        agent_id = data.get("agent_id") or "hub"
        conf = float(data.get("confidence") or 0.6)
        sub_raw = data.get("sub_intents") or []
        subs = [
            SubIntent(
                agent_id=s.get("agent_id", "hub"),
                message=s.get("message", message),
                reason=s.get("reason", ""),
            )
            for s in sub_raw
            if isinstance(s, dict)
        ]
        is_multi = bool(data.get("is_multi")) and len(subs) >= 2
        return IntentResult(
            agent_id=agent_id,
            confidence=conf,
            is_multi=is_multi,
            sub_intents=subs,
        )
