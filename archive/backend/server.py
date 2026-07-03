"""
Flask API 服务 —— 所有后端路由
"""
import json, os, hashlib, secrets, time, functools
from flask import Flask, request, jsonify, send_from_directory, g
from .store import DataStore, UserStore, Project, PRESET_CATEGORIES, PROGRESS_OPTIONS
from .github_api import fetch_starred_repos
from .path_util import get_base_dir, get_resource_dir

DIR = get_resource_dir()
UI_DIR = os.path.join(DIR, "frontend")

store = DataStore()
user_store = UserStore()

SETTINGS_FILE = os.path.join(get_base_dir(), "data", "stash_settings.json")
REMEMBERED_FILE = os.path.join(get_base_dir(), "data", "remembered_sessions.json")
DEFAULT_SETTINGS = {
    "theme": "dark",
    "zoom": 1.0,
    "font_scale": 1.0,
}

# 会话令牌 -> user_id 映射（服务重启后失效）
sessions: dict[str, str] = {}

# 持久化令牌 -> {"user_id": ..., "username": ..., "created_at": ...}
remembered_sessions: dict[str, dict] = {}

def load_remembered():
    """加载持久化会话"""
    global remembered_sessions
    if os.path.exists(REMEMBERED_FILE):
        try:
            with open(REMEMBERED_FILE, "r", encoding="utf-8") as f:
                remembered_sessions = json.load(f)
        except:
            remembered_sessions = {}

def save_remembered():
    os.makedirs(os.path.dirname(REMEMBERED_FILE), exist_ok=True)
    with open(REMEMBERED_FILE, "w", encoding="utf-8") as f:
        json.dump(remembered_sessions, f, ensure_ascii=False, indent=2)

load_remembered()

def load_settings():
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return dict(DEFAULT_SETTINGS)

def save_settings(s):
    os.makedirs(os.path.dirname(SETTINGS_FILE), exist_ok=True)
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(s, f, ensure_ascii=False, indent=2)

def hash_password(password: str, salt: str = None) -> tuple[str, str]:
    """sha256 加盐哈希，返回 (hash, salt)"""
    if salt is None:
        salt = secrets.token_hex(16)
    h = hashlib.sha256((password + salt).encode("utf-8")).hexdigest()
    return h, salt

def require_auth(f):
    """鉴权装饰器"""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            token = request.args.get("token", "")
        if token in sessions:
            g.user_id = sessions[token]
            g.user = user_store.find_by_id(g.user_id)
        elif token in remembered_sessions:
            g.user_id = remembered_sessions[token]["user_id"]
            g.user = user_store.find_by_id(g.user_id)
        else:
            return jsonify({"error": "未登录"}), 401
        return f(*args, **kwargs)
    return wrapper

app = Flask(__name__)

# ── 认证 ──

@app.route("/api/register", methods=["POST"])
def api_register():
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    if len(username) < 2 or len(username) > 32:
        return jsonify({"error": "账号需 2-32 个字符"}), 400
    if len(password) < 4:
        return jsonify({"error": "密码至少 4 个字符"}), 400
    pwd_hash, salt = hash_password(password)
    github_accounts = data.get("github_accounts", [])
    u = user_store.create(username, pwd_hash, salt, github_accounts)
    if u is None:
        return jsonify({"error": "账号已存在"}), 409
    token = secrets.token_hex(32)
    sessions[token] = u.id
    return jsonify({"ok": True, "token": token, "user": u.to_dict()})


@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    remember_me = data.get("remember_me", False)
    u = user_store.find_by_username(username)
    if not u:
        return jsonify({"error": "账号不存在"}), 401
    h, _ = hash_password(password, u.salt)
    if h != u.password_hash:
        return jsonify({"error": "密码错误"}), 401
    token = secrets.token_hex(32)
    sessions[token] = u.id
    persistent_token = None
    if remember_me:
        persistent_token = secrets.token_hex(32)
        remembered_sessions[persistent_token] = {
            "user_id": u.id,
            "username": u.username,
            "created_at": time.time(),
        }
        save_remembered()
    return jsonify({
        "ok": True,
        "token": token,
        "persistent_token": persistent_token,
        "user": u.to_dict(),
    })


@app.route("/api/user")
@require_auth
def api_user():
    u = user_store.find_by_id(g.user_id)
    if not u:
        return jsonify({"error": "用户不存在"}), 404
    return jsonify(u.to_dict())


@app.route("/api/user/github", methods=["PUT"])
@require_auth
def api_add_github():
    data = request.json or {}
    email = data.get("email", "").strip()
    github_id = data.get("github_id", "").strip()
    if not email or not github_id:
        return jsonify({"error": "邮箱和 GitHub ID 不能为空"}), 400
    user_store.add_github_account(g.user_id, email, github_id)
    u = user_store.find_by_id(g.user_id)
    return jsonify({"ok": True, "github_accounts": u.github_accounts})


@app.route("/api/user/github", methods=["DELETE"])
@require_auth
def api_remove_github():
    data = request.json or {}
    github_id = data.get("github_id", "").strip()
    if not github_id:
        return jsonify({"error": "github_id 不能为空"}), 400
    user_store.remove_github_account(g.user_id, github_id)
    u = user_store.find_by_id(g.user_id)
    return jsonify({"ok": True, "github_accounts": u.github_accounts})


@app.route("/api/logout", methods=["POST"])
def api_logout():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if token in sessions:
        user_id = sessions[token]
        del sessions[token]
        # 同时清除该用户的所有持久化 token
        to_delete = [k for k, v in remembered_sessions.items() if v.get("user_id") == user_id]
        for k in to_delete:
            del remembered_sessions[k]
        if to_delete:
            save_remembered()
    return jsonify({"ok": True})


# ── 项目 CRUD ──

@app.route("/api/projects")
def api_projects():
    cat = request.args.get("category", "全部")
    kw = request.args.get("keyword", "").lower()
    lang = request.args.get("lang", "")
    star_min = request.args.get("star_min", type=int, default=0)
    star_max = request.args.get("star_max", type=int)
    sort = request.args.get("sort", "")
    progress = request.args.get("progress", "").strip()
    progress_list = [p for p in progress.split(",") if p in PROGRESS_OPTIONS] if progress else []
    results = []
    for idx, p in enumerate(store.projects):
        if cat != "全部" and p.category != cat:
            continue
        if kw:
            haystack = f"{p.name} {p.description} {p.category} {' '.join(p.tags)} {p.note} {p.language}".lower()
            if kw not in haystack:
                continue
        if lang and p.language.lower() != lang.lower():
            continue
        if p.stars < star_min:
            continue
        if star_max is not None and p.stars > star_max:
            continue
        if progress_list and p.progress not in progress_list:
            continue
        results.append({"index": idx, **p.__dict__})
    # 排序
    if sort == "stars_desc":
        results.sort(key=lambda x: x["stars"], reverse=True)
    elif sort == "stars_asc":
        results.sort(key=lambda x: x["stars"])
    elif sort == "name_asc":
        results.sort(key=lambda x: x["name"].lower())
    elif sort == "name_desc":
        results.sort(key=lambda x: x["name"].lower(), reverse=True)
    return jsonify(results)

@app.route("/api/projects/add", methods=["POST"])
def api_add():
    data = request.json or {}
    p = Project(
        name=data.get("name", ""),
        url=data.get("url", ""),
        description=data.get("description", ""),
        category=data.get("category", "其他"),
        tags=data.get("tags", []),
        note=data.get("note", ""),
        stars=data.get("stars", 0),
        language=data.get("language", ""),
    )
    ok = store.add(p)
    return jsonify({"ok": ok, "total": len(store.projects)})

@app.route("/api/projects/delete/<int:idx>", methods=["DELETE"])
def api_delete(idx):
    if 0 <= idx < len(store.projects):
        store.delete(idx)
        return jsonify({"ok": True})
    return jsonify({"ok": False}), 404

@app.route("/api/projects/update/<int:idx>", methods=["PUT"])
def api_update(idx):
    if 0 <= idx < len(store.projects):
        data = request.json or {}
        cur = store.projects[idx]
        p = Project(
            name=data.get("name", cur.name),
            url=data.get("url", cur.url),
            description=data.get("description", cur.description),
            category=data.get("category", cur.category),
            tags=data.get("tags", cur.tags),
            note=data.get("note", cur.note),
            stars=data.get("stars", cur.stars),
            language=data.get("language", cur.language),
            progress=data.get("progress", cur.progress),
        )
        store.update(idx, p)
        return jsonify({"ok": True})
    return jsonify({"ok": False}), 404


@app.route("/api/projects/<int:idx>/progress", methods=["PUT"])
def api_update_progress(idx):
    if 0 <= idx < len(store.projects):
        data = request.json or {}
        progress = data.get("progress", "none")
        if progress not in PROGRESS_OPTIONS:
            return jsonify({"error": "无效的进度值"}), 400
        store.update_progress(idx, progress)
        return jsonify({"ok": True, "progress": progress})
    return jsonify({"ok": False}), 404

@app.route("/api/projects/import", methods=["POST"])
def api_import_batch():
    data = request.json or {}
    items = data.get("items", [])
    added = 0
    for item in items:
        p = Project(
            name=item.get("name", ""),
            url=item.get("url", ""),
            description=item.get("description", ""),
            category=item.get("category", "其他"),
            tags=item.get("tags", []),
            stars=item.get("stars", 0),
            language=item.get("language", ""),
        )
        if store.add(p):
            added += 1
    return jsonify({"ok": True, "added": added})

# ── 分类 ──

@app.route("/api/categories")
def api_categories():
    return jsonify(store.all_categories)

@app.route("/api/categories/add", methods=["POST"])
def api_add_category():
    name = (request.json or {}).get("name", "").strip()
    if not name:
        return jsonify({"ok": False, "error": "名称不能为空"}), 400
    ok = store.add_category(name)
    if not ok:
        return jsonify({"ok": False, "error": "分类已存在"}), 409
    return jsonify({"ok": True})

@app.route("/api/categories/remove", methods=["POST"])
def api_remove_category():
    name = (request.json or {}).get("name", "").strip()
    if name in PRESET_CATEGORIES:
        return jsonify({"ok": False, "error": "不能删除预设分类"}), 403
    ok = store.remove_category(name)
    if not ok:
        return jsonify({"ok": False, "error": "分类不存在"}), 404
    return jsonify({"ok": True})

# ── 统计 ──

@app.route("/api/stats")
def api_stats():
    return jsonify(store.get_stats())

# ── 设置 ──

@app.route("/api/settings", methods=["GET", "POST"])
def api_settings():
    if request.method == "POST":
        s = request.json or {}
        save_settings(s)
        return jsonify({"ok": True})
    return jsonify(load_settings())

# ── GitHub ──

@app.route("/api/github/stars/<username>")
def api_github_stars(username):
    existing = {e.url.rstrip("/") for e in store.projects}
    result = fetch_starred_repos(username, existing)
    if result["error"]:
        return jsonify(result), 400
    return jsonify(result)


@app.route("/api/github/stars")
def api_github_stars_bound():
    """通过绑定的 GitHub 账号拉取 Star，优先使用请求中指定的 github_id"""
    github_id = request.args.get("github_id", "").strip()
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token and not github_id:
        return jsonify({"error": "请先登录并绑定 GitHub 账号"}), 400
    if token and token in sessions:
        u = user_store.find_by_id(sessions[token])
        if u and u.github_accounts:
            if github_id:
                matched = [a for a in u.github_accounts if a["github_id"] == github_id]
            else:
                matched = u.github_accounts[:1]
            if matched:
                existing = {e.url.rstrip("/") for e in store.projects}
                result = fetch_starred_repos(matched[0]["github_id"], existing)
                if result["error"]:
                    return jsonify(result), 400
                result["github_account"] = matched[0]
                return jsonify(result)
    return jsonify({"error": "未绑定 GitHub 账号，请在设置中绑定"}), 400

# ── 项目关系图谱 ──

@app.route("/graph-api")
@require_auth
def api_graph():
    projects = store.get_all_projects()
    if not projects:
        return jsonify({"nodes": [], "edges": []})

    import math

    # ── 分词：英文按空格 + 中文按字符 bigram，正确处理中英文混合 ──
    def tokenize(text):
        tokens = []
        for word in text.lower().split():
            has_cjk = any('\u4e00' <= c <= '\u9fff' for c in word)
            if has_cjk and len(word) >= 2:
                tokens.extend(word[i:i+2] for i in range(len(word) - 1))
            elif word:
                tokens.append(word)
        return tokens

    texts = []
    for p in projects:
        parts = [p.description or "", " ".join(p.tags or []), p.language or "", p.category or ""]
        texts.append(" ".join(parts))

    tokenized = [tokenize(t) for t in texts]

    # ── TF-IDF ──
    vocab = {}
    for tokens in tokenized:
        for tok in set(tokens):
            vocab[tok] = vocab.get(tok, 0) + 1
    vocab = {k: v for k, v in vocab.items() if v > 1}

    N = len(tokenized)
    idf = {}
    for word in vocab:
        df = sum(1 for tokens in tokenized if word in set(tokens))
        idf[word] = math.log(N / (df + 1)) + 1

    def tfidf_vector(tokens):
        vec = {}
        for tok in tokens:
            if tok in vocab:
                vec[tok] = vec.get(tok, 0) + 1
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1
        for k in vec:
            vec[k] = vec[k] / norm * idf.get(k, 0)
        return vec

    vectors = [tfidf_vector(t) for t in tokenized]

    def cosine(v1, v2):
        if not v1 or not v2:
            return 0.0
        common = set(v1) & set(v2)
        if not common:
            return 0.0
        dot = sum(v1[k] * v2[k] for k in common)
        mag1 = math.sqrt(sum(val * val for val in v1.values()))
        mag2 = math.sqrt(sum(val * val for val in v2.values()))
        if mag1 == 0 or mag2 == 0:
            return 0.0
        return dot / (mag1 * mag2)

    # ── 构建边 ──
    edges = []
    for i in range(len(projects)):
        for j in range(i + 1, len(projects)):
            sim = cosine(vectors[i], vectors[j])
            if projects[i].category and projects[i].category == projects[j].category:
                sim += 0.15
            if projects[i].language and projects[i].language == projects[j].language:
                sim += 0.08
            tags_i = set(t.lower() for t in (projects[i].tags or []))
            tags_j = set(t.lower() for t in (projects[j].tags or []))
            if tags_i and tags_j:
                overlap = len(tags_i & tags_j) / max(len(tags_i | tags_j), 1)
                sim += overlap * 0.12
            if sim > 0.15:
                edges.append({"source": i, "target": j, "weight": round(sim, 3)})

    nodes = []
    for i, p in enumerate(projects):
        nodes.append({
            "id": i,
            "name": p.name,
            "category": p.category or "未分类",
            "language": p.language or "",
            "stars": p.stars or 0,
            "progress": p.progress or "none",
            "desc": (p.description or "")[:120],
            "url": p.url or ""
        })

    return jsonify({"nodes": nodes, "edges": edges})


@app.route("/graph")
def graph_page():
    return send_from_directory(UI_DIR, "graph.html")

# ── 静态文件 & 首页 ──

@app.route("/")
def index():
    return send_from_directory(UI_DIR, "index.html")

@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(UI_DIR, filename)
