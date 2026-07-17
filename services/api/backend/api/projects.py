"""
项目管理 API —— CRUD、导入、进度、统计
"""
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.api.github import _primary_token
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
    ProjectProgress,
    ProjectReadmeOut,
    ProjectStats,
    ProjectUpdate,
)
from backend.services.github_client import fetch_readme_text
from backend.services.project_service import (
    build_project_from_create,
    import_repos,
    list_user_projects,
    load_tags_map,
    project_stats,
    project_to_out,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/", response_model=PaginatedResponse[ProjectOut])
async def list_projects(
    keyword: str = Query(""),
    search: str = Query(""),
    lang: str = Query(""),
    language: str = Query(""),
    category_id: UUID | None = Query(None),
    tag_id: UUID | None = Query(None),
    star_min: int = Query(0),
    star_max: int | None = Query(None),
    sort: str = Query(""),
    sort_by: str = Query(""),
    progress: str = Query(""),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    kw = keyword or search
    lg = lang or language
    sort_key = sort or sort_by
    items, total = await list_user_projects(
        db,
        current_user.id,
        keyword=kw,
        lang=lg,
        star_min=star_min,
        star_max=star_max,
        sort=sort_key,
        progress=progress,
        category_id=category_id,
        tag_id=tag_id,
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
    return wrap_data(project_to_out(project, (await load_tags_map(db, [project.id])).get(project.id, [])))


def _parse_github_owner_repo(project: Project) -> tuple[str, str] | None:
    """从 name（owner/repo）或 url 解析 GitHub 仓库坐标。"""
    name = (project.name or "").strip()
    if name and "/" in name and not name.startswith("http"):
        owner, _, repo = name.partition("/")
        owner, repo = owner.strip(), repo.strip().removesuffix(".git")
        if owner and repo and "/" not in repo:
            return owner, repo
    url = (project.url or "").strip()
    if not url:
        return None
    try:
        path = urlparse(url).path.strip("/")
    except Exception:
        return None
    parts = [p for p in path.split("/") if p]
    if len(parts) >= 2:
        return parts[0], parts[1].removesuffix(".git")
    return None


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
    return wrap_data(project_to_out(project, (await load_tags_map(db, [project.id])).get(project.id, [])))


@router.get("/{project_id}/readme", response_model=DataResponse[ProjectReadmeOut])
async def get_project_readme(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    按需从 GitHub 拉取项目 README。
    使用用户绑定的 PAT（若有）以提高限额与私有仓可读性。
    """
    project = await db.get(Project, project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Project not found"},
        )
    coords = _parse_github_owner_repo(project)
    if not coords:
        return wrap_data(
            ProjectReadmeOut(
                content=None,
                source="error",
                message="无法从项目 URL/名称解析 GitHub 仓库",
            )
        )
    owner, repo = coords
    _, token = _primary_token(current_user)
    # 迁移明文 PAT 时可能改了 user，需要落库
    await db.commit()
    try:
        text = await fetch_readme_text(owner, repo, token=token)
    except Exception:
        return wrap_data(
            ProjectReadmeOut(
                content=None,
                source="error",
                message="拉取 README 时发生网络错误",
                owner=owner,
                repo=repo,
            )
        )
    if not text:
        return wrap_data(
            ProjectReadmeOut(
                content=None,
                source="empty",
                message="该仓库暂无 README 或无权访问",
                owner=owner,
                repo=repo,
            )
        )
    return wrap_data(
        ProjectReadmeOut(
            content=text,
            source="github",
            owner=owner,
            repo=repo,
        )
    )


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
    return wrap_data(project_to_out(project, (await load_tags_map(db, [project.id])).get(project.id, [])))


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
    progress: ProjectProgress = Query(...),
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
    return wrap_data(ProgressUpdateOut(id=project.id, progress=progress))
