"""
图谱 API —— 项目关系图谱数据
"""
from fastapi import APIRouter, Depends, Query

from backend.api.deps import get_current_user, get_db
from backend.core.responses import wrap_data
from backend.models.user import User
from backend.schemas.common import DataResponse
from backend.services.graph_service import build_graph
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/", response_model=DataResponse[dict])
async def get_graph(
    min_similarity: float = Query(0.3, ge=0, le=1),
    max_edges: int = Query(200, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    graph = await build_graph(
        db,
        current_user.id,
        min_similarity=min_similarity,
        max_edges=max_edges,
    )
    return wrap_data(graph)
