"""
Pydantic schemas —— Agent 相关请求/响应
"""
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AgentChatRequest(BaseModel):
    session_id: Optional[UUID] = None
    message: str
    project_id: Optional[UUID] = None
    preferred_agent: Optional[str] = None


class AgentChatBody(BaseModel):
    message: str = Field(..., min_length=1)


class AgentQuestionAnswer(BaseModel):
    question_id: str
    answers: Any = Field(default_factory=dict)  # dict 或 QuestionAnswer[]
    skipped: bool = False
    session_id: Optional[UUID] = None


class AgentAnalyzeRequest(BaseModel):
    depth: str = "quick"
    force_refresh: bool = False


class AgentMessageOut(BaseModel):
    id: UUID
    session_id: UUID
    agent: str
    role: str
    content: Optional[str] = None
    created_at: str


class AgentSessionOut(BaseModel):
    id: UUID
    title: str
    agent: str
    updated_at: str
    unread: bool = False


class AgentSessionDetailOut(AgentSessionOut):
    messages: list[AgentMessageOut] = Field(default_factory=list)


class AgentProfileOut(BaseModel):
    id: str
    name: str
    description: str
    avatar_emoji: str
    capabilities: list[str]


class AgentPermissionsOut(BaseModel):
    allow_web_search: bool = True
    allow_github_api: bool = True
    allow_file_write: bool = False
    max_iterations: int = 10
    max_tokens_per_turn: int = 4096


class ContextWindowSegmentOut(BaseModel):
    label: str
    tokens: int
    kind: Literal["system", "skill", "memory", "tools", "messages", "other"]


class ContextWindowStatsOut(BaseModel):
    session_id: Optional[str] = None
    model: str
    context_limit: int
    input_tokens: int
    output_tokens: int
    total_tokens: int
    segments: list[ContextWindowSegmentOut] = Field(default_factory=list)
