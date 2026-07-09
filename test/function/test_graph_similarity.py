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
    a = _project(language="TypeScript", category_id=cid)
    b = _project(language="TypeScript", category_id=cid)
    assert _similarity(a, b) == 1.0


def test_similarity_no_match():
    a = _project(language="Go")
    b = _project(language="Rust")
    assert _similarity(a, b) == 0.0
