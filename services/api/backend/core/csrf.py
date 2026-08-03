"""CSRF 防护 —— Cookie 会话写请求须携带双提交令牌。

Bearer 鉴权（API 客户端）不校验 CSRF。
仅当请求带有 rp_access Cookie 且无有效 Bearer 时，对 POST/PUT/PATCH/DELETE 校验。
"""
from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from backend.core.auth_cookies import ACCESS_COOKIE, CSRF_COOKIE, CSRF_HEADER

_SAFE = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})


class CsrfMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method.upper() in _SAFE:
            return await call_next(request)

        path = request.url.path
        # 认证引导端点自带密码/refresh 校验；不套 CSRF（避免注册限流测等被误伤）
        if "/auth/" in path:
            return await call_next(request)

        auth = request.headers.get("authorization") or ""
        if auth.lower().startswith("bearer ") and auth[7:].strip():
            return await call_next(request)

        if not request.cookies.get(ACCESS_COOKIE):
            return await call_next(request)

        cookie_tok = request.cookies.get(CSRF_COOKIE) or ""
        header_tok = (
            request.headers.get(CSRF_HEADER)
            or request.headers.get("X-CSRF-Token")
            or ""
        )
        if not cookie_tok or not header_tok or cookie_tok != header_tok:
            return JSONResponse(
                status_code=403,
                content={
                    "detail": {
                        "code": "CSRF_FAILED",
                        "message": "缺少或无效的 CSRF 令牌",
                    }
                },
            )
        return await call_next(request)
