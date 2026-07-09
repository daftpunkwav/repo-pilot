"""
分类 API —— 预设 + 自定义分类管理
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.core.responses import wrap_data
from backend.models.category import Category
from backend.models.user import User
from backend.schemas.category import CategoryCreate, CategoryUpdate
from backend.schemas.common import DataResponse

router = APIRouter(prefix="/categories", tags=["categories"])


class CategoryOut(BaseModel):
    id: UUID
    name: str
    icon: str | None = None
    color: str | None = None
    is_preset: bool


@router.get("/", response_model=DataResponse[list[CategoryOut]])
async def list_categories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Category).where(
            or_(Category.is_preset.is_(True), Category.user_id == current_user.id)
        )
    )
    items = [
        CategoryOut(
            id=c.id,
            name=c.name,
            icon=c.icon,
            color=c.color,
            is_preset=c.is_preset,
        )
        for c in result.scalars().all()
    ]
    return wrap_data(items)


@router.post("/", response_model=DataResponse[CategoryOut])
async def create_category(
    data: CategoryCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = Category(user_id=current_user.id, name=data.name, is_preset=False)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return wrap_data(
        CategoryOut(
            id=category.id,
            name=category.name,
            icon=category.icon,
            color=category.color,
            is_preset=category.is_preset,
        )
    )


@router.put("/{category_id}", response_model=DataResponse[CategoryOut])
async def update_category(
    category_id: UUID,
    data: CategoryUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = await db.get(Category, category_id)
    if not category or category.is_preset or category.user_id != current_user.id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Category not found"},
        )
    category.name = data.name
    await db.commit()
    await db.refresh(category)
    return wrap_data(
        CategoryOut(
            id=category.id,
            name=category.name,
            icon=category.icon,
            color=category.color,
            is_preset=category.is_preset,
        )
    )


@router.delete("/{category_id}", response_model=DataResponse[dict])
async def delete_category(
    category_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    category = await db.get(Category, category_id)
    if not category or category.is_preset or category.user_id != current_user.id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Category not found"},
        )
    await db.delete(category)
    await db.commit()
    return wrap_data({"success": True})
