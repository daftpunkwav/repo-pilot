"""历史明文密钥读路径 re-encrypt 迁移测试"""
import json
from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import ensure_encrypted_secret, is_encrypted_secret
from backend.models.user import User
from backend.services.settings_service import get_settings, settings_to_out


def test_ensure_encrypted_secret_migrates_plaintext():
    plain = "sk-legacy-plain-key"
    stored, migrated = ensure_encrypted_secret(plain)
    assert migrated is True
    assert is_encrypted_secret(stored)
    # 已加密则不再迁移
    again, migrated2 = ensure_encrypted_secret(stored)
    assert migrated2 is False
    assert again == stored


def test_ensure_encrypted_secret_empty():
    assert ensure_encrypted_secret(None) == (None, False)
    assert ensure_encrypted_secret("") == ("", False)


@pytest.mark.asyncio
async def test_get_settings_reencrypts_plain_llm_key(tmp_path, monkeypatch):
    import os

    from backend.config import get_settings as gs
    from backend.core.security import decrypt_secret
    from backend.database import get_session_factory, init_db, reset_database

    os.environ["DATABASE_URL"] = f"sqlite:///{tmp_path / 'migrate.db'}"
    os.environ.setdefault("SECRET_KEY", "pytest-secret-key-do-not-use-in-prod")
    gs.cache_clear()
    reset_database()
    await init_db()
    factory = get_session_factory()
    async with factory() as session:  # type: AsyncSession
        user = User(
            username="migrate_user",
            password_hash="x",
            settings_json=json.dumps({"llm_api_key": "sk-plain-legacy-key"}),
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        uid = user.id

        out = await get_settings(session, uid)
        assert out.llm_configured is True

        await session.refresh(user)
        raw = json.loads(user.settings_json)
        assert is_encrypted_secret(raw.get("llm_api_key"))
        assert decrypt_secret(raw.get("llm_api_key")) == "sk-plain-legacy-key"


def test_github_migrate_plaintext_pats():
    from backend.api.github import _load_accounts, _migrate_plaintext_pats
    from backend.core.security import decrypt_secret

    user = User(
        id=uuid4(),
        username="gh",
        password_hash="x",
        github_accounts=json.dumps(
            [{"id": "1", "username": "octocat", "pat": "ghp_plain_token_xyz"}]
        ),
    )
    assert _migrate_plaintext_pats(user) is True
    accounts = _load_accounts(user)
    assert is_encrypted_secret(accounts[0]["pat"])
    assert decrypt_secret(accounts[0]["pat"]) == "ghp_plain_token_xyz"
    # 二次迁移应 no-op
    assert _migrate_plaintext_pats(user) is False
