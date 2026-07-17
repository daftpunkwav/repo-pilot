"""Pydantic schema 模块测试"""
import pytest
from pydantic import ValidationError

from backend.schemas.category import CategoryCreate, CategoryUpdate
from backend.schemas.note import NoteCreate
from backend.schemas.project import ImportProjectsBody, ProjectCreate, ProjectUpdate
from backend.schemas.settings import SettingsUpdate
from backend.schemas.tag import TagCreate
from backend.schemas.user import UserCreate, UserLogin


def test_user_create_min_length():
    u = UserCreate(username="abc", password="demo1234")
    assert u.username == "abc"


def test_user_create_password_over_72_bytes():
    with pytest.raises(ValidationError):
        UserCreate(username="abcuser", password="a" * 73)


def test_user_login_password_too_short():
    with pytest.raises(ValidationError):
        UserLogin(username="abc", password="short")


def test_user_login_password_too_long():
    with pytest.raises(ValidationError):
        UserLogin(username="abc", password="x" * 129)


def test_import_body_repos():
    body = ImportProjectsBody(
        repos=[{"owner": "o", "repo": "r", "url": "https://github.com/o/r"}]
    )
    assert body.repos[0].owner == "o"


def test_import_repo_item_requires_https():
    with pytest.raises(ValidationError):
        ImportProjectsBody(
            repos=[{"owner": "o", "repo": "r", "url": "http://github.com/o/r"}]
        )


def test_import_repo_item_requires_github_domain():
    with pytest.raises(ValidationError):
        ImportProjectsBody(
            repos=[{"owner": "o", "repo": "r", "url": "https://example.com/o/r"}]
        )


def test_project_create_defaults():
    p = ProjectCreate(name="a/b", url="https://github.com/a/b")
    assert p.progress == "none"
    assert p.source == "manual"


def test_project_create_name_too_long():
    with pytest.raises(ValidationError):
        ProjectCreate(name="x" * 129, url="https://github.com/a/b")


def test_project_create_description_too_long():
    with pytest.raises(ValidationError):
        ProjectCreate(
            name="a/b", url="https://github.com/a/b", description="x" * 2049
        )


def test_project_update_name_too_long():
    with pytest.raises(ValidationError):
        ProjectUpdate(name="x" * 129)


def test_project_update_description_too_long():
    with pytest.raises(ValidationError):
        ProjectUpdate(description="x" * 2049)


def test_settings_update_llm_api_base_must_be_https():
    with pytest.raises(ValidationError):
        SettingsUpdate(llm_api_base="http://api.openai.com/v1")


def test_settings_update_llm_api_base_rejects_localhost():
    with pytest.raises(ValidationError):
        SettingsUpdate(llm_api_base="https://localhost:11434/v1")


def test_settings_update_llm_api_base_rejects_private_ip():
    with pytest.raises(ValidationError):
        SettingsUpdate(llm_api_base="https://192.168.1.1/v1")


def test_settings_update_llm_api_base_rejects_link_local():
    """云元数据等链路本地地址应被拦截，防止 SSRF。"""
    with pytest.raises(ValidationError):
        SettingsUpdate(llm_api_base="https://169.254.169.254/")


def test_settings_update_llm_api_base_rejects_unspecified():
    with pytest.raises(ValidationError):
        SettingsUpdate(llm_api_base="https://0.0.0.0/v1")


def test_settings_update_llm_api_base_rejects_internal_domain():
    with pytest.raises(ValidationError):
        SettingsUpdate(llm_api_base="https://ollama.lan/v1")


def test_settings_update_llm_api_base_rejects_dns_to_private(monkeypatch):
    """域名若解析到内网 IP，应拦截（防 SSRF）。"""
    import socket

    import backend.schemas.settings as settings_mod

    def fake_getaddrinfo(host, *args, **kwargs):
        assert host == "evil.example.com"
        return [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.5", 0)),
        ]

    monkeypatch.setattr(settings_mod.socket, "getaddrinfo", fake_getaddrinfo)
    with pytest.raises(ValidationError):
        SettingsUpdate(llm_api_base="https://evil.example.com/v1")


def test_settings_update_llm_api_base_allows_public_dns(monkeypatch):
    import socket

    import backend.schemas.settings as settings_mod

    def fake_getaddrinfo(host, *args, **kwargs):
        return [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("1.1.1.1", 0)),
        ]

    monkeypatch.setattr(settings_mod.socket, "getaddrinfo", fake_getaddrinfo)
    obj = SettingsUpdate(llm_api_base="https://api.openai.com/v1")
    assert obj.llm_api_base == "https://api.openai.com/v1"


def test_settings_update_llm_api_key_too_long():
    with pytest.raises(ValidationError):
        SettingsUpdate(llm_api_key="x" * 1025)


def test_note_create_title_empty():
    with pytest.raises(ValidationError):
        NoteCreate(title="")


def test_note_create_title_too_long():
    with pytest.raises(ValidationError):
        NoteCreate(title="x" * 257)


def test_note_create_content_too_long():
    with pytest.raises(ValidationError):
        NoteCreate(title="t", content="x" * 100_001)


def test_category_create_name_empty():
    with pytest.raises(ValidationError):
        CategoryCreate(name="")


def test_category_create_name_too_long():
    with pytest.raises(ValidationError):
        CategoryCreate(name="x" * 65)


def test_category_update_name_too_long():
    with pytest.raises(ValidationError):
        CategoryUpdate(name="x" * 65)


def test_tag_create_name_too_long():
    with pytest.raises(ValidationError):
        TagCreate(name="x" * 65)
