"""
认证 API —— 注册/登录/当前用户/修改密码
"""
from datetime import timedelta
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from backend.api.deps import get_db, get_current_user
from backend.core.security import create_access_token, hash_password, verify_password
from backend.models.user import User
from backend.schemas.common import DataResponse, OkResponse
from backend.schemas.user import PasswordUpdate, TokenOut, UserCreate, UserLogin, UserOut

router = APIRouter()


@router.post("/register", response_model=DataResponse[TokenOut])
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, detail={"code": "USERNAME_EXISTS", "message": "Username already taken"})
    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        email=data.email,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return DataResponse(data=TokenOut(access_token=token, user=UserOut.model_validate(user)))


@router.post("/login", response_model=DataResponse[TokenOut])
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail={"code": "INVALID_CREDENTIALS", "message": "Invalid username or password"})
    access_token = create_access_token({"sub": str(user.id)})
    return DataResponse(data=TokenOut(access_token=access_token, user=UserOut.model_validate(user)))


@router.get("/me", response_model=DataResponse[UserOut])
async def get_me(current_user: User = Depends(get_current_user)):
    return DataResponse(data=UserOut.model_validate(current_user))


@router.put("/password", response_model=OkResponse)
async def update_password(
    data: PasswordUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.old_password, current_user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail={"code": "BAD_REQUEST", "message": "Old password is incorrect"})
    current_user.password_hash = hash_password(data.new_password)
    await db.commit()
    return OkResponse()
