"""用户设置持久化"""
import json
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.user import User
from backend.schemas.settings import AgentLlmConfigOut, SettingsOut, SettingsUpdate

AGENT_IDS = ("hub", "scout", "mentor", "navigator", "curator", "scribe")

DEFAULT_AGENT_LLM_CONFIGS: list[dict[str, str | None]] = [
    {"agent_id": aid, "model_override": None, "speaking_style": "default"}
    for aid in AGENT_IDS
]

DEFAULT_SETTINGS: dict[str, Any] = {
    **SettingsOut(agent_llm_configs=[AgentLlmConfigOut(**c) for c in DEFAULT_AGENT_LLM_CONFIGS]).model_dump(),
}
MASK = "sk-****"


def _mask_api_key(key: str | None) -> str | None:
    if not key:
        return None
    if len(key) <= 8:
        return MASK
    return f"{key[:3]}****{key[-4:]}"


def _load_raw(user: User) -> dict[str, Any]:
    try:
        data = json.loads(user.settings_json or "{}")
        if isinstance(data, dict):
            return {**DEFAULT_SETTINGS, **data}
    except json.JSONDecodeError:
        pass
    return dict(DEFAULT_SETTINGS)


def _normalize_agent_llm_configs(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list) and value:
        return value
    return list(DEFAULT_AGENT_LLM_CONFIGS)


def settings_to_out(user: User) -> SettingsOut:
    raw = _load_raw(user)
    api_key = raw.pop("llm_api_key", None)
    raw["llm_api_key_masked"] = _mask_api_key(api_key) if api_key else None
    raw["llm_configured"] = bool(api_key)
    if not raw.get("llm_model"):
        raw["llm_model"] = raw.get("llm_default_model", "gpt-4o")
    raw["agent_llm_configs"] = _normalize_agent_llm_configs(raw.get("agent_llm_configs"))
    return SettingsOut.model_validate(raw)


async def get_settings(db: AsyncSession, user_id: UUID) -> SettingsOut:
    user = await db.get(User, user_id)
    assert user is not None
    return settings_to_out(user)


async def save_llm_api_key(db: AsyncSession, user_id: UUID, api_key: str) -> str:
    """保存真实 LLM API Key 到用户 settings_json，返回掩码。"""
    user = await db.get(User, user_id)
    assert user is not None
    raw = _load_raw(user)
    raw["llm_api_key"] = api_key
    user.settings_json = json.dumps(raw, ensure_ascii=False)
    await db.commit()
    await db.refresh(user)
    return _mask_api_key(api_key) or ""


async def update_settings(
    db: AsyncSession, user_id: UUID, data: SettingsUpdate
) -> SettingsOut:
    user = await db.get(User, user_id)
    assert user is not None
    raw = _load_raw(user)
    payload = data.model_dump(exclude_unset=True)
    if "llm_api_key" in payload and payload["llm_api_key"] is None:
        payload.pop("llm_api_key")
    raw.update(payload)
    if data.llm_default_model and not data.llm_model:
        raw["llm_model"] = data.llm_default_model
    user.settings_json = json.dumps(raw, ensure_ascii=False)
    await db.commit()
    await db.refresh(user)
    return settings_to_out(user)
