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
    access_token_expire_minutes: int = 60 * 24  # 1 天
    refresh_token_expire_days: int = 30

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
