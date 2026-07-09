"""
统一 API 响应辅助
"""
import time
from typing import Generic, TypeVar

from backend.schemas.common import DataResponse, PaginatedData, PaginatedResponse

T = TypeVar("T")


def meta_ts(**extra: int | str) -> dict:
    """生成带时间戳的 meta 字段。"""
    return {"ts": int(time.time() * 1000), **extra}


def wrap_data(data: T, **meta_extra: int | str) -> DataResponse[T]:
    return DataResponse(data=data, meta=meta_ts(**meta_extra))


def wrap_paginated(
    items: list[T],
    *,
    total: int,
    page: int,
    page_size: int,
    **meta_extra: int | str,
) -> PaginatedResponse[T]:
    return PaginatedResponse(
        data=PaginatedData(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        ),
        meta=meta_ts(total=total, page=page, page_size=page_size, **meta_extra),
    )
