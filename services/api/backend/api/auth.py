"""
认证 API —— 注册/登录/刷新/登出/当前用户/修改密码
"""
from fastapi import APIRouter, Depends, HTTPException, status
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from starlette.requests import Request

from backend.api.deps import get_current_user, get_db
from backend.config import get_settings
from backend.core.limiter import limiter
from backend.core.responses import wrap_data
from backend.core.security import hash_password, verify_password
from backend.models.user import User
from backend.schemas.common import DataResponse, OkData
from backend.schemas.user import (
    AccessTokenOut,
    LogoutBody,
    PasswordUpdate,
    RefreshBody,
    TokenOut,
    UserCreate,
    UserLogin,
    UserOut,
    UserUpdate,
)
from backend.services.auth_service import (
    issue_tokens,
    revoke_all_user_refresh_tokens,
    revoke_refresh_token,
    rotate_refresh_token,
    user_to_out,
)

router = APIRouter()
settings = get_settings()


def _login_key(request: Request) -> str:
    """login 限流 key：IP + 用户名（用户名由中间件写入 request.state）。"""
    ip = get_remote_address(request)
    username = getattr(request.state, "rate_limit_username", "") or ""
    return f"{ip}:{username}"


@router.post("/register", response_model=DataResponse[TokenOut])
@limiter.limit(settings.rate_limit_register)
async def register(request: Request, data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"code": "USERNAME_EXISTS", "message": "用户名已存在"},
        )
    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        email=str(data.email) if data.email else None,
    )
    db.add(user)
    await db.flush()
    tokens = await issue_tokens(db, user)
    return wrap_data(tokens)


@router.post("/login", response_model=DataResponse[TokenOut])
@limiter.limit(settings.rate_limit_login, key_func=_login_key)
async def login(request: Request, data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_FAILED", "message": "用户名或密码错误"},
        )
    tokens = await issue_tokens(db, user)
    return wrap_data(tokens)


@router.post("/refresh", response_model=DataResponse[AccessTokenOut])
@limiter.limit(settings.rate_limit_refresh)
async def refresh(request: Request, data: RefreshBody, db: AsyncSession = Depends(get_db)):
    rotated = await rotate_refresh_token(db, data.refresh_token)
    if not rotated:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_FAILED", "message": "Refresh token 无效"},
        )
    access, refresh, _ = rotated
    return wrap_data(AccessTokenOut(access_token=access, refresh_token=refresh))


@router.post("/logout", response_model=DataResponse[OkData])
async def logout(data: LogoutBody, db: AsyncSession = Depends(get_db)):
    await revoke_refresh_token(db, data.refresh_token)
    return wrap_data(OkData())


@router.get("/me", response_model=DataResponse[UserOut])
async def get_me(current_user: User = Depends(get_current_user)):
    return wrap_data(user_to_out(current_user))


@router.patch("/me", response_model=DataResponse[UserOut])
async def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if data.email is not None:
        current_user.email = str(data.email)
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url
    await db.commit()
    await db.refresh(current_user)
    return wrap_data(user_to_out(current_user))


@router.put("/password", response_model=DataResponse[OkData])
async def update_password(
    data: PasswordUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.old_password, current_user.password_hash):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail={"code": "AUTH_FAILED", "message": "旧密码不正确"},
        )
    current_user.password_hash = hash_password(data.new_password)
    await db.commit()
    # 密码变更后撤销该用户所有未过期 refresh token，防止旧凭证继续被使用
    await revoke_all_user_refresh_tokens(db, current_user.id)
    return wrap_data(OkData())
