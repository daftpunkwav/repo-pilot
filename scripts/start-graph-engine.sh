#!/usr/bin/env bash
# 启动自研图谱引擎 HTTP sidecar（默认 127.0.0.1:9750）
# API 默认可进程内使用 graph_fallback；仅在需要 sidecar 时运行本脚本，并设置 GRAPH_ENGINE_URL。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_ROOT="${GRAPH_ALLOWED_ROOT:-$ROOT/data}"
mkdir -p "$DATA_ROOT"

export GRAPH_ALLOWED_ROOT="$DATA_ROOT"
export GRAPH_ENGINE_PORT="${GRAPH_ENGINE_PORT:-9750}"

echo "graph-engine sidecar → 127.0.0.1:${GRAPH_ENGINE_PORT}"
echo "GRAPH_ALLOWED_ROOT=${GRAPH_ALLOWED_ROOT}"
echo "PYTHONPATH=${PYTHONPATH}"

cd "$ROOT"
exec python -m graph_fallback.server
