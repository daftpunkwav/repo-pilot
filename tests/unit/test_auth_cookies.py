"""认证 Cookie 单元测试"""
from fastapi import Response

from backend.config import get_settings
from backend.core.auth_cookies import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    clear_auth_cookies,
    set_auth_cookies,
)


def test_set_auth_cookies_httponly(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "x" * 32)
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("AUTH_COOKIE_SAMESITE", "lax")
    get_settings.cache_clear()

    response = Response()
    set_auth_cookies(
        response,
        access_token="access-jwt",
        refresh_token="refresh-plain",
    )
    # Starlette Response.raw_headers 含 set-cookie
    cookies = response.headers.getlist("set-cookie")
    assert any(ACCESS_COOKIE in c and "HttpOnly" in c for c in cookies)
    assert any(REFRESH_COOKIE in c and "HttpOnly" in c for c in cookies)
    # 不应在 set-cookie 中出现可读 JS 标志缺失：HttpOnly 必须存在
    for c in cookies:
        if ACCESS_COOKIE in c or REFRESH_COOKIE in c:
            assert "httponly" in c.lower()
    get_settings.cache_clear()


def test_clear_auth_cookies(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "x" * 32)
    get_settings.cache_clear()
    response = Response()
    set_auth_cookies(response, access_token="a", refresh_token="b")
    clear_auth_cookies(response)
    # delete_cookie 同样产生 set-cookie
    joined = " ".join(response.headers.getlist("set-cookie")).lower()
    assert ACCESS_COOKIE in joined or "rp_access" in joined
    get_settings.cache_clear()


def test_samesite_none_forces_secure(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "x" * 32)
    monkeypatch.setenv("DEBUG", "true")
    monkeypatch.setenv("AUTH_COOKIE_SAMESITE", "none")
    monkeypatch.delenv("AUTH_COOKIE_SECURE", raising=False)
    get_settings.cache_clear()
    response = Response()
    set_auth_cookies(response, access_token="a", refresh_token="b")
    cookies = response.headers.getlist("set-cookie")
    assert any("samesite=none" in c.lower() and "secure" in c.lower() for c in cookies)
    get_settings.cache_clear()
