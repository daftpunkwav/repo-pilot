"""
[deprecated] 外部 CBM 客户端已移除。

保留模块名以免旧 import 瞬间炸掉；全部转发至 RpGraphClient。
"""
from graph_engine_runtime.client import RpGraphClient as CodebaseMemoryClient
from graph_engine_runtime.client import RpGraphError as CodebaseMemoryError

__all__ = ["CodebaseMemoryClient", "CodebaseMemoryError"]
