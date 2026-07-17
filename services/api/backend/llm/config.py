"""LLM 配置 —— 从用户 settings_json 构建"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
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
    api_format: str = "openai"
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

    def normalized_api_base(self) -> str | None:
        """规范化 api_base：去掉末尾斜杠与多余 messages 路径。"""
        if not self.api_base:
            return None
        base = self.api_base.strip().rstrip("/")
        # 用户若误填完整 messages 路径，截回 base
        for suffix in (
            "/v1/messages",
            "/messages",
            "/v1/chat/completions",
            "/chat/completions",
        ):
            if base.endswith(suffix):
                base = base[: -len(suffix)]
                break
        return base or None

    def litellm_model(self) -> str:
        """
        转换为 litellm model 字符串。

        - Anthropic 兼容（含 MiniMax）：anthropic/<model>
        - Google：gemini/<model>
        - Ollama：ollama/<model>
        - OpenAI 兼容自定义 base：openai/<model>
        """
        m = (self.model or "").strip()
        if not m:
            m = "gpt-4o"
        # 已带 provider 前缀
        known = (
            "openai/",
            "anthropic/",
            "deepseek/",
            "gemini/",
            "ollama/",
            "minimax/",
        )
        if m.startswith(known):
            return m

        fmt = (self.api_format or "openai").lower()
        p = (self.provider or "openai").lower()
        base = (self.normalized_api_base() or "").lower()

        # MiniMax Anthropic 兼容域名 → 强制 anthropic 路由
        if "minimax" in p or "minimax" in base or "minimaxi" in base:
            if fmt in ("anthropic", "custom", "") or "anthropic" in base:
                return f"anthropic/{m}"
            return f"openai/{m}"

        if fmt == "anthropic" or p == "anthropic":
            return f"anthropic/{m}"
        if fmt == "google" or p in ("google", "gemini"):
            return f"gemini/{m}"
        if fmt == "ollama" or p == "ollama":
            return f"ollama/{m}"
        if p == "deepseek":
            return f"deepseek/{m}"
        # 有自定义 base 的 OpenAI 兼容
        if self.api_base and p not in ("openai",):
            return f"openai/{m}"
        if self.api_base and fmt in ("openai", "custom"):
            return f"openai/{m}"
        return m


def _load_settings_dict(user: User) -> dict[str, Any]:
    try:
        data = json.loads(user.settings_json or "{}")
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def build_llm_config_from_settings(raw: dict[str, Any]) -> LLMConfig | None:
    """从 settings 字典构建配置；无 key 时返回 None。"""
    from backend.core.security import decrypt_secret, is_encrypted_secret
    import logging

    logger = logging.getLogger(__name__)
    stored = raw.get("llm_api_key")
    api_key = (decrypt_secret(stored) or "").strip()
    if not api_key:
        # 区分「未配置」与「密文无法解密」（如 SECRET_KEY 变更）
        if stored and is_encrypted_secret(str(stored)):
            logger.warning(
                "llm_api_key 解密失败（enc:v1 密文存在但无法解密），"
                "请用户在设置页重新保存 API Key"
            )
        return None
    model = raw.get("llm_model") or raw.get("llm_default_model") or "gpt-4o"
    provider = raw.get("llm_provider") or "openai"
    api_base = raw.get("llm_api_base") or None
    api_format = raw.get("llm_api_format") or "openai"
    return LLMConfig(
        provider=provider,
        model=model,
        api_key=api_key,
        api_base=api_base,
        api_format=api_format,
    )


def llm_config_status(raw: dict[str, Any]) -> str:
    """诊断用：ok | missing | decrypt_failed。"""
    from backend.core.security import decrypt_secret, is_encrypted_secret

    stored = raw.get("llm_api_key")
    if not stored:
        return "missing"
    plain = decrypt_secret(stored)
    if plain and str(plain).strip():
        return "ok"
    if is_encrypted_secret(str(stored)):
        return "decrypt_failed"
    return "missing"


async def load_user_settings_dict(
    db: AsyncSession, user_id: UUID
) -> dict[str, Any]:
    """与 LLM 配置同源：强制刷新 settings_json。"""
    from sqlalchemy import select

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return {}
    await db.refresh(user, attribute_names=["settings_json", "agent_permissions"])
    return _load_settings_dict(user)


async def build_llm_config_from_user(
    db: AsyncSession, user_id: UUID
) -> LLMConfig | None:
    """始终重新读取用户行，避免 session expire 后拿到空 settings_json。"""
    raw = await load_user_settings_dict(db, user_id)
    return build_llm_config_from_settings(raw)


async def build_llm_bundle_from_user(
    db: AsyncSession, user_id: UUID
) -> tuple[LLMConfig | None, str, dict[str, Any]]:
    """一次查库返回 (config, status, settings_dict)，诊断与构建同源。"""
    raw = await load_user_settings_dict(db, user_id)
    cfg = build_llm_config_from_settings(raw)
    return cfg, llm_config_status(raw), raw


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
