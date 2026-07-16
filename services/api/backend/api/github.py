"""
GitHub API —— Star 导入、绑定账号、仓库搜索
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.core.responses import wrap_data
from backend.models.project import Project
from backend.models.user import User
from backend.schemas.common import DataResponse
from backend.services.github_client import list_user_stars, search_repositories

router = APIRouter(prefix="/github", tags=["github"])

# Stars 缓存默认 6 小时
STARS_CACHE_TTL = timedelta(hours=6)


class BindGithubBody(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    pat: str = Field(..., min_length=4, max_length=256)


class GithubAccountOut(BaseModel):
    id: str
    username: str
    avatar_url: Optional[str] = None
    bound_at: str


class StarRepoOut(BaseModel):
    owner: str
    repo: str
    url: str
    description: Optional[str] = None
    language: Optional[str] = None
    stars: int = 0
    already_imported: bool = False


class StarsListOut(BaseModel):
    items: list[StarRepoOut]
    total: int
    cached: bool = False
    fetched_at: Optional[str] = None
    cache_ttl_hours: float = 6.0


def _load_accounts(user: User) -> list[dict]:
    try:
        data = json.loads(user.github_accounts or "[]")
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def _save_accounts(user: User, accounts: list[dict]) -> None:
    user.github_accounts = json.dumps(accounts, ensure_ascii=False)


def _primary_token(user: User) -> tuple[str | None, str | None]:
    accounts = _load_accounts(user)
    if not accounts:
        return None, None
    acc = accounts[0]
    return acc.get("username"), acc.get("pat")


def _load_settings(user: User) -> dict:
    try:
        data = json.loads(user.settings_json or "{}")
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def _save_settings(user: User, data: dict) -> None:
    user.settings_json = json.dumps(data, ensure_ascii=False)


def _stars_from_cache(
    user: User, username: str
) -> tuple[list[dict], str | None] | None:
    raw = _load_settings(user)
    cache = raw.get("github_stars_cache")
    if not isinstance(cache, dict):
        return None
    if (cache.get("username") or "").lower() != username.lower():
        return None
    fetched_at = cache.get("fetched_at")
    items = cache.get("items")
    if not fetched_at or not isinstance(items, list):
        return None
    try:
        ts = datetime.fromisoformat(fetched_at.replace("Z", "+00:00").replace("+00:00", ""))
    except ValueError:
        return None
    if datetime.utcnow() - ts > STARS_CACHE_TTL:
        return None
    return items, fetched_at


def _write_stars_cache(user: User, username: str, items: list[dict]) -> str:
    raw = _load_settings(user)
    fetched_at = datetime.utcnow().isoformat() + "Z"
    # 缓存瘦身：只保留列表展示字段
    slim = []
    for it in items:
        slim.append(
            {
                "owner": it.get("owner"),
                "name": it.get("name"),
                "full_name": it.get("full_name"),
                "url": it.get("url"),
                "description": (it.get("description") or "")[:300] or None,
                "language": it.get("language"),
                "stars": it.get("stars") or 0,
            }
        )
    raw["github_stars_cache"] = {
        "username": username,
        "fetched_at": fetched_at,
        "items": slim,
    }
    _save_settings(user, raw)
    return fetched_at


def _to_star_out(s: dict, existing_urls: set[str]) -> StarRepoOut:
    full = s.get("full_name") or ""
    if "/" in full:
        owner, repo = full.split("/", 1)
    else:
        owner, repo = s.get("owner") or "", s.get("name") or s.get("repo") or ""
    url = s.get("url") or f"https://github.com/{owner}/{repo}"
    return StarRepoOut(
        owner=owner,
        repo=repo,
        url=url,
        description=s.get("description"),
        language=s.get("language"),
        stars=int(s.get("stars") or 0),
        already_imported=url in existing_urls or s.get("already_imported") is True,
    )


@router.get("/accounts", response_model=DataResponse[list[GithubAccountOut]])
async def list_accounts(current_user: User = Depends(get_current_user)):
    accounts = _load_accounts(current_user)
    out = []
    for a in accounts:
        out.append(
            GithubAccountOut(
                id=str(a.get("id") or a.get("username")),
                username=a.get("username") or "",
                avatar_url=a.get("avatar_url"),
                bound_at=a.get("bound_at") or "",
            )
        )
    return wrap_data(out)


@router.get("/stars", response_model=DataResponse[StarsListOut])
async def get_stars(
    username: str | None = Query(None),
    refresh: bool = Query(False, description="强制刷新，忽略缓存"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    拉取用户全部 Stars（分页聚合）。
    默认使用 6 小时缓存；?refresh=true 强制更新。
    """
    bound_user, token = _primary_token(current_user)
    uname = username or bound_user
    if not uname:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "GITHUB_NOT_BOUND",
                "message": "请先绑定 GitHub 账号或传入 username",
            },
        )

    existing = (
        await db.execute(select(Project.url).where(Project.user_id == current_user.id))
    ).scalars().all()
    existing_set = set(existing)

    cached = False
    fetched_at: str | None = None
    raw_items: list[dict] = []

    if not refresh:
        hit = _stars_from_cache(current_user, uname)
        if hit:
            raw_items, fetched_at = hit
            cached = True

    if not cached:
        raw_items = await list_user_stars(uname, token=token, per_page=100, max_pages=30)
        # 重新绑定 user 后写缓存
        user = await db.get(User, current_user.id)
        if user is not None:
            fetched_at = _write_stars_cache(user, uname, raw_items)
            await db.commit()

    items = [_to_star_out(s, existing_set) for s in raw_items]
    return wrap_data(
        StarsListOut(
            items=items,
            total=len(items),
            cached=cached,
            fetched_at=fetched_at,
            cache_ttl_hours=STARS_CACHE_TTL.total_seconds() / 3600,
        )
    )


@router.post("/bindaccount", response_model=DataResponse[GithubAccountOut])
async def bind_account(
    body: BindGithubBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from backend.services.github_client import _request

    status_code, data, _ = await _request("/user", token=body.pat)
    if status_code != 200:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "GITHUB_AUTH_FAILED",
                "message": "GitHub PAT 无效或权限不足",
            },
        )
    login = (data.get("login") if isinstance(data, dict) else None) or body.username
    avatar = data.get("avatar_url") if isinstance(data, dict) else None
    accounts = _load_accounts(current_user)
    accounts = [a for a in accounts if a.get("username") != login]
    entry = {
        "id": str(uuid4()),
        "username": login,
        "pat": body.pat,
        "avatar_url": avatar,
        "bound_at": datetime.utcnow().isoformat() + "Z",
    }
    accounts.insert(0, entry)
    _save_accounts(current_user, accounts)
    # 绑定后清空旧 stars 缓存
    settings = _load_settings(current_user)
    settings.pop("github_stars_cache", None)
    _save_settings(current_user, settings)
    await db.commit()
    return wrap_data(
        GithubAccountOut(
            id=entry["id"],
            username=login,
            avatar_url=avatar,
            bound_at=entry["bound_at"],
        )
    )


@router.delete("/accounts/{account_id}", response_model=DataResponse[dict])
async def unbind_account(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    accounts = _load_accounts(current_user)
    new_accounts = [
        a
        for a in accounts
        if str(a.get("id")) != account_id and a.get("username") != account_id
    ]
    if len(new_accounts) == len(accounts):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "账号不存在"},
        )
    _save_accounts(current_user, new_accounts)
    settings = _load_settings(current_user)
    settings.pop("github_stars_cache", None)
    _save_settings(current_user, settings)
    await db.commit()
    return wrap_data({"success": True})


@router.get("/search", response_model=DataResponse[list[StarRepoOut]])
async def search_repos(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _, token = _primary_token(current_user)
    items = await search_repositories(q, token=token, per_page=30)
    existing = (
        await db.execute(select(Project.url).where(Project.user_id == current_user.id))
    ).scalars().all()
    existing_set = set(existing)
    out = []
    for s in items:
        full = s.get("full_name") or ""
        if "/" in full:
            owner, repo = full.split("/", 1)
        else:
            owner, repo = s.get("owner") or "", s.get("name") or ""
        url = s.get("url") or f"https://github.com/{owner}/{repo}"
        out.append(
            StarRepoOut(
                owner=owner,
                repo=repo,
                url=url,
                description=s.get("description"),
                language=s.get("language"),
                stars=int(s.get("stars") or 0),
                already_imported=url in existing_set,
            )
        )
    return wrap_data(out)
