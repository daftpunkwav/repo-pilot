"""
GitHub API —— Star 导入、绑定账号
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db

router = APIRouter(prefix="/github", tags=["github"])


@router.get("/stars")
async def get_stars(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # TODO: 接入 GitHub API 获取 Star 列表
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, detail={"code": "NOT_IMPLEMENTED", "message": "GitHub stars is not implemented yet"})


@router.post("/bindaccount")
async def bind_account(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, detail={"code": "NOT_IMPLEMENTED", "message": "Bind account is not implemented yet"})