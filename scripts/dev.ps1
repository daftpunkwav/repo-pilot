# 并行启动 API + Web 开发服务
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "RepoPilot dev — API :19876, Web :5173" -ForegroundColor Cyan

$api = Start-Process -PassThru -NoNewWindow -FilePath "python" -ArgumentList @(
    "-m", "uvicorn", "backend.main:app", "--reload", "--port", "19876"
) -WorkingDirectory "$Root\services\api"

$web = Start-Process -PassThru -NoNewWindow -FilePath "npm" -ArgumentList @(
    "run", "dev", "-w", "@repopilot/web"
) -WorkingDirectory $Root

Write-Host "API  PID $($api.Id)  |  Web PID $($web.Id)" -ForegroundColor Green
Write-Host "按 Ctrl+C 停止（需手动结束子进程）"

try {
    Wait-Process -Id $api.Id, $web.Id
} finally {
    Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $web.Id -Force -ErrorAction SilentlyContinue
}
