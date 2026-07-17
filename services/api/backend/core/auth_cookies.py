"""认证 Cookie —— httpOnly 存储 access/refresh，降低 XSS 窃取面"""
from __future__ import annotations

from typing import Literal

from fastapi import Response

from backend.config import get_settings

ACCESS_COOKIE = "rp_access"
REFRESH_COOKIE = "rp_refresh"

SameSite = Literal["lax", "strict", "none"]


def _cookie_flags() -> tuple[bool, SameSite]:
    """返回 (secure, samesite)。SameSite=none 时强制 secure。

    - 生产默认：Lax + Secure（同源反代最稳妥）
    - 开发默认：None + Secure（localhost 跨端口 5173→API 可带 Cookie；
      现代浏览器将 localhost 视为安全上下文）
    - 测试可设 AUTH_COOKIE_SECURE=false 以便 httpx http:// 客户端落 Cookie
    """
    settings = get_settings()
    samesite_cfg = getattr(settings, "auth_cookie_samesite", None)
    if samesite_cfg:
        samesite_raw = str(samesite_cfg).lower()
    else:
        # 未配置时：debug 用 none 适配跨端口；生产用 lax
        samesite_raw = "none" if settings.debug else "lax"
    if samesite_raw not in ("lax", "strict", "none"):
        samesite_raw = "lax"
    samesite: SameSite = samesite_raw  # type: ignore[assignment]

    secure_cfg = getattr(settings, "auth_cookie_secure", None)
    if secure_cfg is None:
        # 默认 Secure（localhost 安全上下文可接受）；测试可显式 false
        secure = True
    else:
        secure = bool(secure_cfg)
    # 浏览器规范：SameSite=None 必须带 Secure（除非测试显式关闭 secure）
    if samesite == "none" and secure_cfg is None:
        secure = True
    return secure, samesite


def set_auth_cookies(
    response: Response,
    *,
    access_token: str,
    refresh_token: str,
) -> None:
    """登录/注册/刷新后写入 httpOnly Cookie。"""
    settings = get_settings()
    secure, samesite = _cookie_flags()
    access_max = max(60, int(settings.access_token_expire_minutes) * 60)
    refresh_max = max(3600, int(settings.refresh_token_expire_days) * 86400)

    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        max_age=access_max,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        max_age=refresh_max,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    """登出或凭证失效时清除 Cookie。"""
    secure, samesite = _cookie_flags()
    for key in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(
            key=key,
            path="/",
            secure=secure,
            httponly=True,
            samesite=samesite,
        )


def get_access_token_from_request(request) -> str | None:
    return request.cookies.get(ACCESS_COOKIE) or None


def get_refresh_token_from_request(request) -> str | None:
    return request.cookies.get(REFRESH_COOKIE) or None
