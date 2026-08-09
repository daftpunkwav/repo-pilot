"""
图谱业务逻辑 —— 多信号 pairwise / foundation / hubness / cluster

启发式先落地；节点可预留 foundation_score / cluster_id 供后续 LLM 覆盖。
"""
from __future__ import annotations

import math
import re
from collections import Counter, defaultdict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.project import Project, Tag, project_tags

# ---------------------------------------------------------------------------
# 可调权重（集中管理，避免魔法散落）
# ---------------------------------------------------------------------------
WEIGHTS = {
    "tfidf": 0.30,
    "language": 0.12,
    "category": 0.12,
    "tags": 0.10,
    "name": 0.08,
    "domain": 0.12,
    "role_complement": 0.08,
    "stars_proximity": 0.05,
    "sparse_penalty_floor": 0.35,  # 文本过稀时整体乘子下限
}

FOUNDATION_W = {
    "lexicon": 0.55,
    "stars": 0.20,
    "centrality": 0.25,
}

HUBNESS_W = {
    "weighted_degree": 0.55,
    "avg_edge": 0.20,
    "neighbor_ratio": 0.25,
}

CLUSTER_MERGE_MIN_SIM = 0.35
CLUSTER_MAX_MERGE_RATIO = 0.85

_TOKEN_RE = re.compile(r"[A-Za-z0-9_+#.-]{2,}|[\u4e00-\u9fff]{1,}")

# 领域 / 角色词表（小写匹配 token 或子串）
FOUNDATION_LEXICON = frozenset(
    {
        "engine",
        "framework",
        "runtime",
        "database",
        "db",
        "kernel",
        "sdk",
        "protocol",
        "language",
        "linux",
        "docker",
        "kubernetes",
        "k8s",
        "spring",
        "springboot",
        "dotnet",
        "langgraph",
        "langchain",
        "mcp",
        "mcp-server",
        "postgres",
        "postgresql",
        "mysql",
        "sqlite",
        "redis",
        "compiler",
        "vm",
        "interpreter",
        "stdlib",
        "standard",
        "core",
        "foundation",
        "infra",
        "infrastructure",
        "platform",
        "os",
        "browser",
        "godot",
        "unity",
        "unreal",
        "cocos",
        "react",
        "vue",
        "angular",
        "fastapi",
        "flask",
        "django",
        "express",
        "nginx",
        "apache",
        "openssl",
        "llvm",
        "wasm",
        "typescript",
        "python",
        "rust",
        "golang",
        "jvm",
        "node",
        "nodejs",
    }
)

APPLICATION_LEXICON = frozenset(
    {
        "game",
        "demo",
        "ecommerce",
        "e-commerce",
        "shop",
        "skill",
        "skills",
        "bot",
        "starter",
        "template",
        "boilerplate",
        "example",
        "examples",
        "tutorial",
        "playground",
        "clone",
        "app",
        "application",
        "cms",
        "blog",
        "chat",
        "agent-app",
        "wrapper",
        "plugin",
        "theme",
        "ui-kit",
        "dashboard",
        "admin",
        "saas",
    }
)

DOMAIN_LEXICON = frozenset(
    FOUNDATION_LEXICON
    | APPLICATION_LEXICON
    | {
        "ai",
        "llm",
        "agent",
        "agents",
        "mcp",
        "frontend",
        "backend",
        "devops",
        "ml",
        "nlp",
        "graph",
        "viz",
        "visualization",
        "gamedev",
        "graphics",
        "webgl",
        "three",
        "d3",
        "auth",
        "oauth",
        "api",
        "http",
        "async",
        "queue",
        "cache",
        "search",
        "vector",
        "embedding",
        "rag",
        "codex",
        "claude",
        "opencode",
    }
)


def _tokenize(text: str) -> list[str]:
    if not text:
        return []
    return [t.lower() for t in _TOKEN_RE.findall(text)]


def _tf(tokens: list[str]) -> dict[str, float]:
    if not tokens:
        return {}
    c = Counter(tokens)
    n = len(tokens)
    return {k: v / n for k, v in c.items()}


def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    keys = set(a) | set(b)
    dot = sum(a.get(k, 0.0) * b.get(k, 0.0) for k in keys)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def _doc_tokens(p: Project) -> list[str]:
    text = " ".join(
        filter(
            None,
            [
                p.name or "",
                p.description or "",
                p.language or "",
                p.note or "",
            ],
        )
    )
    return _tokenize(text)


def _doc_vector(p: Project) -> dict[str, float]:
    """兼容旧测试：纯 TF 向量。"""
    return _tf(_doc_tokens(p))


def _build_idf(docs: list[list[str]]) -> dict[str, float]:
    n = len(docs)
    if n == 0:
        return {}
    df: Counter[str] = Counter()
    for toks in docs:
        df.update(set(toks))
    return {t: math.log((n + 1) / (df_t + 1)) + 1.0 for t, df_t in df.items()}


def _tfidf(tokens: list[str], idf: dict[str, float]) -> dict[str, float]:
    if not tokens:
        return {}
    tf = _tf(tokens)
    return {k: v * idf.get(k, 1.0) for k, v in tf.items()}


def _lexicon_hits(tokens: list[str], lexicon: frozenset[str]) -> set[str]:
    hits: set[str] = set()
    joined = " ".join(tokens)
    for w in lexicon:
        if w in tokens or (len(w) >= 3 and w in joined):
            hits.add(w)
    return hits


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    inter = len(a & b)
    if inter == 0:
        return 0.0
    return inter / len(a | b)


def _stars_proximity(sa: int, sb: int) -> float:
    cap = 12.0
    diff = abs(math.log1p(max(0, sa)) - math.log1p(max(0, sb)))
    return max(0.0, 1.0 - diff / cap)


def _sparse_multiplier(
    tokens_a: list[str],
    tokens_b: list[str],
    *,
    text_sim: float,
) -> float:
    """描述过稀时衰减；高文本相似时不惩罚（避免短但同义文档被压分）。"""
    if text_sim >= 0.75:
        return 1.0
    n = min(len(tokens_a), len(tokens_b))
    if n >= 8:
        return 1.0
    if n == 0:
        return WEIGHTS["sparse_penalty_floor"]
    t = n / 8.0
    floor = WEIGHTS["sparse_penalty_floor"]
    return floor + (1.0 - floor) * t


def _project_tags_map(
    tag_rows: list[tuple[UUID, str]],
) -> dict[UUID, set[str]]:
    out: dict[UUID, set[str]] = defaultdict(set)
    for pid, name in tag_rows:
        if name:
            out[pid].add(name.lower())
    return out


def _similarity_detailed(
    a: Project,
    b: Project,
    va: dict[str, float],
    vb: dict[str, float],
    *,
    tags_a: set[str] | None = None,
    tags_b: set[str] | None = None,
    tokens_a: list[str] | None = None,
    tokens_b: list[str] | None = None,
) -> tuple[float, list[str]]:
    reasons: list[str] = []
    score = 0.0
    ta = tokens_a if tokens_a is not None else _doc_tokens(a)
    tb = tokens_b if tokens_b is not None else _doc_tokens(b)

    text_sim = _cosine(va, vb)
    if text_sim > 0.05:
        score += WEIGHTS["tfidf"] * text_sim
        if text_sim >= 0.2:
            reasons.append("tfidf")

    if a.language and b.language and a.language == b.language:
        score += WEIGHTS["language"]
        reasons.append("language")

    if a.category_id and b.category_id and a.category_id == b.category_id:
        score += WEIGHTS["category"]
        reasons.append("category")

    sa_tags = tags_a or set()
    sb_tags = tags_b or set()
    tag_j = _jaccard(sa_tags, sb_tags)
    if tag_j > 0:
        score += WEIGHTS["tags"] * tag_j
        if tag_j >= 0.25:
            reasons.append("tags")

    name_a = set(_tokenize(a.name or ""))
    name_b = set(_tokenize(b.name or ""))
    name_j = _jaccard(name_a, name_b)
    if name_j > 0:
        score += WEIGHTS["name"] * name_j
        if name_j >= 0.3:
            reasons.append("name")

    dom_a = _lexicon_hits(ta, DOMAIN_LEXICON)
    dom_b = _lexicon_hits(tb, DOMAIN_LEXICON)
    dom_j = _jaccard(dom_a, dom_b)
    if dom_j > 0:
        score += WEIGHTS["domain"] * dom_j
        if dom_j >= 0.2:
            reasons.append("domain")

    found_a = _lexicon_hits(ta, FOUNDATION_LEXICON)
    found_b = _lexicon_hits(tb, FOUNDATION_LEXICON)
    app_a = _lexicon_hits(ta, APPLICATION_LEXICON)
    app_b = _lexicon_hits(tb, APPLICATION_LEXICON)
    # 一方偏基础、一方偏应用，且有领域重叠 → 互补加成（引擎↔游戏同球）
    role_pair = (bool(found_a) and bool(app_b)) or (bool(found_b) and bool(app_a))
    if role_pair and dom_j > 0:
        score += WEIGHTS["role_complement"] * min(1.0, 0.5 + dom_j)
        reasons.append("role_complement")

    has_content = bool(
        (a.name or a.description or a.note or a.language)
        and (b.name or b.description or b.note or b.language)
    )
    stars_p = _stars_proximity(a.stars or 0, b.stars or 0)
    if has_content and stars_p > 0.4 and score > 0:
        score += WEIGHTS["stars_proximity"] * stars_p
        if stars_p >= 0.7:
            reasons.append("stars")

    if score > 0:
        score *= _sparse_multiplier(ta, tb, text_sim=text_sim)
    return min(score, 1.0), reasons


def _similarity(a: Project, b: Project) -> float:
    toks_a, toks_b = _doc_tokens(a), _doc_tokens(b)
    idf = _build_idf([toks_a, toks_b])
    sim, _ = _similarity_detailed(
        a,
        b,
        _tfidf(toks_a, idf),
        _tfidf(toks_b, idf),
        tokens_a=toks_a,
        tokens_b=toks_b,
    )
    return sim


def _lexicon_foundation_raw(tokens: list[str]) -> float:
    f = len(_lexicon_hits(tokens, FOUNDATION_LEXICON))
    a = len(_lexicon_hits(tokens, APPLICATION_LEXICON))
    if f == 0 and a == 0:
        return 0.35  # 中性偏应用侧略低
    # foundation 拉高、application 压低
    raw = (f * 1.0 - a * 0.85) / max(1.0, f + a)
    return max(0.0, min(1.0, 0.5 + 0.5 * raw))


def _compute_foundation(
    p: Project,
    tokens: list[str],
    centrality: float,
    override: float | None = None,
) -> float:
    if override is not None:
        return max(0.0, min(1.0, override))
    lex = _lexicon_foundation_raw(tokens)
    stars_n = min(1.0, math.log1p(p.stars or 0) / math.log1p(200_000))
    score = (
        FOUNDATION_W["lexicon"] * lex
        + FOUNDATION_W["stars"] * stars_n
        + FOUNDATION_W["centrality"] * centrality
    )
    return max(0.0, min(1.0, score))


def _compute_hubness(
    weighted_degree: float,
    avg_edge: float,
    neighbor_ratio: float,
) -> float:
    score = (
        HUBNESS_W["weighted_degree"] * weighted_degree
        + HUBNESS_W["avg_edge"] * avg_edge
        + HUBNESS_W["neighbor_ratio"] * neighbor_ratio
    )
    return max(0.0, min(1.0, score))


def _cluster_communities(
    node_ids: list[str],
    edges: list[dict],
) -> dict[str, str]:
    """阈值并查集：高相似度优先合并。"""
    parent = {nid: nid for nid in node_ids}

    def find(x: str) -> str:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: str, b: str) -> bool:
        ra, rb = find(a), find(b)
        if ra == rb:
            return False
        if ra < rb:
            parent[rb] = ra
        else:
            parent[ra] = rb
        return True

    sorted_edges = sorted(edges, key=lambda e: e["similarity"], reverse=True)
    max_merge = max(1, int(len(node_ids) * CLUSTER_MAX_MERGE_RATIO))
    merges = 0
    for e in sorted_edges:
        if e["similarity"] < CLUSTER_MERGE_MIN_SIM:
            break
        if merges >= max_merge:
            break
        if union(e["source"], e["target"]):
            merges += 1

    return {nid: find(nid) for nid in node_ids}


async def _load_project_tags(
    db: AsyncSession, project_ids: list[UUID]
) -> dict[UUID, set[str]]:
    if not project_ids:
        return {}
    q = (
        select(project_tags.c.project_id, Tag.name)
        .join(Tag, Tag.id == project_tags.c.tag_id)
        .where(project_tags.c.project_id.in_(project_ids))
    )
    result = await db.execute(q)
    return _project_tags_map([(row[0], row[1]) for row in result.all()])


async def build_graph(
    db: AsyncSession,
    *,
    min_similarity: float = 0.3,
    max_edges: int = 200,
) -> dict:
    result = await db.execute(select(Project))
    projects = list(result.scalars().all())
    tag_map = await _load_project_tags(db, [p.id for p in projects])

    token_map = {p.id: _doc_tokens(p) for p in projects}
    idf = _build_idf(list(token_map.values()))
    vectors = {p.id: _tfidf(token_map[p.id], idf) for p in projects}

    # 全量 pairwise（社区 / hubness 用），再按阈值截断返回边
    all_edges: list[dict] = []
    for i, a in enumerate(projects):
        for b in projects[i + 1 :]:
            sim, reasons = _similarity_detailed(
                a,
                b,
                vectors[a.id],
                vectors[b.id],
                tags_a=tag_map.get(a.id, set()),
                tags_b=tag_map.get(b.id, set()),
                tokens_a=token_map[a.id],
                tokens_b=token_map[b.id],
            )
            if sim >= min_similarity:
                all_edges.append(
                    {
                        "source": str(a.id),
                        "target": str(b.id),
                        "similarity": round(sim, 3),
                        "relation": reasons[0] if reasons else "similarity",
                        "reasons": reasons or ["similarity"],
                        "edge_type": "similarity",
                    }
                )

    all_edges.sort(key=lambda e: e["similarity"], reverse=True)

    # 加权度（全量过阈边）
    wdeg: dict[str, float] = defaultdict(float)
    neigh: dict[str, set[str]] = defaultdict(set)
    for e in all_edges:
        s, t, w = e["source"], e["target"], e["similarity"]
        wdeg[s] += w
        wdeg[t] += w
        neigh[s].add(t)
        neigh[t].add(s)

    max_wdeg = max(wdeg.values()) if wdeg else 1.0
    n_nodes = max(len(projects), 1)

    # 归一中心性 → foundation / hubness
    centrality = {str(p.id): (wdeg[str(p.id)] / max_wdeg if max_wdeg else 0.0) for p in projects}

    # 预留覆盖：ORM 若将来有 foundation_score_override / cluster_id_override 则读取
    foundations: dict[str, float] = {}
    for p in projects:
        pid = str(p.id)
        override = getattr(p, "foundation_score_override", None)
        foundations[pid] = round(
            _compute_foundation(p, token_map[p.id], centrality[pid], override),
            3,
        )

    hubness: dict[str, float] = {}
    for p in projects:
        pid = str(p.id)
        nbrs = neigh.get(pid, set())
        avg_e = (wdeg[pid] / len(nbrs)) if nbrs else 0.0
        hubness[pid] = round(
            _compute_hubness(
                centrality[pid],
                min(1.0, avg_e),
                len(nbrs) / n_nodes,
            ),
            3,
        )

    node_ids = [str(p.id) for p in projects]
    # 社区用全量边；若节点有 cluster_id_override 则优先
    communities = _cluster_communities(node_ids, all_edges)
    for p in projects:
        ov = getattr(p, "cluster_id_override", None)
        if ov:
            communities[str(p.id)] = str(ov)

    cluster_sizes: Counter[str] = Counter(communities.values())

    nodes = []
    for p in projects:
        pid = str(p.id)
        cid = communities.get(pid, pid)
        nodes.append(
            {
                "id": pid,
                "name": p.name,
                "language": p.language,
                "category_id": str(p.category_id) if p.category_id else None,
                "progress": p.progress,
                "stars": p.stars,
                "description": (p.description or "")[:160],
                "url": p.url,
                "foundation_score": foundations[pid],
                "hubness": hubness[pid],
                "cluster_id": cid,
                "cluster_size": cluster_sizes[cid],
            }
        )

    edges = all_edges[:max_edges]
    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "node_count": len(nodes),
            "edge_count": len(edges),
            "avg_similarity": round(
                sum(e["similarity"] for e in edges) / max(len(edges), 1),
                3,
            )
            if edges
            else 0.0,
        },
    }


async def build_cross_edges(db: AsyncSession) -> list[dict]:
    """从已 READY 项目跑/读取跨仓边；引擎不可用时返回空列表（不影响 L0 相似度）。"""
    from backend.models.graph_index import GraphIndexStatus
    from backend.services.rp_graph_client import RpGraphClient, RpGraphError

    result = await db.execute(
        select(GraphIndexStatus).where(GraphIndexStatus.status == "READY")
    )
    rows = list(result.scalars().all())
    if len(rows) < 2:
        return []

    engine_to_project = {
        r.engine_project: str(r.project_id) for r in rows if r.engine_project
    }
    names = list(engine_to_project.keys())
    client = RpGraphClient()
    if not await client.health():
        return []

    first_path = next((r.local_path for r in rows if r.local_path), ".") or "."
    try:
        raw = await client.index_repository(
            first_path,
            mode="cross-repo-intelligence",
            target_projects=names,
        )
    except RpGraphError:
        return []

    edges: list[dict] = []
    raw_edges = raw.get("edges") if isinstance(raw, dict) else None
    if not isinstance(raw_edges, list):
        try:
            raw_edges = await client.list_cross_edges()
        except Exception:
            raw_edges = []

    for row in raw_edges or []:
        if not isinstance(row, dict):
            continue
        src_e = str(row.get("source_engine") or "")
        dst_e = str(row.get("target_engine") or "")
        rel = str(row.get("type") or row.get("relation") or "CROSS_SHARED_SYMBOL")
        relation = "cross_shared"
        if "HTTP" in rel:
            relation = "cross_http"
        elif "ASYNC" in rel:
            relation = "cross_async"
        elif "CHANNEL" in rel:
            relation = "cross_channel"
        edges.append(
            {
                "source": engine_to_project.get(src_e, src_e),
                "target": engine_to_project.get(dst_e, dst_e),
                "source_engine": src_e,
                "target_engine": dst_e,
                "relation": relation,
                "weight": float(row.get("weight") or 1.0),
                "reasons": [
                    rel,
                    str(row.get("source_symbol") or ""),
                    str(row.get("target_symbol") or ""),
                ],
                "source_symbol": row.get("source_symbol"),
                "target_symbol": row.get("target_symbol"),
                "similarity": 1.0,
            }
        )
    return edges
