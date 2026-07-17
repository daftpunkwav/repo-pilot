"""
安全工具 —— JWT + 密码哈希 + 敏感字段 at-rest 加密
"""
import base64
import hashlib
import secrets
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Optional

import bcrypt
from cryptography.fernet import Fernet, InvalidToken
from jose import JWTError, jwt

from backend.config import get_settings

settings = get_settings()

# 落库密文前缀；无此前缀视为历史明文（兼容旧数据）
_SECRET_PREFIX = "enc:v1:"


# bcrypt 仅使用前 72 字节；超长会静默截断，须在哈希前拒绝
BCRYPT_MAX_PASSWORD_BYTES = 72


def _password_bytes(password: str) -> bytes:
    raw = password.encode("utf-8")
    if len(raw) > BCRYPT_MAX_PASSWORD_BYTES:
        raise ValueError(
            f"密码编码后不得超过 {BCRYPT_MAX_PASSWORD_BYTES} 字节（bcrypt 限制）"
        )
    return raw


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        raw = _password_bytes(password)
    except ValueError:
        return False
    return bcrypt.checkpw(raw, hashed.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except JWTError:
        return None


def create_refresh_token_value() -> str:
    """生成明文 refresh token（仅存哈希）。"""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


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
