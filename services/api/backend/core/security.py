"""
安全工具 —— 敏感字段 at-rest 加密（Fernet）

本地单机已移除 JWT / 密码哈希；保留 encrypt/decrypt 供 GitHub PAT、LLM Key 使用。
"""
import base64
import hashlib
from functools import lru_cache

from backend.config import get_settings
from cryptography.fernet import Fernet, InvalidToken

# 落库密文前缀；无此前缀视为历史明文（兼容旧数据）
_SECRET_PREFIX = "enc:v1:"


@lru_cache(maxsize=8)
def _fernet_for(material: str) -> Fernet:
    """由密钥材料派生 Fernet 密钥（SHA-256 → urlsafe base64）。"""
    digest = hashlib.sha256(material.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _encryption_key_material() -> str:
    """优先 SECRETS_ENCRYPTION_KEY，否则回退 SECRET_KEY。"""
    cfg = get_settings()
    custom = (cfg.secrets_encryption_key or "").strip()
    if custom:
        return custom
    return cfg.secret_key


def _fernet() -> Fernet:
    return _fernet_for(_encryption_key_material())


def is_encrypted_secret(value: str | None) -> bool:
    return bool(value and value.startswith(_SECRET_PREFIX))


def encrypt_secret(plain: str) -> str:
    """加密敏感字符串以便落库；空串原样返回。"""
    if not plain:
        return plain
    token = _fernet().encrypt(plain.encode("utf-8")).decode("ascii")
    return f"{_SECRET_PREFIX}{token}"


def decrypt_secret(value: str | None) -> str | None:
    """解密落库敏感字段；兼容历史明文与解密失败时返回 None。"""
    if value is None:
        return None
    if not value:
        return value
    if not value.startswith(_SECRET_PREFIX):
        return value  # 历史明文
    cipher = value[len(_SECRET_PREFIX) :]
    try:
        return _fernet().decrypt(cipher.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, TypeError):
        return None


def ensure_encrypted_secret(value: str | None) -> tuple[str | None, bool]:
    """若为历史明文则加密；返回 (存储值, 是否发生了迁移)。"""
    if value is None or value == "":
        return value, False
    if is_encrypted_secret(value):
        return value, False
    return encrypt_secret(value), True
