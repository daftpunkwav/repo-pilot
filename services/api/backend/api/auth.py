"""
认证 API —— 注册/登录/刷新/登出/当前用户/修改密码
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.api.deps import get_current_user, get_db
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
    revoke_refresh_token,
    rotate_refresh_token,
    user_to_out,
)

router = APIRouter()


@router.post("/register", response_model=DataResponse[TokenOut])
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={"code": "USERNAME_EXISTS", "message": "用户名或密码错误"},
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
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
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
async def refresh(data: RefreshBody, db: AsyncSession = Depends(get_db)):
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
    return wrap_data(OkData())
