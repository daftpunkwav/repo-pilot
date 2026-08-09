"""
图谱 API —— 项目关系图谱数据
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_db
from backend.core.responses import wrap_data
from backend.schemas.common import DataResponse
from backend.services.graph_service import build_graph

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/", response_model=DataResponse[dict])
async def get_graph(
    min_similarity: float = Query(0.3, ge=0, le=1),
    max_edges: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    graph = await build_graph(
        db,
        min_similarity=min_similarity,
        max_edges=max_edges,
    )
    return wrap_data(graph)
