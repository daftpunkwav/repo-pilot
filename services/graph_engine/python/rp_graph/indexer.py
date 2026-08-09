"""静态解析索引：Python AST + 通用正则（JS/TS/Go/等）。"""
from __future__ import annotations

import ast
import hashlib
import os
import re
from pathlib import Path
from typing import Iterable

from .store import Edge, GraphStore, Node, force_layout_3d

SKIP_DIRS = {
    ".git",
    "node_modules",
    "dist",
    "build",
    ".venv",
    "venv",
    "__pycache__",
    ".tox",
    "vendor",
    "target",
    ".next",
    "coverage",
}

MODE_LIMITS = {
    # fast：跳过 O(n²) 力导向，仅球面初置，显著缩短索引尾延迟
    "fast": {"max_files": 200, "max_bytes": 200_000, "layout_iters": 0},
    "moderate": {"max_files": 2000, "max_bytes": 400_000, "layout_iters": 35},
    "full": {"max_files": 20_000, "max_bytes": 800_000, "layout_iters": 50},
    "cross-repo-intelligence": {"max_files": 0, "max_bytes": 0, "layout_iters": 0},
}

PY_EXT = {".py"}
JS_EXT = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"}
GO_EXT = {".go"}
RS_EXT = {".rs"}
JAVA_EXT = {".java", ".kt"}

FN_RE = re.compile(
    r"(?:(?:export\s+)?(?:async\s+)?function\s+|const\s+|let\s+|var\s+)"
    r"([A-Za-z_][\w$]*)\s*(?:=\s*(?:async\s*)?\(|\()",
)
CLASS_RE = re.compile(r"(?:export\s+)?class\s+([A-Za-z_][\w$]*)")
IMPORT_RE = re.compile(
    r"""(?:from\s+['"]([^'"]+)['"]|import\s+.*?from\s+['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\))"""
)
GO_FN_RE = re.compile(r"func\s+(?:\([^)]+\)\s*)?([A-Za-z_][\w]*)\s*\(")
RS_FN_RE = re.compile(r"(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_][\w]*)\s*[<(]")
JAVA_FN_RE = re.compile(
    r"(?:public|private|protected|static|\s)+\s+[\w<>\[\]]+\s+([A-Za-z_][\w]*)\s*\("
)
CALL_RE = re.compile(r"\b([A-Za-z_][\w$]*)\s*\(")


def _nid(project: str, qn: str) -> str:
    h = hashlib.sha1(f"{project}:{qn}".encode()).hexdigest()[:16]
    return f"n_{h}"


def _complexity_attrs(source: str) -> dict:
    """粗粒度复杂度启发式（学习场景可被 Cypher 查询）。"""
    loops = len(re.findall(r"\b(for|while|foreach)\b", source))
    branches = len(re.findall(r"\b(if|elif|else|switch|case|catch)\b", source))
    recursion_hint = 1 if "self." in source or re.search(r"\breturn\s+\w+\(", source) else 0
    alloc_in_loop = 1 if loops and re.search(r"(new |malloc|alloc|\[\]|list\()", source) else 0
    return {
        "cyclomatic_complexity": max(1, branches + loops),
        "cognitive_complexity": max(1, branches + loops * 2),
        "loop_depth": min(5, loops),
        "transitive_loop_depth": min(5, loops),
        "linear_scan_in_loop": 1 if loops else 0,
        "alloc_in_loop": alloc_in_loop,
        "unguarded_recursion": recursion_hint,
    }


def iter_source_files(root: Path, max_files: int) -> Iterable[Path]:
    count = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for name in filenames:
            ext = Path(name).suffix.lower()
            if ext not in PY_EXT | JS_EXT | GO_EXT | RS_EXT | JAVA_EXT:
                continue
            yield Path(dirpath) / name
            count += 1
            if count >= max_files:
                return


def index_repository(
    store: GraphStore,
    repo_path: str | Path,
    *,
    mode: str = "moderate",
) -> dict:
    limits = MODE_LIMITS.get(mode) or MODE_LIMITS["moderate"]
    root = Path(repo_path).resolve()
    if not root.exists():
        raise FileNotFoundError(f"仓库路径不存在: {root}")

    store.clear()
    store.meta = {"mode": mode, "repo_path": str(root)}

    file_nodes: dict[str, str] = {}  # relpath -> id
    qn_to_id: dict[str, str] = {}
    call_sites: list[tuple[str, str]] = []  # (caller_id, callee_name)

    for path in iter_source_files(root, limits["max_files"]):
        try:
            raw = path.read_bytes()
        except OSError:
            continue
        if len(raw) > limits["max_bytes"]:
            raw = raw[: limits["max_bytes"]]
        try:
            text = raw.decode("utf-8", errors="replace")
        except Exception:
            continue

        rel = str(path.relative_to(root)).replace("\\", "/")
        pkg = rel.rsplit("/", 1)[0] if "/" in rel else "."
        file_qn = rel
        fid = _nid(store.project, f"File:{file_qn}")
        store.add_node(
            Node(
                id=fid,
                name=path.name,
                label="File",
                file_path=rel,
                qualified_name=file_qn,
                attrs={"package": pkg},
            )
        )
        file_nodes[rel] = fid

        ext = path.suffix.lower()
        if ext in PY_EXT:
            _index_python(store, text, rel, fid, qn_to_id, call_sites)
        elif ext in JS_EXT:
            _index_regex(
                store, text, rel, fid, qn_to_id, call_sites, FN_RE, CLASS_RE, "Module"
            )
            for m in IMPORT_RE.finditer(text):
                target = m.group(1) or m.group(2) or m.group(3) or ""
                if target:
                    call_sites.append((fid, f"import:{target}"))
        elif ext in GO_EXT:
            _index_regex(store, text, rel, fid, qn_to_id, call_sites, GO_FN_RE, None, "Package")
        elif ext in RS_EXT:
            _index_regex(store, text, rel, fid, qn_to_id, call_sites, RS_FN_RE, None, "Module")
        elif ext in JAVA_EXT:
            _index_regex(store, text, rel, fid, qn_to_id, call_sites, JAVA_FN_RE, CLASS_RE, "Class")

    # 解析调用边
    name_index: dict[str, list[str]] = {}
    for qn, nid in qn_to_id.items():
        short = qn.rsplit(".", 1)[-1]
        name_index.setdefault(short, []).append(nid)

    for caller, callee in call_sites:
        if callee.startswith("import:"):
            continue
        targets = name_index.get(callee) or []
        for tid in targets[:3]:
            if tid != caller:
                store.add_edge(Edge(source=caller, target=tid, type="CALLS"))

    # 同文件 CONTAINS
    for n in list(store.nodes.values()):
        if n.label in ("Function", "Class", "Method") and n.file_path in file_nodes:
            store.add_edge(
                Edge(source=file_nodes[n.file_path], target=n.id, type="CONTAINS")
            )

    store.rebuild_adj()
    nodes = list(store.nodes.values())
    edges = list(store.edges)
    force_layout_3d(nodes, edges, iterations=limits["layout_iters"])

    return {
        "project": store.project,
        "mode": mode,
        "node_count": len(store.nodes),
        "edge_count": len(store.edges),
        "repo_path": str(root),
    }


def _index_python(
    store: GraphStore,
    text: str,
    rel: str,
    file_id: str,
    qn_to_id: dict[str, str],
    call_sites: list[tuple[str, str]],
) -> None:
    try:
        tree = ast.parse(text)
    except SyntaxError:
        return
    mod = rel.replace("/", ".").removesuffix(".py")

    class Visitor(ast.NodeVisitor):
        def __init__(self) -> None:
            self.stack: list[str] = []

        def visit_ClassDef(self, node: ast.ClassDef) -> None:
            qn = f"{mod}.{node.name}"
            nid = _nid(store.project, qn)
            src = ast.get_source_segment(text, node) or ""
            store.add_node(
                Node(
                    id=nid,
                    name=node.name,
                    label="Class",
                    file_path=rel,
                    qualified_name=qn,
                    start_line=node.lineno,
                    end_line=getattr(node, "end_lineno", node.lineno) or node.lineno,
                    attrs=_complexity_attrs(src),
                )
            )
            qn_to_id[qn] = nid
            store.add_edge(Edge(source=file_id, target=nid, type="DEFINES"))
            self.stack.append(node.name)
            self.generic_visit(node)
            self.stack.pop()

        def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
            self._fn(node)

        def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
            self._fn(node)

        def _fn(self, node: ast.AST) -> None:
            name = getattr(node, "name", "fn")
            if self.stack:
                qn = f"{mod}.{'.'.join(self.stack)}.{name}"
                label = "Method"
            else:
                qn = f"{mod}.{name}"
                label = "Function"
            nid = _nid(store.project, qn)
            src = ast.get_source_segment(text, node) or ""
            store.add_node(
                Node(
                    id=nid,
                    name=name,
                    label=label,
                    file_path=rel,
                    qualified_name=qn,
                    start_line=getattr(node, "lineno", 0),
                    end_line=getattr(node, "end_lineno", 0) or 0,
                    attrs=_complexity_attrs(src),
                )
            )
            qn_to_id[qn] = nid
            parent = qn_to_id.get(f"{mod}.{'.'.join(self.stack)}") if self.stack else file_id
            if parent:
                store.add_edge(Edge(source=parent, target=nid, type="DEFINES"))
            for child in ast.walk(node):
                if isinstance(child, ast.Call):
                    callee = _call_name(child.func)
                    if callee:
                        call_sites.append((nid, callee))

    Visitor().visit(tree)


def _call_name(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return None


def _index_regex(
    store: GraphStore,
    text: str,
    rel: str,
    file_id: str,
    qn_to_id: dict[str, str],
    call_sites: list[tuple[str, str]],
    fn_re: re.Pattern,
    class_re: re.Pattern | None,
    default_pkg_label: str,
) -> None:
    mod = rel.replace("/", ".")
    lines = text.splitlines()
    if class_re:
        for m in class_re.finditer(text):
            name = m.group(1)
            qn = f"{mod}.{name}"
            nid = _nid(store.project, qn)
            line = text[: m.start()].count("\n") + 1
            store.add_node(
                Node(
                    id=nid,
                    name=name,
                    label="Class",
                    file_path=rel,
                    qualified_name=qn,
                    start_line=line,
                    end_line=line,
                    attrs=_complexity_attrs(""),
                )
            )
            qn_to_id[qn] = nid
            store.add_edge(Edge(source=file_id, target=nid, type="DEFINES"))

    for m in fn_re.finditer(text):
        name = m.group(1)
        if name in {"if", "for", "while", "switch", "catch", "return"}:
            continue
        qn = f"{mod}.{name}"
        nid = _nid(store.project, qn)
        line = text[: m.start()].count("\n") + 1
        chunk = "\n".join(lines[max(0, line - 1) : line + 40])
        store.add_node(
            Node(
                id=nid,
                name=name,
                label="Function",
                file_path=rel,
                qualified_name=qn,
                start_line=line,
                end_line=line + 40,
                attrs=_complexity_attrs(chunk),
            )
        )
        qn_to_id[qn] = nid
        store.add_edge(Edge(source=file_id, target=nid, type="DEFINES"))
        for cm in CALL_RE.finditer(chunk):
            callee = cm.group(1)
            if callee != name:
                call_sites.append((nid, callee))
