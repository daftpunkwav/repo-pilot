"""用户设置 API —— 持久化到 users.settings_json"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.core.responses import wrap_data
from backend.models.user import User
from backend.schemas.common import DataResponse
from backend.schemas.settings import (
    ApiKeyIn,
    ApiKeyOut,
    LlmTestIn,
    LlmTestOut,
    SettingsOut,
    SettingsUpdate,
)
from backend.services.settings_service import get_settings, save_llm_api_key, update_settings

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
    body: LlmTestIn | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    对当前默认模型（或 body.model）发起一次真实补全请求。
    模型返回非空文本 → success=true。
    """
    from backend.llm.config import build_llm_config_from_user
    from backend.llm.provider import LLMProvider
    from backend.services.settings_service import record_llm_test

    settings = await get_settings(db, current_user.id)
    cfg = await build_llm_config_from_user(db, current_user.id)
    model = (body.model if body else None) or settings.llm_model or settings.llm_default_model
    if not cfg:
        return wrap_data(
            LlmTestOut(
                success=False,
                latency_ms=0,
                model=model,
                error="未配置 API Key，请先保存密钥",
            )
        )
    # 用指定模型覆盖一次
    if model:
        cfg.model = model
    provider = LLMProvider(cfg)
    result = await provider.test_connection(model_override=model)
    await record_llm_test(
        db,
        current_user.id,
        success=result.success,
        latency_ms=result.latency_ms,
        model=result.model or model,
    )
    return wrap_data(
        LlmTestOut(
            success=result.success,
            latency_ms=result.latency_ms,
            model=result.model or model,
            reply=result.reply,
            error=result.error,
            litellm_model=result.litellm_model,
        )
    )


@router.post("/api-key", response_model=DataResponse[ApiKeyOut])
async def save_api_key(
    data: ApiKeyIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """接收真实 LLM API Key，持久化后返回掩码。"""
    masked = await save_llm_api_key(db, current_user.id, data.api_key)
    return wrap_data(ApiKeyOut(masked=masked))
