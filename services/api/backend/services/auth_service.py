"""
用户序列化与认证业务逻辑
"""
import json
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.core.security import (
    create_access_token,
    create_refresh_token_value,
    hash_refresh_token,
)
from backend.models.user import RefreshToken, User
from backend.schemas.user import TokenOut, UserOut

settings = get_settings()


def user_to_out(user: User) -> UserOut:
    """ORM User → 前端 UserOut。"""
    github_accounts: list[dict] = []
    try:
        github_accounts = json.loads(user.github_accounts or "[]")
    except json.JSONDecodeError:
        github_accounts = []
    first = github_accounts[0] if github_accounts else None
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        avatar_url=user.avatar_url,
        github_login=first.get("username") if first else None,
        github_bound=bool(github_accounts),
        created_at=user.created_at,
    )


async def issue_tokens(db: AsyncSession, user: User) -> TokenOut:
    """签发 access + refresh，并将 refresh 哈希入库。"""
    access = create_access_token({"sub": str(user.id)})
    refresh_plain = create_refresh_token_value()
    expires = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(refresh_plain),
            expires_at=expires,
        )
    )
    await db.commit()
    return TokenOut(
        access_token=access,
        refresh_token=refresh_plain,
        user=user_to_out(user),
    )


async def revoke_refresh_token(db: AsyncSession, refresh_plain: str | None) -> None:
    if not refresh_plain:
        return
    token_hash = hash_refresh_token(refresh_plain)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    row = result.scalar_one_or_none()
    if row:
        row.revoked = True
        await db.commit()


async def rotate_refresh_token(
    db: AsyncSession, refresh_plain: str
) -> tuple[str, UUID] | None:
    """校验 refresh 并返回新 access_token 与 user_id。"""
    token_hash = hash_refresh_token(refresh_plain)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    row = result.scalar_one_or_none()
    if not row or row.revoked or row.expires_at < datetime.utcnow():
        return None
    access = create_access_token({"sub": str(row.user_id)})
    return access, row.user_id
