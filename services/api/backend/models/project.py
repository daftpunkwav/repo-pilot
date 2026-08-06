"""
ORM 模型 —— 项目相关
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base

# 项目与标签多对多关联
project_tags = Table(
    "project_tags",
    Base.metadata,
    Column("project_id", UUID(as_uuid=True), ForeignKey("projects.id"), primary_key=True),
    Column("tag_id", UUID(as_uuid=True), ForeignKey("tags.id"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # §4.1.8: user_id 维度查询与 JOIN 走索引；与 f4542a1f742b 迁移一致
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(64), nullable=False)


class Project(Base):
    __tablename__ = "projects"
    # §4.1.9: 同一用户同一仓库 URL 唯一，并发导入竞态保护
    __table_args__ = (UniqueConstraint('user_id', 'url', name='uq_projects_user_url'),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # §4.1.8: user_id 维度查询与 JOIN 走索引；与 f4542a1f742b 迁移一致
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stars: Mapped[int] = mapped_column(Integer, default=0)
    language: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    progress: Mapped[str] = mapped_column(String(16), default="none")
    source: Mapped[str] = mapped_column(String(16), default="manual")
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # §4.1.8: 分类维度查询走索引；与 f4542a1f742b 迁移一致
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id"), nullable=True, index=True
    )
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)
