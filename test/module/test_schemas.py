"""Pydantic schema 模块测试"""
from backend.schemas.project import ImportProjectsBody, ProjectCreate
from backend.schemas.user import UserCreate


def test_user_create_min_length():
    u = UserCreate(username="abc", password="demo1234")
    assert u.username == "abc"


def test_import_body_repos():
    body = ImportProjectsBody(
        repos=[{"owner": "o", "repo": "r", "url": "https://github.com/o/r"}]
    )
    assert body.repos[0].owner == "o"


def test_project_create_defaults():
    p = ProjectCreate(name="a/b", url="https://github.com/a/b")
    assert p.progress == "none"
    assert p.source == "manual"
