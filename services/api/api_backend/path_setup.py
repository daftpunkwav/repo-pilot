"""确保同仓服务路径可导入（agent_core / rp_graph 等）。"""
from __future__ import annotations

import sys
from pathlib import Path

# services/api/api_backend/path_setup.py → parents[2] = services/
_SERVICES_ROOT = Path(__file__).resolve().parents[2]


def ensure_service_paths() -> None:
    """把 services/agent、graph_engine/graph_engine_runtime 插入 sys.path（幂等）。"""
    candidates = (
        _SERVICES_ROOT / "agent",
        _SERVICES_ROOT / "graph_engine" / "graph_engine_runtime",
    )
    for path in candidates:
        if not path.is_dir():
            continue
        s = str(path)
        if s not in sys.path:
            sys.path.insert(0, s)
