"""GitHub REST API 客户端（公开接口 + 可选 PAT）"""
from __future__ import annotations

import base64
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

GITHUB_API = "https://api.github.com"


async def _request(
    path: str,
    *,
    token: str | None = None,
    accept: str = "application/vnd.github+json",
) -> tuple[int, Any]:
    try:
        import httpx
    except ImportError:
        logger.error("httpx not installed")
        return 0, {"error": "httpx 未安装"}

    headers = {
        "Accept": accept,
        "User-Agent": "RepoPilot/2.0",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(f"{GITHUB_API}{path}", headers=headers)
        try:
            data = resp.json()
        except Exception:
            data = {"raw": resp.text[:500]}
        return resp.status_code, data


async def fetch_repo_info(owner: str, repo: str, token: str | None = None) -> dict:
    status, data = await _request(f"/repos/{owner}/{repo}", token=token)
    if status != 200:
        return {
            "error": f"GitHub API {status}",
            "message": data.get("message") if isinstance(data, dict) else str(data),
        }
    return {
        "full_name": data.get("full_name"),
        "description": data.get("description"),
        "stars": data.get("stargazers_count", 0),
        "language": data.get("language"),
        "topics": data.get("topics") or [],
        "forks": data.get("forks_count", 0),
        "open_issues": data.get("open_issues_count", 0),
        "license": (data.get("license") or {}).get("spdx_id"),
        "homepage": data.get("homepage"),
        "default_branch": data.get("default_branch"),
        "html_url": data.get("html_url"),
        "updated_at": data.get("updated_at"),
    }


async def fetch_readme_text(
    owner: str, repo: str, token: str | None = None
) -> str | None:
    status, data = await _request(f"/repos/{owner}/{repo}/readme", token=token)
    if status != 200 or not isinstance(data, dict):
        return None
    content = data.get("content")
    if not content:
        return None
    try:
        raw = base64.b64decode(content).decode("utf-8", errors="replace")
        return raw
    except Exception:
        return None


async def search_repositories(
    query: str, token: str | None = None, per_page: int = 10
) -> list[dict]:
    if not query.strip():
        return []
    from urllib.parse import quote

    status, data = await _request(
        f"/search/repositories?q={quote(query)}&per_page={per_page}&sort=stars",
        token=token,
    )
    if status != 200 or not isinstance(data, dict):
        return []
    items = []
    for r in data.get("items") or []:
        items.append(
            {
                "id": str(r.get("id")),
                "name": r.get("name"),
                "full_name": r.get("full_name"),
                "url": r.get("html_url"),
                "description": r.get("description"),
                "language": r.get("language"),
                "stars": r.get("stargazers_count", 0),
                "owner": (r.get("owner") or {}).get("login"),
            }
        )
    return items


async def list_user_stars(
    username: str, token: str | None = None, per_page: int = 30
) -> list[dict]:
    status, data = await _request(
        f"/users/{username}/starred?per_page={per_page}",
        token=token,
    )
    if status != 200 or not isinstance(data, list):
        return []
    items = []
    for r in data:
        items.append(
            {
                "id": str(r.get("id")),
                "name": r.get("name"),
                "full_name": r.get("full_name"),
                "url": r.get("html_url"),
                "description": r.get("description"),
                "language": r.get("language"),
                "stars": r.get("stargazers_count", 0),
                "owner": (r.get("owner") or {}).get("login"),
            }
        )
    return items


async def list_trending_approx(language: str = "", limit: int = 10) -> list[dict]:
    """
    用 search 近似 trending：按 stars 与最近 push 排序的高星仓库。
    """
    from datetime import datetime, timedelta
    from urllib.parse import quote

    since = (datetime.utcnow() - timedelta(days=7)).strftime("%Y-%m-%d")
    q = f"created:>{since}"
    if language:
        q += f" language:{language}"
    status, data = await _request(
        f"/search/repositories?q={quote(q)}&sort=stars&order=desc&per_page={limit}"
    )
    if status != 200 or not isinstance(data, dict):
        # 降级：热门仓库
        status, data = await _request(
            f"/search/repositories?q={quote('stars:>10000')}&sort=stars&order=desc&per_page={limit}"
        )
    if status != 200 or not isinstance(data, dict):
        return []
    out = []
    for r in data.get("items") or []:
        out.append(
            {
                "id": str(r.get("id")),
                "name": r.get("full_name") or r.get("name"),
                "url": r.get("html_url"),
                "description": r.get("description"),
                "language": r.get("language"),
                "stars": r.get("stargazers_count", 0),
                "forks": r.get("forks_count", 0),
                "period": "weekly",
            }
        )
    return out
