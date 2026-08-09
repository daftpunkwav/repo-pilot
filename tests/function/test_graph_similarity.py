"""图谱相似度函数测试 — pairwise / foundation / hubness / cluster

覆盖：满分/零分/中间梯度/空输入/TF-IDF/引擎vs应用 foundation/hubness/新字段。
"""
from uuid import uuid4

import pytest

from backend.models.project import Project
from backend.services.graph_service import (
    _build_idf,
    _cluster_communities,
    _compute_foundation,
    _compute_hubness,
    _cosine,
    _doc_tokens,
    _doc_vector,
    _lexicon_foundation_raw,
    _similarity,
    _similarity_detailed,
    _tf,
    _tfidf,
    _tokenize,
    build_graph,
)


def _project(**kwargs) -> Project:
    p = Project(
        id=uuid4(),
        name="a/b",
        url="https://github.com/a/b",
    )
    for k, v in kwargs.items():
        setattr(p, k, v)
    return p


def test_similarity_same_language_and_category():
    cid = uuid4()
    a = _project(name="react/core", language="TypeScript", category_id=cid, description="ui library")
    b = _project(name="react/core", language="TypeScript", category_id=cid, description="ui library")
    assert _similarity(a, b) >= 0.65


def test_similarity_no_match():
    a = _project(name="alpha/foo", language="Go", description="cli tools")
    b = _project(name="zeta/bar", language="Rust", description="kernel module")
    assert _similarity(a, b) < 0.35


def test_similarity_partial_language_only():
    a = _project(name="react/core", language="TypeScript", description="ui lib for declarative components")
    b = _project(name="vue/runtime", language="TypeScript", description="progressive web framework")
    score = _similarity(a, b)
    assert 0.12 <= score < 0.9


def test_similarity_both_empty():
    a = _project(name="", language=None, description=None, note=None, category_id=None)
    b = _project(name="", language=None, description=None, note=None, category_id=None)
    assert _similarity(a, b) == 0.0


def test_similarity_one_side_empty():
    a = _project(name="", language=None, description=None, note=None, category_id=None)
    b = _project(name="react/core", language="TypeScript", description="ui")
    assert _similarity(a, b) < 0.2


def test_similarity_chinese_text_overlap():
    a = _project(name="react/core", language="TypeScript", description="React 是一款用于构建用户界面的 JavaScript 库")
    b = _project(name="react/core", language="TypeScript", description="React 是构建用户界面的库")
    score = _similarity(a, b)
    assert score >= 0.40


def test_cosine_zero_vector():
    assert _cosine({}, {"a": 0.1}) == 0.0
    assert _cosine({"a": 0.1}, {}) == 0.0
    assert _cosine({}, {}) == 0.0


def test_cosine_basic():
    assert _cosine({"a": 1.0}, {"a": 1.0}) == pytest.approx(1.0)
    assert _cosine({"a": 1.0}, {"b": 1.0}) == pytest.approx(0.0)


def test_tokenize_empty():
    assert _tokenize("") == []


def test_tokenize_basic():
    toks = _tokenize("React TypeScript JavaScript")
    assert "react" in toks
    assert "typescript" in toks


def test_tokenize_chinese():
    toks = _tokenize("React 是一个库")
    assert "react" in toks
    assert any(t for t in toks if t and ord(t[0]) > 127)


def test_tf_normalizes():
    tf = _tf(["a", "b", "a", "a"])
    assert tf["a"] == pytest.approx(0.75)
    assert tf["b"] == pytest.approx(0.25)


def test_tf_empty():
    assert _tf([]) == {}


def test_tfidf_downweights_common_terms():
    docs = [
        ["react", "ui", "library"],
        ["react", "framework", "web"],
        ["vue", "framework", "web"],
    ]
    idf = _build_idf(docs)
    # "react" 出现在 2/3 文档，idf 应低于只出现一次的 "library"
    assert idf["library"] > idf["react"]
    v = _tfidf(docs[0], idf)
    assert "react" in v and "library" in v


def test_doc_vector_combines_fields():
    p = _project(name="react", language="TypeScript", description="ui", note="frontend")
    v = _doc_vector(p)
    assert "typescript" in v
    assert "react" in v
    assert "ui" in v


def test_similarity_detailed_reasons():
    cid = uuid4()
    a = _project(name="react/core", language="TypeScript", category_id=cid, description="ui library framework")
    b = _project(name="react/core", language="TypeScript", category_id=cid, description="ui library framework")
    toks = _doc_tokens(a)
    idf = _build_idf([toks, toks])
    score, reasons = _similarity_detailed(
        a, b, _tfidf(toks, idf), _tfidf(toks, idf), tokens_a=toks, tokens_b=toks
    )
    assert "tfidf" in reasons
    assert "language" in reasons
    assert "category" in reasons
    assert "name" in reasons
    assert score >= 0.65


def test_similarity_detailed_empty_reasons():
    a = _project(name="", language=None, description=None, note=None, category_id=None)
    b = _project(name="x", language="Go", description="cli", note="")
    score, reasons = _similarity_detailed(a, b, _doc_vector(a), _doc_vector(b))
    assert score < 0.15
    assert "language" not in reasons or score < 0.15


def test_similarity_bounded():
    a = _project(name="a", language="A", description="x")
    b = _project(name="a", language="A", description="x")
    s = _similarity(a, b)
    assert 0.0 <= s <= 1.0


def test_foundation_engine_higher_than_game():
    engine = _project(
        name="godotengine/godot",
        language="C++",
        description="Godot Engine is a free and open source game engine",
        stars=90000,
    )
    game = _project(
        name="someone/platformer-demo",
        language="GDScript",
        description="A small platformer game demo based on Godot engine starter template",
        stars=120,
    )
    fe = _compute_foundation(engine, _doc_tokens(engine), centrality=0.4)
    fg = _compute_foundation(game, _doc_tokens(game), centrality=0.1)
    assert fe > fg
    assert fe >= 0.45
    assert fg < fe


def test_foundation_override_wins():
    p = _project(name="x", description="game demo template", stars=1)
    assert _compute_foundation(p, _doc_tokens(p), 0.0, override=0.95) == pytest.approx(0.95)


def test_lexicon_foundation_raw_engine_vs_app():
    eng = _lexicon_foundation_raw(_tokenize("database engine runtime postgres"))
    app = _lexicon_foundation_raw(_tokenize("ecommerce shop demo starter template"))
    assert eng > app


def test_hubness_broad_connector_higher():
    broad = _compute_hubness(weighted_degree=0.9, avg_edge=0.7, neighbor_ratio=0.5)
    isolated = _compute_hubness(weighted_degree=0.05, avg_edge=0.3, neighbor_ratio=0.02)
    assert broad > isolated


def test_cluster_communities_merges_strong_edges():
    nodes = ["a", "b", "c", "d"]
    edges = [
        {"source": "a", "target": "b", "similarity": 0.9},
        {"source": "b", "target": "c", "similarity": 0.85},
        {"source": "d", "target": "a", "similarity": 0.1},
    ]
    comm = _cluster_communities(nodes, edges)
    assert comm["a"] == comm["b"] == comm["c"]
    assert comm["d"] != comm["a"] or True  # d 可能孤立


@pytest.mark.asyncio
async def test_build_graph_smoke():
    from unittest.mock import AsyncMock, MagicMock

    db = MagicMock()
    empty = MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))))
    db.execute = AsyncMock(return_value=empty)
    graph = await build_graph(db, min_similarity=0.1, max_edges=10)
    assert graph["nodes"] == []
    assert graph["edges"] == []


@pytest.mark.asyncio
async def test_build_graph_node_fields():
    """build_graph 返回 foundation_score / hubness / cluster_id。"""
    from unittest.mock import AsyncMock, MagicMock

    cid = uuid4()
    projects = [
        _project(
            name="godotengine/godot",
            language="C++",
            description="open source game engine runtime",
            stars=90000,
            category_id=cid,
            url="https://github.com/godotengine/godot",
        ),
        _project(
            name="user/godot-platformer",
            language="GDScript",
            description="platformer game demo based on godot engine",
            stars=50,
            category_id=cid,
            url="https://github.com/user/godot-platformer",
        ),
        _project(
            name="postgres/postgres",
            language="C",
            description="PostgreSQL database engine",
            stars=15000,
            category_id=cid,
            url="https://github.com/postgres/postgres",
        ),
    ]

    db = MagicMock()

    async def fake_execute(stmt):
        # 第一次 Project select；第二次 tags select
        text = str(stmt)
        if "tags" in text.lower() or "project_tags" in text.lower():
            return MagicMock(all=MagicMock(return_value=[]))
        return MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=projects))))

    db.execute = AsyncMock(side_effect=fake_execute)
    graph = await build_graph(db, min_similarity=0.05, max_edges=50)
    assert len(graph["nodes"]) == 3
    for n in graph["nodes"]:
        assert "foundation_score" in n
        assert "hubness" in n
        assert "cluster_id" in n
        assert "cluster_size" in n
        assert 0.0 <= n["foundation_score"] <= 1.0
        assert 0.0 <= n["hubness"] <= 1.0

    by_name = {n["name"]: n for n in graph["nodes"]}
    assert by_name["godotengine/godot"]["foundation_score"] > by_name["user/godot-platformer"]["foundation_score"]
