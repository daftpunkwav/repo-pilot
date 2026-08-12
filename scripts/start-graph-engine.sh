#!/usr/bin/env bash
# 启动自研图谱引擎 HTTP sidecar（默认 127.0.0.1:9750）
# API 默认可进程内使用 rp_graph；仅在需要 sidecar 时运行本脚本，并设置 RP_GRAPH_ENGINE_URL。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_ROOT="${RP_GRAPH_ALLOWED_ROOT:-$ROOT/data}"
mkdir -p "$DATA_ROOT"

export RP_GRAPH_ALLOWED_ROOT="$DATA_ROOT"
export RP_GRAPH_ENGINE_PORT="${RP_GRAPH_ENGINE_PORT:-9750}"
export PYTHONPATH="$ROOT/services/graph_engine/graph_engine_runtime${PYTHONPATH:+:$PYTHONPATH}"

echo "rp-graph-engine sidecar → 127.0.0.1:${RP_GRAPH_ENGINE_PORT}"
echo "RP_GRAPH_ALLOWED_ROOT=${RP_GRAPH_ALLOWED_ROOT}"
echo "PYTHONPATH=${PYTHONPATH}"

cd "$ROOT"
exec python -m rp_graph.server
