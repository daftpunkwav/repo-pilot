"""自研图谱引擎：索引 / 搜索 / schema 冒烟。"""
from __future__ import annotations

import tempfile
from pathlib import Path

from graph_fallback import GraphEngine


def test_index_and_search_python_repo():
    with tempfile.TemporaryDirectory() as td:
        root = Path(td)
        (root / "pkg").mkdir()
        (root / "pkg" / "mod.py").write_text(
            "def hello(x):\n    return world(x)\n\ndef world(x):\n    return x\n",
            encoding="utf-8",
        )
        eng = GraphEngine(data_root=root / "data")
        out = eng.index_repository(str(root), mode="fast", name="graph-test", persistence=True)
        assert out["node_count"] > 0
        schema = eng.get_graph_schema("graph-test")
        assert schema["node_labels"]
        hits = eng.search_graph("graph-test", query="hello", limit=20)
        assert hits["results"]
        assert hits["has_more"] is False or isinstance(hits["has_more"], bool)
        layout = eng.fetch_layout("graph-test", max_nodes=100)
        assert layout["nodes"]
        arch = eng.get_architecture("graph-test")
        assert "packages" in arch
        db = root / "data" / "graph-db" / "graph-test.db"
        assert db.exists()
