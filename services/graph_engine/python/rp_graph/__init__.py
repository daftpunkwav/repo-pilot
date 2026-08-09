"""
RepoPilot 自研图谱引擎（Python 编排层）。

运行时不依赖第三方 codebase-memory-mcp。
可选加速：native/ 下的 C 布局库（rp_layout）。
"""

from .engine import GraphEngine, get_engine

__all__ = ["GraphEngine", "get_engine"]
