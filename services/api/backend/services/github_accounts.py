"""GitHub 账号绑定与 PAT 读取 —— 供 github 路由与 projects 等复用。

避免 api.projects 反向依赖 api.github 私有函数。
"""
from __future__ import annotations

import json

from backend.core.security import decrypt_secret, ensure_encrypted_secret
from backend.models.user import User


def load_accounts(user: User) -> list[dict]:
    try:
        data = json.loads(user.github_accounts or "[]")
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def save_accounts(user: User, accounts: list[dict]) -> None:
    user.github_accounts = json.dumps(accounts, ensure_ascii=False)


def migrate_plaintext_pats(user: User) -> bool:
    """将 github_accounts 中历史明文 PAT 升级为密文；返回是否写入。"""
    accounts = load_accounts(user)
    if not accounts:
        return False
    dirty = False
    for acc in accounts:
        if not isinstance(acc, dict):
            continue
        pat = acc.get("pat")
        stored, migrated = ensure_encrypted_secret(pat if isinstance(pat, str) else None)
        if migrated:
            acc["pat"] = stored
            dirty = True
    if dirty:
        save_accounts(user, accounts)
    return dirty


def primary_token(user: User) -> tuple[str | None, str | None]:
    """返回 (username, decrypted_pat)；读路径顺带迁移明文 PAT（调用方需 commit）。"""
    migrate_plaintext_pats(user)
    accounts = load_accounts(user)
    if not accounts:
        return None, None
    acc = accounts[0]
    if not isinstance(acc, dict):
        return None, None
    return acc.get("username"), decrypt_secret(acc.get("pat"))
