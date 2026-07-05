"""
Agent API —— 对话、分析、反问、会话管理
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/chat")
async def chat(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # TODO: 接入 Hub + ReAct + SSE
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, detail={"code": "NOT_IMPLEMENTED", "message": "Agent chat is not implemented yet"})


@router.post("/question")
async def question(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, detail={"code": "NOT_IMPLEMENTED", "message": "Agent question is not implemented yet"})


@router.post("/analyze/{project_id}")
async def analyze(
    project_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, detail={"code": "NOT_IMPLEMENTED", "message": "Agent analyze is not implemented yet"})
