"""
项目管理 API —— CRUD、导入、进度、统计
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.core.responses import wrap_data, wrap_paginated
from backend.models.project import Project
from backend.models.user import User
from backend.schemas.common import DataResponse, PaginatedResponse
from backend.schemas.project import (
    ImportProjectsBody,
    ImportResult,
    ProgressUpdateOut,
    ProjectCreate,
    ProjectOut,
    ProjectStats,
    ProjectUpdate,
)
from backend.services.project_service import (
    build_project_from_create,
    import_repos,
    list_user_projects,
    project_stats,
    project_to_out,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/", response_model=PaginatedResponse[ProjectOut])
async def list_projects(
    keyword: str = Query(""),
    lang: str = Query(""),
    star_min: int = Query(0),
    star_max: int | None = Query(None),
    sort: str = Query(""),
    progress: str = Query(""),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, total = await list_user_projects(
        db,
        current_user.id,
        keyword=keyword,
        lang=lang,
        star_min=star_min,
        star_max=star_max,
        sort=sort,
        progress=progress,
        page=page,
        page_size=page_size,
    )
    return wrap_paginated(items, total=total, page=page, page_size=page_size)


@router.get("/stats", response_model=DataResponse[ProjectStats])
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stats = await project_stats(db, current_user.id)
    return wrap_data(stats)


@router.post("/", response_model=DataResponse[ProjectOut])
async def create_project(
    data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = build_project_from_create(current_user.id, data)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return wrap_data(project_to_out(project))


@router.get("/{project_id}", response_model=DataResponse[ProjectOut])
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Project not found"},
        )
    return wrap_data(project_to_out(project))


@router.put("/{project_id}", response_model=DataResponse[ProjectOut])
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Project not found"},
        )
    for key, value in data.model_dump(exclude_unset=True, exclude={"tags"}).items():
        setattr(project, key, value)
    await db.commit()
    await db.refresh(project)
    return wrap_data(project_to_out(project))


@router.delete("/{project_id}", response_model=DataResponse[dict])
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Project not found"},
        )
    await db.delete(project)
    await db.commit()
    return wrap_data({"success": True})


@router.post("/import", response_model=DataResponse[ImportResult])
async def import_projects(
    body: ImportProjectsBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await import_repos(db, current_user.id, body.repos)
    return wrap_data(result)


@router.put("/{project_id}/progress", response_model=DataResponse[ProgressUpdateOut])
async def update_progress(
    project_id: UUID,
    progress: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Project not found"},
        )
    project.progress = progress
    await db.commit()
    return wrap_data(ProgressUpdateOut(id=project.id, progress=progress))  # type: ignore[arg-type]
