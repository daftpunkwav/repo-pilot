"""
依赖注入 —— 获取当前用户、数据库会话等
"""
from uuid import UUID
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.security.utils import get_authorization_scheme_param
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.security import decode_token
from backend.database import get_session
from backend.models.user import User


class AuthBearer(HTTPBearer):
    """自定义 Bearer 认证依赖：缺失 Authorization 头或 scheme 错误时返回 401。"""

    async def __call__(self, request: Request) -> HTTPAuthorizationCredentials | None:
        authorization = request.headers.get("Authorization")
        if not authorization:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "UNAUTHORIZED", "message": "缺少 Authorization 头"},
            )
        scheme, _ = get_authorization_scheme_param(authorization)
        if scheme.lower() != "bearer":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "UNAUTHORIZED", "message": "Authorization scheme 必须是 Bearer"},
            )
        return await super().__call__(request)


security = AuthBearer()


async def get_db() -> AsyncSession:
    async for session in get_session():
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db=Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={"code": "UNAUTHORIZED", "message": "Invalid token"})
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={"code": "UNAUTHORIZED", "message": "Invalid token"})
    try:
        uid = UUID(str(user_id))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid token"},
        )
    user = await db.get(User, uid)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={"code": "UNAUTHORIZED", "message": "User not found"})
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
