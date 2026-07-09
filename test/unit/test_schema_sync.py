"""schema 同步单元测试"""
import sqlite3
from pathlib import Path

from sqlalchemy import create_engine

from backend.migrations.schema_sync import sync_sqlite_schema


def test_sync_adds_settings_json_column(tmp_path: Path):
    db_path = tmp_path / "legacy.db"
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            email TEXT,
            avatar_url TEXT,
            github_accounts TEXT DEFAULT '[]',
            agent_permissions TEXT DEFAULT '{}',
            created_at TEXT,
            updated_at TEXT
        )
        """
    )
    conn.commit()
    conn.close()

    engine = create_engine(f"sqlite:///{db_path}")
    with engine.begin() as connection:
        sync_sqlite_schema(connection)

    conn = sqlite3.connect(db_path)
    cols = {row[1] for row in conn.execute("PRAGMA table_info(users)")}
    conn.close()
    assert "settings_json" in cols
