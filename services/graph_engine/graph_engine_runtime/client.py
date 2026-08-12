"""
RepoPilot 图谱客户端。

优先连接 `RP_GRAPH_ENGINE_URL` 指向的本仓 C 引擎 sidecar（`services/graph_engine/graph_engine_core`）；
未配置或 sidecar 不健康时回退进程内 Python `rp_graph.GraphEngine`。
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
import time
from pathlib import Path
from typing import Any, Literal, Optional

import httpx
from py_shared import error_codes as EC

from graph_engine_runtime.context import get_runtime_context

logger = logging.getLogger(__name__)

# rp_graph（Python 回退实现）位于 graph_engine_fallback 包；运行层与回退层同目录插入 sys.path
_ENGINE_PY = Path(__file__).resolve().parent.parent / "graph_engine_fallback"
if _ENGINE_PY.is_dir() and str(_ENGINE_PY) not in sys.path:
    sys.path.insert(0, str(_ENGINE_PY))

SidecarFlavor = Literal["cbm", "rp_graph", "unknown"]


class RpGraphError(Exception):
    def __init__(self, message: str, *, code: str = EC.GRAPH_QUERY_FAILED):
        super().__init__(message)
        self.message = message
        self.code = code


def _local_engine():
    from rp_graph import get_engine

    settings = get_runtime_context().settings
    root = getattr(settings, "rp_graph_allowed_root", None) or settings.cbm_allowed_root
    return get_engine(data_root=root)


def _unwrap_mcp_result(result: Any) -> Any:
    """解析 CBM/MCP tools/call 的 content / structuredContent。"""
    if not isinstance(result, dict):
        return result
    if result.get("isError"):
        msg = "引擎工具错误"
        content = result.get("content")
        if isinstance(content, list) and content:
            first = content[0]
            if isinstance(first, dict) and first.get("text"):
                msg = str(first["text"])
        raise RpGraphError(msg, code=EC.GRAPH_QUERY_FAILED)
    structured = result.get("structuredContent")
    if structured is not None:
        return structured
    content = result.get("content")
    if isinstance(content, list) and content:
        first = content[0]
        if isinstance(first, dict) and "text" in first:
            text = first.get("text") or ""
            try:
                return json.loads(text)
            except (TypeError, json.JSONDecodeError):
                return {"text": text}
    return result


def _norm_path(path: str) -> str:
    return str(Path(path).resolve()).replace("\\", "/").rstrip("/").lower()


class RpGraphClient:
    """统一引擎端口：sidecar（CBM C / rp_graph）或进程内引擎。"""

    def __init__(self, base_url: str | None = None, timeout: float = 300.0):
        settings = get_runtime_context().settings
        url = base_url
        if url is None:
            url = getattr(settings, "rp_graph_engine_url", None) or ""
        self.base_url = (url or "").rstrip("/")
        self.timeout = timeout
        self._rpc_id = 0
        self._flavor: SidecarFlavor | None = None

    async def health(self) -> bool:
        if self.base_url:
            return await self._sidecar_ok()
        try:
            return bool(_local_engine().health())
        except Exception as exc:
            logger.warning("自研图谱引擎不可用: %s", exc)
            return False

    async def flavor(self) -> SidecarFlavor:
        if not self.base_url:
            return "unknown"
        if self._flavor is None:
            await self._sidecar_ok()
        return self._flavor or "unknown"

    async def fetch_layout(
        self,
        project: str,
        *,
        max_nodes: int = 5000,
        graph: str = "code",
    ) -> dict[str, Any]:
        if self.base_url and await self._sidecar_ok():
            params = {"project": project, "max_nodes": str(max_nodes)}
            # 自研 sidecar 兼容 graph 参数；CBM 忽略未知 query
            if await self.flavor() != "cbm":
                params["graph"] = graph
            return await self._http_get("/api/layout", params)
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
            if name == "index_repository":
                return await self.index_repository(
                    args.get("repo_path") or ".",
                    mode=args.get("mode") or "moderate",
                    name=args.get("name"),
                    target_projects=args.get("target_projects"),
                    persistence=bool(args.get("persistence", True)),
                )
            if name == "drop_project":
                return await self.drop_project(
                    args.get("project") or args.get("name") or ""
                )
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
            if name == "drop_project":
                return eng.drop_project(args.get("project") or args.get("name") or "")
            raise RpGraphError(f"未知工具：{name}", code=EC.GRAPH_QUERY_FAILED)

        try:
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
        should_abandon: Any = None,
    ) -> Any:
        """本地引擎可传 should_abandon；CBM sidecar 通过轮询 index-status 检查放弃。"""
        if self.base_url and await self._sidecar_ok():
            flavor = await self.flavor()
            if flavor == "cbm":
                return await self._cbm_index(
                    repo_path,
                    name=name,
                    should_abandon=should_abandon,
                )
            # 自研 sidecar：RPC 同步 index（支持 mode）
            return await self._http_rpc(
                "index_repository",
                {
                    "repo_path": repo_path,
                    "mode": mode,
                    "name": name,
                    "target_projects": target_projects,
                    "persistence": persistence,
                },
            )

        eng = _local_engine()

        def _sync() -> Any:
            return eng.index_repository(
                repo_path,
                mode=mode,
                name=name,
                target_projects=target_projects,
                persistence=persistence,
                should_abandon=should_abandon,
            )

        try:
            return await asyncio.to_thread(_sync)
        except RpGraphError:
            raise
        except Exception as exc:
            raise RpGraphError(str(exc), code=EC.GRAPH_QUERY_FAILED) from exc

    async def _cbm_index(
        self,
        repo_path: str,
        *,
        name: Optional[str],
        should_abandon: Any,
    ) -> dict[str, Any]:
        """CBM Graph UI：POST /api/index + 轮询 /api/index-status。

        注意：CBM UI 的 /rpc index_repository 已禁用；mode 由 C 引擎默认管线决定
        （等价于 full/LSP，质量高于自研 Python 索引）。
        """
        root = str(Path(repo_path).resolve()).replace("\\", "/")
        payload: dict[str, Any] = {"root_path": root}
        if name:
            payload["project_name"] = name

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(f"{self.base_url}/api/index", json=payload)
        except Exception as exc:
            raise RpGraphError(
                f"CBM 启动索引失败：{exc}", code=EC.GRAPH_ENGINE_UNAVAILABLE
            ) from exc

        if resp.status_code not in (200, 202):
            raise RpGraphError(
                f"CBM 索引拒绝 HTTP {resp.status_code}：{resp.text[:300]}",
                code=EC.GRAPH_INDEX_FAILED,
            )

        want = _norm_path(root)
        deadline = time.monotonic() + max(self.timeout, 60.0)
        last_error = ""

        while time.monotonic() < deadline:
            if callable(should_abandon) and should_abandon():
                return {"abandoned": True, "project": name or root}

            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    st = await client.get(f"{self.base_url}/api/index-status")
                    jobs = st.json() if st.status_code == 200 else []
            except Exception:
                jobs = []

            matched = None
            if isinstance(jobs, list):
                for job in jobs:
                    if not isinstance(job, dict):
                        continue
                    jpath = _norm_path(str(job.get("path") or ""))
                    if jpath == want:
                        matched = job
                        break

            if matched is not None:
                status = str(matched.get("status") or "")
                if status == "done":
                    break
                if status == "error":
                    last_error = str(matched.get("error") or "CBM 索引失败")
                    raise RpGraphError(last_error, code=EC.GRAPH_INDEX_FAILED)
            elif jobs == []:
                # 槽位已清空：用 project-health 确认是否已落库
                proj = (name or "").strip()
                if proj:
                    health = await self._project_health(proj)
                    if health.get("status") == "healthy":
                        break

            await asyncio.sleep(1.5)
        else:
            raise RpGraphError(
                f"CBM 索引超时（>{int(self.timeout)}s）",
                code=EC.GRAPH_INDEX_FAILED,
            )

        proj = (name or "").strip()
        out: dict[str, Any] = {"ok": True, "project": proj or root, "engine": "cbm"}
        if proj:
            health = await self._project_health(proj)
            if health.get("status") == "healthy":
                out["nodes"] = health.get("nodes")
                out["edges"] = health.get("edges")
        return out

    async def _project_health(self, project: str) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.base_url}/api/project-health",
                    params={"name": project},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data if isinstance(data, dict) else {}
        except Exception:
            logger.debug("project-health 查询失败 project=%s", project, exc_info=True)
        return {}

    async def search_graph(self, project: str, **kwargs: Any) -> Any:
        return await self.call_tool(
            "search_graph", {"project": project, **kwargs}
        )

    async def search_code(self, project: str, **kwargs: Any) -> Any:
        return await self.call_tool("search_code", {"project": project, **kwargs})

    async def trace_path(self, project: str, **kwargs: Any) -> Any:
        """对齐 CBM：优先 function_name；兼容本地引擎的 symbol/start。"""
        args = {"project": project, **kwargs}
        if "function_name" not in args:
            sym = args.pop("symbol", None) or args.pop("start", None)
            if sym:
                args["function_name"] = sym
        if "mode" not in args and ("kind" in args or "type" in args):
            kind = args.pop("kind", None) or args.pop("type", None)
            if kind in ("calls", "data_flow", "cross_service"):
                args["mode"] = kind
            elif kind == "data":
                args["mode"] = "data_flow"
        return await self.call_tool("trace_path", args)

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

    async def drop_project(self, project: str) -> Any:
        """删除引擎侧图谱。CBM：DELETE /api/project；自研：RPC/本地 drop_project。"""
        name = (project or "").strip()
        if not name:
            raise RpGraphError("缺少 project 名称", code=EC.GRAPH_QUERY_FAILED)
        if self.base_url and await self._sidecar_ok():
            if await self.flavor() == "cbm":
                try:
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        # name 可能含特殊字符，走 query
                        resp = await client.request(
                            "DELETE",
                            f"{self.base_url}/api/project",
                            params={"name": name},
                        )
                        if resp.status_code == 200:
                            return resp.json() if resp.content else {"deleted": True}
                        raise RpGraphError(
                            f"CBM 删除项目失败 HTTP {resp.status_code}：{resp.text[:200]}",
                            code=EC.GRAPH_QUERY_FAILED,
                        )
                except RpGraphError:
                    raise
                except Exception as exc:
                    raise RpGraphError(
                        f"CBM 删除项目失败：{exc}", code=EC.GRAPH_ENGINE_UNAVAILABLE
                    ) from exc
            return await self._http_rpc("drop_project", {"project": name})
        return await asyncio.to_thread(_local_engine().drop_project, name)

    async def query_graph(self, project: str, query: str, **kwargs: Any) -> Any:
        return await self.call_tool(
            "query_graph", {"project": project, "query": query, **kwargs}
        )

    async def list_cross_edges(self) -> list[dict[str, Any]]:
        if self.base_url and await self._sidecar_ok():
            if await self.flavor() == "cbm":
                # CBM Graph UI 无此路由；跨仓边由引擎内部维护
                return []
            data = await self._http_get("/api/cross-edges", {})
            return data.get("edges") or []
        return await asyncio.to_thread(_local_engine().list_cross_edges)

    async def _sidecar_ok(self) -> bool:
        if not self.base_url:
            return False
        try:
            async with httpx.AsyncClient(timeout=2.5) as client:
                # CBM Graph UI：无 /health，用 /api/ui-config
                try:
                    resp = await client.get(f"{self.base_url}/api/ui-config")
                    if resp.status_code == 200:
                        self._flavor = "cbm"
                        return True
                except Exception:
                    pass
                # 自研 rp_graph.server
                try:
                    resp = await client.get(f"{self.base_url}/health")
                    if resp.status_code == 200:
                        self._flavor = "rp_graph"
                        return True
                except Exception:
                    pass
                # 兜底：RPC tools/list
                try:
                    resp = await client.post(
                        f"{self.base_url}/rpc",
                        json={
                            "jsonrpc": "2.0",
                            "id": 0,
                            "method": "tools/list",
                            "params": {},
                        },
                    )
                    if resp.status_code == 200:
                        self._flavor = self._flavor or "unknown"
                        return True
                except Exception:
                    pass
        except Exception:
            return False
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
                data = resp.json()
                return data if isinstance(data, dict) else {"result": data}
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
        result = data.get("result") if isinstance(data, dict) else data
        return _unwrap_mcp_result(result)
