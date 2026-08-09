"""索引流水线：浅克隆 → 引擎 index_repository → 状态机（串行）。"""
from __future__ import annotations

import asyncio
import logging
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import get_settings
from backend.core import error_codes as EC
from backend.core.exceptions import AppException, NotFoundError
from backend.models.graph_index import GraphIndexStatus
from backend.models.project import Project
from backend.services.rp_graph_client import RpGraphClient, RpGraphError
from backend.services.github_accounts import primary_token

logger = logging.getLogger(__name__)

_INDEX_LOCK = asyncio.Lock()
_BACKGROUND_TASKS: set[asyncio.Task[Any]] = set()
_INDEX_QUEUE: asyncio.Queue[tuple[UUID, str, str, str, bool]] | None = None
_INDEX_WORKER: asyncio.Task[Any] | None = None
# 用户取消请求：worker 在阶段边界检查
_CANCEL_REQUESTED: set[UUID] = set()
_OWNER_REPO_RE = re.compile(
    r"github\.com[/:](?P<owner>[^/]+)/(?P<repo>[^/.]+?)(?:\.git)?/?$",
    re.I,
)
_TOKEN_IN_URL_RE = re.compile(r"(https?://)([^:@/]+):([^@/]+)@", re.I)


async def start_index_worker() -> None:
    """在 lifespan 启动常驻 worker（不受请求 cancel scope 影响）。"""
    global _INDEX_QUEUE, _INDEX_WORKER
    if _INDEX_WORKER and not _INDEX_WORKER.done():
        return
    _INDEX_QUEUE = asyncio.Queue()

    async def _worker() -> None:
        assert _INDEX_QUEUE is not None
        while True:
            project_id, owner, repo, mode, refresh = await _INDEX_QUEUE.get()
            try:
                await _run_pipeline(project_id, owner, repo, mode=mode, refresh=refresh)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("索引 worker 未捕获异常 project=%s", project_id)
            finally:
                _INDEX_QUEUE.task_done()

    _INDEX_WORKER = asyncio.create_task(_worker(), name="graph-index-worker")


async def stop_index_worker() -> None:
    global _INDEX_QUEUE, _INDEX_WORKER
    if _INDEX_WORKER and not _INDEX_WORKER.done():
        _INDEX_WORKER.cancel()
        try:
            await _INDEX_WORKER
        except (asyncio.CancelledError, Exception):
            pass
    _INDEX_WORKER = None
    _INDEX_QUEUE = None


def classify_index_error(error: str | None) -> str:
    """将错误文案归类为 network / service / cancelled / unknown，供 UI 展示。"""
    if not error:
        return "unknown"
    low = error.lower()
    if "取消" in error or "cancel" in low:
        return "cancelled"
    if any(
        k in low
        for k in (
            "timeout",
            "timed out",
            "connection",
            "network",
            "dns",
            "unreachable",
            "ssl",
            "proxy",
            "getaddrinfo",
            "failed to connect",
            "could not resolve",
            "连接",
            "网络",
            "超时",
        )
    ):
        return "network"
    if any(
        k in low
        for k in (
            "engine",
            "rp_graph",
            "502",
            "503",
            "500",
            "internal",
            "sqlite",
            "disk",
            "quota",
            "permission",
            "already exists",
            "not an empty directory",
            "服务",
            "引擎",
            "命令失败",
        )
    ):
        return "service"
    return "unknown"


def _format_pipeline_error(exc: BaseException) -> str:
    """生成可读错误；避免空 str(exc) 与 URL 中的 token 泄露。"""
    if isinstance(exc, AppException) and isinstance(exc.detail, dict):
        msg = str(exc.detail.get("message") or exc.detail)
    elif isinstance(exc, asyncio.CancelledError):
        msg = "索引任务被取消（常见于 API --reload 重启），请重新点击索引"
    else:
        msg = str(exc).strip() or repr(exc)
    msg = _TOKEN_IN_URL_RE.sub(r"\1***:***@", msg)
    return f"{type(exc).__name__}: {msg}"[:2000]


def _spawn_pipeline(
    project_id: UUID,
    owner: str,
    repo: str,
    *,
    mode: str,
    refresh: bool,
) -> None:
    """投递到 lifespan worker 队列；worker 未就绪时退化为带强引用的 create_task。"""
    if _INDEX_QUEUE is not None:
        _INDEX_QUEUE.put_nowait((project_id, owner, repo, mode, refresh))
        return

    async def _runner() -> None:
        await _run_pipeline(project_id, owner, repo, mode=mode, refresh=refresh)

    task = asyncio.create_task(_runner(), name=f"graph-index-{project_id}")
    _BACKGROUND_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_TASKS.discard)


def parse_github_owner_repo(url: str) -> tuple[str, str]:
    raw = (url or "").strip()
    m = _OWNER_REPO_RE.search(raw)
    if m:
        return m.group("owner"), m.group("repo")
    parsed = urlparse(raw)
    parts = [p for p in (parsed.path or "").split("/") if p]
    if len(parts) >= 2:
        return parts[0], parts[1].removesuffix(".git")
    raise ValueError(f"无法从 URL 解析 owner/repo: {url}")


def engine_project_name(owner: str, repo: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9._-]+", "-", f"{owner}-{repo}").strip("-")
    return f"rp-{safe}"[:200]


def _allowed_root() -> Path:
    settings = get_settings()
    return Path(
        getattr(settings, "rp_graph_allowed_root", None) or settings.cbm_allowed_root
    )


def cache_dir_for(owner: str, repo: str, sha7: str = "head") -> Path:
    root = _allowed_root() / "repo-cache"
    root.mkdir(parents=True, exist_ok=True)
    name = f"{owner}-{repo}-{sha7}"[:180]
    return root / name


async def get_or_create_status(
    db: AsyncSession, project_id: UUID
) -> GraphIndexStatus:
    result = await db.execute(
        select(GraphIndexStatus).where(GraphIndexStatus.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    if row:
        return row
    row = GraphIndexStatus(project_id=project_id, status="NONE", index_mode="moderate")
    db.add(row)
    await db.flush()
    return row


async def get_status_out(db: AsyncSession, project_id: UUID) -> dict:
    project = await db.get(Project, project_id)
    if not project:
        raise NotFoundError("项目不存在", EC.PROJECT_NOT_FOUND)
    row = await get_or_create_status(db, project_id)
    await db.commit()
    return _status_dict(row)


def _status_dict(row: GraphIndexStatus) -> dict:
    err = row.error
    return {
        "project_id": str(row.project_id),
        "engine_project": row.engine_project or "",
        "local_path": row.local_path,
        "head_sha": row.head_sha,
        "branch": row.branch,
        "status": row.status,
        "index_mode": row.index_mode,
        "node_count": row.node_count,
        "edge_count": row.edge_count,
        "indexed_at": row.indexed_at.isoformat() if row.indexed_at else None,
        "error": err,
        "error_kind": classify_index_error(err),
        "cancel_requested": row.project_id in _CANCEL_REQUESTED,
    }


async def list_index_statuses(db: AsyncSession) -> list[dict]:
    """全部项目索引状态（图谱页进度条）。"""
    result = await db.execute(select(GraphIndexStatus))
    rows = result.scalars().all()
    return [_status_dict(r) for r in rows]


def _raise_if_cancelled(project_id: UUID) -> None:
    if project_id in _CANCEL_REQUESTED:
        raise asyncio.CancelledError("用户取消索引")


async def cancel_index(db: AsyncSession, project_id: UUID) -> dict:
    """取消排队中或进行中的索引；已完成则 no-op。"""
    project = await db.get(Project, project_id)
    if not project:
        raise NotFoundError("项目不存在", EC.PROJECT_NOT_FOUND)
    row = await get_or_create_status(db, project_id)
    if row.status not in ("QUEUED", "CLONING", "INDEXING"):
        return _status_dict(row)

    _CANCEL_REQUESTED.add(project_id)
    # 排队中：直接落库，worker 取到后会立刻退出
    if row.status == "QUEUED":
        row.status = "INDEX_FAILED"
        row.error = "用户取消索引"
        _CANCEL_REQUESTED.discard(project_id)
        await db.commit()
    else:
        row.error = "正在取消…"
        await db.commit()
    return _status_dict(row)


async def recover_interrupted_jobs(db: AsyncSession) -> int:
    """启动时将中断的 CLONING/INDEXING 标为失败，供用户重试。"""
    result = await db.execute(
        update(GraphIndexStatus)
        .where(GraphIndexStatus.status.in_(("QUEUED", "CLONING", "INDEXING")))
        .values(
            status="INDEX_FAILED",
            error="进程重启，索引任务中断，请重试",
            updated_at=datetime.utcnow(),
        )
    )
    await db.commit()
    return result.rowcount or 0


async def trigger_index(
    db: AsyncSession,
    project_id: UUID,
    *,
    mode: str = "moderate",
    refresh: bool = False,
) -> dict:
    project = await db.get(Project, project_id)
    if not project:
        raise NotFoundError("项目不存在", EC.PROJECT_NOT_FOUND)

    row = await get_or_create_status(db, project_id)
    if row.status in ("QUEUED", "CLONING", "INDEXING"):
        return _status_dict(row)

    try:
        owner, repo = parse_github_owner_repo(project.url)
    except ValueError as exc:
        raise AppException(400, EC.PROJECT_URL_INVALID, str(exc)) from exc

    row.status = "QUEUED"
    row.index_mode = mode
    row.error = None
    row.engine_project = engine_project_name(owner, repo)
    await db.commit()

    # 后台串行执行（必须脱离 HTTP 请求 cancel scope，否则会秒级 CancelledError）
    _spawn_pipeline(project_id, owner, repo, mode=mode, refresh=refresh)
    return _status_dict(row)


async def delete_index(db: AsyncSession, project_id: UUID) -> dict:
    project = await db.get(Project, project_id)
    if not project:
        raise NotFoundError("项目不存在", EC.PROJECT_NOT_FOUND)
    row = await get_or_create_status(db, project_id)
    if row.local_path:
        path = Path(row.local_path)
        if path.exists() and path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
    row.status = "NONE"
    row.local_path = None
    row.head_sha = None
    row.node_count = None
    row.edge_count = None
    row.indexed_at = None
    row.error = None
    await db.commit()
    return _status_dict(row)


async def _run_pipeline(
    project_id: UUID,
    owner: str,
    repo: str,
    *,
    mode: str,
    refresh: bool,
) -> None:
    from backend.database import get_session_factory

    async with _INDEX_LOCK:
        factory = get_session_factory()
        async with factory() as db:
            row = await get_or_create_status(db, project_id)
            project = await db.get(Project, project_id)
            if not project:
                _CANCEL_REQUESTED.discard(project_id)
                return
            try:
                if project_id in _CANCEL_REQUESTED:
                    row.status = "INDEX_FAILED"
                    row.error = "用户取消索引"
                    await db.commit()
                    return
                await _clone_and_index(db, row, project, owner, repo, mode, refresh)
            except BaseException as exc:
                # 含 CancelledError（BaseException）：必须落库，否则 UI 卡在 CLONING 或空错误
                logger.exception(
                    "索引流水线失败 project=%s status=%s err=%s",
                    project_id,
                    row.status,
                    _format_pipeline_error(exc),
                )
                try:
                    user_cancel = project_id in _CANCEL_REQUESTED or (
                        isinstance(exc, asyncio.CancelledError)
                        and "用户取消" in str(exc)
                    )
                    if user_cancel:
                        row.status = "INDEX_FAILED"
                        row.error = "用户取消索引"
                    else:
                        row.status = (
                            "CLONE_FAILED"
                            if row.status in ("CLONING", "QUEUED")
                            else "INDEX_FAILED"
                        )
                        row.error = _format_pipeline_error(exc)
                    await db.commit()
                except Exception:
                    logger.exception("写入失败状态时二次异常 project=%s", project_id)
                if isinstance(exc, (KeyboardInterrupt, SystemExit)):
                    raise
            finally:
                _CANCEL_REQUESTED.discard(project_id)


async def _clone_and_index(
    db: AsyncSession,
    row: GraphIndexStatus,
    project: Project,
    owner: str,
    repo: str,
    mode: str,
    refresh: bool,
) -> None:
    settings = get_settings()
    # 配额粗检
    cache_root = _allowed_root() / "repo-cache"
    cache_root.mkdir(parents=True, exist_ok=True)
    _enforce_quota(cache_root, settings.repo_cache_quota_gb)

    row.status = "CLONING"
    await db.commit()
    _raise_if_cancelled(project.id)

    token = None
    try:
        from backend.services.app_state_service import get_or_create_app_state

        state = await get_or_create_app_state(db)
        _, token = primary_token(state)
    except Exception:
        token = None

    dest = Path(row.local_path) if row.local_path else cache_dir_for(owner, repo, "head")
    if refresh and dest.exists():
        await _git_pull(dest)
    else:
        if dest.exists():
            shutil.rmtree(dest, ignore_errors=True)
        dest = cache_dir_for(owner, repo, "head")
        await _git_shallow_clone(project.url, dest, token=token)

    sha = await _git_rev_parse(dest)
    branch = await _git_branch(dest)
    row.local_path = str(dest.resolve())
    row.head_sha = sha
    row.branch = branch
    row.engine_project = engine_project_name(owner, repo)
    _raise_if_cancelled(project.id)
    row.status = "INDEXING"
    await db.commit()
    _raise_if_cancelled(project.id)

    client = RpGraphClient()
    if not await client.health():
        raise RpGraphError(
            "自研图谱引擎不可用。请确认 RepoPilot 已正确安装，或检查 RP_GRAPH_ENGINE_URL。",
            code=EC.GRAPH_ENGINE_UNAVAILABLE,
        )

    try:
        await client.index_repository(
            str(dest.resolve()),
            mode=mode,
            name=row.engine_project,
            persistence=True,
        )
    except RpGraphError:
        raise
    except Exception as exc:
        raise RpGraphError(
            f"索引失败：{exc}", code=EC.GRAPH_INDEX_FAILED
        ) from exc

    # 取 schema 统计
    try:
        schema = await client.get_graph_schema(row.engine_project)
        node_count = sum(
            int(x.get("count") or 0) for x in (schema.get("node_labels") or [])
        )
        edge_count = sum(
            int(x.get("count") or 0) for x in (schema.get("edge_types") or [])
        )
        row.node_count = node_count
        row.edge_count = edge_count
    except Exception:
        logger.warning("无法读取 graph schema 统计", exc_info=True)

    row.status = "READY"
    row.indexed_at = datetime.utcnow()
    row.error = None
    await db.commit()


def _enforce_quota(cache_root: Path, quota_gb: float) -> None:
    total = 0
    for p in cache_root.rglob("*"):
        if p.is_file():
            try:
                total += p.stat().st_size
            except OSError:
                pass
    if total > quota_gb * 1024**3:
        raise AppException(
            400,
            EC.GRAPH_INDEX_FAILED,
            f"仓库缓存已超过配额 {quota_gb}GB，请删除旧索引后重试",
        )


async def _git_shallow_clone(
    url: str, dest: Path, *, token: str | None = None
) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    clone_url = url
    if token and "github.com" in url:
        # https://x-access-token:TOKEN@github.com/owner/repo.git
        parsed = urlparse(url)
        path = parsed.path or ""
        clone_url = f"https://x-access-token:{token}@github.com{path}"
        if not clone_url.endswith(".git"):
            clone_url += ".git"

    # Windows：长路径 + symlink 回退（无管理员/开发者模式时）
    await _run_cmd(["git", "config", "--global", "core.longpaths", "true"], check=False)
    await _run_cmd(["git", "config", "--global", "core.symlinks", "false"], check=False)

    # 优先 partial clone；旧 git / 代理不支持 filter 时回退
    attempts = [
        ["git", "clone", "--depth", "1", "--filter=blob:none", "--single-branch", clone_url, str(dest)],
        ["git", "clone", "--depth", "1", "--single-branch", clone_url, str(dest)],
    ]
    last_err: Optional[BaseException] = None
    for cmd in attempts:
        if dest.exists():
            shutil.rmtree(dest, ignore_errors=True)
        try:
            await _run_cmd(cmd)
            return
        except Exception as exc:
            last_err = exc
            logger.warning("浅克隆失败，尝试回退策略: %s", _format_pipeline_error(exc))
    assert last_err is not None
    raise last_err


async def _git_pull(dest: Path) -> None:
    await _run_cmd(["git", "-C", str(dest), "fetch", "--depth", "1"])
    branch = await _git_branch(dest)
    await _run_cmd(
        ["git", "-C", str(dest), "reset", "--hard", f"origin/{branch}"],
        check=False,
    )


async def _git_rev_parse(dest: Path) -> str:
    out = await _run_cmd(["git", "-C", str(dest), "rev-parse", "HEAD"])
    return out.strip()[:40]


async def _git_branch(dest: Path) -> str:
    out = await _run_cmd(
        ["git", "-C", str(dest), "rev-parse", "--abbrev-ref", "HEAD"],
        check=False,
    )
    return (out or "HEAD").strip() or "HEAD"


async def _run_cmd(cmd: list[str], *, check: bool = True) -> str:
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError as exc:
        raise RuntimeError(
            "未找到 git 可执行文件，请确认已安装 Git 且 API 进程 PATH 可用"
        ) from exc
    stdout, stderr = await proc.communicate()
    if check and proc.returncode != 0:
        err = (stderr or stdout or b"").decode("utf-8", errors="replace")[:1500]
        # 日志/错误里脱敏 token，不打印完整带凭证 URL
        safe_cmd = [_TOKEN_IN_URL_RE.sub(r"\1***:***@", c) for c in cmd]
        raise RuntimeError(f"命令失败 ({proc.returncode}): {' '.join(safe_cmd)}\n{err}")
    return (stdout or b"").decode("utf-8", errors="replace")
