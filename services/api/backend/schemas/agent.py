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
    project_id: Optional[UUID] = None


class SessionUpdateBody(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    # 单项目兼容：null 清除全部；非 null 替换为仅该项目
    project_id: Optional[UUID] = None
    # 多项目：整体替换会话绑定的项目列表
    project_ids: Optional[list[UUID]] = None
    active_agent: Optional[str] = None


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
    content_type: Optional[str] = "text"
    # 本段思考过程（存于 message metadata.thinking）
    thinking: Optional[str] = None
    # 工具调用 / 内嵌专家踪迹（metadata.tool_calls / subagents）
    tool_calls: Optional[list[dict[str, Any]]] = None
    subagents: Optional[list[dict[str, Any]]] = None
    # 反问结构 / 答题详情等（由 message_meta 解析）
    question: Optional[dict[str, Any]] = None
    question_answer: Optional[dict[str, Any]] = None
    created_at: str


class AgentSessionOut(BaseModel):
    id: UUID
    title: str
    agent: str
    updated_at: str
    unread: bool = False
    project_id: Optional[UUID] = None
    project_ids: list[UUID] = Field(default_factory=list)
    # chat=用户主动；analyze=详情页快速分析
    source: str = "chat"


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


class AgentPermissionsUpdate(BaseModel):
    """部分更新 Agent 权限；未传字段保持原值。"""

    allow_web_search: bool | None = None
    allow_github_api: bool | None = None
    allow_file_write: bool | None = None
    max_iterations: int | None = Field(None, ge=1, le=50)
    max_tokens_per_turn: int | None = Field(None, ge=256, le=128_000)


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
