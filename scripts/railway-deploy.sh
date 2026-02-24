#!/bin/bash
# ============================================
# Railway 一鍵部署腳本
# 使用方式: bash scripts/railway-deploy.sh
# 前置需求: npm i -g @railway/cli && railway login
# ============================================

set -e

echo "🚂 Texas Poker - Railway 自動部署"
echo "=================================="
echo ""

# Check Railway CLI
if ! command -v railway &> /dev/null; then
    echo "❌ 未安裝 Railway CLI"
    echo "   請先執行: npm i -g @railway/cli"
    echo "   然後執行: railway login"
    exit 1
fi

# Check if linked to a project
if ! railway status &> /dev/null 2>&1; then
    echo "📦 建立新的 Railway 專案..."
    railway init
    echo ""
fi

echo "⚙️  設定環境變數..."

# ---- Clerk Auth ----
railway variables set \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_dXNlZnVsLWltcGFsYS02OC5jbGVyay5hY2NvdW50cy5kZXYk" \
    CLERK_SECRET_KEY="sk_test_C4wYUSpfzhXBooE2M9FIQZIs4XrAqdK0eyrfqYnKnq" \
    NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in" \
    NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up" \
    NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL="/lobby" \
    NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL="/lobby" \
    NEXT_PUBLIC_SUPABASE_URL="https://jxkapldqbbwexnmrgnus.supabase.co" \
    NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_ZirOPdYPUvkddhSXfHzCzQ_x7i7F36y" \
    NODE_ENV="production" \
    PORT="3000"

echo "✅ 環境變數設定完成 (10 個變數)"
echo ""

echo "🚀 開始部署..."
railway up --detach

echo ""
echo "=================================="
echo "✅ 部署完成！"
echo ""
echo "📋 後續步驟:"
echo "   1. 執行 'railway open' 開啟 Railway Dashboard"
echo "   2. 到 Settings → Networking → Generate Domain 產生公開網址"
echo "   3. 將該網址加入 Clerk Dashboard → Allowed Origins"
echo "   4. 更新 Supabase Webhook URL 為: https://你的網址/api/webhooks/clerk"
echo ""
echo "🔍 查看日誌: railway logs"
echo "🌐 開啟面板: railway open"
echo "=================================="
