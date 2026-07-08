# Phase 2 design review request: Tauri Recent Folders

あなたはレビュー担当 Agent です。

重要:

- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。

workflow: new-feature
review kind: Phase design review
issue id/title: `TODO-2026-004 Tauri Recent Folders 導入`
issue dir: `docs/design_analysis/new_feature/20260708_tauri_recent_folders`
review document path: `docs/design_analysis/new_feature/20260708_tauri_recent_folders/review/tauri_recent_folders_design_review.md`
review target commit: `8b4ab06 Phase 2 draft Tauri recent folders design`

## レビュー対象

- `docs/design_analysis/new_feature/20260708_tauri_recent_folders/meta.md`
- `docs/design_analysis/new_feature/20260708_tauri_recent_folders/design/tauri_recent_folders_feature_design.md`
- `docs/todo/todo.md` の `TODO-2026-004`
- `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md` の `WP-002`
- `docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/report.md`
- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `markdown-viewer-tauri/src/App.tsx`
- `markdown-viewer-tauri/src/App.css`
- `markdown-viewer-tauri/src-tauri/src/lib.rs`
- `markdown-viewer-tauri/src-tauri/Cargo.toml`
- `markdown-viewer-tauri/src-tauri/capabilities/default.json`

## レビュー観点

- `new-feature-workflow` Phase 2 の必須観点を満たしているか。
- ユースケース、最小提供範囲、非対象、受け入れ条件、失敗時動作が矛盾なく設計されているか。
- MenuBar 方針がユーザ要件を満たしているか。特に、OS 標準 menu を必須にせず、ウィンドウ top の menu name クリックで item 展開する UI を許容する判断が妥当か。
- React state と Rust command の責務分離が既存 Tauri architecture と合っているか。
- Recent Folders 永続化を app config JSON に置く設計が、localStorage 不採用と WBS 方針に沿っているか。
- 最大件数、重複更新、削除、存在しない path、config 破損、再起動後復元の境界条件が十分か。
- `record_recent_folder` / `remove_recent_folder` へ list 更新を寄せる方針が、重複実装や不要な fallback を避けているか。
- Phase 3 で更新すべき恒久 docs と検証観点に漏れがないか。

## 成果物

レビュー結果は `docs/design_analysis/new_feature/20260708_tauri_recent_folders/review/tauri_recent_folders_design_review.md` に作成してください。

レビュー文書には次を含めてください。

- 判定: Approved / Conditionally Approved / Needs Changes のいずれか
- 指摘一覧: severity、対象ファイル / 範囲、理由、推奨対応
- 良い点は短く、主に未解決リスクと修正必要事項を優先
- 指摘がない場合も、確認した観点と残リスクを明記

レビュー文書作成後、必ず commit してください。
