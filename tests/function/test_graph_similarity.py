"""图谱相似度函数测试 — §4.1.11 T-01 扩充

覆盖：满分/零分/中间梯度/空输入/单文档/多语言混合/_cosine 边界/build_graph 邻居。
"""
from uuid import uuid4

import pytest

from backend.models.project import Project
from backend.services.graph_service import (
    _cosine,
    _doc_vector,
    _similarity,
    _similarity_detailed,
    _tokenize,
    _tf,
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


# 已有：满分相似度（多信号全对齐）
def test_similarity_same_language_and_category():
    cid = uuid4()
    a = _project(name="react/core", language="TypeScript", category_id=cid, description="ui library")
    b = _project(name="react/core", language="TypeScript", category_id=cid, description="ui library")
    # 多信号加权后接近 1.0
    assert _similarity(a, b) >= 0.9


# 已有：完全不相似
def test_similarity_no_match():
    a = _project(name="alpha/foo", language="Go", description="cli tools")
    b = _project(name="zeta/bar", language="Rust", description="kernel module")
    assert _similarity(a, b) < 0.3


# §4.1.11 新增：中等相似度（仅共享语言但文本不同）
def test_similarity_partial_language_only():
    a = _project(name="react/core", language="TypeScript", description="ui lib for declarative components")
    b = _project(name="vue/runtime", language="TypeScript", description="progressive web framework")
    score = _similarity(a, b)
    # 共享语言 +0.25；文本有部分重叠（如 "framework"/"lib"）但远低于 1
    assert 0.2 <= score < 0.9


# §4.1.11 新增：完全空输入
def test_similarity_both_empty():
    a = _project(name="", language=None, description=None, note=None, category_id=None)
    b = _project(name="", language=None, description=None, note=None, category_id=None)
    assert _similarity(a, b) == 0.0


# §4.1.11 新增：一边空，一边有内容
def test_similarity_one_side_empty():
    a = _project(name="", language=None, description=None, note=None, category_id=None)
    b = _project(name="react/core", language="TypeScript", description="ui")
    assert _similarity(a, b) == 0.0


# §4.1.11 新增：中英文混合
def test_similarity_chinese_text_overlap():
    a = _project(name="react/core", language="TypeScript", description="React 是一款用于构建用户界面的 JavaScript 库")
    b = _project(name="react/core", language="TypeScript", description="React 是构建用户界面的库")
    score = _similarity(a, b)
    # 同名 + 同语言 + 中文 token 重叠，分数应当较高
    assert score >= 0.5


# §4.1.11 新增：_cosine 零向量
def test_cosine_zero_vector():
    assert _cosine({}, {"a": 0.1}) == 0.0
    assert _cosine({"a": 0.1}, {}) == 0.0
    assert _cosine({}, {}) == 0.0


# §4.1.11 新增：_cosine 完美 / 正交
def test_cosine_basic():
    assert _cosine({"a": 1.0}, {"a": 1.0}) == pytest.approx(1.0)
    assert _cosine({"a": 1.0}, {"b": 1.0}) == pytest.approx(0.0)


# §4.1.11 新增：_tokenize 行为
def test_tokenize_empty():
    assert _tokenize("") == []


def test_tokenize_basic():
    toks = _tokenize("React TypeScript JavaScript")
    assert "react" in toks
    assert "typescript" in toks


def test_tokenize_chinese():
    toks = _tokenize("React 是一个库")
    # 至少要切出 "react" 与至少一个中文 token
    assert "react" in toks
    assert any(t for t in toks if t and ord(t[0]) > 127)


# §4.1.11 新增：_tf 归一化
def test_tf_normalizes():
    tf = _tf(["a", "b", "a", "a"])
    assert tf["a"] == pytest.approx(0.75)
    assert tf["b"] == pytest.approx(0.25)


def test_tf_empty():
    assert _tf([]) == {}


# §4.1.11 新增：_doc_vector 拼接 name + description + language + note
def test_doc_vector_combines_fields():
    p = _project(name="react", language="TypeScript", description="ui", note="frontend")
    v = _doc_vector(p)
    # 必须包含 language token "typescript"
    assert "typescript" in v
    # name token "react" 出现，描述 "ui" 出现
    assert "react" in v
    assert "ui" in v


# §4.1.11 新增：_similarity_detailed 理由列表
def test_similarity_detailed_reasons():
    cid = uuid4()
    a = _project(name="react/core", language="TypeScript", category_id=cid, description="ui library")
    b = _project(name="react/core", language="TypeScript", category_id=cid, description="ui library")
    score, reasons = _similarity_detailed(a, b, _doc_vector(a), _doc_vector(b))
    assert "tfidf" in reasons
    assert "language" in reasons
    assert "category" in reasons
    assert "name" in reasons
    assert score >= 0.9


# §4.1.11 新增：_similarity_detailed 零分无理由
def test_similarity_detailed_empty_reasons():
    a = _project(name="", language=None, description=None, note=None, category_id=None)
    b = _project(name="x", language="Go", description="cli", note="")
    score, reasons = _similarity_detailed(a, b, _doc_vector(a), _doc_vector(b))
    assert score == 0.0
    assert reasons == []


# §4.1.11 新增：build_graph 节点与边
@pytest.mark.asyncio
async def test_build_graph_smoke():
    """build_graph 接口签名烟雾测试（不连真实 DB）。

    完整多文档图构建由 integration 集成测试覆盖；本测试仅断言：
    - 接受 min_similarity / max_edges 关键字参数
    - 返回 dict 含 nodes/edges 键
    - 在空库场景下（mock 空 execute）返回结构合法
    """
    from unittest.mock import AsyncMock, MagicMock
    from backend.services.graph_service import build_graph

    db = MagicMock()
    # 第一句空查询直接返回空列表
    db.execute = AsyncMock(
        return_value=MagicMock(scalars=MagicMock(return_value=MagicMock(all=MagicMock(return_value=[]))))
    )
    graph = await build_graph(db, min_similarity=0.1, max_edges=10)
    assert "nodes" in graph
    assert "edges" in graph
    assert graph["nodes"] == []
    assert graph["edges"] == []


# §4.1.11 新增：_similarity 上下界 0..1
def test_similarity_bounded():
    a = _project(name="a", language="A", description="x")
    b = _project(name="a", language="A", description="x")
    s = _similarity(a, b)
    assert 0.0 <= s <= 1.0