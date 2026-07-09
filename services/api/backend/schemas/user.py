"""
Pydantic schemas —— 用户相关请求/响应
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

import re

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=8, max_length=128)
    email: Optional[EmailStr] = None


class UserLogin(BaseModel):
    username: str
    password: str = Field(..., min_length=8, max_length=128)
    remember_me: bool = False


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None

    @field_validator("avatar_url")
    @classmethod
    def _validate_avatar_url(cls, value: Optional[str]) -> Optional[str]:
        """头像 URL 仅允许 GitHub 头像域名，防止 XSS/SSRF 向量。"""
        if value is None or value == "":
            return value
        if len(value) > 512:
            raise ValueError("头像 URL 过长")
        if not re.match(r"^https://avatars\.githubusercontent\.com/", value, re.IGNORECASE):
            raise ValueError("头像 URL 必须是 GitHub 头像地址")
        return value


class UserOut(BaseModel):
    id: UUID
    username: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    github_login: Optional[str] = None
    github_bound: bool = False
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut


class RefreshBody(BaseModel):
    refresh_token: str


class AccessTokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class PasswordUpdate(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=8, max_length=128)


class LogoutBody(BaseModel):
    refresh_token: Optional[str] = None
