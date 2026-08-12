# 启动自研图谱引擎 HTTP sidecar（默认 127.0.0.1:9750）
# API 默认可进程内使用 rp_graph；仅在需要 sidecar 时运行本脚本，并设置 RP_GRAPH_ENGINE_URL。
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

$dataRoot = Join-Path $Root "data"
if (-not (Test-Path $dataRoot)) {
    New-Item -ItemType Directory -Force -Path $dataRoot | Out-Null
}

$pyPath = Join-Path $Root "services\graph_engine\graph_engine_runtime"
if ($env:PYTHONPATH) {
    $env:PYTHONPATH = "$pyPath;$env:PYTHONPATH"
} else {
    $env:PYTHONPATH = $pyPath
}

$env:RP_GRAPH_ALLOWED_ROOT = if ($env:RP_GRAPH_ALLOWED_ROOT) { $env:RP_GRAPH_ALLOWED_ROOT } else { $dataRoot }
$env:RP_GRAPH_ENGINE_PORT = if ($env:RP_GRAPH_ENGINE_PORT) { $env:RP_GRAPH_ENGINE_PORT } else { "9750" }

Write-Host "rp-graph-engine sidecar → 127.0.0.1:$($env:RP_GRAPH_ENGINE_PORT)" -ForegroundColor Cyan
Write-Host "RP_GRAPH_ALLOWED_ROOT=$($env:RP_GRAPH_ALLOWED_ROOT)"
Write-Host "PYTHONPATH=$($env:PYTHONPATH)"

Set-Location $Root
python -m rp_graph.server
