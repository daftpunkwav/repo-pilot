"""
项目管理 API —— CRUD、导入、进度、搜索筛选排序
"""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.models.project import Project
from backend.models.user import User
from backend.schemas.common import DataResponse, ListResponse, OkResponse
from backend.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/", response_model=ListResponse[ProjectOut])
async def list_projects(
    category: str = Query("全部"),
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
    query = select(Project).where(Project.user_id == current_user.id)
    # TODO: 增加筛选/排序/分页逻辑
    result = await db.execute(query)
    items = result.scalars().all()
    total = len(items)
    total_pages = max(1, (total + page_size - 1) // page_size)
    start = (page - 1) * page_size
    page_items = items[start : start + page_size]
    return ListResponse(
        data=[ProjectOut.model_validate(p) for p in page_items],
        meta={"total": total, "page": page, "page_size": page_size, "total_pages": total_pages},
    )


@router.post("/", response_model=DataResponse[ProjectOut])
async def create_project(
    data: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = Project(user_id=current_user.id, **data.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return DataResponse(data=ProjectOut.model_validate(project))


@router.get("/{project_id}", response_model=DataResponse[ProjectOut])
async def get_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Project not found"})
    return DataResponse(data=ProjectOut.model_validate(project))


@router.put("/{project_id}", response_model=DataResponse[ProjectOut])
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Project not found"})
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(project, key, value)
    await db.commit()
    await db.refresh(project)
    return DataResponse(data=ProjectOut.model_validate(project))


@router.delete("/{project_id}", response_model=OkResponse)
async def delete_project(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Project not found"})
    await db.delete(project)
    await db.commit()
    return OkResponse()


@router.post("/import", response_model=OkResponse)
async def import_projects(
    items: list[ProjectCreate],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # TODO: 增加去重逻辑
    for item in items:
        project = Project(user_id=current_user.id, **item.model_dump())
        db.add(project)
    await db.commit()
    return OkResponse()


@router.put("/{project_id}/progress", response_model=DataResponse[dict])
async def update_progress(
    project_id: UUID,
    progress: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Project not found"})
    project.progress = progress
    await db.commit()
    return DataResponse(data={"progress": progress})
