"""确保同仓服务路径可导入（agent_core / graph_fallback 等）。"""
from __future__ import annotations

import sys
from pathlib import Path

# services/api/api_backend/path_setup.py → parents[2] = services/
_SERVICES_ROOT = Path(__file__).resolve().parents[2]


def ensure_service_paths() -> None:
    """把 services/agent、graph_engine、packages/py-shared 插入 sys.path（幂等）。"""
    candidates = (
        _SERVICES_ROOT / "agent",
        _SERVICES_ROOT / "graph_engine",
        _SERVICES_ROOT.parent / "packages" / "py-shared",  # 共享层
    )
    for path in candidates:
        if not path.is_dir():
            continue
        s = str(path)
        if s not in sys.path:
            sys.path.insert(0, s)
