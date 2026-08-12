"""
[deprecated] 外部 CBM 客户端已移除。

保留模块名以免旧 import 瞬间炸掉；全部转发至 GraphEngineClient。
"""
from graph_engine_runtime.client import GraphEngineClient as CodebaseMemoryClient
from graph_engine_runtime.client import GraphEngineError as CodebaseMemoryError

__all__ = ["CodebaseMemoryClient", "CodebaseMemoryError"]
