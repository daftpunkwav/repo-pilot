"""§4.3.2 (D-03 / D-04) 迁移往返 + downgrade 单测

针对 base→head→base→head 路径做集成测试，确保每条迁移都可回退。
"""
import os
import tempfile
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config


def _make_alembic_config(db_path: str) -> Config:
    """构造指向临时 SQLite 的 alembic config。"""
    cfg = Config(str(Path(__file__).resolve().parents[2] / 'alembic.ini'))
    cfg.set_main_option('script_location', 'services/api/backend/migrations/alembic')
    # env.py 通过 get_settings().database_url 注入；此处覆盖 settings
    os.environ['DATABASE_URL'] = f'sqlite:///{db_path}'
    return cfg


def test_migration_upgrade_downgrade_roundtrip():
    with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
        db_path = f.name
    try:
        cfg = _make_alembic_config(db_path)
        # 第一次升级到 head
        command.upgrade(cfg, 'head')
        # 回退到 base
        command.downgrade(cfg, 'base')
        # 再升级回 head - 验证迁移可重复执行
        command.upgrade(cfg, 'head')
        # 验证数据库非空（表已重建）
        from sqlalchemy import create_engine, text
        engine = create_engine(f'sqlite:///{db_path}')
        engine.dispose()
        with engine.connect() as conn:
            tables = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' "
                     "AND name NOT LIKE 'sqlite_%' AND name != 'alembic_version'")
            ).fetchall()
            table_names = {t[0] for t in tables}
            # 关键表存在
            for t in ('users', 'projects', 'agent_sessions', 'refresh_tokens', 'agent_session_cancel_tokens'):
                assert t in table_names, f'missing table {t} after roundtrip'
            # refresh_tokens 含 last_used_at 列（§4.3.5）
            cols = conn.execute(text('PRAGMA table_info(refresh_tokens)')).fetchall()
            col_names = {c[1] for c in cols}
            assert 'last_used_at' in col_names
    finally:
        # Windows: engine connection may still hold the file briefly.
        import time
        time.sleep(0.1)
        try:
            Path(db_path).unlink(missing_ok=True)
        except OSError:
            pass