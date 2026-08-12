"""
Pydantic schemas —— 项目相关请求/响应
"""
from datetime import datetime
from typing import Literal, Optional
from urllib.parse import urlparse
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator
from repopilot_shared.schemas.project import ImportRepoItem  # noqa: F401

ProjectProgress = Literal["none", "learning", "learned", "mastered"]
ProjectSource = Literal["github", "manual"]


def _validate_http_url(v: str) -> str:
    """项目 URL：仅 http(s)，拒绝空 host / 危险 scheme。"""
    raw = (v or "").strip()
    parsed = urlparse(raw)
    if parsed.scheme not in ("https", "http"):
        raise ValueError("仅支持 http/https 协议")
    host = (parsed.hostname or "").lower()
    if not host:
        raise ValueError("URL 必须包含有效域名")
    return raw


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

    @field_validator("url")
    @classmethod
    def _url(cls, v: str) -> str:
        return _validate_http_url(v)

    @model_validator(mode="after")
    def _github_source_url(self) -> "ProjectCreate":
        if self.source == "github":
            parsed = urlparse(self.url)
            host = (parsed.hostname or "").lower()
            if parsed.scheme != "https" or not host.endswith("github.com"):
                raise ValueError("source=github 时 URL 必须是 https://github.com/...")
        return self


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=128)
    url: Optional[str] = Field(None, min_length=1, max_length=512)
    description: Optional[str] = Field(None, max_length=2048)
    category_id: Optional[UUID] = None
    stars: Optional[int] = None
    language: Optional[str] = None
    progress: Optional[ProjectProgress] = None
    tags: Optional[list[str]] = None

    @field_validator("url")
    @classmethod
    def _url(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _validate_http_url(v)


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
