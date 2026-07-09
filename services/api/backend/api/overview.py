"""总览聚合 API —— 从数据库派生真实数据"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.core.responses import wrap_data
from backend.models.user import User
from backend.schemas.common import DataResponse
from backend.schemas.overview import (
    ActivityItemOut,
    OverviewRecentNoteOut,
    RecommendedProjectOut,
    TrendingRepoOut,
)
from backend.services.overview_service import (
    list_activities,
    list_recent_notes,
    list_recommended,
    list_trending,
)

router = APIRouter(prefix="/overview", tags=["overview"])


@router.get("/activities", response_model=DataResponse[list[ActivityItemOut]])
async def get_activities(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return wrap_data(await list_activities(db, current_user.id))


@router.get("/recent-notes", response_model=DataResponse[list[OverviewRecentNoteOut]])
async def get_recent_notes(
    limit: int = Query(5, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return wrap_data(await list_recent_notes(db, current_user.id, limit=limit))


@router.get("/recommended", response_model=DataResponse[list[RecommendedProjectOut]])
async def get_recommended(
    limit: int = Query(6, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return wrap_data(await list_recommended(db, current_user.id, limit=limit))


@router.get("/trending", response_model=DataResponse[list[TrendingRepoOut]])
async def get_trending():
    return wrap_data(await list_trending())
