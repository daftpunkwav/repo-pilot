"""LLM 配置 —— 从用户 settings_json 构建"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.user import User


@dataclass
class LLMConfig:
    """运行时 LLM 配置（含真实 api_key，仅服务端内部使用）"""

    provider: str
    model: str
    api_key: str
    api_base: str | None = None
    max_context_tokens: int = 128_000
    max_output_tokens: int = 4096
    temperature: float = 0.7

    @property
    def has_llm(self) -> bool:
        return bool(self.api_key)

    @property
    def supports_tools(self) -> bool:
        if not self.has_llm:
            return False
        blocked = {"gpt-3.5-turbo-0301", "text-davinci-003"}
        return self.model not in blocked

    def litellm_model(self) -> str:
        """转换为 litellm model 字符串。"""
        p = (self.provider or "openai").lower()
        m = self.model
        if p in ("openai", "custom") or m.startswith(("openai/", "anthropic/", "deepseek/")):
            if p == "deepseek" and not m.startswith("deepseek/"):
                return f"deepseek/{m}"
            if p == "anthropic" and not m.startswith("anthropic/"):
                return f"anthropic/{m}"
            return m
        if p == "anthropic":
            return m if m.startswith("anthropic/") else f"anthropic/{m}"
        if p == "deepseek":
            return m if m.startswith("deepseek/") else f"deepseek/{m}"
        return m


def _load_settings_dict(user: User) -> dict[str, Any]:
    try:
        data = json.loads(user.settings_json or "{}")
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def build_llm_config_from_settings(raw: dict[str, Any]) -> LLMConfig | None:
    """从 settings 字典构建配置；无 key 时返回 None。"""
    api_key = (raw.get("llm_api_key") or "").strip()
    if not api_key:
        return None
    model = raw.get("llm_model") or raw.get("llm_default_model") or "gpt-4o"
    provider = raw.get("llm_provider") or "openai"
    api_base = raw.get("llm_api_base") or None
    return LLMConfig(
        provider=provider,
        model=model,
        api_key=api_key,
        api_base=api_base,
    )


async def build_llm_config_from_user(
    db: AsyncSession, user_id: UUID
) -> LLMConfig | None:
    user = await db.get(User, user_id)
    if not user:
        return None
    return build_llm_config_from_settings(_load_settings_dict(user))


def get_agent_model_override(raw: dict[str, Any], agent_id: str) -> str | None:
    configs = raw.get("agent_llm_configs") or []
    if isinstance(configs, list):
        for c in configs:
            if isinstance(c, dict) and c.get("agent_id") == agent_id:
                return c.get("model_override") or None
    return None


def get_agent_speaking_style(raw: dict[str, Any], agent_id: str) -> str:
    configs = raw.get("agent_llm_configs") or []
    if isinstance(configs, list):
        for c in configs:
            if isinstance(c, dict) and c.get("agent_id") == agent_id:
                return c.get("speaking_style") or "default"
    return "default"
