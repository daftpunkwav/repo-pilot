"""图谱相似度函数测试"""
from uuid import uuid4

from backend.models.project import Project
from backend.services.graph_service import _similarity


def _project(**kwargs) -> Project:
    p = Project(
        id=uuid4(),
        user_id=uuid4(),
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
    # 多信号加权后应接近满分
    assert _similarity(a, b) >= 0.9


def test_similarity_no_match():
    a = _project(name="alpha/foo", language="Go", description="cli tools")
    b = _project(name="zeta/bar", language="Rust", description="kernel module")
    assert _similarity(a, b) < 0.3
