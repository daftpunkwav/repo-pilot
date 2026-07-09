"""
速率限制器 —— 基于 slowapi 的内存存储限流器
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend.config import get_settings

settings = get_settings()

limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.rate_limit_enabled,
    headers_enabled=False,
)
