"""鉴权与限流共用的 access token 解析顺序"""
from starlette.requests import Request

from backend.core.auth_cookies import ACCESS_COOKIE, resolve_access_token


def _request(*, headers: list[tuple[bytes, bytes]] | None = None, cookies: dict | None = None) -> Request:
    hdrs = list(headers or [])
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "headers": hdrs,
        "client": ("127.0.0.1", 123),
        "server": ("test", 80),
    }
    req = Request(scope)
    if cookies:
        # Starlette 从 header 解析 cookie
        cookie_header = "; ".join(f"{k}={v}" for k, v in cookies.items())
        scope["headers"] = hdrs + [(b"cookie", cookie_header.encode("latin-1"))]
        req = Request(scope)
    return req


def test_resolve_access_token_prefers_bearer_over_cookie():
    req = _request(
        headers=[(b"authorization", b"Bearer bearer-token")],
        cookies={ACCESS_COOKIE: "cookie-token"},
    )
    assert resolve_access_token(req) == "bearer-token"


def test_resolve_access_token_falls_back_to_cookie():
    req = _request(cookies={ACCESS_COOKIE: "cookie-only"})
    assert resolve_access_token(req) == "cookie-only"
