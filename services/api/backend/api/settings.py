"""
设置 API —— 用户设置读写
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/")
async def get_settings(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # TODO: 接入 UserSetting 模型
    return {"theme": "dark", "zoom": 1.0, "font_scale": 1.0, "view_mode": "list"}


@router.put("/")
async def update_settings(
    data: dict,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # TODO: 保存到 UserSetting 模型
    return {"ok": True}
