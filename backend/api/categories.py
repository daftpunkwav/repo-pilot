"""
分类 API —— 预设 + 自定义分类管理
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.models.category import Category
from backend.models.user import User
from backend.schemas.common import DataResponse, ListResponse, OkResponse

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=ListResponse[dict])
async def list_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 预设分类 + 用户自定义分类
    result = await db.execute(select(Category).where(Category.is_preset == True))
    preset = result.scalars().all()
    result = await db.execute(select(Category).where(Category.user_id == current_user.id))
    custom = result.scalars().all()
    items = [{"id": str(c.id), "name": c.name, "icon": c.icon, "color": c.color, "is_preset": c.is_preset} for c in list(preset) + list(custom)]
    return ListResponse(data=items, meta={"total": len(items), "page": 1, "page_size": len(items), "total_pages": 1})


@router.post("/", response_model=DataResponse[dict])
async def create_category(
    name: str,
    icon: str | None = None,
    color: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = Category(user_id=current_user.id, name=name, icon=icon, color=color, is_preset=False)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return DataResponse(data={"id": str(category.id), "name": category.name, "icon": category.icon, "color": category.color, "is_preset": category.is_preset})


@router.delete("/{category_id}", response_model=OkResponse)
async def delete_category(
    category_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = await db.get(Category, category_id)
    if not category or category.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Category not found"})
    await db.delete(category)
    await db.commit()
    return OkResponse()
