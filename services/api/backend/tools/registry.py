"""工具注册表"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

logger = logging.getLogger(__name__)

ToolHandler = Callable[..., Awaitable[Any]]


@dataclass
class ToolDefinition:
    name: str
    description: str
    parameters: dict[str, Any]
    handler: ToolHandler
    allowed_agents: list[str] = field(default_factory=list)
    timeout_ms: int = 30_000

    def to_openai_format(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: dict[str, ToolDefinition] = {}

    def register(self, tool: ToolDefinition) -> None:
        self._tools[tool.name] = tool

    def get(self, name: str) -> ToolDefinition | None:
        return self._tools.get(name)

    def get_tools_for_agent(self, agent_id: str) -> list[ToolDefinition]:
        return [t for t in self._tools.values() if agent_id in t.allowed_agents or "*" in t.allowed_agents]

    def get_timeout(self, name: str) -> int:
        t = self._tools.get(name)
        return t.timeout_ms if t else 30_000

    def openai_tools_for(self, agent_id: str) -> list[dict[str, Any]]:
        return [t.to_openai_format() for t in self.get_tools_for_agent(agent_id)]

    async def execute(
        self, name: str, args: dict[str, Any], context: Any
    ) -> Any:
        tool = self._tools.get(name)
        if not tool:
            return {"error": f"工具 {name} 不存在"}
        agent_id = getattr(context, "agent_id", None)
        if agent_id and agent_id not in tool.allowed_agents and "*" not in tool.allowed_agents:
            return {"error": f"Agent {agent_id} 无权使用工具 {name}"}
        timeout = tool.timeout_ms / 1000.0
        try:
            return await asyncio.wait_for(
                tool.handler(context=context, **args),
                timeout=timeout,
            )
        except asyncio.TimeoutError:
            return {"error": f"工具 {name} 超时"}
        except Exception as e:
            logger.exception("Tool %s failed", name)
            return {"error": f"工具 {name} 失败: {e}"}


# 全局单例，builtin 工具在模块导入时注册
global_registry = ToolRegistry()


def tool(
    name: str,
    description: str,
    parameters: dict[str, Any],
    allowed_agents: list[str],
    timeout_ms: int = 30_000,
):
    def decorator(func: ToolHandler):
        global_registry.register(
            ToolDefinition(
                name=name,
                description=description,
                parameters=parameters,
                handler=func,
                allowed_agents=allowed_agents,
                timeout_ms=timeout_ms,
            )
        )
        return func

    return decorator
