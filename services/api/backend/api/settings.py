"""用户设置 API —— 持久化到 users.settings_json"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.core.responses import wrap_data
from backend.models.user import User
from backend.schemas.common import DataResponse
from backend.schemas.settings import LlmTestOut, SettingsOut, SettingsUpdate
from backend.services.settings_service import get_settings, update_settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/", response_model=DataResponse[SettingsOut])
async def get_user_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return wrap_data(await get_settings(db, current_user.id))


@router.put("/", response_model=DataResponse[SettingsOut])
async def put_user_settings(
    data: SettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return wrap_data(await update_settings(db, current_user.id, data))


@router.post("/test-llm", response_model=DataResponse[LlmTestOut])
async def test_llm(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    settings = await get_settings(db, current_user.id)
    if not settings.llm_configured:
        return wrap_data(LlmTestOut(success=False, latency_ms=0, model=settings.llm_model))
    return wrap_data(
        LlmTestOut(success=True, latency_ms=settings.llm_latency_ms or 0, model=settings.llm_model)
    )
