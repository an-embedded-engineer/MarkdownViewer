あなたはレビュー担当 Agent です。

重要:
- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。
- レビュー文書以外の設計書・source・metaは変更しないでください。指摘への対応は実装担当 Agent が行います。

workflow: spec-change
review kind: Phase 2 design review
tracking file: docs/todo/todo.md
item: TODO-2026-017 Tauri HTML形式仕様書表示対応
issue dir: docs/design_analysis/spec_change/20260719_tauri_html_document_viewing
review target commit: 88aae68
design document: docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/design/tauri_html_document_viewing_design.md
source report: docs/design_analysis/research_analysis/20260719_html_document_viewing_support/report.md
review output: docs/design_analysis/spec_change/20260719_tauri_html_document_viewing/review/tauri_html_document_viewing_design_review.md

上記コミットから必要なファイルを取得し、Phase 2設計レビューを実施してください。

レビュー観点は `ai-review-response-workflow/references/procedure/review_checkpoints.md` 相当のcheckpointsと、spec-change Phase 2の観点に従ってください。特に次を確認してください。

- `docs/todo/todo.md`の要求・範囲・受け入れ条件が設計へ漏れなく追跡されているか。
- trusted active HTMLの前提と、root-scoped custom protocol、sandbox、shell / response CSP、CORS、Tauri IPC境界が過大評価なく定義されているか。
- macOS / Windows / Linuxのcustom protocol URL、opaque origin、JSON fetch、iframe request制約を実装・検証できるか。
- HTML link bridge、`event.isTrusted`、transient user activation、message validationで、user clickされた`http:` / `https:`だけを安全に外部openできるか。
- `DocumentStore`、root swap / lock、path decode / canonicalize / symlink、MIME allowlist、HTTP responseの責務とエラー契約が妥当か。
- TypeScript / Rustのtyped document modelが過剰なoptional fieldやfallbackを生まず、既存Markdown / Mermaid / PlantUML / Multi-tabを維持できるか。
- 類似logicの共通化、関数配置、テスト、恒久docs更新先が十分か。
- 仕様上の未解決事項や、Phase 3開始前に修正必須の矛盾がないか。

全指摘にseverity、工程、根拠、推奨対応、statusを付けてください。未解決指摘がある場合は明示し、指摘がない場合も承認可否を結論へ記載してください。

レビュー結果を指定のreview outputへ保存し、reviewer自身のコミットとして記録してください。
