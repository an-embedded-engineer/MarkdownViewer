あなたはレビュー担当 Agent です。

重要:
- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。
- レビュー文書以外の設計・実装ファイルは変更しないでください。

workflow: spec-change
review kind: Phase 2 design review
tracking file: `docs/todo/todo.md`
issue: `TODO-2026-022 Tauri Markdown画像オーバーレイ表示`
issue directory: `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay`
design document: `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/design/tauri_markdown_image_overlay_design.md`
review output: `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/review/tauri_markdown_image_overlay_design_review.md`
review target commit: `e0b7fe3`

上記コミットから必要なファイルを確認し、Phase 2設計レビューを実施してください。

レビュー観点:
- `ai-review-response-workflow/references/procedure/review_checkpoints.md`相当のcheckpoints。
- `spec-change-workflow` Phase 2の要求、範囲、採用案 / 不採用案、before / after、影響範囲、互換性、恒久docs、検証、リスクの完全性。
- `TODO-2026-022`の全受け入れ条件が設計へ追跡可能か。
- 現行`App.tsx`、`App.css`、Markdown-It image rule、MermaidのReact外DOM変換、PlantUML success HTML、link event delegationとの整合。
- 通常画像 / Mermaid SVG / PlantUML SVGのtrigger selector、intrinsic size、clone lifecycleとsecurity境界が実装可能か。
- fit / 100% / 800% clamp、pointer anchor zoom、pan bounds、window resize時のfit/custom state数式に矛盾や到達不能領域がないか。
- modalのinert、focus trap、focus復帰、linked image優先、pointer capture、wheel / keyboard accessibilityに見落としがないか。
- trusted HTML iframe / Rust backendを非対象にする判断が既存security contractと整合するか。
- `ImageViewerTransformPolicy` / `ImageViewerSourceResolver`の責務分離、Settings modalを共通化しない判断、外部libraryを追加しない判断が妥当か。
- Vitest pure policy、自動test対象外のDOM lifecycle、専用fixtureと手動scenarioの組み合わせが十分か。

指摘は重大度、対象工程、根拠、推奨対応、statusを明示してください。未解決指摘が0件なら承認を明記してください。
レビュー結果は指定したreview文書へ保存し、review文書だけをコミットしてください。
