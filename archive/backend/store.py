"""
数据持久层 —— Project 模型 & DataStore & UserStore
"""
import json, os, uuid, time
from dataclasses import dataclass, field, asdict
from .path_util import get_base_dir

DATA_DIR = os.path.join(get_base_dir(), "data")
DATA_FILE = os.path.join(DATA_DIR, "stash_data.json")
USERS_FILE = os.path.join(DATA_DIR, "stash_users.json")

PRESET_CATEGORIES = [
    "AI / 机器学习", "Web 前端", "后端 / API", "DevOps / 工具链",
    "数据科学", "安全 / 逆向", "游戏开发", "移动开发", "系统 / 底层", "其他",
]

PROGRESS_OPTIONS = ["none", "learning", "learned", "mastered"]
PROGRESS_LABELS = {"none": "未学习", "learning": "正在学习", "learned": "已经学习", "mastered": "熟练掌握"}

@dataclass
class Project:
    name: str
    url: str
    description: str = ""
    category: str = "其他"
    tags: list[str] = field(default_factory=list)
    note: str = ""
    stars: int = 0
    language: str = ""
    progress: str = "none"


@dataclass
class User:
    id: str
    username: str
    password_hash: str
    salt: str
    github_accounts: list[dict] = field(default_factory=list)
    created_at: float = 0.0

    def to_dict(self, include_hash=False):
        d = {
            "id": self.id,
            "username": self.username,
            "github_accounts": self.github_accounts,
            "created_at": self.created_at,
        }
        if include_hash:
            d["password_hash"] = self.password_hash
            d["salt"] = self.salt
        return d


class DataStore:
    def __init__(self, path: str = DATA_FILE):
        self.path = path
        self.projects: list[Project] = []
        self.custom_categories: list[str] = []
        self.load()

    def load(self):
        if os.path.exists(self.path):
            with open(self.path, "r", encoding="utf-8") as f:
                data = json.load(f)
            raw_projects = data.get("projects", [])
            valid_fields = set(Project.__dataclass_fields__.keys())
            self.projects = [
                Project(**{k: v for k, v in d.items() if k in valid_fields})
                for d in raw_projects
            ]
            self.custom_categories = data.get("custom_categories", [])
        else:
            self.projects = []
            self.custom_categories = []

    def save(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump({
                "projects": [asdict(p) for p in self.projects],
                "custom_categories": self.custom_categories,
            }, f, ensure_ascii=False, indent=2)

    @property
    def all_categories(self) -> list[str]:
        return PRESET_CATEGORIES + self.custom_categories

    def add_category(self, name: str) -> bool:
        if name in PRESET_CATEGORIES or name in self.custom_categories:
            return False
        self.custom_categories.append(name)
        self.save()
        return True

    def remove_category(self, name: str) -> bool:
        if name in PRESET_CATEGORIES:
            return False
        if name in self.custom_categories:
            self.custom_categories.remove(name)
            for p in self.projects:
                if p.category == name:
                    p.category = "其他"
            self.save()
            return True
        return False

    def get_stats(self) -> dict:
        cats = {}
        lang_count = {}
        progress_count = {}
        for p in self.projects:
            cats[p.category] = cats.get(p.category, 0) + 1
            if p.language:
                lang_count[p.language] = lang_count.get(p.language, 0) + 1
            progress_count[p.progress] = progress_count.get(p.progress, 0) + 1
        return {
            "total": len(self.projects),
            "categories": cats,
            "languages": lang_count,
            "progress": progress_count,
        }

    def add(self, p: Project) -> bool:
        if any(e.url.rstrip("/") == p.url.rstrip("/") for e in self.projects):
            return False
        self.projects.append(p)
        self.save()
        return True

    def delete(self, index: int):
        del self.projects[index]
        self.save()

    def update(self, index: int, p: Project):
        self.projects[index] = p
        self.save()

    def update_progress(self, index: int, progress: str):
        if progress in PROGRESS_OPTIONS:
            self.projects[index].progress = progress
            self.save()
            return True
        return False

    def get_all_projects(self) -> list[Project]:
        return self.projects

    def import_batch(self, projects: list[Project]) -> int:
        added = 0
        existing_urls = {e.url.rstrip("/") for e in self.projects}
        for p in projects:
            if p.url.rstrip("/") not in existing_urls:
                self.projects.append(p)
                existing_urls.add(p.url.rstrip("/"))
                added += 1
        if added:
            self.save()
        return added


class UserStore:
    def __init__(self, path: str = USERS_FILE):
        self.path = path
        self.users: list[User] = []
        self.load()

    def load(self):
        if os.path.exists(self.path):
            with open(self.path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.users = [User(**u) for u in data.get("users", [])]
        else:
            self.users = []

    def save(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump({
                "users": [u.to_dict(include_hash=True) for u in self.users],
            }, f, ensure_ascii=False, indent=2)

    def find_by_username(self, username: str):
        for u in self.users:
            if u.username == username:
                return u
        return None

    def find_by_id(self, user_id: str):
        for u in self.users:
            if u.id == user_id:
                return u
        return None

    def create(self, username: str, password_hash: str, salt: str, github_accounts: list[dict] = None):
        if self.find_by_username(username):
            return None
        u = User(
            id=str(uuid.uuid4()),
            username=username,
            password_hash=password_hash,
            salt=salt,
            github_accounts=github_accounts or [],
            created_at=time.time(),
        )
        self.users.append(u)
        self.save()
        return u

    def add_github_account(self, user_id: str, email: str, github_id: str):
        u = self.find_by_id(user_id)
        if not u:
            return False
        existing = [a for a in u.github_accounts if a.get("github_id") == github_id]
        if existing:
            existing[0]["email"] = email
        else:
            u.github_accounts.append({"email": email, "github_id": github_id})
        self.save()
        return True

    def remove_github_account(self, user_id: str, github_id: str):
        u = self.find_by_id(user_id)
        if not u:
            return False
        u.github_accounts = [a for a in u.github_accounts if a.get("github_id") != github_id]
        self.save()
        return True
