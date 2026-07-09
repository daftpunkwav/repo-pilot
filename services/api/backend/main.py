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
    projects,
    settings as settings_api,
)
from backend.config import get_settings
from backend.database import init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
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
app.include_router(agent.router, prefix=api)
app.include_router(github.router, prefix=api)
app.include_router(settings_api.router, prefix=api)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
