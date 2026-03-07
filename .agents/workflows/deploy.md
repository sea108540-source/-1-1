---
description: ローカルで確認後、本番環境へデプロイしてGitHubに保存する
---

## デプロイフロー

### 1. ローカルでの最終ビルドチェック
// turbo
powershell -ExecutionPolicy Bypass -File deploy.ps1

### 2. 変更をGitにコミット
git add -A
git commit -m "feat: [変更内容の説明]"

### 3. GitHubにプッシュ（Vercelが自動でデプロイ）
git push origin main

---
## 注意：SQLの変更がある場合

deploy.ps1 の実行時に「SQLに変更あり」と表示された場合は、以下を先に実行してください：

1. Supabase ダッシュボード → SQL Editor を開く
2. supabase_setup.sql の内容を**すべてコピー**して貼り付ける
3. RUN を押して実行する（Success表示を確認）
4. アプリをリロードしてグループ・友達が正常か確認
5. 問題なければ上記の手順 2〜3 を実行
