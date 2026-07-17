"""Pydantic schemas —— 用户设置（对齐前端 Settings 子集）"""
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from backend.core.url_safety import validate_public_https_url


class AgentLlmConfigOut(BaseModel):
    agent_id: str
    model_override: str | None = None
    speaking_style: str = "default"


class SettingsOut(BaseModel):
    theme: Literal["dark", "light"] = "dark"
    font_scale: float = 1.0
    code_font: str = "JetBrains Mono"
    llm_provider: str = "openai"
    llm_provider_display_name: str = "OpenAI"
    llm_default_model: str = "gpt-4o"
    llm_model: str = "gpt-4o"
    llm_api_base: Optional[str] = None
    llm_api_format: Literal["openai", "anthropic", "google", "ollama", "custom"] = "openai"
    llm_available_models: list[str] = Field(default_factory=lambda: ["gpt-4o"])
    llm_api_key_masked: Optional[str] = None
    llm_configured: bool = False
    llm_last_test: Optional[str] = None
    llm_latency_ms: Optional[int] = None
    agent_llm_configs: list[AgentLlmConfigOut] = Field(default_factory=list)


class SettingsUpdate(BaseModel):
    theme: Optional[Literal["dark", "light"]] = None
    font_scale: Optional[float] = None
    code_font: Optional[str] = None
    llm_provider: Optional[str] = None
    llm_provider_display_name: Optional[str] = None
    llm_default_model: Optional[str] = None
    llm_model: Optional[str] = None
    llm_api_base: Optional[str] = None
    llm_api_format: Optional[str] = None
    llm_available_models: Optional[list[str]] = None
    llm_api_key: Optional[str] = Field(None, max_length=1024)
    agent_llm_configs: Optional[list[AgentLlmConfigOut]] = None

    @field_validator("llm_api_base")
    @classmethod
    def _validate_llm_api_base(cls, v: Optional[str]) -> Optional[str]:
        """校验为公开 HTTPS URL，禁止私有 IP、localhost 及内网域名。"""
        if v is None:
            return v
        return validate_public_https_url(v, resolve_dns=True)


class ApiKeyIn(BaseModel):
    api_key: str = Field(..., min_length=1, max_length=1024)


class ApiKeyOut(BaseModel):
    masked: str


class LlmTestOut(BaseModel):
    success: bool
    latency_ms: int
    model: str
    reply: str = ""
    error: str = ""
    litellm_model: str = ""


class LlmTestIn(BaseModel):
    """可选：指定测试模型；默认使用 settings 中的默认模型。"""
    model: Optional[str] = Field(None, max_length=128)
