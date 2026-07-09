"""用户画像持久化"""
import json
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.agent import UserProfile
from backend.schemas.profile import GoalOut, MemoryItemOut, UserProfileOut, UserProfileUpdate

DEFAULT_PROFILE = UserProfileOut()


def _parse_json(text: str | None, fallback):
    try:
        value = json.loads(text or "")
        return value if isinstance(value, (dict, list)) else fallback
    except json.JSONDecodeError:
        return fallback


def profile_to_out(row: UserProfile) -> UserProfileOut:
    memory_raw = _parse_json(row.agent_prefs, {})
    memory_items = memory_raw.get("memory_items", []) if isinstance(memory_raw, dict) else []
    extensions = memory_raw.get("extensions", {}) if isinstance(memory_raw, dict) else {}
    goals = [GoalOut.model_validate(g) for g in _parse_json(row.goals, [])]
    memory = [MemoryItemOut.model_validate(m) for m in memory_items]
    return UserProfileOut(
        tech_proficiency=_parse_json(row.tech_profile, {}),
        learning_preferences=_parse_json(row.preferences, {}),
        goals=goals,
        history_summary=row.history_summary or "",
        memory_items=memory,
        extensions=extensions,
    )


async def get_or_create_profile(db: AsyncSession, user_id: UUID) -> UserProfile:
    row = await db.get(UserProfile, user_id)
    if row:
        return row
    row = UserProfile(user_id=user_id)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


async def get_user_profile(db: AsyncSession, user_id: UUID) -> UserProfileOut:
    row = await get_or_create_profile(db, user_id)
    return profile_to_out(row)


async def update_user_profile(
    db: AsyncSession, user_id: UUID, data: UserProfileUpdate
) -> UserProfileOut:
    row = await get_or_create_profile(db, user_id)
    if data.tech_proficiency is not None:
        row.tech_profile = json.dumps(data.tech_proficiency, ensure_ascii=False)
    if data.learning_preferences is not None:
        row.preferences = json.dumps(data.learning_preferences, ensure_ascii=False)
    if data.goals is not None:
        row.goals = json.dumps([g.model_dump() for g in data.goals], ensure_ascii=False)
    if data.history_summary is not None:
        row.history_summary = data.history_summary
    if data.memory_items is not None or data.extensions is not None:
        current = _parse_json(row.agent_prefs, {})
        if not isinstance(current, dict):
            current = {}
        if data.memory_items is not None:
            current["memory_items"] = [m.model_dump() for m in data.memory_items]
        if data.extensions is not None:
            current["extensions"] = data.extensions
        row.agent_prefs = json.dumps(current, ensure_ascii=False)
    await db.commit()
    await db.refresh(row)
    return profile_to_out(row)
