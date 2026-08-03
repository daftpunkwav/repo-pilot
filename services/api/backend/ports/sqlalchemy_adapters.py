"""ToolPorts 的 SQLAlchemy 适配器。"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.agent import AgentSession
from backend.models.category import Category
from backend.models.note import Note
from backend.models.project import Project, Tag
from backend.ports import (
    CategoryPort,
    GraphPort,
    NotePort,
    ProjectPort,
    SessionPort,
    TagPort,
    ToolPorts,
)


@dataclass
class SqlAlchemyProjectPort:
    db: AsyncSession

    async def get_owned(self, project_id: UUID, user_id: UUID) -> Project | None:
        p = await self.db.get(Project, project_id)
        if not p or p.user_id != user_id:
            return None
        return p

    async def get_by_name(self, user_id: UUID, name: str) -> Project | None:
        rows = await self.db.execute(
            select(Project)
            .where(Project.user_id == user_id, Project.name == name)
            .limit(1)
        )
        return rows.scalars().first()

    async def list_for_user(self, user_id: UUID, *, limit: int = 50) -> list[Project]:
        rows = await self.db.execute(
            select(Project)
            .where(Project.user_id == user_id)
            .order_by(Project.updated_at.desc())
            .limit(limit)
        )
        return list(rows.scalars().all())

    async def search(
        self,
        user_id: UUID,
        *,
        query: str = "",
        language: str = "",
        progress: str = "",
        limit: int = 50,
    ) -> list[Project]:
        stmt = select(Project).where(Project.user_id == user_id)
        if query:
            like = f"%{query}%"
            stmt = stmt.where(
                or_(Project.name.ilike(like), Project.description.ilike(like))
            )
        if language:
            stmt = stmt.where(Project.language == language)
        if progress:
            stmt = stmt.where(Project.progress == progress)
        stmt = stmt.limit(min(limit or 50, 50))
        rows = await self.db.execute(stmt)
        return list(rows.scalars().all())

    async def update_fields(self, project: Project, **fields: Any) -> Project:
        for k, v in fields.items():
            if hasattr(project, k):
                setattr(project, k, v)
        await self.db.flush()
        return project

    async def import_repos(self, user_id: UUID, items: list[Any]) -> Any:
        from backend.services.project_service import import_repos

        return await import_repos(self.db, user_id, items)


@dataclass
class SqlAlchemyNotePort:
    db: AsyncSession

    async def create(
        self,
        *,
        user_id: UUID,
        project_id: UUID | None,
        title: str,
        content: str,
    ) -> Note:
        if project_id is None:
            raise ValueError("project_id required")
        note = Note(
            user_id=user_id,
            project_id=project_id,
            title=title,
            content=content,
        )
        self.db.add(note)
        await self.db.flush()
        await self.db.refresh(note)
        return note

    async def update(self, note_id: UUID, user_id: UUID, **fields: Any) -> Note | None:
        note = await self.db.get(Note, note_id)
        if not note or note.user_id != user_id:
            return None
        for k, v in fields.items():
            if hasattr(note, k):
                setattr(note, k, v)
        await self.db.flush()
        await self.db.refresh(note)
        return note

    async def list_for_project(
        self, user_id: UUID, project_id: UUID, *, limit: int = 20
    ) -> list[Note]:
        return await self.list_for_user(
            user_id, project_id=project_id, limit=limit
        )

    async def list_for_user(
        self,
        user_id: UUID,
        *,
        project_id: UUID | None = None,
        limit: int = 30,
    ) -> list[Note]:
        stmt = select(Note).where(Note.user_id == user_id)
        if project_id is not None:
            stmt = stmt.where(Note.project_id == project_id)
        stmt = stmt.order_by(Note.updated_at.desc()).limit(limit)
        rows = await self.db.execute(stmt)
        return list(rows.scalars().all())

    async def count_for_user(self, user_id: UUID) -> int:
        from sqlalchemy import func

        result = await self.db.execute(
            select(func.count()).select_from(Note).where(Note.user_id == user_id)
        )
        return int(result.scalar_one() or 0)


@dataclass
class SqlAlchemyCategoryPort:
    db: AsyncSession

    async def list_visible(self, user_id: UUID) -> list[Category]:
        rows = await self.db.execute(
            select(Category).where(
                or_(Category.is_preset.is_(True), Category.user_id == user_id)
            )
        )
        return list(rows.scalars().all())

    async def get_visible(self, user_id: UUID, category_id: UUID) -> Category | None:
        cat = await self.db.get(Category, category_id)
        if not cat:
            return None
        if cat.is_preset:
            return cat
        if cat.user_id and cat.user_id != user_id:
            return None
        return cat

    async def ensure(
        self,
        user_id: UUID,
        name: str,
        *,
        icon: str | None = None,
        color: str | None = None,
    ) -> tuple[Category, bool]:
        name_s = (name or "").strip()[:64]
        rows = await self.db.execute(
            select(Category).where(
                Category.name == name_s,
                or_(Category.is_preset.is_(True), Category.user_id == user_id),
            )
        )
        existing = rows.scalars().first()
        if existing:
            return existing, False
        cat = Category(
            user_id=user_id,
            name=name_s,
            icon=icon or None,
            color=color or None,
            is_preset=False,
        )
        self.db.add(cat)
        await self.db.flush()
        await self.db.refresh(cat)
        return cat, True


@dataclass
class SqlAlchemyTagPort:
    db: AsyncSession

    async def list_for_user(self, user_id: UUID) -> list[Tag]:
        rows = await self.db.execute(select(Tag).where(Tag.user_id == user_id))
        return list(rows.scalars().all())

    async def list_with_counts(self, user_id: UUID) -> list[Any]:
        from backend.services.tag_service import list_user_tags

        return await list_user_tags(self.db, user_id)

    async def ensure_many(self, user_id: UUID, names: list[str]) -> list[Tag]:
        out: list[Tag] = []
        for name in names:
            n = (name or "").strip()[:64]
            if not n:
                continue
            rows = await self.db.execute(
                select(Tag).where(Tag.user_id == user_id, Tag.name == n)
            )
            tag = rows.scalars().first()
            if not tag:
                tag = Tag(user_id=user_id, name=n)
                self.db.add(tag)
                await self.db.flush()
            out.append(tag)
        return out

    async def validate_owned_ids(
        self, user_id: UUID, tag_ids: list[UUID]
    ) -> list[UUID]:
        if not tag_ids:
            return []
        owned = await self.db.execute(
            select(Tag.id).where(Tag.user_id == user_id, Tag.id.in_(tag_ids))
        )
        valid = {row[0] for row in owned.all()}
        return [tid for tid in tag_ids if tid in valid]

    async def get_project_tag_ids(self, project_id: UUID) -> list[UUID]:
        from backend.services.tag_service import get_project_tag_ids

        raw = await get_project_tag_ids(self.db, project_id)
        return [UUID(s) for s in raw]

    async def set_on_project(
        self, user_id: UUID, project_id: UUID, tag_ids: list[UUID]
    ) -> Any | None:
        from backend.services.tag_service import set_project_tags

        return await set_project_tags(self.db, user_id, project_id, tag_ids)


@dataclass
class SqlAlchemySessionPort:
    db: AsyncSession

    async def get_owned(self, session_id: UUID, user_id: UUID) -> AgentSession | None:
        session = await self.db.get(AgentSession, session_id)
        if not session or session.user_id != user_id:
            return None
        return session

    async def mutate_projects(
        self,
        session: AgentSession,
        user_id: UUID,
        action: str,
        project_ids: list[UUID],
    ) -> list[UUID]:
        from backend.services.agent_service import (
            add_session_project,
            get_session_project_ids,
            remove_session_project,
            set_session_projects,
        )

        act = (action or "add").strip().lower()
        if act == "set":
            return await set_session_projects(
                self.db, session, project_ids, user_id=user_id
            )
        if act == "remove":
            ids: list[UUID] = []
            for pid in project_ids:
                ids = await remove_session_project(
                    self.db, session, pid, user_id=user_id
                )
            if not project_ids:
                ids = await get_session_project_ids(self.db, session.id)
            return ids
        ids = []
        for pid in project_ids:
            ids = await add_session_project(
                self.db, session, pid, user_id=user_id
            )
        if not project_ids:
            ids = await get_session_project_ids(self.db, session.id)
        return ids


@dataclass
class SqlAlchemyGraphPort:
    db: AsyncSession

    async def build(
        self,
        user_id: UUID,
        *,
        min_similarity: float = 0.3,
        max_edges: int = 20,
    ) -> dict[str, Any]:
        from backend.services.graph_service import build_graph

        return await build_graph(
            self.db,
            user_id,
            min_similarity=min_similarity,
            max_edges=max_edges,
        )


@dataclass
class SqlAlchemyToolPorts:
    db: AsyncSession

    def __post_init__(self) -> None:
        self.projects: ProjectPort = SqlAlchemyProjectPort(self.db)
        self.notes: NotePort = SqlAlchemyNotePort(self.db)
        self.categories: CategoryPort = SqlAlchemyCategoryPort(self.db)
        self.tags: TagPort = SqlAlchemyTagPort(self.db)
        self.sessions: SessionPort = SqlAlchemySessionPort(self.db)
        self.graph: GraphPort = SqlAlchemyGraphPort(self.db)

    async def commit(self) -> None:
        await self.db.commit()


def build_tool_ports(db: AsyncSession) -> ToolPorts:
    return SqlAlchemyToolPorts(db)
