"""用户设置持久化"""
import json
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import decrypt_secret, encrypt_secret, ensure_encrypted_secret
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


def _get_plain_api_key(raw: dict[str, Any]) -> str | None:
    """读取并解密 settings 中的 LLM API Key。"""
    return decrypt_secret(raw.get("llm_api_key"))


def settings_to_out(user: User) -> SettingsOut:
    raw = _load_raw(user)
    api_key = _get_plain_api_key(raw)
    raw.pop("llm_api_key", None)
    raw["llm_api_key_masked"] = _mask_api_key(api_key) if api_key else None
    raw["llm_configured"] = bool(api_key)
    # 默认模型与生效模型保持一致（优先 default）
    default_model = raw.get("llm_default_model") or raw.get("llm_model") or "gpt-4o"
    raw["llm_default_model"] = default_model
    raw["llm_model"] = default_model
    # 保证可选列表包含默认模型
    models = raw.get("llm_available_models") or []
    if isinstance(models, list) and default_model and default_model not in models:
        raw["llm_available_models"] = [*models, default_model]
    raw["agent_llm_configs"] = _normalize_agent_llm_configs(raw.get("agent_llm_configs"))
    return SettingsOut.model_validate(raw)


async def _migrate_plaintext_llm_key(db: AsyncSession, user: User) -> None:
    """读路径将历史明文 LLM Key 升级为 enc:v1 密文。"""
    raw = _load_raw(user)
    stored, migrated = ensure_encrypted_secret(raw.get("llm_api_key"))
    if not migrated:
        return
    raw["llm_api_key"] = stored
    user.settings_json = json.dumps(raw, ensure_ascii=False)
    await db.commit()
    await db.refresh(user)


async def get_settings(db: AsyncSession, user_id: UUID) -> SettingsOut:
    user = await db.get(User, user_id)
    assert user is not None
    await _migrate_plaintext_llm_key(db, user)
    return settings_to_out(user)


async def save_llm_api_key(db: AsyncSession, user_id: UUID, api_key: str) -> str:
    """保存真实 LLM API Key（加密落库）到用户 settings_json，返回掩码。"""
    user = await db.get(User, user_id)
    assert user is not None
    raw = _load_raw(user)
    raw["llm_api_key"] = encrypt_secret(api_key)
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
    if "llm_api_key" in payload:
        plain = payload.pop("llm_api_key")
        if plain is not None:
            payload["llm_api_key"] = encrypt_secret(plain)
    raw.update(payload)
    # 任一模型字段变更时双向同步，避免 default/model 漂移
    if data.llm_default_model is not None:
        raw["llm_default_model"] = data.llm_default_model
        raw["llm_model"] = data.llm_default_model
    elif data.llm_model is not None:
        raw["llm_model"] = data.llm_model
        raw["llm_default_model"] = data.llm_model
    user.settings_json = json.dumps(raw, ensure_ascii=False)
    await db.commit()
    await db.refresh(user)
    return settings_to_out(user)


async def record_llm_test(
    db: AsyncSession,
    user_id: UUID,
    *,
    success: bool,
    latency_ms: int,
    model: str,
) -> None:
    from datetime import datetime

    user = await db.get(User, user_id)
    if not user:
        return
    raw = _load_raw(user)
    raw["llm_last_test"] = datetime.utcnow().isoformat() + "Z"
    raw["llm_latency_ms"] = latency_ms
    if model:
        raw["llm_model"] = model
    raw["llm_test_success"] = success
    user.settings_json = json.dumps(raw, ensure_ascii=False)
    await db.commit()
