"""依赖注入 —— 本地单机模式，仅提供数据库会话。"""
from backend.database import get_session
from sqlalchemy.ext.asyncio import AsyncSession


async def get_db() -> AsyncSession:
    async for session in get_session():
        yield session
