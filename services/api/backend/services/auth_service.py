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


def _access_claims(user: User) -> dict:
    """签发 access JWT 的标准 claims（含凭证版本）。"""
    return {"sub": str(user.id), "ver": int(getattr(user, "token_version", 0) or 0)}


async def issue_tokens(db: AsyncSession, user: User) -> TokenOut:
    """签发 access + refresh，并将 refresh 哈希入库。"""
    access = create_access_token(_access_claims(user))
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
    """校验 refresh，轮换并返回新 access_token、新 refresh_token 与 user_id。

    使用乐观锁（UPDATE ... WHERE revoked=False）保证并发下仅一方胜出，
    避免双写新 token 或误伤并发合法轮换。
    """
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

    user_id = row.user_id
    # 原子抢占：仅未撤销行可标记为 revoked，rowcount!=1 表示并发竞态失败
    claim = await db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.id == row.id,
            RefreshToken.revoked.is_(False),
        )
        .values(revoked=True)
    )
    if claim.rowcount != 1:
        # 并发请求已完成轮换；不触发 family revoke，避免误吊销刚签发的 token
        await db.rollback()
        return None

    user = await db.get(User, user_id)
    if not user:
        await db.rollback()
        return None

    access = create_access_token(_access_claims(user))
    new_refresh_plain = create_refresh_token_value()
    new_expires = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    db.add(
        RefreshToken(
            user_id=user_id,
            token_hash=hash_refresh_token(new_refresh_plain),
            expires_at=new_expires,
        )
    )
    await db.commit()
    return access, new_refresh_plain, user_id
