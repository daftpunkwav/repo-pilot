"""
图谱业务逻辑 —— TF-IDF / 主题 / 语言 / 分类多信号相似度
"""
from __future__ import annotations

import math
import re
from collections import Counter
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.project import Project


_TOKEN_RE = re.compile(r"[A-Za-z0-9_+#.-]{2,}|[\u4e00-\u9fff]{1,}")


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


def _doc_vector(p: Project) -> dict[str, float]:
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
    return _tf(_tokenize(text))


async def build_graph(
    db: AsyncSession,
    user_id: UUID,
    *,
    min_similarity: float = 0.3,
    max_edges: int = 200,
) -> dict:
    result = await db.execute(select(Project).where(Project.user_id == user_id))
    projects = list(result.scalars().all())
    vectors = {p.id: _doc_vector(p) for p in projects}

    nodes = [
        {
            "id": str(p.id),
            "name": p.name,
            "language": p.language,
            "category_id": str(p.category_id) if p.category_id else None,
            "progress": p.progress,
            "stars": p.stars,
            "description": (p.description or "")[:160],
            "url": p.url,
        }
        for p in projects
    ]

    edges: list[dict] = []
    for i, a in enumerate(projects):
        for b in projects[i + 1 :]:
            sim, reasons = _similarity_detailed(a, b, vectors[a.id], vectors[b.id])
            if sim >= min_similarity:
                edges.append(
                    {
                        "source": str(a.id),
                        "target": str(b.id),
                        "similarity": round(sim, 3),
                        "relation": reasons[0] if reasons else "related",
                        "reasons": reasons,
                    }
                )
    edges.sort(key=lambda e: e["similarity"], reverse=True)
    return {
        "nodes": nodes,
        "edges": edges[:max_edges],
        "stats": {
            "node_count": len(nodes),
            "edge_count": min(len(edges), max_edges),
            "avg_similarity": round(
                sum(e["similarity"] for e in edges[:max_edges]) / max(len(edges[:max_edges]), 1),
                3,
            )
            if edges
            else 0.0,
        },
    }


def _similarity_detailed(
    a: Project,
    b: Project,
    va: dict[str, float],
    vb: dict[str, float],
) -> tuple[float, list[str]]:
    reasons: list[str] = []
    score = 0.0

    text_sim = _cosine(va, vb)
    if text_sim > 0.05:
        score += 0.45 * text_sim
        if text_sim >= 0.25:
            reasons.append("tfidf")

    if a.language and b.language and a.language == b.language:
        score += 0.25
        reasons.append("language")

    if a.category_id and b.category_id and a.category_id == b.category_id:
        score += 0.2
        reasons.append("category")

    # 名称 token 重叠
    name_a = set(_tokenize(a.name or ""))
    name_b = set(_tokenize(b.name or ""))
    if name_a and name_b:
        jacc = len(name_a & name_b) / len(name_a | name_b)
        if jacc > 0:
            score += 0.1 * jacc
            if jacc >= 0.3:
                reasons.append("name")

    return min(score, 1.0), reasons


def _similarity(a: Project, b: Project) -> float:
    sim, _ = _similarity_detailed(a, b, _doc_vector(a), _doc_vector(b))
    return sim
