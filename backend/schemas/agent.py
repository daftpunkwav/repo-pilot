"""
Pydantic schemas —— Agent 相关请求/响应
"""
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, Any


class AgentChatRequest(BaseModel):
    session_id: Optional[UUID] = None
    message: str
    project_id: Optional[UUID] = None
    preferred_agent: Optional[str] = None


class AgentQuestionAnswer(BaseModel):
    question_id: str
    answers: dict[str, Any]
    skipped: bool = False


class AgentAnalyzeRequest(BaseModel):
    depth: str = "quick"
    force_refresh: bool = False


class AgentMessageOut(BaseModel):
    id: UUID
    role: str
    agent_id: Optional[str] = None
    content: str
    content_type: str = "text"
    metadata: dict = {}
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AgentSessionOut(BaseModel):
    id: UUID
    title: str
    project_id: Optional[UUID] = None
    active_agent: str
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
