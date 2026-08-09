"""
可选 HTTP sidecar：python -m rp_graph.server
供独立进程托管（P5 / 大规模索引）。
"""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from .engine import get_engine


class Handler(BaseHTTPRequestHandler):
    eng = None

    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        return

    def _json(self, code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        eng = Handler.eng
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._json(200, {"status": "ok", "engine": "rp-graph-engine"})
            return
        if parsed.path == "/api/layout":
            qs = parse_qs(parsed.query)
            project = (qs.get("project") or [""])[0]
            max_nodes = int((qs.get("max_nodes") or ["5000"])[0])
            self._json(200, eng.fetch_layout(project, max_nodes=max_nodes))
            return
        if parsed.path == "/api/cross-edges":
            self._json(200, {"edges": eng.list_cross_edges()})
            return
        self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802
        eng = Handler.eng
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._json(400, {"error": "invalid_json"})
            return
        if urlparse(self.path).path != "/rpc":
            self._json(404, {"error": "not_found"})
            return
        params = data.get("params") or {}
        name = params.get("name")
        args = params.get("arguments") or {}
        try:
            result = _dispatch(eng, name, args)
            self._json(200, {"jsonrpc": "2.0", "id": data.get("id"), "result": result})
        except Exception as exc:
            self._json(
                200,
                {
                    "jsonrpc": "2.0",
                    "id": data.get("id"),
                    "error": {"message": str(exc)},
                },
            )


def _dispatch(eng, name: str, args: dict):
    if name == "index_repository":
        return eng.index_repository(
            args.get("repo_path") or ".",
            mode=args.get("mode") or "moderate",
            name=args.get("name"),
            target_projects=args.get("target_projects"),
            persistence=bool(args.get("persistence", True)),
        )
    if name == "search_graph":
        return eng.search_graph(args["project"], **{k: v for k, v in args.items() if k != "project"})
    if name == "search_code":
        return eng.search_code(
            args["project"],
            pattern=args.get("pattern") or args.get("query") or "",
            limit=int(args.get("limit") or 50),
        )
    if name == "get_code_snippet":
        return eng.get_code_snippet(args["project"], args.get("qualified_name") or "")
    if name == "trace_path":
        return eng.trace_path(args["project"], **{k: v for k, v in args.items() if k != "project"})
    if name == "query_graph":
        return eng.query_graph(args.get("project") or "", args.get("query") or "")
    if name == "get_graph_schema":
        return eng.get_graph_schema(args["project"])
    if name == "get_architecture":
        return eng.get_architecture(args["project"], aspects=args.get("aspects"))
    raise ValueError(f"unknown tool: {name}")


def main() -> None:
    root = os.environ.get("RP_GRAPH_ALLOWED_ROOT") or os.environ.get("CBM_ALLOWED_ROOT")
    port = int(os.environ.get("RP_GRAPH_ENGINE_PORT") or "9750")
    Handler.eng = get_engine(data_root=root)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"rp-graph-engine listening on 127.0.0.1:{port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
