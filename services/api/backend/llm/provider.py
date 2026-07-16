"""LiteLLM 封装 —— 流式/非流式补全"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Literal, Optional

from backend.llm.config import LLMConfig

logger = logging.getLogger(__name__)


@dataclass
class LLMChunk:
    type: Literal["text", "tool_call", "done", "error"]
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


class LLMProvider:
    """统一 LLM 调用层。"""

    def __init__(self, config: LLMConfig | None):
        self.config = config

    @property
    def available(self) -> bool:
        return self.config is not None and self.config.has_llm

    def _kwargs(self, model_override: str | None = None) -> dict[str, Any]:
        assert self.config is not None
        model = model_override or self.config.litellm_model()
        kw: dict[str, Any] = {
            "model": model,
            "api_key": self.config.api_key,
        }
        if self.config.api_base:
            kw["api_base"] = self.config.api_base
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
            logger.exception("LLM complete failed")
            raise RuntimeError(f"LLM 调用失败: {e}") from e

        choice = resp.choices[0]
        msg = choice.message
        text = msg.content or ""
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
        # 部分 provider 流式 tool_calls 不稳定：若有 tools 则降级非流式再模拟流
        if call_kw.get("tools"):
            result = await self._complete_once(litellm, {**call_kw, "stream": False})
            if result.tool_calls:
                for tc in result.tool_calls:
                    yield LLMChunk(type="tool_call", tool_call=tc)
            if result.text:
                # 分片推送以保持 SSE 体验
                step = 24
                for i in range(0, len(result.text), step):
                    yield LLMChunk(type="text", text=result.text[i : i + step])
            yield LLMChunk(type="done", usage=result.usage)
            return

        try:
            resp = await litellm.acompletion(**call_kw)
            async for chunk in resp:
                delta = chunk.choices[0].delta
                if getattr(delta, "content", None):
                    yield LLMChunk(type="text", text=delta.content)
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
        # 剥离 markdown code fence
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

    async def test_connection(self) -> tuple[bool, int, str]:
        """测试连通性，返回 (success, latency_ms, model)。"""
        import time

        if not self.available or self.config is None:
            return False, 0, ""
        model = self.config.model
        t0 = time.perf_counter()
        try:
            await self.complete(
                [{"role": "user", "content": "ping"}],
                max_tokens=5,
                temperature=0,
                stream=False,
            )
            ms = int((time.perf_counter() - t0) * 1000)
            return True, ms, model
        except Exception:
            ms = int((time.perf_counter() - t0) * 1000)
            return False, ms, model
