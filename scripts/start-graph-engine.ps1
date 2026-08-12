# 启动图谱引擎 HTTP sidecar（默认 127.0.0.1:9750）
# 档位：C 引擎 rp-graph-engine.exe 优先（性能权威实现）；未构建时回退 Python rp_graph（装即用）。
# API 默认可进程内使用 rp_graph；仅在需要 sidecar 时运行本脚本，并设置 RP_GRAPH_ENGINE_URL。
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

$dataRoot = Join-Path $Root "data"
if (-not (Test-Path $dataRoot)) {
    New-Item -ItemType Directory -Force -Path $dataRoot | Out-Null
}

$env:RP_GRAPH_ALLOWED_ROOT = if ($env:RP_GRAPH_ALLOWED_ROOT) { $env:RP_GRAPH_ALLOWED_ROOT } else { $dataRoot }
$env:RP_GRAPH_ENGINE_PORT = if ($env:RP_GRAPH_ENGINE_PORT) { $env:RP_GRAPH_ENGINE_PORT } else { "9750" }

$cacheDir = if ($env:RP_GRAPH_CACHE_DIR) { $env:RP_GRAPH_CACHE_DIR } else { Join-Path $dataRoot "graph-engine-cache" }
if (-not (Test-Path $cacheDir)) { New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null }

# 档位一：C 引擎（Windows 原生二进制 rp-graph-engine.exe）
$cExe = Join-Path $Root "services\graph_engine\graph_engine_core\build\c\rp-graph-engine.exe"
if (Test-Path $cExe) {
    $env:CBM_CACHE_DIR = $cacheDir
    $env:CBM_ALLOWED_ROOT = $dataRoot
    Write-Host "rp-graph-engine (C) sidecar → 127.0.0.1:$($env:RP_GRAPH_ENGINE_PORT)" -ForegroundColor Cyan
    Write-Host "CBM_CACHE_DIR=$($env:CBM_CACHE_DIR)"
    Write-Host "CBM_ALLOWED_ROOT=$($env:CBM_ALLOWED_ROOT)"
    Set-Location $Root
    & $cExe "--port=$($env:RP_GRAPH_ENGINE_PORT)"
    exit $LASTEXITCODE
}

# 档位二：Python 回退 rp_graph（跨平台，装即用）
$pyPath = Join-Path $Root "services\graph_engine\graph_engine_fallback"
if ($env:PYTHONPATH) {
    $env:PYTHONPATH = "$pyPath;$env:PYTHONPATH"
} else {
    $env:PYTHONPATH = $pyPath
}

Write-Host "rp-graph-engine (Python) sidecar → 127.0.0.1:$($env:RP_GRAPH_ENGINE_PORT)" -ForegroundColor Cyan
Write-Host "RP_GRAPH_ALLOWED_ROOT=$($env:RP_GRAPH_ALLOWED_ROOT)"
Write-Host "PYTHONPATH=$($env:PYTHONPATH)"

Set-Location $Root
python -m rp_graph.server
