"""
数据库引擎与会话管理 —— SQLAlchemy 2.0 async
"""
from pathlib import Path

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from backend.config import get_settings

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _async_database_url(url: str) -> str:
    """将同步 SQLite URL 转为 aiosqlite 异步 URL。"""
    if url.startswith("sqlite:///"):
        return "sqlite+aiosqlite:///" + url.removeprefix("sqlite:///")
    return url


def _ensure_data_dir(url: str) -> None:
    path = url.replace("sqlite:///", "")
    if path and not path.startswith(":"):
        Path(path).parent.mkdir(parents=True, exist_ok=True)


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        settings = get_settings()
        _ensure_data_dir(settings.database_url)
        _engine = create_async_engine(
            _async_database_url(settings.database_url),
            echo=settings.debug,
            future=True,
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            get_engine(), expire_on_commit=False, class_=AsyncSession
        )
    return _session_factory


def reset_database() -> None:
    """测试专用：重置引擎与会话工厂。"""
    global _engine, _session_factory
    _engine = None
    _session_factory = None


class Base(DeclarativeBase):
    pass


async def get_session() -> AsyncSession:
    """FastAPI Depends 用会话生成器"""
    factory = get_session_factory()
    async with factory() as session:
        yield session


async def init_db() -> None:
    """开发/测试环境建表（Alembic 落地前使用 create_all）。"""
    import backend.models  # noqa: F401 — 注册全部 ORM metadata
    from backend.migrations.schema_sync import sync_sqlite_schema

    async with get_engine().begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(sync_sqlite_schema)
