"""
Pydantic schemas —— 通用响应格式
"""
from pydantic import BaseModel
from typing import Generic, TypeVar, Optional

T = TypeVar("T")


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Optional[list[dict]] = None


class PaginationMeta(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int


class OkResponse(BaseModel):
    ok: bool = True


class ErrorResponse(BaseModel):
    error: ErrorDetail


class DataResponse(BaseModel, Generic[T]):
    data: T
    meta: Optional[dict] = None


class ListResponse(BaseModel, Generic[T]):
    data: list[T]
    meta: PaginationMeta
