"""记忆系统 —— 短期/长期/画像提案与合并"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.agent import AgentMessage, AgentSession, UserProfile
from backend.services.profile_service import get_or_create_profile, profile_to_out

logger = logging.getLogger(__name__)


class MemoryService:
    """Agent 记忆读写与合并。"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_session(self, session_id: UUID, user_id: UUID) -> AgentSession | None:
        session = await self.db.get(AgentSession, session_id)
        if not session or session.user_id != user_id:
            return None
        return session

    async def list_recent_messages(
        self, session_id: UUID, limit: int = 30
    ) -> list[AgentMessage]:
        result = await self.db.execute(
            select(AgentMessage)
            .where(AgentMessage.session_id == session_id)
            .order_by(AgentMessage.created_at.desc())
            .limit(limit)
        )
        msgs = list(result.scalars().all())
        msgs.reverse()
        return msgs

    async def get_user_profile_dict(self, user_id: UUID) -> dict[str, Any]:
        row = await get_or_create_profile(self.db, user_id)
        out = profile_to_out(row)
        return out.model_dump()

    async def get_short_memory(self, user_id: UUID, agent_id: str) -> list[dict]:
        """Agent 私有短期记忆（存于 user_profiles.agent_prefs）。"""
        row = await get_or_create_profile(self.db, user_id)
        prefs = self._parse(row.agent_prefs, {})
        short = prefs.get("short_memory", {})
        if not isinstance(short, dict):
            return []
        items = short.get(agent_id, [])
        return items if isinstance(items, list) else []

    async def append_short_memory(
        self, user_id: UUID, agent_id: str, entry: dict[str, Any], max_items: int = 12
    ) -> None:
        row = await get_or_create_profile(self.db, user_id)
        prefs = self._parse(row.agent_prefs, {})
        if not isinstance(prefs, dict):
            prefs = {}
        short = prefs.setdefault("short_memory", {})
        if not isinstance(short, dict):
            short = {}
            prefs["short_memory"] = short
        items = list(short.get(agent_id) or [])
        items.append({**entry, "at": datetime.utcnow().isoformat() + "Z"})
        short[agent_id] = items[-max_items:]
        row.agent_prefs = json.dumps(prefs, ensure_ascii=False)
        await self.db.commit()

    async def get_long_memory(self, user_id: UUID) -> list[dict]:
        row = await get_or_create_profile(self.db, user_id)
        prefs = self._parse(row.agent_prefs, {})
        items = prefs.get("memory_items", []) if isinstance(prefs, dict) else []
        return items if isinstance(items, list) else []

    async def propose_memory(
        self,
        user_id: UUID,
        *,
        agent_id: str,
        value: str,
        confidence: float,
        evidence: list[str] | None = None,
        kind: str = "long_memory",
    ) -> dict[str, Any]:
        """
        Agent 提交记忆提案，Hub 做证据加权合并。
        kind: long_memory | profile_tech | preference
        """
        proposal = {
            "value": value,
            "confidence": max(0.0, min(1.0, confidence)),
            "evidence": evidence or [],
            "agent_id": agent_id,
            "kind": kind,
            "at": datetime.utcnow().isoformat() + "Z",
        }
        if kind == "long_memory":
            await self._merge_long_memory(user_id, proposal)
        elif kind == "profile_tech":
            await self._merge_tech_profile(user_id, proposal)
        elif kind == "preference":
            await self._merge_preference(user_id, proposal)
        return proposal

    async def _merge_long_memory(self, user_id: UUID, proposal: dict) -> None:
        row = await get_or_create_profile(self.db, user_id)
        prefs = self._parse(row.agent_prefs, {})
        if not isinstance(prefs, dict):
            prefs = {}
        items: list[dict] = list(prefs.get("memory_items") or [])
        value = str(proposal["value"]).strip()
        # 冲突检测：语义近似用子串/相等
        for existing in items:
            if not isinstance(existing, dict):
                continue
            ev = str(existing.get("content") or existing.get("value") or "")
            if ev == value or value in ev or ev in value:
                # 保留高置信度
                old_c = float(existing.get("confidence", 0.5))
                if proposal["confidence"] >= old_c:
                    existing["content"] = value
                    existing["confidence"] = proposal["confidence"]
                    existing["source_agent"] = proposal["agent_id"]
                    existing["updated_at"] = proposal["at"]
                row.agent_prefs = json.dumps(prefs, ensure_ascii=False)
                await self.db.commit()
                return
        items.append(
            {
                "id": f"mem_{len(items)+1}_{int(datetime.utcnow().timestamp())}",
                "category": "summary",
                "content": value,
                "confidence": proposal["confidence"],
                "source_agent": proposal["agent_id"],
                "evidence": proposal.get("evidence", []),
                "created_at": proposal["at"],
            }
        )
        # 上限 100 条
        prefs["memory_items"] = items[-100:]
        row.agent_prefs = json.dumps(prefs, ensure_ascii=False)
        # 同步 history_summary 摘要
        if not row.history_summary:
            row.history_summary = value[:200]
        await self.db.commit()

    async def _merge_tech_profile(self, user_id: UUID, proposal: dict) -> None:
        """技术熟练度：证据加权，取交集倾向（共同点）。"""
        row = await get_or_create_profile(self.db, user_id)
        tech = self._parse(row.tech_profile, {})
        if not isinstance(tech, dict):
            tech = {}
        # value 格式: "Python:80" 或 JSON
        value = proposal["value"]
        conf = proposal["confidence"]
        try:
            if value.strip().startswith("{"):
                patch = json.loads(value)
            elif ":" in value:
                k, v = value.split(":", 1)
                patch = {k.strip(): float(v.strip())}
            else:
                return
        except (ValueError, json.JSONDecodeError):
            return
        for k, v in patch.items():
            old = float(tech.get(k, 50))
            # 加权平均：新证据 * conf + 旧值 * (1-conf)
            tech[k] = round(old * (1 - conf) + float(v) * conf, 1)
        row.tech_profile = json.dumps(tech, ensure_ascii=False)
        await self.db.commit()

    async def _merge_preference(self, user_id: UUID, proposal: dict) -> None:
        row = await get_or_create_profile(self.db, user_id)
        prefs_data = self._parse(row.preferences, {})
        if not isinstance(prefs_data, dict):
            prefs_data = {}
        value = proposal["value"]
        try:
            if value.strip().startswith("{"):
                prefs_data.update(json.loads(value))
            elif ":" in value:
                k, v = value.split(":", 1)
                prefs_data[k.strip()] = v.strip()
        except json.JSONDecodeError:
            prefs_data["note"] = value
        row.preferences = json.dumps(prefs_data, ensure_ascii=False)
        await self.db.commit()

    async def compress_history_if_needed(
        self,
        messages: list[dict[str, Any]],
        *,
        max_messages: int = 24,
        keep_recent: int = 12,
    ) -> list[dict[str, Any]]:
        """简单上下文压缩：保留 system + 最近 N 条，中间摘要。"""
        if len(messages) <= max_messages:
            return messages
        system = [m for m in messages if m.get("role") == "system"]
        rest = [m for m in messages if m.get("role") != "system"]
        if len(rest) <= keep_recent:
            return messages
        old = rest[:-keep_recent]
        recent = rest[-keep_recent:]
        summary_parts = []
        for m in old:
            role = m.get("role", "?")
            content = (m.get("content") or "")[:120]
            if content:
                summary_parts.append(f"{role}: {content}")
        summary = {
            "role": "system",
            "content": "[历史对话摘要]\n" + "\n".join(summary_parts[-20:]),
        }
        return system + [summary] + recent

    @staticmethod
    def _parse(text: str | None, fallback: Any) -> Any:
        try:
            value = json.loads(text or "")
            return value if isinstance(value, (dict, list)) else fallback
        except json.JSONDecodeError:
            return fallback

    @staticmethod
    def estimate_tokens(text: str) -> int:
        """粗略 token 估计：中文约 1.5 字/token，英文约 4 字符/token。"""
        if not text:
            return 0
        # 混合估算
        return max(1, len(text) // 3)
