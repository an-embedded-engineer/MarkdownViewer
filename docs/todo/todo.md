# TODO

## TODO-2026-004 Tauri Recent Folders 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- source_report: `docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/report.md`
- work_package_id: WP-002
- depends_on: TODO-2026-003
- summary: Tauri 版に最近開いたディレクトリを追加し、MenuBar の `Recent Folders` から再オープンできるようにする。
- target_users:
  - Tauri 版 Markdown Viewer で複数のドキュメントフォルダを切り替えながら確認する利用者。
  - アプリ再起動後も直近の作業フォルダへ短い操作で戻りたい利用者。
- use_cases:
  - `Open Folder` で root open に成功したディレクトリを最近開いたディレクトリとして保存する。
  - ウィンドウ上部の MenuBar にある `File` / `Recent Folders` から保存済みディレクトリを選択し、root と Explorer を再オープンする。
  - 不要になった recent entry を UI から削除する。
  - 保存済み path が存在しない場合は、アプリを壊さず代表 error と StatusBar で失敗状態を確認できる。
- scope:
  - Tauri v2 の native menu API (`@tauri-apps/api/menu`) で OS 標準の menu bar / app menu に `File` / `Recent Folders` を表示できるかを設計で確認する。
  - OS 標準 menu が制約・工数・状態同期リスクに対して過剰な場合は、ウィンドウ top にメニュー名を並べ、クリックで menu item を展開する React アプリ内 MenuBar を採用してよい。
  - macOS では app-wide menu、Windows / Linux では window menu として扱う platform 差分、または React アプリ内 MenuBar 採用時に platform 差分を持たない理由を整理する。
  - menu action から既存 React state / handler へ接続する event / command bridge と disabled 状態同期を設計する。
  - recent folders の保存先は app config JSON を第一候補とし、localStorage は採用しない。
  - 最大件数、重複更新、削除、存在しない path のエラー表示、再起動後の復元を実装対象に含める。
- non_scope:
  - Multi-tab、split view、Avalonia 版 Recent Folders は後続 TODO で扱う。
  - 最近開いた Markdown ファイル、pin / favorite、drag reorder、履歴検索は含めない。
  - OS ごとの完全な native menu 体験の再現は必須条件にしない。
- integration_points:
  - `markdown-viewer-tauri/src/App.tsx` の `MenuBar`、root open handler、busy / loading / error state、Explorer state。
  - `markdown-viewer-tauri/src/App.css` の MenuBar dropdown、recent folders menu、削除 UI、狭幅時表示。
  - `markdown-viewer-tauri/src-tauri/src/lib.rs` の app config JSON 読み書き command と path existence validation。
  - Tauri capability / config の command 権限定義。
  - `docs/components/tauri_viewer/README.md`、`basic_design.md`、`detail_design.md`、`interface_spec.md` の恒久仕様。
- completion:
  - `Recent Folders` は OS 標準 menu、またはウィンドウ top の MenuBar dropdown として `File` 配下に表示・実行できる。
  - `Open Folder` / `Reload` / `Recent Folders` が MenuBar から利用でき、busy 中は重複操作が抑止される。
  - root open 成功時に最近開いたディレクトリが保存される。
  - 最大件数、重複更新、存在しない path のエラー、削除 UI が機能する。
  - 再起動後も一覧が復元される。
  - 既存の root path strip、Explorer、Markdown preview、Mermaid、PlantUML、ErrorBanner、StatusBar の動作が退行しない。
- success_metrics:
  - `npm run build` in `markdown-viewer-tauri/` が成功する。
  - `cargo check` in `markdown-viewer-tauri/src-tauri/` が成功する。
  - 手動確認で recent entry 追加、重複更新、最大件数超過、削除、存在しない path、再起動後復元、StatusBar / ErrorBanner 表示を確認できる。

## TODO-2026-005 Tauri Multi-tab core 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-003
- depends_on: TODO-2026-003, TODO-2026-004
- summary: Tauri 版に複数タブの core state と TabStrip を追加する。
- completion:
  - Explorer クリックで同一 path のタブがあれば activate、なければ新規タブを開く。
  - タブ切替、タブ close、Reload、theme、Markdown 内リンクが仕様通り動く。
  - タブは現在の `rootPath` 内に限定される。

## TODO-2026-006 Tauri Split view 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-004
- depends_on: TODO-2026-005
- summary: Tauri 版に 2 ペイン split view を追加する。
- completion:
  - single / split の切替ができる。
  - primary / secondary に別タブを表示できる。
  - 各 pane で Markdown preview、Mermaid、PlantUML、scroll、loading/error 表示が破綻しない。

## TODO-2026-007 Tauri 先行 UX 評価と Avalonia 反映仕様化

- status: open
- workflow: documentation
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-005
- depends_on: TODO-2026-003, TODO-2026-004, TODO-2026-005, TODO-2026-006
- summary: Tauri 先行実装の UX 評価を行い、Avalonia へ適用する確定仕様を文書化する。
- completion:
  - MenuBar、StatusBar、Recent Folders、TabStrip、split view の評価結果が文書化される。
  - Avalonia 反映時の共通仕様と stack 差分方針が明確になる。
  - 未解決 UI 調整が必要な場合は todo 化される。

## TODO-2026-008 Avalonia MenuBar / StatusBar 導入

- status: open
- workflow: spec-change
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-006
- depends_on: TODO-2026-007
- summary: Avalonia 版で MenuBar / StatusBar を導入し、Tauri 先行仕様に合わせて UI 領域を分離する。
- completion:
  - `Open Folder` / `Reload` / theme 操作が MenuBar から実行できる。
  - root path、active file、loading、error が StatusBar に表示される。
  - 既存単一ファイル表示、Mermaid、PlantUML、相対画像、リンク遷移が退行しない。

## TODO-2026-009 Avalonia Recent Folders 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-007
- depends_on: TODO-2026-008
- summary: Avalonia 版に最近開いたディレクトリを追加し、MenuBar から再オープンできるようにする。
- completion:
  - root open 成功時に最近開いたディレクトリが保存される。
  - 最大件数、重複更新、存在しない path のエラー、削除 UI が機能する。
  - 再起動後も一覧が復元される。

## TODO-2026-010 Avalonia Multi-tab core 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-008
- depends_on: TODO-2026-008, TODO-2026-009
- summary: Avalonia 版に複数タブの core state と TabControl を追加する。
- completion:
  - Explorer 選択で同一 path のタブがあれば activate、なければ新規タブを開く。
  - タブ切替、close、Reload、theme、Markdown 内リンクが仕様通り動く。
  - タブは現在の `RootPath` 内に限定される。

## TODO-2026-011 Avalonia Split view 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-009
- depends_on: TODO-2026-010
- summary: Avalonia 版に 2 ペイン split view を追加する。
- completion:
  - single / split の切替ができる。
  - primary / secondary に別タブを表示できる。
  - 各 pane で Markdown preview、Mermaid、PlantUML、loading/error 表示が破綻しない。

## TODO-2026-012 両実装 UI/UX docs 最終同期

- status: open
- workflow: documentation
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-010
- depends_on: TODO-2026-007, TODO-2026-011
- summary: 両実装の UI/UX 仕様・比較観点・残課題を最終同期する。
- completion:
  - Tauri / Avalonia の docs が実装と一致する。
  - 共通仕様、差分理由、残課題、今後の follow-up が整理される。
  - todo の完了 / 残項目が整合する。
