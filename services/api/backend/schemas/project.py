"""
Pydantic schemas —— 项目相关请求/响应
"""
from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., min_length=1, max_length=512)
    description: Optional[str] = None
    category: str = "其他"
    tags: list[str] = []
    note: Optional[str] = None
    stars: int = 0
    language: Optional[str] = None
    progress: str = "none"


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    url: Optional[str] = Field(None, min_length=1, max_length=512)
    description: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[list[str]] = None
    note: Optional[str] = None
    stars: Optional[int] = None
    language: Optional[str] = None
    progress: Optional[str] = None


class ProjectOut(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    url: str
    description: Optional[str] = None
    stars: int
    language: Optional[str] = None
    progress: str
    note: Optional[str] = None
    category: Optional[str] = None
    tags: list[str] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
