"""
RepoPilot 自研图谱客户端。

默认走进程内 rp_graph.GraphEngine；若配置了 RP_GRAPH_ENGINE_URL 且健康，则走 HTTP sidecar。
绝不调用第三方 codebase-memory-mcp。
"""
from __future__ import annotations

import asyncio
import logging
import sys
from pathlib import Path
from typing import Any, Optional

import httpx

from backend.config import get_settings
from backend.core import error_codes as EC

logger = logging.getLogger(__name__)

# 将 services/graph_engine/python 加入 path
_ENGINE_PY = Path(__file__).resolve().parents[3] / "graph_engine" / "python"
if _ENGINE_PY.is_dir() and str(_ENGINE_PY) not in sys.path:
    sys.path.insert(0, str(_ENGINE_PY))


class RpGraphError(Exception):
    def __init__(self, message: str, *, code: str = EC.GRAPH_QUERY_FAILED):
        super().__init__(message)
        self.message = message
        self.code = code


def _local_engine():
    from rp_graph import get_engine

    settings = get_settings()
    root = getattr(settings, "rp_graph_allowed_root", None) or settings.cbm_allowed_root
    return get_engine(data_root=root)


class RpGraphClient:
    """统一引擎端口：优先本机 sidecar，否则进程内引擎。"""

    def __init__(self, base_url: str | None = None, timeout: float = 300.0):
        settings = get_settings()
        url = base_url
        if url is None:
            url = getattr(settings, "rp_graph_engine_url", None) or ""
        self.base_url = (url or "").rstrip("/")
        self.timeout = timeout
        self._rpc_id = 0

    async def health(self) -> bool:
        if self.base_url:
            try:
                async with httpx.AsyncClient(timeout=3.0) as client:
                    resp = await client.get(f"{self.base_url}/health")
                    return resp.status_code < 500
            except Exception:
                return False
        try:
            return bool(_local_engine().health())
        except Exception as exc:
            logger.warning("自研图谱引擎不可用: %s", exc)
            return False

    async def fetch_layout(
        self,
        project: str,
        *,
        max_nodes: int = 5000,
        graph: str = "code",
    ) -> dict[str, Any]:
        if self.base_url and await self._sidecar_ok():
            return await self._http_get(
                "/api/layout",
                {"project": project, "max_nodes": str(max_nodes), "graph": graph},
            )
        try:
            return await asyncio.to_thread(
                _local_engine().fetch_layout,
                project,
                max_nodes=max_nodes,
                graph=graph,
            )
        except Exception as exc:
            raise RpGraphError(
                f"读取布局失败：{exc}", code=EC.GRAPH_QUERY_FAILED
            ) from exc

    async def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> Any:
        args = arguments or {}
        if self.base_url and await self._sidecar_ok():
            return await self._http_rpc(name, args)
        eng = _local_engine()

        def _sync_call() -> Any:
            if name == "index_repository":
                return eng.index_repository(
                    args.get("repo_path") or ".",
                    mode=args.get("mode") or "moderate",
                    name=args.get("name"),
                    target_projects=args.get("target_projects"),
                    persistence=bool(args.get("persistence", True)),
                )
            if name == "search_graph":
                return eng.search_graph(
                    args["project"],
                    query=args.get("query") or "",
                    name_pattern=args.get("name_pattern") or "",
                    semantic_query=args.get("semantic_query") or "",
                    label=args.get("label"),
                    limit=int(args.get("limit") or 200),
                    offset=int(args.get("offset") or 0),
                )
            if name == "search_code":
                return eng.search_code(
                    args["project"],
                    pattern=args.get("pattern") or args.get("query") or "",
                    limit=int(args.get("limit") or 50),
                )
            if name == "get_code_snippet":
                return eng.get_code_snippet(
                    args["project"], args.get("qualified_name") or ""
                )
            if name == "trace_path":
                return eng.trace_path(
                    args["project"],
                    start=args.get("start") or args.get("symbol") or "",
                    symbol=args.get("symbol") or "",
                    direction=args.get("direction") or "both",
                    depth=int(args.get("depth") or 3),
                    kind=args.get("kind") or args.get("type") or "calls",
                )
            if name == "query_graph":
                return eng.query_graph(
                    args.get("project") or "",
                    args.get("query") or "",
                    limit=int(args.get("limit") or 100_000),
                )
            if name == "get_graph_schema":
                return eng.get_graph_schema(args["project"])
            if name == "get_architecture":
                return eng.get_architecture(
                    args["project"], aspects=args.get("aspects")
                )
            raise RpGraphError(f"未知工具：{name}", code=EC.GRAPH_QUERY_FAILED)

        try:
            # 本地引擎为同步 CPU/IO 重活；必须丢进线程池，否则会卡死 uvicorn 事件循环
            return await asyncio.to_thread(_sync_call)
        except RpGraphError:
            raise
        except Exception as exc:
            raise RpGraphError(str(exc), code=EC.GRAPH_QUERY_FAILED) from exc

    async def index_repository(
        self,
        repo_path: str,
        *,
        mode: str = "moderate",
        name: Optional[str] = None,
        target_projects: list[str] | None = None,
        persistence: bool = True,
    ) -> Any:
        return await self.call_tool(
            "index_repository",
            {
                "repo_path": repo_path,
                "mode": mode,
                "name": name,
                "target_projects": target_projects,
                "persistence": persistence,
            },
        )

    async def search_graph(self, project: str, **kwargs: Any) -> Any:
        return await self.call_tool(
            "search_graph", {"project": project, **kwargs}
        )

    async def search_code(self, project: str, **kwargs: Any) -> Any:
        return await self.call_tool("search_code", {"project": project, **kwargs})

    async def trace_path(self, project: str, **kwargs: Any) -> Any:
        return await self.call_tool("trace_path", {"project": project, **kwargs})

    async def get_architecture(self, project: str, aspects: list[str] | None = None) -> Any:
        args: dict[str, Any] = {"project": project}
        if aspects:
            args["aspects"] = aspects
        return await self.call_tool("get_architecture", args)

    async def get_code_snippet(self, project: str, qualified_name: str) -> Any:
        return await self.call_tool(
            "get_code_snippet",
            {"project": project, "qualified_name": qualified_name},
        )

    async def get_graph_schema(self, project: str) -> Any:
        return await self.call_tool("get_graph_schema", {"project": project})

    async def query_graph(self, project: str, query: str, **kwargs: Any) -> Any:
        return await self.call_tool(
            "query_graph", {"project": project, "query": query, **kwargs}
        )

    async def list_cross_edges(self) -> list[dict[str, Any]]:
        if self.base_url and await self._sidecar_ok():
            data = await self._http_get("/api/cross-edges", {})
            return data.get("edges") or []
        return await asyncio.to_thread(_local_engine().list_cross_edges)

    async def _sidecar_ok(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(f"{self.base_url}/health")
                return resp.status_code == 200
        except Exception:
            return False

    async def _http_get(self, path: str, params: dict[str, str]) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(f"{self.base_url}{path}", params=params)
                if resp.status_code != 200:
                    raise RpGraphError(
                        f"引擎 HTTP {resp.status_code}：{resp.text[:300]}",
                        code=EC.GRAPH_QUERY_FAILED,
                    )
                return resp.json()
        except RpGraphError:
            raise
        except Exception as exc:
            raise RpGraphError(
                f"引擎请求失败：{exc}", code=EC.GRAPH_ENGINE_UNAVAILABLE
            ) from exc

    async def _http_rpc(self, name: str, arguments: dict[str, Any]) -> Any:
        self._rpc_id += 1
        payload = {
            "jsonrpc": "2.0",
            "id": self._rpc_id,
            "method": "tools/call",
            "params": {"name": name, "arguments": arguments},
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(f"{self.base_url}/rpc", json=payload)
                if resp.status_code != 200:
                    raise RpGraphError(
                        f"引擎 rpc HTTP {resp.status_code}",
                        code=EC.GRAPH_QUERY_FAILED,
                    )
                data = resp.json()
        except RpGraphError:
            raise
        except Exception as exc:
            raise RpGraphError(
                f"引擎 rpc 失败：{exc}", code=EC.GRAPH_ENGINE_UNAVAILABLE
            ) from exc
        if isinstance(data, dict) and data.get("error"):
            err = data["error"]
            msg = err.get("message") if isinstance(err, dict) else str(err)
            raise RpGraphError(msg or "引擎错误", code=EC.GRAPH_QUERY_FAILED)
        return data.get("result") if isinstance(data, dict) else data
