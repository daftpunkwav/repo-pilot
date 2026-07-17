"""
Pydantic schemas —— 项目相关请求/响应
"""
from datetime import datetime
from typing import Literal, Optional
from urllib.parse import urlparse
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


ProjectProgress = Literal["none", "learning", "learned", "mastered"]
ProjectSource = Literal["github", "manual"]


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    url: str = Field(..., min_length=1, max_length=512)
    description: Optional[str] = Field(None, max_length=2048)
    category_id: Optional[UUID] = None
    stars: int = 0
    language: Optional[str] = None
    progress: ProjectProgress = "none"
    source: ProjectSource = "manual"
    tags: list[str] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=128)
    url: Optional[str] = Field(None, min_length=1, max_length=512)
    description: Optional[str] = Field(None, max_length=2048)
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


class ProjectReadmeOut(BaseModel):
    """按需从 GitHub 拉取的 README（不落库）"""

    content: Optional[str] = None
    source: Literal["github", "empty", "error"] = "empty"
    message: Optional[str] = None
    owner: Optional[str] = None
    repo: Optional[str] = None


class ImportRepoItem(BaseModel):
    owner: str
    repo: str
    url: str

    @field_validator("url")
    @classmethod
    def _validate_url(cls, v: str) -> str:
        """仅允许公开的 HTTPS URL，且域名需在白名单内。"""
        parsed = urlparse(v)
        if parsed.scheme != "https":
            raise ValueError("仅支持 https 协议")
        host = (parsed.hostname or "").lower()
        if not host or not host.endswith("github.com"):
            raise ValueError("仅支持 github.com 域名")
        return v


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
