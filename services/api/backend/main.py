"""
FastAPI 应用入口 —— v2.0
"""
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from backend.api import (
    agent,
    auth,
    categories,
    github,
    graph,
    notes,
    overview,
    projects,
    settings as settings_api,
    tags,
    user,
)
from backend.config import get_settings
from backend.core.limiter import limiter
from backend.database import get_session_factory, init_db
from backend.services.seed_service import seed_preset_categories

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # 启动前校验 JWT 密钥长度，防止使用弱密钥
    if len(settings.secret_key.encode("utf-8")) < 32:
        raise ValueError("SECRET_KEY 长度必须至少为 32 字节，请设置足够强度的随机密钥")
    await init_db()
    factory = get_session_factory()
    async with factory() as session:
        await seed_preset_categories(session)
    yield


class _LoginBodyCacheMiddleware:
    """
    缓存 /auth/login 请求体，提取用户名写入 scope state 供限流 key 使用。
    通过 wrapped_receive 把完整 body 重新交给下游，避免 FastAPI 解析失败。
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope.get("type") != "http" or scope.get("path") != f"{settings.api_v1_prefix}/auth/login":
            return await self.app(scope, receive, send)

        body_parts: list[bytes] = []
        more_body = True
        while more_body:
            message = await receive()
            if message["type"] == "http.request":
                body_parts.append(message.get("body", b""))
                more_body = message.get("more_body", False)
            else:
                body_parts.append(b"")
                more_body = False
        body = b"".join(body_parts)

        username = ""
        if body:
            try:
                payload = json.loads(body)
                if isinstance(payload, dict):
                    username = payload.get("username", "") or ""
            except Exception:
                pass
        scope.setdefault("state", {})["rate_limit_username"] = username

        sent = False

        async def wrapped_receive() -> Message:
            nonlocal sent
            if not sent:
                sent = True
                return {"type": "http.request", "body": body, "more_body": False}
            return await receive()

        await self.app(scope, wrapped_receive, send)


app = FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(SlowAPIMiddleware)
app.add_middleware(_LoginBodyCacheMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = settings.api_v1_prefix
app.include_router(auth.router, prefix=f"{api}/auth", tags=["auth"])
app.include_router(projects.router, prefix=api)
app.include_router(categories.router, prefix=api)
app.include_router(notes.router, prefix=api)
app.include_router(graph.router, prefix=api)
app.include_router(tags.router, prefix=api)
app.include_router(overview.router, prefix=api)
app.include_router(user.router, prefix=api)
app.include_router(agent.router, prefix=api)
app.include_router(github.router, prefix=api)
app.include_router(settings_api.router, prefix=api)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
