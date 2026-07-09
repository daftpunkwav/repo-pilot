"""
用户序列化与认证业务逻辑
"""
import json
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select, update
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


async def revoke_all_user_refresh_tokens(db: AsyncSession, user_id: UUID) -> None:
    """撤销指定用户的所有 refresh token（token family 级防御）。"""
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id)
        .values(revoked=True)
    )
    await db.commit()


async def rotate_refresh_token(
    db: AsyncSession, refresh_plain: str
) -> tuple[str, str, UUID] | None:
    """校验 refresh，轮换并返回新 access_token、新 refresh_token 与 user_id。"""
    token_hash = hash_refresh_token(refresh_plain)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    row = result.scalar_one_or_none()
    if not row:
        return None
    # 重放检测：已撤销的 token 被再次使用，触发 token family 级防御
    if row.revoked:
        await revoke_all_user_refresh_tokens(db, row.user_id)
        return None
    if row.expires_at < datetime.utcnow():
        return None
    # 旧 token 标记撤销，实现 rotation
    row.revoked = True
    # 签发新 token 对
    access = create_access_token({"sub": str(row.user_id)})
    new_refresh_plain = create_refresh_token_value()
    new_expires = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    db.add(
        RefreshToken(
            user_id=row.user_id,
            token_hash=hash_refresh_token(new_refresh_plain),
            expires_at=new_expires,
        )
    )
    await db.commit()
    return access, new_refresh_plain, row.user_id
