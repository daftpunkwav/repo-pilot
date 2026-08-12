# 启动图谱引擎 HTTP sidecar（默认 127.0.0.1:9750）
# 档位：C 引擎 graph-engine.exe 优先（性能权威实现）；未构建时回退 Python graph_fallback（装即用）。
# API 默认可进程内使用 graph_fallback；仅在需要 sidecar 时运行本脚本，并设置 GRAPH_ENGINE_URL。
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

$dataRoot = Join-Path $Root "data"
if (-not (Test-Path $dataRoot)) {
    New-Item -ItemType Directory -Force -Path $dataRoot | Out-Null
}

$env:GRAPH_ALLOWED_ROOT = if ($env:GRAPH_ALLOWED_ROOT) { $env:GRAPH_ALLOWED_ROOT } else { $dataRoot }
$env:GRAPH_ENGINE_PORT = if ($env:GRAPH_ENGINE_PORT) { $env:GRAPH_ENGINE_PORT } else { "9750" }

$cacheDir = if ($env:GRAPH_CACHE_DIR) { $env:GRAPH_CACHE_DIR } else { Join-Path $dataRoot "graph-engine-cache" }
if (-not (Test-Path $cacheDir)) { New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null }

# 档位一：C 引擎（Windows 原生二进制 graph-engine.exe）
# C 引擎内部读取 ENGINE_CACHE_DIR / ENGINE_ALLOWED_ROOT；GRAPH_* 为对外契约名，
# 启动前双写保证两端一致（与 graph_engine_runtime/sidecar.py 同策略）。
$cExe = Join-Path $Root "services\graph_engine\graph_engine_core\build\c\graph-engine.exe"
if (Test-Path $cExe) {
    $env:GRAPH_CACHE_DIR = $cacheDir
    $env:GRAPH_ALLOWED_ROOT = $dataRoot
    $env:ENGINE_CACHE_DIR = $cacheDir
    $env:ENGINE_ALLOWED_ROOT = $dataRoot
    Write-Host "graph-engine (C) sidecar → 127.0.0.1:$($env:GRAPH_ENGINE_PORT)" -ForegroundColor Cyan
    Write-Host "GRAPH_CACHE_DIR=$($env:GRAPH_CACHE_DIR)"
    Write-Host "GRAPH_ALLOWED_ROOT=$($env:GRAPH_ALLOWED_ROOT)"
    Set-Location $Root
    & $cExe "--port=$($env:GRAPH_ENGINE_PORT)"
    exit $LASTEXITCODE
}

# 档位二：Python 回退 graph_fallback（跨平台，装即用）
$pyPath = Join-Path $Root "services\graph_engine\graph_engine_fallback"
if ($env:PYTHONPATH) {
    $env:PYTHONPATH = "$pyPath;$env:PYTHONPATH"
} else {
    $env:PYTHONPATH = $pyPath
}

Write-Host "graph-engine (Python) sidecar → 127.0.0.1:$($env:GRAPH_ENGINE_PORT)" -ForegroundColor Cyan
Write-Host "GRAPH_ALLOWED_ROOT=$($env:GRAPH_ALLOWED_ROOT)"
Write-Host "PYTHONPATH=$($env:PYTHONPATH)"

Set-Location $Root
python -m graph_fallback.server
