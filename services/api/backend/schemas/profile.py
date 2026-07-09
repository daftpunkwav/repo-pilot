"""Pydantic schemas —— 用户画像（Agent 记忆）"""
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class GoalOut(BaseModel):
    title: str
    deadline: Optional[str] = None
    priority: int = 1
    status: Literal["active", "completed", "paused"] = "active"


class MemoryItemOut(BaseModel):
    id: str
    category: Literal["summary", "goal", "tech", "preference"]
    content: str
    created_at: str
    updated_at: Optional[str] = None


class UserProfileOut(BaseModel):
    tech_proficiency: dict[str, Any] = Field(default_factory=dict)
    learning_preferences: dict[str, Any] = Field(default_factory=dict)
    goals: list[GoalOut] = Field(default_factory=list)
    history_summary: str = ""
    memory_items: list[MemoryItemOut] = Field(default_factory=list)
    extensions: dict[str, Any] = Field(default_factory=dict)


class UserProfileUpdate(BaseModel):
    tech_proficiency: Optional[dict[str, Any]] = None
    learning_preferences: Optional[dict[str, Any]] = None
    goals: Optional[list[GoalOut]] = None
    history_summary: Optional[str] = None
    memory_items: Optional[list[MemoryItemOut]] = None
    extensions: Optional[dict[str, Any]] = None
