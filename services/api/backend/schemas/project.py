"""
Pydantic schemas —— 项目相关请求/响应
"""
from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


ProjectProgress = Literal["none", "learning", "learned", "mastered"]
ProjectSource = Literal["github", "manual"]


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., min_length=1, max_length=512)
    description: Optional[str] = None
    category_id: Optional[UUID] = None
    stars: int = 0
    language: Optional[str] = None
    progress: ProjectProgress = "none"
    source: ProjectSource = "manual"
    tags: list[str] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    url: Optional[str] = Field(None, min_length=1, max_length=512)
    description: Optional[str] = None
    category_id: Optional[UUID] = None
    stars: Optional[int] = None
    language: Optional[str] = None
    progress: Optional[ProjectProgress] = None
    tags: Optional[list[str]] = None


class ProjectOut(BaseModel):
    id: UUID
    name: str
    url: str
    description: Optional[str] = None
    language: Optional[str] = None
    stars: int
    category_id: Optional[UUID] = None
    progress: ProjectProgress
    tags: list[str] = Field(default_factory=list)
    source: ProjectSource
    imported_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ImportRepoItem(BaseModel):
    owner: str
    repo: str
    url: str


class ImportProjectsBody(BaseModel):
    repos: list[ImportRepoItem]


class ImportResult(BaseModel):
    succeeded: int
    failed: int
    summary: str
    errors: list[dict] = Field(default_factory=list)


class ProjectStats(BaseModel):
    total: int
    by_progress: dict[str, int]
    by_language: dict[str, int]
    by_category: dict[str, int] = Field(default_factory=dict)


class ProgressUpdateOut(BaseModel):
    id: UUID
    progress: ProjectProgress
