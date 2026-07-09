"""设置 service 单元测试"""
import pytest

from backend.services.settings_service import settings_to_out
from backend.models.user import User


def test_settings_to_out_defaults():
    user = User(username="u", password_hash="x", settings_json="{}")
    out = settings_to_out(user)
    assert out.theme in ("dark", "light")
    assert out.llm_configured is False
