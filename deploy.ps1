# デプロイ前チェックスクリプト（PowerShell）
# 使い方: プロジェクトルートで `powershell -ExecutionPolicy Bypass -File deploy.ps1` を実行

Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
Write-Host "  Exo-Plasma デプロイ前チェック" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true

# =====================
# Step 1: ビルドチェック
# =====================
Write-Host "Step 1/3: TypeScriptビルドチェック..." -ForegroundColor Yellow

$buildResult = npm run build 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ ビルド成功" -ForegroundColor Green
} else {
    Write-Host "  ❌ ビルド失敗 - 以下のエラーを修正してください:" -ForegroundColor Red
    Write-Host $buildResult -ForegroundColor Red
    $allPassed = $false
}

# =====================
# Step 2: 未コミット変更チェック
# =====================
Write-Host ""
Write-Host "Step 2/3: Git コミット状態チェック..." -ForegroundColor Yellow

$gitStatus = git status --short
if ([string]::IsNullOrWhiteSpace($gitStatus)) {
    Write-Host "  ✅ すべての変更がコミット済み" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  未コミットの変更があります（以下のファイル）:" -ForegroundColor Yellow
    git status --short
    Write-Host "  → GitHub に保存するには git commit が必要です" -ForegroundColor Yellow
}

# =====================
# Step 3: SQLファイル確認
# =====================
Write-Host ""
Write-Host "Step 3/3: SQLマイグレーションファイルの確認..." -ForegroundColor Yellow

$sqlDiff = git diff HEAD supabase_setup.sql 2>&1
if ([string]::IsNullOrWhiteSpace($sqlDiff)) {
    Write-Host "  ✅ SQLに変更なし（本番DB適用不要）" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  supabase_setup.sql に変更があります！" -ForegroundColor Yellow
    Write-Host "  → 本番SupabaseのSQL Editorで supabase_setup.sql を実行してください" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  変更箇所:" -ForegroundColor Gray
    git diff HEAD supabase_setup.sql
}

# =====================
# 最終結果
# =====================
Write-Host ""
Write-Host "===================================" -ForegroundColor Cyan
if ($allPassed) {
    Write-Host "  ✅ チェック完了！デプロイ準備OK" -ForegroundColor Green
    Write-Host ""
    Write-Host "  次のステップ:" -ForegroundColor White
    Write-Host "  1. supabase_setup.sql に変更があれば本番DBに適用" -ForegroundColor White
    Write-Host "  2. git push origin main でGitHubに保存 → Vercelが自動デプロイ" -ForegroundColor White
} else {
    Write-Host "  ❌ デプロイ前にエラーを修正してください" -ForegroundColor Red
}
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""
