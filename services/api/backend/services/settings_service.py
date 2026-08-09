"""本机设置持久化 —— 读写 AppState.settings_json"""
import json
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import decrypt_secret, encrypt_secret, ensure_encrypted_secret
from backend.models.app_state import AppState
from backend.schemas.settings import AgentLlmConfigOut, SettingsOut, SettingsUpdate
from backend.services.app_state_service import get_or_create_app_state

AGENT_IDS = ("hub", "scout", "mentor", "navigator", "curator", "scribe", "atlas")


def derive_agent_ids() -> tuple[str, ...]:
    """优先从 agent_core registry 派生；不可用时回退到静态 AGENT_IDS。"""
    try:
        from agent_core.agents.registry import get_registry as _get_reg

        return tuple(d.id for d in _get_reg().list_all())
    except Exception:
        return AGENT_IDS


DEFAULT_AGENT_LLM_CONFIGS: list[dict[str, str | None]] = [
    {"agent_id": aid, "model_override": None, "speaking_style": "default"}
    for aid in AGENT_IDS
]

DEFAULT_AGENT_GUIDELINES: list[dict[str, str]] = [
    {"agent_id": aid, "guideline": ""} for aid in AGENT_IDS
]

DEFAULT_SETTINGS: dict[str, Any] = {
    **SettingsOut(
        agent_llm_configs=[AgentLlmConfigOut(**c) for c in DEFAULT_AGENT_LLM_CONFIGS],
        agent_guidelines=DEFAULT_AGENT_GUIDELINES,
    ).model_dump(),
}
MASK = "sk-****"


def _mask_api_key(key: str | None) -> str | None:
    if not key:
        return None
    if len(key) <= 8:
        return MASK
    return f"{key[:3]}****{key[-4:]}"


def _load_raw(state: AppState) -> dict[str, Any]:
    try:
        data = json.loads(state.settings_json or "{}")
        if isinstance(data, dict):
            return {**DEFAULT_SETTINGS, **data}
    except json.JSONDecodeError:
        pass
    return dict(DEFAULT_SETTINGS)


def _normalize_agent_llm_configs(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list) and value:
        by_id = {
            str(item.get("agent_id")): item
            for item in value
            if isinstance(item, dict) and item.get("agent_id")
        }
        merged: list[dict[str, Any]] = []
        for aid in AGENT_IDS:
            if aid in by_id:
                merged.append(by_id[aid])
            else:
                merged.append(
                    {"agent_id": aid, "model_override": None, "speaking_style": "default"}
                )
        return merged
    return list(DEFAULT_AGENT_LLM_CONFIGS)


def _normalize_agent_guidelines(value: Any) -> list[dict[str, str]]:
    by_id: dict[str, str] = {}
    if isinstance(value, list):
        for item in value:
            if not isinstance(item, dict):
                continue
            aid = str(item.get("agent_id") or "").strip()
            if not aid:
                continue
            guideline = str(item.get("guideline") or "")[:2000]
            by_id[aid] = guideline
    return [{"agent_id": aid, "guideline": by_id.get(aid, "")} for aid in AGENT_IDS]


def _get_plain_api_key(raw: dict[str, Any]) -> str | None:
    """读取并解密 settings 中的 LLM API Key。"""
    return decrypt_secret(raw.get("llm_api_key"))


def settings_to_out(state: AppState) -> SettingsOut:
    raw = _load_raw(state)
    api_key = _get_plain_api_key(raw)
    raw.pop("llm_api_key", None)
    raw["llm_api_key_masked"] = _mask_api_key(api_key) if api_key else None
    raw["llm_configured"] = bool(api_key)
    default_model = raw.get("llm_default_model") or raw.get("llm_model") or "gpt-4o"
    raw["llm_default_model"] = default_model
    raw["llm_model"] = default_model
    models = raw.get("llm_available_models") or []
    if isinstance(models, list) and default_model and default_model not in models:
        raw["llm_available_models"] = [*models, default_model]
    raw["agent_llm_configs"] = _normalize_agent_llm_configs(raw.get("agent_llm_configs"))
    raw["agent_guidelines"] = _normalize_agent_guidelines(raw.get("agent_guidelines"))
    conduct = raw.get("agent_code_of_conduct") or ""
    raw["agent_code_of_conduct"] = str(conduct)[:4000]
    return SettingsOut.model_validate(raw)


async def _migrate_plaintext_llm_key(db: AsyncSession, state: AppState) -> None:
    """读路径将历史明文 LLM Key 升级为 enc:v1 密文。"""
    raw = _load_raw(state)
    stored, migrated = ensure_encrypted_secret(raw.get("llm_api_key"))
    if not migrated:
        return
    raw["llm_api_key"] = stored
    state.settings_json = json.dumps(raw, ensure_ascii=False)
    await db.commit()
    await db.refresh(state)


async def get_settings(db: AsyncSession) -> SettingsOut:
    state = await get_or_create_app_state(db)
    await _migrate_plaintext_llm_key(db, state)
    return settings_to_out(state)


async def save_llm_api_key(db: AsyncSession, api_key: str) -> str:
    """保存真实 LLM API Key（加密落库），返回掩码。"""
    state = await get_or_create_app_state(db)
    raw = _load_raw(state)
    raw["llm_api_key"] = encrypt_secret(api_key)
    state.settings_json = json.dumps(raw, ensure_ascii=False)
    await db.commit()
    await db.refresh(state)
    return _mask_api_key(api_key) or ""


async def update_settings(db: AsyncSession, data: SettingsUpdate) -> SettingsOut:
    state = await get_or_create_app_state(db)
    raw = _load_raw(state)
    payload = data.model_dump(exclude_unset=True)
    if "llm_api_key" in payload:
        plain = payload.pop("llm_api_key")
        if plain is not None:
            payload["llm_api_key"] = encrypt_secret(plain)
    raw.update(payload)
    if data.llm_default_model is not None:
        raw["llm_default_model"] = data.llm_default_model
        raw["llm_model"] = data.llm_default_model
    elif data.llm_model is not None:
        raw["llm_model"] = data.llm_model
        raw["llm_default_model"] = data.llm_model
    state.settings_json = json.dumps(raw, ensure_ascii=False)
    await db.commit()
    await db.refresh(state)
    return settings_to_out(state)


async def record_llm_test(
    db: AsyncSession,
    *,
    success: bool,
    latency_ms: int,
    model: str,
) -> None:
    from datetime import datetime

    state = await get_or_create_app_state(db)
    raw = _load_raw(state)
    raw["llm_last_test"] = datetime.utcnow().isoformat() + "Z"
    raw["llm_latency_ms"] = latency_ms
    if model:
        raw["llm_model"] = model
    raw["llm_test_success"] = success
    state.settings_json = json.dumps(raw, ensure_ascii=False)
    await db.commit()
