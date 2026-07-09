"""
Pydantic schemas —— 用户相关请求/响应
"""
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=8, max_length=128)
    email: Optional[EmailStr] = None


class UserLogin(BaseModel):
    username: str
    password: str
    remember_me: bool = False


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    avatar_url: Optional[str] = None


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
