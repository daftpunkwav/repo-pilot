"""LiteLLM 封装 —— 流式/非流式补全"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Literal

from backend.llm.config import LLMConfig

logger = logging.getLogger(__name__)


@dataclass
class LLMChunk:
    type: Literal["text", "thinking", "tool_call", "done", "error"]
    text: str = ""
    tool_call: dict[str, Any] | None = None
    usage: dict[str, int] = field(default_factory=dict)
    error: str = ""


@dataclass
class LLMCompleteResult:
    text: str
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    usage: dict[str, int] = field(default_factory=dict)
    raw_message: dict[str, Any] | None = None
    failed: bool = False


@dataclass
class LLMTestResult:
    success: bool
    latency_ms: int
    model: str
    reply: str = ""
    error: str = ""
    litellm_model: str = ""


class LLMProvider:
    """统一 LLM 调用层。"""

    def __init__(self, config: LLMConfig | None):
        self.config = config

    @property
    def available(self) -> bool:
        return self.config is not None and self.config.has_llm

    def _kwargs(self, model_override: str | None = None) -> dict[str, Any]:
        """始终经 litellm_model() 解析，禁止把裸模型名直接交给 LiteLLM。"""
        assert self.config is not None
        if model_override and model_override.strip():
            resolved = LLMConfig(
                provider=self.config.provider,
                model=model_override.strip(),
                api_key=self.config.api_key,
                api_base=self.config.api_base,
                api_format=self.config.api_format,
            )
        else:
            resolved = self.config
        model = resolved.litellm_model()
        # 兜底：仍无 provider 前缀时，按 api_format 强制加
        if "/" not in model:
            fmt = (resolved.api_format or "openai").lower()
            if fmt == "anthropic" or "anthropic" in (resolved.normalized_api_base() or ""):
                model = f"anthropic/{model}"
            elif fmt == "google":
                model = f"gemini/{model}"
            elif fmt == "ollama":
                model = f"ollama/{model}"
            else:
                model = f"openai/{model}"

        kw: dict[str, Any] = {
            "model": model,
            "api_key": self.config.api_key,
        }
        api_base = self.config.normalized_api_base()
        if api_base:
            # 出站前二次 SSRF 校验（DNS TOCTOU：保存时安全不代表请求时仍安全）
            from backend.core.url_safety import assert_safe_outbound_https_url

            try:
                api_base = assert_safe_outbound_https_url(api_base)
            except ValueError as exc:
                raise RuntimeError(f"LLM_API_BASE_BLOCKED: {exc}") from exc
            if api_base:
                kw["api_base"] = api_base
        # 按前缀显式指定 provider，避免 LiteLLM 无法识别自定义端点
        if model.startswith("anthropic/"):
            kw["custom_llm_provider"] = "anthropic"
        elif model.startswith("openai/"):
            kw["custom_llm_provider"] = "openai"
        elif model.startswith("gemini/"):
            kw["custom_llm_provider"] = "gemini"
        elif model.startswith("ollama/"):
            kw["custom_llm_provider"] = "ollama"
        logger.info(
            "LLM call route model=%s api_base=%s format=%s",
            model,
            api_base,
            self.config.api_format,
        )
        return kw

    async def complete(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict] | None = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        stream: bool = False,
        model_override: str | None = None,
    ) -> LLMCompleteResult | AsyncIterator[LLMChunk]:
        if not self.available or self.config is None:
            raise RuntimeError("LLM_NOT_CONFIGURED")

        try:
            import litellm
        except ImportError as exc:
            raise RuntimeError("litellm 未安装") from exc

        litellm.drop_params = True
        call_kw = self._kwargs(model_override)
        call_kw.update(
            {
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
        )
        if tools:
            call_kw["tools"] = tools
            call_kw["tool_choice"] = "auto"

        if stream:
            return self._stream(litellm, call_kw)
        return await self._complete_once(litellm, call_kw)

    async def _complete_once(self, litellm: Any, call_kw: dict) -> LLMCompleteResult:
        call_kw["stream"] = False
        try:
            resp = await litellm.acompletion(**call_kw)
        except Exception as e:
            logger.exception("LLM complete failed: model=%s base=%s", call_kw.get("model"), call_kw.get("api_base"))
            raise RuntimeError(f"LLM 调用失败: {e}") from e

        choice = resp.choices[0]
        msg = choice.message
        text = _extract_text(msg)
        tool_calls: list[dict[str, Any]] = []
        if getattr(msg, "tool_calls", None):
            for tc in msg.tool_calls:
                tool_calls.append(
                    {
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments or "{}",
                        },
                    }
                )
        usage = {}
        if getattr(resp, "usage", None):
            usage = {
                "prompt_tokens": getattr(resp.usage, "prompt_tokens", 0) or 0,
                "completion_tokens": getattr(resp.usage, "completion_tokens", 0) or 0,
                "total_tokens": getattr(resp.usage, "total_tokens", 0) or 0,
            }
        return LLMCompleteResult(
            text=text,
            tool_calls=tool_calls,
            usage=usage,
            raw_message={
                "role": "assistant",
                "content": text or None,
                "tool_calls": tool_calls or None,
            },
        )

    async def _stream(self, litellm: Any, call_kw: dict) -> AsyncIterator[LLMChunk]:
        call_kw["stream"] = True
        if call_kw.get("tools"):
            result = await self._complete_once(litellm, {**call_kw, "stream": False})
            if result.tool_calls:
                for tc in result.tool_calls:
                    yield LLMChunk(type="tool_call", tool_call=tc)
            if result.text:
                step = 24
                for i in range(0, len(result.text), step):
                    yield LLMChunk(type="text", text=result.text[i : i + step])
            yield LLMChunk(type="done", usage=result.usage)
            return

        try:
            resp = await litellm.acompletion(**call_kw)
            async for chunk in resp:
                delta = chunk.choices[0].delta
                content = getattr(delta, "content", None)
                if content:
                    yield LLMChunk(type="text", text=content)
                # 部分推理模型会在 delta 中带 reasoning_content
                reasoning = getattr(delta, "reasoning_content", None)
                if isinstance(reasoning, str) and reasoning:
                    yield LLMChunk(type="thinking", text=reasoning)
            yield LLMChunk(type="done", usage={})
        except Exception as e:
            logger.exception("LLM stream failed")
            yield LLMChunk(type="error", error=str(e))

    async def complete_json(
        self,
        messages: list[dict[str, Any]],
        *,
        temperature: float = 0.2,
        max_tokens: int = 1024,
    ) -> dict[str, Any]:
        """要求模型返回 JSON 对象。"""
        result = await self.complete(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False,
        )
        assert isinstance(result, LLMCompleteResult)
        text = result.text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = [ln for ln in lines if not ln.strip().startswith("```")]
            text = "\n".join(lines).strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            start = text.find("{")
            end = text.rfind("}")
            if start >= 0 and end > start:
                return json.loads(text[start : end + 1])
            return {}

    async def test_connection(self, *, model_override: str | None = None) -> LLMTestResult:
        """
        真实请求一个模型：发送简短 prompt，收到非空回复视为通过。
        """
        import time

        if not self.available or self.config is None:
            return LLMTestResult(
                success=False,
                latency_ms=0,
                model="",
                error="未配置 API Key",
            )

        display_model = model_override or self.config.model
        litellm_name = ""
        try:
            kw = self._kwargs(model_override)
            litellm_name = str(kw.get("model") or "")
        except Exception:
            litellm_name = display_model

        t0 = time.perf_counter()
        try:
            # 推理型模型（如 MiniMax-M2.7）会先占用 thinking tokens，需给足预算
            result = await self.complete(
                [
                    {
                        "role": "user",
                        "content": "Reply with exactly: OK",
                    }
                ],
                max_tokens=256,
                temperature=0,
                stream=False,
                model_override=model_override,
            )
            assert isinstance(result, LLMCompleteResult)
            ms = int((time.perf_counter() - t0) * 1000)
            reply = (result.text or "").strip()
            if not reply:
                return LLMTestResult(
                    success=False,
                    latency_ms=ms,
                    model=display_model,
                    reply="",
                    error=(
                        "模型返回空正文（可能仍在 thinking，"
                        "请换用 highspeed 模型或增大 max_tokens）"
                    ),
                    litellm_model=litellm_name,
                )
            return LLMTestResult(
                success=True,
                latency_ms=ms,
                model=display_model,
                reply=reply[:500],
                error="",
                litellm_model=litellm_name,
            )
        except Exception as e:
            ms = int((time.perf_counter() - t0) * 1000)
            err = str(e)
            # 截断过长错误
            if len(err) > 800:
                err = err[:800] + "…"
            return LLMTestResult(
                success=False,
                latency_ms=ms,
                model=display_model,
                reply="",
                error=err,
                litellm_model=litellm_name,
            )


def _extract_text(msg: Any) -> str:
    """兼容 content 为 str / list(blocks)，以及 reasoning/thinking 回落。"""
    content = getattr(msg, "content", None)
    text = _coerce_content(content)
    if text.strip():
        return text

    # MiniMax 等推理模型：正文可能仍为空，但有 reasoning_content
    reasoning = getattr(msg, "reasoning_content", None)
    if isinstance(reasoning, str) and reasoning.strip():
        return reasoning.strip()

    thinking_blocks = getattr(msg, "thinking_blocks", None)
    if isinstance(thinking_blocks, list):
        parts: list[str] = []
        for b in thinking_blocks:
            if isinstance(b, dict) and b.get("thinking"):
                parts.append(str(b["thinking"]))
            else:
                t = getattr(b, "thinking", None)
                if t:
                    parts.append(str(t))
        if parts:
            return "\n".join(parts)

    return ""


def _coerce_content(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                if block.get("type") in ("text", "output_text"):
                    parts.append(str(block.get("text") or ""))
                elif "text" in block:
                    parts.append(str(block.get("text") or ""))
            else:
                text = getattr(block, "text", None)
                if text:
                    parts.append(str(text))
        return "".join(parts)
    return str(content)
