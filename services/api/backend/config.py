"""
配置管理 —— 基于 pydantic-settings 的环境变量/配置文件统一入口
"""
from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict


def _repo_root() -> Path:
    """定位 monorepo 根目录（含 apps/ 与 services/）"""
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "apps").is_dir() and (parent / "services").is_dir():
            return parent
    # fallback: services/api/backend -> 仓库根
    return current.parents[3]


REPO_ROOT = _repo_root()
DATA_DIR = REPO_ROOT / "data"


class Settings(BaseSettings):
    """应用配置"""

    model_config = SettingsConfigDict(
        # 同时尝试进程 cwd 与仓库根，避免从 services/api 启动时读不到根目录 .env
        env_file=(".env", str(REPO_ROOT / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 应用
    app_name: str = "RepoPilot"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # 数据库
    database_url: str = f"sqlite:///{DATA_DIR / 'repopilot.db'}"

    # 密钥：SECRET_KEY 必填；敏感字段 at-rest 加密可另设 SECRETS_ENCRYPTION_KEY
    secret_key: str = Field(
        ...,
        description="应用密钥，必须通过 SECRET_KEY 环境变量设置，长度不少于 32 字节",
    )
    secrets_encryption_key: Optional[str] = Field(
        default=None,
        description="Fernet 派生用密钥，环境变量 SECRETS_ENCRYPTION_KEY；未设则回退 SECRET_KEY",
    )

    # 速率限制
    rate_limit_enabled: bool = True
    # Agent SSE 端点(chat/analyze/classify 等)每次触发多轮 LLM 调用,按用户限频
    rate_limit_agent: str = "20/minute"

    # CORS：逗号分隔源列表；生产请通过 CORS_ALLOW_ORIGINS 显式配置
    # 含 Vite 端口回退（5173 被占用时会落到 5174/5175）与 127.0.0.1 同源写法
    cors_allow_origins: str = (
        "http://localhost:5173,http://localhost:5174,http://localhost:5175,"
        "http://localhost:4173,http://localhost:5193,"
        "http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175,"
        "http://127.0.0.1:4173,http://127.0.0.1:5193"
    )

    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]

    # Agent 独立进程（可选）。设置后 API 可将 SSE 转发至该基址；未设置则同进程 Hub。
    agent_base_url: Optional[str] = Field(
        default=None,
        description="例如 http://127.0.0.1:19877；空则 Agent 与 API 同进程",
    )
    agent_internal_token: str = Field(
        default="",
        description="API↔Agent 内部鉴权；启用 AGENT_BASE_URL 时必填",
    )
    llm_api_key: str = ""
    llm_api_base: Optional[str] = None
    llm_model: str = "gpt-4o-mini"

    # 图谱 C 引擎 sidecar（迁入 services/graph_engine/c）
    rp_graph_allowed_root: str = Field(
        default_factory=lambda: str(DATA_DIR),
        description="RP_GRAPH_ALLOWED_ROOT：引擎可索引根；仓库缓存落其下 repo-cache/",
    )
    rp_graph_engine_url: str = Field(
        default="http://127.0.0.1:9750",
        description=(
            "图谱引擎 sidecar HTTP 基址（默认 http://127.0.0.1:9750）。"
            "设为空字符串可强制仅用进程内 Python 回退。"
        ),
    )
    rp_graph_engine_bin: str = Field(
        default="",
        description=(
            "RP_GRAPH_ENGINE_BIN：本仓 rp-graph-engine 可执行文件路径；"
            "空则尝试 services/graph_engine/c/build/c/ 下约定产物"
        ),
    )
    rp_graph_cache_dir: str = Field(
        default_factory=lambda: str(DATA_DIR / "graph-engine-cache"),
        description="RP_GRAPH_CACHE_DIR：写入 C 引擎的 CBM_CACHE_DIR（图谱 SQLite 根）",
    )
    rp_graph_auto_start: bool = Field(
        default=True,
        description="API 启动时若 sidecar 不健康则尝试拉起 RP_GRAPH_ENGINE_BIN",
    )
    # 兼容旧环境变量名（勿在新代码中直接依赖）
    cbm_allowed_root: str = Field(
        default_factory=lambda: str(DATA_DIR),
        description="[deprecated] 请改用 RP_GRAPH_ALLOWED_ROOT",
    )
    cbm_ui_base_url: str = Field(
        default="",
        description="[deprecated] 请改用 RP_GRAPH_ENGINE_URL",
    )
    repo_cache_quota_gb: float = Field(
        default=2.0,
        description="data/repo-cache 总配额（GB）",
    )
    index_concurrency: int = Field(
        default=4,
        ge=1,
        le=16,
        description="INDEX_CONCURRENCY：同时进行的 clone/index 任务数",
    )
    git_clone_timeout_sec: float = Field(
        default=600.0,
        description="单次浅克隆超时（秒）；超时后失败并释放队列槽位",
    )
    graph_index_timeout_sec: float = Field(
        default=900.0,
        description="单次引擎 index_repository 超时（秒）",
    )


@lru_cache()
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError as exc:
        # 将缺失 SECRET_KEY 的提示转换得更直观
        for err in exc.errors():
            if err.get("loc") == ("secret_key",) and err.get("type") == "missing":
                raise ValueError(
                    "必须设置 SECRET_KEY 环境变量（长度不少于 32 字节）"
                ) from exc
        raise
