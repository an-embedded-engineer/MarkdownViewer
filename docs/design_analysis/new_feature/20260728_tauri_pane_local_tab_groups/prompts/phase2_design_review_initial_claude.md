あなたはレビュー担当 Agent です。

重要:

- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。
- レビュー文書はあなたが作成してください。実装担当のCodexには作成させないでください。

workflow: new-feature
review kind: Phase 2 design review

`docs/todo/todo.md` の **TODO-2026-023 Tauri pane-local tab group / pane 間移動** の Phase 2 設計レビューをお願いします。

レビュー対象コミット:

- `996275a Phase 2 design Tauri pane-local tab groups`

主要対象:

- `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/design/tauri_pane_local_tab_groups_feature_design.md`
- `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/meta.md`
- `docs/todo/todo.md` の TODO-2026-023
- `markdown-viewer-tauri/src/App.tsx`
- `markdown-viewer-tauri/src/splitView.ts`
- `markdown-viewer-tauri/src/splitView.test.ts`
- `markdown-viewer-tauri/src/paneRuntime.ts`
- `markdown-viewer-tauri/src/paneRuntime.test.ts`
- `docs/design_analysis/new_feature/20260726_tauri_split_view/`
- `docs/components/tauri_viewer/`
- `docs/architecture/`

特に次を確認してください。

- global `OpenDocumentTab[]`とpane-local ordered ID collectionのinvariantが、open / activate / close / move / Reload / root / split toggleの全経路で閉じているか。
- local close後のunreferenced global cache evictionが、同じIDの両group参照、loading中close、最後のmembershipでraceや不可視cacheを残さないか。
- `move-tab`がsource fallback、destination dedupe / ordering / selection、active pane、pending navigation、runtime status、image viewer、focusを一貫して扱えるか。
- split off / onでsecondary groupを保持する契約と、hidden secondaryのasync result拒否・runtime cleanupが整合するか。
- reducer、App、DocumentPane、TabStrip、paneRuntimeの責務分離が既存project patternと整合し、重複state、不要なfallback、旧経路を残していないか。
- same Markdown / HTML documentを両paneで参照する時にMermaid、PlantUML、HTML handshake、loading / errorが混線しないか。
- inline move button、local close、roving tab操作、destination focus、ARIA name / IDREFがpointer / keyboard /支援技術で成立するか。
- 初回secondary empty、split off時にprimaryへ引き継がない互換性変更がTODOの要求と最小提供範囲に照らして妥当か。
- frontend unit test、build、Rust回帰、手動確認matrixが受け入れ条件と境界値を網羅するか。
- 恒久ドキュメント更新予定とADR不要判断が妥当か。

レビュー観点は `ai-review-response-workflow/references/procedure/review_checkpoints.md` 相当のreview checkpointsと、new-feature workflowのPhase 2設計観点に従ってください。指摘は重大度と対応優先度を付け、blocking / non-blockingを明示してください。

レビュー結果は次へ作成してください。

- `docs/design_analysis/new_feature/20260728_tauri_pane_local_tab_groups/review/tauri_pane_local_tab_groups_design_review.md`

レビュー文書を作成後、レビュー成果だけを1コミットでコミットしてください。未解決指摘がある場合は、実装担当が対応できる具体的な推奨修正を記載してください。
