"""图谱适配层与流水线纯函数测试。"""
from __future__ import annotations

import pytest

from backend.services.index_data_adapter import adapt_layout
from backend.services.index_pipeline import engine_project_name, parse_github_owner_repo


def test_parse_github_owner_repo():
    assert parse_github_owner_repo("https://github.com/foo/bar") == ("foo", "bar")
    assert parse_github_owner_repo("https://github.com/foo/bar.git") == ("foo", "bar")
    assert parse_github_owner_repo("git@github.com:acme/demo.git") == ("acme", "demo")


def test_engine_project_name():
    name = engine_project_name("Foo Org", "my repo!")
    assert name.startswith("rp-")
    assert " " not in name


def test_adapt_layout_maps_nodes_and_edges():
    raw = {
        "nodes": [
            {
                "id": 1,
                "x": 10,
                "y": 20,
                "z": 30,
                "label": "Function",
                "name": "hello",
                "file_path": "a.py",
                "qualified_name": "mod.hello",
                "size": 2,
                "color": "#00ff00",
                "status": "normal",
                "in_calls": 3,
            }
        ],
        "edges": [{"source": 1, "target": 1, "type": "CALLS"}],
        "total_nodes": 100,
    }
    data = adapt_layout(raw)
    assert data.stats.node_count == 1
    assert data.stats.total_nodes == 100
    assert data.nodes[0].kind == "Function"
    assert data.nodes[0].qualified_name == "mod.hello"
    assert data.edges[0].relation == "CALLS"
    assert data.edges[0].source == "1"


def test_parse_invalid_url_raises():
    with pytest.raises(ValueError):
        parse_github_owner_repo("https://example.com/not-github")
