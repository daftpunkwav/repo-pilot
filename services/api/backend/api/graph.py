"""
图谱 API —— 项目关系图谱数据
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.models.project import Project

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/")
async def get_graph(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.user_id == current_user.id))
    projects = result.scalars().all()
    nodes = [{"id": str(p.id), "name": p.name, "language": p.language, "category": p.category} for p in projects]
    edges = []
    return {"nodes": nodes, "edges": edges}
