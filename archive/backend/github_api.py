"""
GitHub API 交互 —— Star 拉取 & 分类推断
"""
import json, urllib.request, urllib.error
from .store import PRESET_CATEGORIES

def fetch_starred_repos(username: str, existing_urls: set[str]) -> dict:
    """返回 {"repos": [...], "error": str|None}"""
    try:
        all_repos = []
        page = 1
        while True:
            url = f"https://api.github.com/users/{username}/starred?per_page=100&page={page}"
            req = urllib.request.Request(url, headers={
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "GitHubStash",
            })
            with urllib.request.urlopen(req, timeout=20) as resp:
                data = json.loads(resp.read().decode())
            if not data:
                break
            all_repos.extend(data)
            if len(data) < 100:
                break
            page += 1

        results = []
        for repo in all_repos:
            lang = repo.get("language") or ""
            cat = _guess_category(lang, repo.get("topics", []), repo.get("description") or "")
            results.append({
                "name": repo["full_name"],
                "url": repo["html_url"],
                "description": repo.get("description") or "",
                "stars": repo.get("stargazers_count", 0),
                "language": lang,
                "category": cat,
                "tags": repo.get("topics", [])[:8],
                "already_saved": repo["html_url"].rstrip("/") in existing_urls,
            })
        return {"repos": results, "error": None}

    except urllib.error.HTTPError as e:
        if e.code == 404:
            return {"repos": [], "error": "用户不存在"}
        if e.code == 403:
            return {"repos": [], "error": "API 限速，请稍后再试"}
        return {"repos": [], "error": f"请求失败: {e.code}"}
    except Exception as e:
        return {"repos": [], "error": str(e)}


def _guess_category(lang: str, topics: list[str], desc: str) -> str:
    mapping = {
        "AI / 机器学习":   ["python", "jupyter notebook", "machine-learning", "deep-learning", "ai", "llm", "gpt", "neural", "pytorch", "tensorflow", "transformer", "nlp"],
        "Web 前端":        ["javascript", "typescript", "html", "css", "vue", "react", "angular", "svelte", "frontend", "ui", "nextjs"],
        "后端 / API":      ["go", "java", "kotlin", "c#", "php", "ruby", "scala", "api", "backend", "server", "graphql", "fastapi"],
        "DevOps / 工具链": ["docker", "kubernetes", "ci", "terraform", "ansible", "devops", "shell", "makefile", "github actions"],
        "数据科学":        ["r", "julia", "data", "analytics", "pandas", "numpy", "visualization", "jupyter"],
        "安全 / 逆向":     ["security", "hacking", "assembly", "reverse", "exploit", "ctf"],
        "游戏开发":        ["c#", "lua", "game", "unity", "unreal", "godot"],
        "移动开发":        ["swift", "dart", "flutter", "android", "ios", "mobile", "kotlin"],
        "系统 / 底层":     ["c", "c++", "rust", "kernel", "os", "embedded", "linux"],
    }
    t = " ".join(topics).lower() + " " + desc.lower()
    lang_lower = lang.lower()
    for cat, keywords in mapping.items():
        if lang_lower in keywords:
            return cat
        for kw in keywords:
            if kw in t:
                return cat
    return "其他"
