"""
中间件装配 —— CORS 等（与 main 入口保持配置一致）

主应用在 main.py 中直接挂载中间件；本模块提供可复用的 setup，
避免出现第二份硬编码 allow_origins。
"""
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from backend.config import get_settings


def setup_middleware(app: FastAPI) -> None:
    """按当前 Settings 挂载 CORS（allow_credentials=True 时不可用 *）。"""
    settings = get_settings()
    origins = settings.cors_origins_list()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def cors_allow_origins() -> list[str]:
    """供测试与诊断：当前 CORS 允许源列表。"""
    return get_settings().cors_origins_list()
