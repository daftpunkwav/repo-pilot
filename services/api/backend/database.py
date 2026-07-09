"""
数据库引擎与会话管理 —— SQLAlchemy 2.0 async
"""
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from backend.config import get_settings

settings = get_settings()


def _async_database_url(url: str) -> str:
    """将同步 SQLite URL 转为 aiosqlite 异步 URL。"""
    if url.startswith("sqlite:///"):
        return "sqlite+aiosqlite:///" + url.removeprefix("sqlite:///")
    return url


_db_path = settings.database_url.replace("sqlite:///", "")
if _db_path and not _db_path.startswith(":"):
    Path(_db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_async_engine(
    _async_database_url(settings.database_url),
    echo=settings.debug,
    future=True,
)

async_session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncSession:
    """FastAPI Depends 用会话生成器"""
    async with async_session() as session:
        yield session


async def init_db() -> None:
    """开发环境建表（Alembic 落地前使用 create_all）。"""
    import backend.models  # noqa: F401 — 注册全部 ORM metadata

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
