"""
依赖注入 —— 获取当前用户、数据库会话等

鉴权双通道（优先级）：
1. Authorization: Bearer <access>
2. httpOnly Cookie rp_access
"""
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.security.utils import get_authorization_scheme_param
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.auth_cookies import get_access_token_from_request
from backend.core.security import decode_token
from backend.database import get_session
from backend.models.user import User


class OptionalAuthBearer(HTTPBearer):
    """Bearer 可选：缺失头时不抛错，便于回落到 Cookie。"""

    def __init__(self) -> None:
        super().__init__(auto_error=False)

    async def __call__(
        self, request: Request
    ) -> HTTPAuthorizationCredentials | None:
        authorization = request.headers.get("Authorization")
        if not authorization:
            return None
        scheme, _ = get_authorization_scheme_param(authorization)
        if scheme.lower() != "bearer":
            # 显式错误 scheme 仍 401，避免误把 Basic 当 Cookie 旁路
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "code": "UNAUTHORIZED",
                    "message": "Authorization scheme 必须是 Bearer",
                },
            )
        return await super().__call__(request)


security = OptionalAuthBearer()


async def get_db() -> AsyncSession:
    async for session in get_session():
        yield session


def _resolve_access_token(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None,
) -> str | None:
    if credentials and credentials.credentials:
        return credentials.credentials
    return get_access_token_from_request(request)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db=Depends(get_db),
) -> User:
    token = _resolve_access_token(request, credentials)
    if not token:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": "缺少认证凭证（Authorization 或 Cookie）",
            },
        )
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid token"},
        )
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid token"},
        )
    try:
        uid = UUID(str(user_id))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid token"},
        )
    user = await db.get(User, uid)
    if not user:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "User not found"},
        )
    # 改密后 token_version 自增，旧 access 立即失效
    token_ver = payload.get("ver", 0)
    try:
        token_ver_int = int(token_ver)
    except (TypeError, ValueError):
        token_ver_int = -1
    current_ver = int(getattr(user, "token_version", 0) or 0)
    if token_ver_int != current_ver:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Token revoked"},
        )
    return user
