"""用户设置持久化"""
import json
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.user import User
from backend.schemas.settings import SettingsOut, SettingsUpdate

DEFAULT_SETTINGS: dict[str, Any] = SettingsOut().model_dump()
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


def settings_to_out(user: User) -> SettingsOut:
    raw = _load_raw(user)
    api_key = raw.pop("llm_api_key", None)
    raw["llm_api_key_masked"] = _mask_api_key(api_key) if api_key else None
    raw["llm_configured"] = bool(api_key)
    if not raw.get("llm_model"):
        raw["llm_model"] = raw.get("llm_default_model", "gpt-4o")
    return SettingsOut.model_validate(raw)


async def get_settings(db: AsyncSession, user_id: UUID) -> SettingsOut:
    user = await db.get(User, user_id)
    assert user is not None
    return settings_to_out(user)


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
