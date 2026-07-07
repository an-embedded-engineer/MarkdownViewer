あなたはレビュー担当 Agent です。

重要:

- このレビューを別の CLI Agent、review automation skill、orchestrator skill、tmux session へ再委譲してはいけません。
- あなた自身が必要なファイルを読み、レビュー文書を作成・更新し、コミットしてください。
- workflow skill は作業実行者向けの Phase 手順として起動しないでください。レビュー観点として必要な範囲だけ参照してください。

workflow: spec-change
review kind: Phase design review
issue directory: `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar`
issue id/title: `TODO-2026-003 Tauri MenuBar / StatusBar 導入`

Phase 2 設計レビューをお願いします。

レビュー対象コミット:

- `7979fce docs: draft Tauri menu status design`

主なレビュー対象:

- `docs/todo/todo.md`
- `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/meta.md`
- `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/design/tauri_menubar_statusbar_design.md`
- `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md`
- `docs/components/tauri_viewer/README.md`
- `docs/components/tauri_viewer/basic_design.md`
- `docs/components/tauri_viewer/detail_design.md`
- `docs/components/tauri_viewer/interface_spec.md`
- `markdown-viewer-tauri/src/App.tsx`
- `markdown-viewer-tauri/src/App.css`

レビュー観点:

- `TODO-2026-003` の受け入れ条件が設計へ漏れなく落ちているか。
- Toolbar から React アプリ内 MenuBar / StatusBar へ分離する仕様差分が明確か。
- root path、active file、loading、error の StatusBar 表示契約が実装可能な粒度か。
- 既存単一ファイル表示、Mermaid、PlantUML、相対画像、リンク遷移への副作用が設計で十分に抑制されているか。
- OS native menu、Recent Folders、multi-tab、split view、Avalonia 変更が非対象として十分に切られているか。
- 類似ロジックの重複追加や不要な互換レイヤー / fallback を前提にしていないか。
- Phase 3 で更新すべき恒久ドキュメントと検証観点が明確か。

レビュー結果は次の文書に反映してください。

- `docs/design_analysis/spec_change/20260706_tauri_menubar_statusbar/review/tauri_menubar_statusbar_design_review.md`

レビュー文書には、少なくとも以下を含めてください。

- 結論（承認 / 条件付き承認 / 要修正）
- 指摘一覧（重大度、対象ファイル、内容、推奨対応）
- 受け入れ条件トレース確認
- 残リスク / Phase 3 での注意点

レビュー文書の作成後、コミットまで実施してください。
