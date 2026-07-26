あなたはレビュー担当 Agent です。

重要:

- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けのPhase手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。

workflow: spec-change
review kind: Phase 3 implementation and permanent docs review
issue: `docs/todo/todo.md` TODO-2026-022 Tauri Markdown画像オーバーレイ表示
issue dir: `docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/`

下記レビュー前コミットから必要な差分とファイルを取得し、設計・実装・テスト・fixture・恒久ドキュメントの整合をレビューしてください。

`ad68ae4`

特に次を確認してください。

- 通常画像、描画済みMermaid SVG、描画済みPlantUML SVGだけがdecorate / resolveされること
- linked imageとSVG anchorの優先順位、selection中open抑止、pending / invalid visualの非対象化
- DOM adapterのidempotency、load / focus / scroll / resize listener cleanup、async Mermaid / PlantUML DOM差替えとの整合
- modalのclone正規化、`inert`、focus trap / deferred focus復帰、Escape / backdrop、tab / revision lifecycle
- fit / zoom anchor / wheel deltaMode / 800% clamp / pan bounds / resize policyの数式とテスト網羅性
- Phase 2 review §9.2の実装条件（triggerの`:focus`可視化、`user-select: none`）
- 通常時layout、著者指定title、link、trusted HTML / Rust境界の非退行
- `impl/`記録、Tauri Viewer恒久docs、development workflow、manual fixtureの一致
- `npm test -- --run`、`npm run build`、`cargo check`の結果と追加検証要否

レビュー結果は次の新規文書へ反映し、コミットまで実施してください。

`docs/design_analysis/spec_change/20260726_tauri_markdown_image_overlay/review/tauri_markdown_image_overlay_impl_review.md`

レビュー観点は`ai-review-response-workflow/references/procedure/review_checkpoints.md`相当のreview checkpointsとspec-change Phase 3の完了条件に従ってください。各指摘へseverity、対象工程、status、根拠、推奨対応を付け、未解決件数とPhase 3承認可否を明記してください。
