あなたはレビュー担当 Agent です。

重要:
- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。

workflow: documentation
review kind: Phase impl review
issue file: `docs/todo/todo.md`
issue: TODO-2026-013 クロスプラットフォーム環境構築・README 整備

Phase impl レビューをお願いします。下記コミットから必要なファイルを取得し、設計、既存 project/manifest/スクリプト、公式前提条件と照合してください。

`f3b38a1`

特に、以下を確認してください。

- Windows / macOS / Linux で clone 直後から実行できる順序と shell 記法
- Avalonia `NativeWebView` の Linux 非対応説明
- `npm ci` / `npm install` の正本同期
- Windows/macOS/Linux の publish/bundle コマンドと出力先
- `scripts/publish_apps_with_plantuml.sh` が macOS 専用であることの扱い
- README と setup 文書の相対リンク、重複、責務分担
- 変更が docs-only であること

レビュー結果は `docs/design_analysis/documentation/20260713_cross_platform_setup_readmes/review/cross_platform_setup_readmes_impl_review.md` に反映し、コミットまで実施してください。
レビュー観点は `ai-review-response-workflow/references/procedure/review_checkpoints.md` 相当の review checkpoints と、現在の workflow 文書に従ってください。
