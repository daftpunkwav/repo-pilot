"""用户画像 API"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.core.responses import wrap_data
from backend.models.user import User
from backend.schemas.common import DataResponse
from backend.schemas.profile import UserProfileOut, UserProfileUpdate
from backend.services.profile_service import get_user_profile, update_user_profile

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
