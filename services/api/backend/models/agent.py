"""
ORM 模型 —— Agent 相关
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base

# 会话与项目多对多：一个对话可绑定多个项目上下文
agent_session_projects = Table(
    "agent_session_projects",
    Base.metadata,
    Column(
        "session_id",
        UUID(as_uuid=True),
        ForeignKey("agent_sessions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "project_id",
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True
    )
    tech_profile: Mapped[Optional[str]] = mapped_column(Text, default="{}")  # JSON
    preferences: Mapped[Optional[str]] = mapped_column(Text, default="{}")  # JSON
    goals: Mapped[Optional[str]] = mapped_column(Text, default="[]")  # JSON
    history_summary: Mapped[Optional[str]] = mapped_column(Text, default="")
    agent_prefs: Mapped[Optional[str]] = mapped_column(Text, default="{}")  # JSON
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)


class AgentSession(Base):
    __tablename__ = "agent_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # §4.1.8: 会话按 user 维度查询；与 f4542a1f742b 迁移一致
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    title: Mapped[Optional[str]] = mapped_column(String(255), default="新对话")
    # 主项目（兼容旧逻辑）；完整列表见 agent_session_projects
    # §4.1.8: 项目维度查询；与 f4542a1f742b 迁移一致
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True, index=True
    )
    # chat=用户主动对话；analyze=详情页快速 AI 分析
    source: Mapped[Optional[str]] = mapped_column(String(16), default="chat")
    active_agent: Mapped[Optional[str]] = mapped_column(String(32), default="hub")
    status: Mapped[Optional[str]] = mapped_column(String(16), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, onupdate=datetime.utcnow, nullable=True)

# 跨 worker 会话流取消信号：每会话至多一行；流开始时 upsert 并 set 旧 token。
class AgentSessionCancelToken(Base):
    __tablename__ = "agent_session_cancel_tokens"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agent_sessions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    # 每次 begin 流时生成新的 token；流循环周期性比对，若发现与自身 token 不一致即让步终止
    cancel_token: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime, onupdate=datetime.utcnow, default=datetime.utcnow, nullable=True
    )

class AgentMessage(Base):
    __tablename__ = "agent_messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # §4.1.8: 消息按 session 维度查询；与 f4542a1f742b 迁移一致
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("agent_sessions.id"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    agent_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[Optional[str]] = mapped_column(String(16), default="text")
    message_meta: Mapped[Optional[str]] = mapped_column("metadata", Text, default="{}")  # JSON
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ProjectAnalysis(Base):
    __tablename__ = "project_analyses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # §4.1.8: 分析按 project 维度查询；与 f4542a1f742b 迁移一致
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False, index=True
    )
    agent_id: Mapped[str] = mapped_column(String(32), nullable=False)
    analysis_type: Mapped[str] = mapped_column(String(32), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    model_used: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
