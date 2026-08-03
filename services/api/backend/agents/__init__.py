"""兼容 shim 包：转发 agent_core.agents 公开符号；子模块见同目录 shim。"""
from __future__ import annotations

import agent_core.agents as _impl

globals().update(
    {k: v for k, v in vars(_impl).items() if k not in {"__name__", "__file__", "__package__", "__loader__", "__spec__", "__cached__", "__builtins__", "__path__"}}
)
