"""
FastAPI 应用入口 —— v2.0
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api import auth, projects
from backend.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name, version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=f"{settings.api_v1_prefix}/auth", tags=["auth"])
app.include_router(projects.router, tags=["projects"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}