"""
FastAPI 应用入口 —— v2.0（模块容错挂载 + 本地单机无认证）
"""
import importlib
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from backend.config import get_settings
from backend.core import error_codes as EC
from backend.core.limiter import limiter
from backend.core.middleware import setup_middleware
from backend.core.module_registry import all_module_statuses, get_module_status, safe_load_router
from backend.database import get_session_factory, init_db
from backend.services.seed_service import seed_preset_categories

settings = get_settings()
api = settings.api_v1_prefix


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # 启动前校验密钥长度，防止使用弱密钥
    if len(settings.secret_key.encode("utf-8")) < 32:
        raise ValueError("SECRET_KEY 长度必须至少为 32 字节，请设置足够强度的随机密钥")
    await init_db()
    factory = get_session_factory()
    async with factory() as session:
        await seed_preset_categories(session)
        # 确保 AppState 与学习者画像各一行
        from backend.services.app_state_service import ensure_singleton_rows

        await ensure_singleton_rows(session)
    yield


app = FastAPI(title=settings.app_name, version="2.0.0", lifespan=lifespan)

app.state.limiter = limiter


async def _rate_limited_handler(request, exc):  # noqa: ANN001
    """限流响应统一带 RATE_LIMITED 码。"""
    return JSONResponse(
        status_code=429,
        content={
            "detail": {
                "code": EC.RATE_LIMITED,
                "message": "请求过于频繁，请稍后重试",
            }
        },
    )


async def _validation_error_handler(request: Request, exc: RequestValidationError):
    """参数校验 → VALIDATION_ERROR；llm_api_base SSRF → SETTINGS_LLM_BASE_INVALID。"""
    errors = exc.errors()
    for err in errors:
        loc = err.get("loc") or ()
        if "llm_api_base" in loc:
            return JSONResponse(
                status_code=400,
                content={
                    "detail": {
                        "code": EC.SETTINGS_LLM_BASE_INVALID,
                        "message": err.get("msg") or "LLM API Base 不安全",
                        "details": errors,
                    }
                },
            )
    return JSONResponse(
        status_code=422,
        content={
            "detail": {
                "code": EC.VALIDATION_ERROR,
                "message": "参数校验失败",
                "details": errors,
            }
        },
    )


app.add_exception_handler(RateLimitExceeded, _rate_limited_handler)
app.add_exception_handler(RequestValidationError, _validation_error_handler)

app.add_middleware(SlowAPIMiddleware)
setup_middleware(app)


def _load_router(module_path: str) -> Callable[[], object]:
    """延迟 import 指定 api 模块的 router。"""

    def _loader() -> object:
        mod = importlib.import_module(module_path)
        return mod.router

    return _loader


# —— 模块容错挂载：单域失败不阻塞 app 启动（已移除 auth） ——
_MODULES: list[tuple[str, Callable[[], object]]] = [
    ("projects", _load_router("backend.api.projects")),
    ("categories", _load_router("backend.api.categories")),
    ("notes", _load_router("backend.api.notes")),
    ("graph", _load_router("backend.api.graph")),
    ("tags", _load_router("backend.api.tags")),
    ("overview", _load_router("backend.api.overview")),
    ("user", _load_router("backend.api.user")),
    ("agent", _load_router("backend.api.agent")),
    ("github", _load_router("backend.api.github")),
    ("settings", _load_router("backend.api.settings")),
]

for _name, _loader in _MODULES:
    _router = safe_load_router(_name, _loader)
    if _router is not None:
        app.include_router(_router, prefix=api)


@app.get("/health")
async def health():
    """健康检查：返回各模块加载状态。"""
    return {
        "status": "ok",
        "version": "2.0.0",
        "modules": [
            {"name": s.name, "loaded": s.loaded, "error": s.error}
            for s in all_module_statuses()
        ],
    }


# —— 模块级 503 兜底：未加载成功的域，其前缀路由统一返回 503 ——
# include_in_schema=False：避免多 method 共用同一 operationId 污染 OpenAPI
@app.api_route(
    f"{api}/{{module}}/{{rest:path}}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
async def module_unavailable(module: str, rest: str):
    status = get_module_status(module)
    if status and not status.loaded:
        return JSONResponse(
            status_code=503,
            content={
                "detail": {
                    "code": EC.MODULE_LOAD_FAILED,
                    "message": f"模块 {module} 加载失败，服务不可用",
                    "module": module,
                    "error": status.error,
                }
            },
        )
    # 已加载但路径不匹配 → 走 FastAPI 默认 404
    return JSONResponse(status_code=404, content={"detail": "Not Found"})
