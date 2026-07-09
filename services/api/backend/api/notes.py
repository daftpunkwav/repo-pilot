"""
笔记 API —— 项目内笔记 CRUD + 全量列表
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.deps import get_current_user, get_db
from backend.core.responses import wrap_data
from backend.models.note import Note
from backend.models.project import Project
from backend.models.user import User
from backend.schemas.common import DataResponse
from backend.schemas.note import NoteCreate, NoteOut, NoteUpdate

router = APIRouter(prefix="/notes", tags=["notes"])


async def _get_owned_project(
    db: AsyncSession, project_id: UUID, user_id: UUID
) -> Project:
    project = await db.get(Project, project_id)
    if not project or project.user_id != user_id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Project not found"},
        )
    return project


async def _get_owned_note(db: AsyncSession, note_id: UUID, user_id: UUID) -> Note:
    note = await db.get(Note, note_id)
    if not note or note.user_id != user_id:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Note not found"},
        )
    return note


@router.get("/", response_model=DataResponse[list[NoteOut]])
async def list_all_notes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Note).where(Note.user_id == current_user.id))
    items = [NoteOut.model_validate(n) for n in result.scalars().all()]
    return wrap_data(items)


@router.get("/projects/{project_id}/notes", response_model=DataResponse[list[NoteOut]])
async def list_notes(
    project_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_project(db, project_id, current_user.id)
    result = await db.execute(
        select(Note).where(Note.project_id == project_id, Note.user_id == current_user.id)
    )
    items = [NoteOut.model_validate(n) for n in result.scalars().all()]
    return wrap_data(items)


@router.get("/{note_id}", response_model=DataResponse[NoteOut])
async def get_note(
    note_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await _get_owned_note(db, note_id, current_user.id)
    return wrap_data(NoteOut.model_validate(note))


@router.post("/projects/{project_id}/notes", response_model=DataResponse[NoteOut])
async def create_note(
    project_id: UUID,
    data: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_owned_project(db, project_id, current_user.id)
    note = Note(user_id=current_user.id, project_id=project_id, **data.model_dump())
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return wrap_data(NoteOut.model_validate(note))


@router.put("/{note_id}", response_model=DataResponse[NoteOut])
async def update_note(
    note_id: UUID,
    data: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await _get_owned_note(db, note_id, current_user.id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(note, key, value)
    await db.commit()
    await db.refresh(note)
    return wrap_data(NoteOut.model_validate(note))


@router.delete("/{note_id}", response_model=DataResponse[dict])
async def delete_note(
    note_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    note = await _get_owned_note(db, note_id, current_user.id)
    await db.delete(note)
    await db.commit()
    return wrap_data({"success": True})
