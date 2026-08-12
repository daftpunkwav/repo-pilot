"""Agent Runtime Interface + Embedded 实现。

api_backend 只依赖 AgentRuntimeInterface（经 get_agent_runtime() 获取）；
EmbeddedAgentRuntime 在启动期（api_backend.main lifespan / agent_runtime 入口）
构造并注入 agent_core 业务服务容器，委托到 agent_runtime.execution 与 agent_core。
"""
from __future__ import annotations

from typing import Any, AsyncIterator, Protocol
from uuid import UUID

from agent_core import services as _agent_services
from agent_core.services import AgentServices

from agent_runtime import execution


class AgentRuntimeInterface(Protocol):
    """Agent 运行层统一接口（api_backend 只依赖此接口）。"""

    # —— SSE 执行编排 ——
    def stream_chat(
        self,
        db: Any,
        session_id: UUID,
        message: str,
        *,
        project_id: UUID | None = None,
        force_local: bool = False,
    ) -> AsyncIterator[str]: ...

    def stream_question_answer(
        self,
        db: Any,
        session_id: UUID,
        question_id: str,
        answers: dict[str, Any],
        *,
        skipped: bool = False,
    ) -> AsyncIterator[str]: ...

    def stream_analyze(
        self,
        db: Any,
        project_id: UUID,
        *,
        depth: str = "quick",
        agent_id: str | None = None,
    ) -> AsyncIterator[str]: ...

    def stream_import_assist(
        self, db: Any, message: str, context: dict[str, Any]
    ) -> AsyncIterator[str]: ...

    def stream_graph_guide(
        self,
        db: Any,
        message: str,
        *,
        selected_node_id: str | None = None,
    ) -> AsyncIterator[str]: ...

    def stream_trending_scout(
        self, db: Any, params: dict[str, Any]
    ) -> AsyncIterator[str]: ...

    def stream_classify_project(
        self,
        db: Any,
        project_id: UUID,
        *,
        user_hint: str | None = None,
    ) -> AsyncIterator[str]: ...

    def stream_generate_note(
        self,
        db: Any,
        project_id: UUID,
        *,
        mode: str = "project",
        topic: str | None = None,
    ) -> AsyncIterator[str]: ...

    # —— LLM 测试 / 画像记忆 / Agent 清单 ——
    async def test_llm(
        self,
        db: Any,
        *,
        provider_id: str | None = None,
        model_override: str | None = None,
    ) -> dict[str, Any]: ...

    async def accept_memory_proposal(
        self, db: Any, proposal_id: str
    ) -> dict[str, Any]: ...

    async def reject_memory_proposal(
        self, db: Any, proposal_id: str
    ) -> dict[str, Any]: ...

    def list_agent_definitions(self) -> list[Any]: ...


class EmbeddedAgentRuntime:
    """Embedded 实现（默认，同进程）。构造时注入 agent_core 业务服务容器。"""

    def __init__(self, services: AgentServices | None = None):
        if services is not None:
            _agent_services.register_agent_services(services)
        self._services = services

    # —— SSE 执行编排（透传 execution，签名一致） ——
    def stream_chat(
        self,
        db: Any,
        session_id: UUID,
        message: str,
        *,
        project_id: UUID | None = None,
        force_local: bool = False,
    ) -> AsyncIterator[str]:
        return execution.stream_chat(
            db, session_id, message, project_id=project_id, force_local=force_local
        )

    def stream_question_answer(
        self,
        db: Any,
        session_id: UUID,
        question_id: str,
        answers: dict[str, Any],
        *,
        skipped: bool = False,
    ) -> AsyncIterator[str]:
        return execution.stream_question_answer(
            db, session_id, question_id, answers, skipped=skipped
        )

    def stream_analyze(
        self,
        db: Any,
        project_id: UUID,
        *,
        depth: str = "quick",
        agent_id: str | None = None,
    ) -> AsyncIterator[str]:
        return execution.stream_analyze(
            db, project_id, depth=depth, agent_id=agent_id
        )

    def stream_import_assist(
        self, db: Any, message: str, context: dict[str, Any]
    ) -> AsyncIterator[str]:
        return execution.stream_import_assist(db, message, context)

    def stream_graph_guide(
        self,
        db: Any,
        message: str,
        *,
        selected_node_id: str | None = None,
    ) -> AsyncIterator[str]:
        return execution.stream_graph_guide(
            db, message, selected_node_id=selected_node_id
        )

    def stream_trending_scout(
        self, db: Any, params: dict[str, Any]
    ) -> AsyncIterator[str]:
        return execution.stream_trending_scout(db, params)

    def stream_classify_project(
        self,
        db: Any,
        project_id: UUID,
        *,
        user_hint: str | None = None,
    ) -> AsyncIterator[str]:
        return execution.stream_classify_project(
            db, project_id, user_hint=user_hint
        )

    def stream_generate_note(
        self,
        db: Any,
        project_id: UUID,
        *,
        mode: str = "project",
        topic: str | None = None,
    ) -> AsyncIterator[str]:
        return execution.stream_generate_note(
            db, project_id, mode=mode, topic=topic
        )

    # —— LLM 测试 / 画像记忆 / Agent 清单 ——
    async def test_llm(
        self,
        db: Any,
        *,
        provider_id: str | None = None,
        model_override: str | None = None,
    ) -> dict[str, Any]:
        from agent_core.llm.config import build_llm_config_from_user
        from agent_core.llm.provider import LLMProvider

        cfg = await build_llm_config_from_user(
            db, provider_id=provider_id, model_override=model_override
        )
        if not cfg:
            return {
                "ok": False,
                "latency_ms": 0,
                "model": model_override or "",
                "reply": "",
                "error": "未配置 API Key，请先保存密钥",
                "litellm_model": "",
                "provider_id": provider_id,
            }
        if model_override:
            cfg.model = model_override
        provider = LLMProvider(cfg)
        result = await provider.test_connection(model_override=model_override)
        return {
            "ok": result.success,
            "latency_ms": result.latency_ms,
            "model": result.model or model_override or cfg.model,
            "reply": result.reply,
            "error": result.error,
            "litellm_model": result.litellm_model,
            "provider_id": cfg.provider_id or provider_id,
        }

    async def accept_memory_proposal(
        self, db: Any, proposal_id: str
    ) -> dict[str, Any]:
        from agent_core.memory.service import MemoryService

        return await MemoryService(db).accept_memory_proposal(proposal_id)

    async def reject_memory_proposal(
        self, db: Any, proposal_id: str
    ) -> dict[str, Any]:
        from agent_core.memory.service import MemoryService

        return await MemoryService(db).reject_memory_proposal(proposal_id)

    def list_agent_definitions(self) -> list[Any]:
        from agent_core.agents.registry import get_registry

        return list(get_registry().list_all())


# 进程内单例：api_backend.main lifespan 构造（注入 services）后全局共享。
_agent_runtime: EmbeddedAgentRuntime | None = None


def get_agent_runtime() -> AgentRuntimeInterface:
    """返回已注入的运行时；未初始化则懒构造（不注入 services，供转发调用）。"""
    global _agent_runtime
    if _agent_runtime is None:
        _agent_runtime = EmbeddedAgentRuntime(services=None)
    return _agent_runtime
