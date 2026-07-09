"""
图谱业务逻辑
"""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.project import Project


async def build_graph(
    db: AsyncSession,
    user_id: UUID,
    *,
    min_similarity: float = 0.3,
    max_edges: int = 200,
) -> dict:
    result = await db.execute(select(Project).where(Project.user_id == user_id))
    projects = list(result.scalars().all())
    nodes = [
        {
            "id": str(p.id),
            "name": p.name,
            "language": p.language,
            "category_id": str(p.category_id) if p.category_id else None,
            "progress": p.progress,
            "stars": p.stars,
        }
        for p in projects
    ]
    edges: list[dict] = []
    for i, a in enumerate(projects):
        for b in projects[i + 1 :]:
            sim = _similarity(a, b)
            if sim >= min_similarity:
                edges.append(
                    {
                        "source": str(a.id),
                        "target": str(b.id),
                        "similarity": round(sim, 3),
                    }
                )
    edges.sort(key=lambda e: e["similarity"], reverse=True)
    return {"nodes": nodes, "edges": edges[:max_edges]}


def _similarity(a: Project, b: Project) -> float:
    score = 0.0
    if a.language and b.language and a.language == b.language:
        score += 0.6
    if a.category_id and b.category_id and a.category_id == b.category_id:
        score += 0.4
    return min(score, 1.0)
