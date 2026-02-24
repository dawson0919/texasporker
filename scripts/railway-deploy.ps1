# ============================================
# Railway 一鍵部署腳本 (Windows PowerShell)
# 使用方式: .\scripts\railway-deploy.ps1
# 前置需求: npm i -g @railway/cli ; railway login
# ============================================

$ErrorActionPreference = "Stop"

Write-Host "`n🚂 Texas Poker - Railway 自動部署" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check Railway CLI
if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未安裝 Railway CLI" -ForegroundColor Red
    Write-Host "   請先執行: npm i -g @railway/cli" -ForegroundColor Yellow
    Write-Host "   然後執行: railway login" -ForegroundColor Yellow
    exit 1
}

# Check if linked
$status = railway status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "📦 建立新的 Railway 專案..." -ForegroundColor Yellow
    railway init
    Write-Host ""
}

Write-Host "⚙️  設定環境變數..." -ForegroundColor Yellow

# Set all variables
$vars = @{
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"              = "pk_test_dXNlZnVsLWltcGFsYS02OC5jbGVyay5hY2NvdW50cy5kZXYk"
    "CLERK_SECRET_KEY"                               = "sk_test_C4wYUSpfzhXBooE2M9FIQZIs4XrAqdK0eyrfqYnKnq"
    "NEXT_PUBLIC_CLERK_SIGN_IN_URL"                  = "/sign-in"
    "NEXT_PUBLIC_CLERK_SIGN_UP_URL"                  = "/sign-up"
    "NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL"= "/lobby"
    "NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL"= "/lobby"
    "NEXT_PUBLIC_SUPABASE_URL"                       = "https://jxkapldqbbwexnmrgnus.supabase.co"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"                  = "sb_publishable_ZirOPdYPUvkddhSXfHzCzQ_x7i7F36y"
    "NODE_ENV"                                       = "production"
    "PORT"                                           = "3000"
}

$setArgs = @()
foreach ($kv in $vars.GetEnumerator()) {
    $setArgs += "$($kv.Key)=$($kv.Value)"
}

railway variables set @setArgs

Write-Host "✅ 環境變數設定完成 (10 個變數)" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 開始部署..." -ForegroundColor Cyan
railway up --detach

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "✅ 部署完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📋 後續步驟:" -ForegroundColor Yellow
Write-Host "   1. 執行 'railway open' 開啟 Railway Dashboard"
Write-Host "   2. 到 Settings → Networking → Generate Domain 產生公開網址"
Write-Host "   3. 將該網址加入 Clerk Dashboard → Allowed Origins"
Write-Host "   4. 更新 Supabase Webhook URL"
Write-Host ""
Write-Host "🔍 查看日誌: railway logs" -ForegroundColor DarkGray
Write-Host "🌐 開啟面板: railway open" -ForegroundColor DarkGray
Write-Host "==================================" -ForegroundColor Cyan
