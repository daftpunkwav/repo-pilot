"""
SQLite 轻量 schema 同步 —— create_all 不会给已有表加列
"""
from sqlalchemy import inspect, text


def sync_sqlite_schema(connection) -> None:
    """为开发环境 SQLite 补齐新增列与新表依赖的列。"""
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())

    if "users" in tables:
        cols = {c["name"] for c in inspector.get_columns("users")}
        if "settings_json" not in cols:
            connection.execute(
                text("ALTER TABLE users ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}'")
            )
        if "token_version" not in cols:
            connection.execute(
                text(
                    "ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0"
                )
            )

    if "projects" in tables:
        cols = {c["name"] for c in inspector.get_columns("projects")}
        if "source" not in cols:
            connection.execute(
                text(
                    "ALTER TABLE projects ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'manual'"
                )
            )

    if "agent_sessions" in tables:
        cols = {c["name"] for c in inspector.get_columns("agent_sessions")}
        if "source" not in cols:
            connection.execute(
                text(
                    "ALTER TABLE agent_sessions ADD COLUMN source VARCHAR(16) DEFAULT 'chat'"
                )
            )
        # 每次启动轻量回填：把明显是快速分析的会话标为 analyze
        connection.execute(
            text(
                "UPDATE agent_sessions SET source = 'analyze' "
                "WHERE (source IS NULL OR source = '' OR source = 'chat') AND ("
                "title LIKE 'scout · %' OR title LIKE 'mentor · %' OR "
                "title LIKE 'navigator · %' OR title LIKE 'curator · %' OR "
                "title LIKE 'scribe · %' OR title LIKE 'atlas · %' OR "
                "title LIKE '分析 %')"
            )
        )
