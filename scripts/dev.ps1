# 并行启动 API + Web 开发服务
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "RepoPilot dev — API :19878, Web :5173" -ForegroundColor Cyan

# API 需要 SECRET_KEY（长度 >= 32 字节）；若未设置则自动生成一个开发用密钥
if (-not $env:SECRET_KEY) {
    $env:SECRET_KEY = (python -c "import secrets; print(secrets.token_urlsafe(32))")
    Write-Host "SECRET_KEY not set, generated a development key" -ForegroundColor Yellow
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

try {
    Wait-Process -Id $api.Id, $web.Id
} finally {
    Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $web.Id -Force -ErrorAction SilentlyContinue
}
