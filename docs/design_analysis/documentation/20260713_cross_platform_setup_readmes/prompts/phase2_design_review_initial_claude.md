あなたはレビュー担当 Agent です。

重要:
- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。

workflow: documentation
review kind: Phase design review
issue file: `docs/todo/todo.md`
issue: TODO-2026-013 クロスプラットフォーム環境構築・README 整備

Phase design レビューをお願いします。下記コミットから必要なファイルを取得して確認してください。

`7ff0ce2`

特に、Windows / macOS / Linux の clone 直後の環境構築、Avalonia NativeWebView の Linux 制約、OS 別 publish、README 間の責務分担が、既存 project/manifest/開発ルールと整合するか確認してください。

レビュー結果は `docs/design_analysis/documentation/20260713_cross_platform_setup_readmes/review/cross_platform_setup_readmes_design_review.md` に反映し、コミットまで実施してください。
レビュー観点は `ai-review-response-workflow/references/procedure/review_checkpoints.md` 相当の review checkpoints と、現在の workflow 文書に従ってください。
