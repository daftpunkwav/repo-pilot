# 并行启动 API + Web 开发服务
# 图谱引擎默认走 API 进程内 rp_graph；sidecar 可选（-GraphEngine / RP_GRAPH_START_SIDECAR=1）
param(
    [switch]$GraphEngine
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "RepoPilot dev — API :19878, Web :5173" -ForegroundColor Cyan
Write-Host "图谱引擎：默认进程内；sidecar 可选（-GraphEngine 或 RP_GRAPH_START_SIDECAR=1）" -ForegroundColor DarkGray

# API 需要 SECRET_KEY（长度 >= 32 字节）；若未设置则自动生成一个开发用密钥
if (-not $env:SECRET_KEY) {
    $env:SECRET_KEY = (python -c "import secrets; print(secrets.token_urlsafe(32))")
    Write-Host "SECRET_KEY not set, generated a development key" -ForegroundColor Yellow
}

# 可选：启动 rp_graph HTTP sidecar（需另设 RP_GRAPH_ENGINE_URL=http://127.0.0.1:9750 才会走 sidecar）
$graph = $null
$startGraph = $GraphEngine -or ($env:RP_GRAPH_START_SIDECAR -eq "1")
if ($startGraph) {
    $startScript = Join-Path $Root "scripts\start-graph-engine.ps1"
    $graph = Start-Process -PassThru -NoNewWindow -FilePath "powershell.exe" -ArgumentList @(
        "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $startScript
    ) -WorkingDirectory $Root
    Write-Host "Graph sidecar PID $($graph.Id) → 127.0.0.1:9750（进程内仍可用，除非设置 RP_GRAPH_ENGINE_URL）" -ForegroundColor Cyan
}

# 端口与 vite.config.ts / npm run dev:api 对齐（19876 在部分 Windows 环境会幽灵占用）
$api = Start-Process -PassThru -NoNewWindow -FilePath "python" -ArgumentList @(
    "-m", "uvicorn", "backend.main:app", "--reload", "--host", "127.0.0.1", "--port", "19878"
) -WorkingDirectory "$Root\services\api"

$web = Start-Process -PassThru -NoNewWindow -FilePath "cmd.exe" -ArgumentList @(
    "/c", "npm", "run", "dev", "-w", "@repopilot/web"
) -WorkingDirectory $Root

Write-Host "API  PID $($api.Id)  |  Web PID $($web.Id)" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop (subprocesses need manual cleanup)" -ForegroundColor Green

$waitIds = @($api.Id, $web.Id)
if ($graph) { $waitIds += $graph.Id }

try {
    Wait-Process -Id $waitIds
} finally {
    Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $web.Id -Force -ErrorAction SilentlyContinue
    if ($graph) {
        Stop-Process -Id $graph.Id -Force -ErrorAction SilentlyContinue
    }
}
