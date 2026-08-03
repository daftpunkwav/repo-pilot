"""用户画像 API"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.core.responses import wrap_data
from backend.memory.service import MemoryService
from backend.models.user import User
from backend.schemas.common import DataResponse
from backend.schemas.profile import UserProfileOut, UserProfileUpdate
from backend.services.profile_service import (
    clear_user_memory,
    get_user_profile,
    update_user_profile,
)

router = APIRouter(prefix="/user", tags=["user"])


@router.get("/profile", response_model=DataResponse[UserProfileOut])
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await get_user_profile(db, current_user.id)
    return wrap_data(profile)


@router.patch("/profile", response_model=DataResponse[UserProfileOut])
async def patch_profile(
    data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = await update_user_profile(db, current_user.id, data)
    return wrap_data(profile)


@router.post("/profile/clear-memory", response_model=DataResponse[UserProfileOut])
async def clear_memory(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """清除 Agent 关于用户的画像记忆（不删除对话会话）。"""
    profile = await clear_user_memory(db, current_user.id)
    return wrap_data(profile)


@router.post(
    "/profile/memory-proposals/{proposal_id}/accept",
    response_model=DataResponse[UserProfileOut],
)
async def accept_memory_proposal(
    proposal_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """确认并写入一条待处理记忆提案。"""
    mem = MemoryService(db)
    result = await mem.accept_memory_proposal(current_user.id, proposal_id)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("error") or "提案不存在")
    profile = await get_user_profile(db, current_user.id)
    return wrap_data(profile)


@router.post(
    "/profile/memory-proposals/{proposal_id}/reject",
    response_model=DataResponse[UserProfileOut],
)
async def reject_memory_proposal(
    proposal_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """拒绝一条待处理记忆提案。"""
    mem = MemoryService(db)
    result = await mem.reject_memory_proposal(current_user.id, proposal_id)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("error") or "提案不存在")
    profile = await get_user_profile(db, current_user.id)
    return wrap_data(profile)
