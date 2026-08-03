"""
认证 API —— 注册/登录/刷新/登出/当前用户/修改密码

凭证双通道：
- 浏览器主路径：只写 httpOnly Cookie；JSON 默认不含 token
- API / 测试：?include_tokens=true 时在 body 返回 access/refresh
- CSRF：登录后下发可读 Cookie rp_csrf；Cookie 鉴权的写请求须带 X-CSRF-Token
"""
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Response, status
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from starlette.requests import Request

from backend.api.deps import get_current_user, get_db
from backend.config import get_settings
from backend.core.auth_cookies import (
    clear_auth_cookies,
    clear_csrf_cookie,
    get_refresh_token_from_request,
    set_auth_cookies,
    set_csrf_cookie,
)
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


def _token_out_for_client(tokens: TokenOut, *, include_tokens: bool) -> TokenOut:
    if include_tokens:
        return tokens
    return TokenOut(user=tokens.user, token_type="bearer")


def _access_out_for_client(
    access: str, refresh: str, *, include_tokens: bool
) -> AccessTokenOut:
    if include_tokens:
        return AccessTokenOut(access_token=access, refresh_token=refresh)
    return AccessTokenOut()


@router.post("/register", response_model=DataResponse[TokenOut])
@limiter.limit(settings.rate_limit_register)
async def register(
    request: Request,
    response: Response,
    data: UserCreate,
    include_tokens: bool = Query(
        False, description="为 true 时在 JSON 中返回 access/refresh（API 客户端）"
    ),
    db: AsyncSession = Depends(get_db),
):
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
    set_auth_cookies(
        response,
        access_token=tokens.access_token or "",
        refresh_token=tokens.refresh_token or "",
    )
    set_csrf_cookie(response)
    return wrap_data(_token_out_for_client(tokens, include_tokens=include_tokens))


@router.post("/login", response_model=DataResponse[TokenOut])
@limiter.limit(settings.rate_limit_login, key_func=_login_key)
async def login(
    request: Request,
    response: Response,
    data: UserLogin,
    include_tokens: bool = Query(
        False, description="为 true 时在 JSON 中返回 access/refresh（API 客户端）"
    ),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.username == data.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_FAILED", "message": "用户名或密码错误"},
        )
    tokens = await issue_tokens(db, user)
    set_auth_cookies(
        response,
        access_token=tokens.access_token or "",
        refresh_token=tokens.refresh_token or "",
    )
    set_csrf_cookie(response)
    return wrap_data(_token_out_for_client(tokens, include_tokens=include_tokens))


@router.post("/refresh", response_model=DataResponse[AccessTokenOut])
@limiter.limit(settings.rate_limit_refresh)
async def refresh(
    request: Request,
    response: Response,
    data: RefreshBody | None = Body(default=None),
    include_tokens: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    refresh_plain = None
    if data is not None and data.refresh_token:
        refresh_plain = data.refresh_token
    if not refresh_plain:
        refresh_plain = get_refresh_token_from_request(request)
    if not refresh_plain:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_FAILED", "message": "Refresh token 无效"},
        )
    rotated = await rotate_refresh_token(db, refresh_plain)
    if not rotated:
        clear_auth_cookies(response)
        clear_csrf_cookie(response)
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail={"code": "AUTH_FAILED", "message": "Refresh token 无效"},
        )
    access, new_refresh, _ = rotated
    set_auth_cookies(response, access_token=access, refresh_token=new_refresh)
    set_csrf_cookie(response)
    return wrap_data(
        _access_out_for_client(access, new_refresh, include_tokens=include_tokens)
    )


@router.post("/logout", response_model=DataResponse[OkData])
async def logout(
    request: Request,
    response: Response,
    data: LogoutBody | None = Body(default=None),
    db: AsyncSession = Depends(get_db),
):
    refresh_plain = None
    if data is not None and data.refresh_token:
        refresh_plain = data.refresh_token
    if not refresh_plain:
        refresh_plain = get_refresh_token_from_request(request)
    await revoke_refresh_token(db, refresh_plain)
    clear_auth_cookies(response)
    clear_csrf_cookie(response)
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
    response: Response,
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
    current_user.token_version = int(getattr(current_user, "token_version", 0) or 0) + 1
    await db.commit()
    await revoke_all_user_refresh_tokens(db, current_user.id)
    clear_auth_cookies(response)
    clear_csrf_cookie(response)
    return wrap_data(OkData())
