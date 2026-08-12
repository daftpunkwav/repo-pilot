"""业务服务契约 —— 学习者画像。"""
from __future__ import annotations

from typing import Any, Protocol


class ProfileServicePort(Protocol):
    """api_backend.services.profile_service 的契约。"""

    async def get_or_create_profile(self, db: Any) -> Any: ...

    def profile_to_out(self, row: Any) -> Any: ...

    async def get_user_profile(self, db: Any) -> Any: ...

    def select_learner_info(self, profile: Any, fields: list[str]) -> dict: ...
