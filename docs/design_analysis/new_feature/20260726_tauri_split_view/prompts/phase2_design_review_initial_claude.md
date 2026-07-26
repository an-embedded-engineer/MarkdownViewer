あなたはレビュー担当 Agent です。

重要:
- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。
- レビュー文書以外の設計・実装ファイルは変更しないでください。

workflow: new-feature
review kind: Phase 2 design review
tracking file: `docs/todo/todo.md`
issue: `TODO-2026-006 Tauri Split view 導入`
issue directory: `docs/design_analysis/new_feature/20260726_tauri_split_view`
design document: `docs/design_analysis/new_feature/20260726_tauri_split_view/design/tauri_split_view_feature_design.md`
review output: `docs/design_analysis/new_feature/20260726_tauri_split_view/review/tauri_split_view_design_review.md`
review target commit: `10948dc`

上記コミットから必要なファイルを確認し、Phase 2設計レビューを実施してください。

レビュー観点:
- `ai-review-response-workflow/references/procedure/review_checkpoints.md`相当のcheckpoints。
- `new-feature-workflow` Phase 2のユーザ価値、操作導線、最小提供範囲、非対象、統合点、責務分割、拡張性、失敗時動作、恒久docs、検証、リスクの完全性。
- `TODO-2026-006`の全受け入れ条件が設計へ追跡可能か。
- 現行`OpenDocumentTab[]`、`activeTabId`、`pendingNavigation`、TabStrip、Reload、root変更、relative Markdown linkとの状態遷移整合。
- global tab dataとpane-local selection / runtimeの分離が、同一tabを両paneへ表示する場合を含めて一貫するか。
- MermaidのApp-owned直列queue、pane / tab / revision guard、DOM cleanupがReact effect lifecycle上実装可能で、不要な再描画やsource復元を起こさないか。
- trusted HTML iframeを2つ表示した時、source / opaque origin / tab / revision / ready / activation / duplicate policyが混線せず、既存sandbox / CSP / root boundaryを弱めないか。
- `DocumentPane`、`splitView.ts`、App、TabStrip、documentPolicy、imageViewerの責務配置と共通化 / 非共通化判断が妥当か。
- split on/off、tab close、最後のtab、Reload、root成功 / 失敗、pending anchor、image viewer focus returnの境界条件に矛盾がないか。
- split widthのdynamic bounds、requested ratio保持、pointer capture、keyboard Home / End、狭幅時動作が数式上成立するか。
- paneごとのDOM ID、ARIA relation、roving focus、iframe focus、active pane、separator、modal inertのaccessibility契約に欠落がないか。
- `splitView.test.ts`のpure policy testと手動matrixが、React DOM lifecycle、Mermaid、HTML security、single view回帰を十分に補完するか。

指摘は重大度、対象工程、根拠、推奨対応、statusを明示してください。未解決指摘が0件なら承認を明記してください。
レビュー結果は指定したreview文書へ保存し、review文書だけをコミットしてください。
