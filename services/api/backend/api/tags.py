"""标签 API"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.core.responses import wrap_data
from backend.models.user import User
from backend.schemas.common import DataResponse
from backend.schemas.tag import SetProjectTagsBody, SetProjectTagsOut, TagCreate, TagOut
from backend.services.tag_service import (
    create_tag,
    delete_tag,
    list_user_tags,
    set_project_tags,
)

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("/", response_model=DataResponse[list[TagOut]])
async def list_tags(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return wrap_data(await list_user_tags(db, current_user.id))


@router.post("/", response_model=DataResponse[TagOut])
async def create_tag_api(
    data: TagCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tag = await create_tag(db, current_user.id, data.name)
    return wrap_data(tag)


@router.delete("/{tag_id}", response_model=DataResponse[dict])
async def delete_tag_api(
    tag_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ok = await delete_tag(db, current_user.id, tag_id)
    if not ok:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Tag not found"},
        )
    return wrap_data({"success": True})


@router.put("/projects/{project_id}", response_model=DataResponse[SetProjectTagsOut])
async def set_project_tags_api(
    project_id: UUID,
    body: SetProjectTagsBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await set_project_tags(db, current_user.id, project_id, body.tag_ids)
    if not result:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Project not found"},
        )
    return wrap_data(result)
