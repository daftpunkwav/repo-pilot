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
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 应用
    app_name: str = "RepoPilot"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # 数据库
    database_url: str = f"sqlite:///{DATA_DIR / 'repopilot.db'}"

    # 认证
    secret_key: str = Field(
        ...,
        description="JWT 签名密钥，必须通过 SECRET_KEY 环境变量设置，长度不少于 32 字节",
    )
    # 敏感字段 at-rest 加密密钥；未设置时回退 SECRET_KEY（兼容旧部署）
    secrets_encryption_key: Optional[str] = Field(
        default=None,
        description="Fernet 派生用密钥，环境变量 SECRETS_ENCRYPTION_KEY；建议与 JWT 分离",
    )
    # Access 默认 60 分钟；过长会扩大被盗 token 窗口（refresh 仍可轮换续期）
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30
    # 认证 Cookie：None=按 debug/生产策略自动选择；跨域可设 AUTH_COOKIE_SAMESITE=none
    auth_cookie_secure: Optional[bool] = None
    auth_cookie_samesite: Optional[str] = None

    # 速率限制
    rate_limit_enabled: bool = True
    rate_limit_login: str = "5/minute"
    rate_limit_register: str = "3/hour"
    rate_limit_refresh: str = "20/minute"

    # CORS：逗号分隔源列表；生产请通过 CORS_ALLOW_ORIGINS 显式配置
    cors_allow_origins: str = (
        "http://localhost:5173,http://localhost:4173,http://localhost:5193"
    )

    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_allow_origins.split(",") if o.strip()]

    # LLM (BYOK)
    llm_provider: str = "openai"
    llm_api_key: str = ""
    llm_api_base: Optional[str] = None
    llm_model: str = "gpt-4o-mini"


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
