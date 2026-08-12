"""兼容 shim：符号来自 agent_core.agents.question（保持单一类身份）。"""
from __future__ import annotations

import agent_core.agents.question as _impl

globals().update(
    {k: v for k, v in vars(_impl).items() if k not in {"__name__", "__file__", "__package__", "__loader__", "__spec__", "__cached__", "__builtins__"}}
)
__all__ = getattr(_impl, "__all__", [k for k in globals() if not k.startswith("_")])
