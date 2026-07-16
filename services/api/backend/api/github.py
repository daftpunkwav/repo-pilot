"""
GitHub API —— Star 导入、绑定账号、仓库搜索
"""
from __future__ import annotations

import json
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.core.responses import wrap_data
from backend.models.user import User
from backend.schemas.common import DataResponse
from backend.services.github_client import list_user_stars, search_repositories

router = APIRouter(prefix="/github", tags=["github"])


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


def _load_accounts(user: User) -> list[dict]:
    try:
        data = json.loads(user.github_accounts or "[]")
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def _save_accounts(user: User, accounts: list[dict]) -> None:
    # 不回传完整 PAT 到列表接口；存储时保留 pat 供 stars 使用
    user.github_accounts = json.dumps(accounts, ensure_ascii=False)


def _primary_token(user: User) -> tuple[str | None, str | None]:
    accounts = _load_accounts(user)
    if not accounts:
        return None, None
    acc = accounts[0]
    return acc.get("username"), acc.get("pat")


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


@router.get("/stars", response_model=DataResponse[list[StarRepoOut]])
async def get_stars(
    username: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
    stars = await list_user_stars(uname, token=token)
    # 标记已导入
    from sqlalchemy import select
    from backend.models.project import Project

    existing = (
        await db.execute(select(Project.url).where(Project.user_id == current_user.id))
    ).scalars().all()
    existing_set = set(existing)
    out = []
    for s in stars:
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


@router.post("/bindaccount", response_model=DataResponse[GithubAccountOut])
async def bind_account(
    body: BindGithubBody,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime
    from uuid import uuid4

    # 校验 PAT：请求 user API
    from backend.services.github_client import _request

    status_code, data = await _request("/user", token=body.pat)
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
    # 替换同名
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
    await db.commit()
    return wrap_data({"success": True})


@router.get("/search", response_model=DataResponse[list[StarRepoOut]])
async def search_repos(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
):
    _, token = _primary_token(current_user)
    items = await search_repositories(q, token=token, per_page=15)
    out = []
    for s in items:
        full = s.get("full_name") or ""
        if "/" in full:
            owner, repo = full.split("/", 1)
        else:
            owner, repo = s.get("owner") or "", s.get("name") or ""
        out.append(
            StarRepoOut(
                owner=owner,
                repo=repo,
                url=s.get("url") or f"https://github.com/{owner}/{repo}",
                description=s.get("description"),
                language=s.get("language"),
                stars=int(s.get("stars") or 0),
                already_imported=False,
            )
        )
    return wrap_data(out)
