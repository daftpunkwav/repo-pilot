"""
笔记 API —— 项目内笔记 CRUD
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.models.note import Note
from backend.models.project import Project
from backend.schemas.common import DataResponse, ListResponse, OkResponse
from backend.schemas.note import NoteCreate, NoteOut, NoteUpdate

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("/projects/{project_id}/notes", response_model=ListResponse[NoteOut])
async def list_notes(
    project_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Note).where(Note.project_id == project_id))
    items = result.scalars().all()
    return ListResponse(data=[NoteOut.model_validate(n) for n in items], meta={"total": len(items), "page": 1, "page_size": len(items), "total_pages": 1})


@router.post("/projects/{project_id}/notes", response_model=DataResponse[NoteOut])
async def create_note(
    project_id: str,
    data: NoteCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = Note(user_id=current_user.id, project_id=project_id, **data.model_dump())
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return DataResponse(data=NoteOut.model_validate(note))


@router.put("/notes/{note_id}", response_model=DataResponse[NoteOut])
async def update_note(
    note_id: str,
    data: NoteUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await db.get(Note, note_id)
    if not note:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Note not found"})
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(note, key, value)
    await db.commit()
    await db.refresh(note)
    return DataResponse(data=NoteOut.model_validate(note))


@router.delete("/notes/{note_id}", response_model=OkResponse)
async def delete_note(
    note_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await db.get(Note, note_id)
    if not note:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail={"code": "NOT_FOUND", "message": "Note not found"})
    await db.delete(note)
    await db.commit()
    return OkResponse()
