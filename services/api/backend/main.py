"""
FastAPI 应用入口 —— v2.0
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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


app = FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:5193",
    ],
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
