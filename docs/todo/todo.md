# TODO

## TODO-2026-003 Tauri MenuBar / StatusBar 導入

- status: open
- workflow: spec-change
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-001
- depends_on: none
- summary: Tauri 版で Toolbar をアプリ内 MenuBar と StatusBar へ分離し、後続タブ UI の土台を作る。
- purpose: 既存 Toolbar に集約されている主要操作と状態表示を、React アプリ内の MenuBar / StatusBar へ分離し、後続の Recent Folders / multi-tab / split view 導入時に操作領域と状態表示領域が衝突しない UI 契約へ変更する。
- scope:
  - Tauri 版の既存 Toolbar 操作をアプリ内 MenuBar へ移す。
  - root path は MenuBar 直下の root path strip、active file と loading は StatusBar、代表 error はエラー発生時のみ StatusBar 直上の error strip に表示する。
  - 既存の単一 root / 単一 active Markdown 表示モデルは維持する。
- non_scope:
  - OS native menu は導入しない。
  - Recent Folders、multi-tab、split view は後続 TODO で扱う。
  - Avalonia 版の UI 変更は TODO-2026-008 以降で扱う。
- affected_components:
  - `markdown-viewer-tauri/src/App.tsx`
  - `markdown-viewer-tauri/src/App.css`
  - `docs/components/tauri_viewer/README.md`
  - `docs/components/tauri_viewer/basic_design.md`
  - `docs/components/tauri_viewer/detail_design.md`
  - `docs/components/tauri_viewer/interface_spec.md`
- completion:
  - `Open Folder` / `Reload` / theme 操作が MenuBar から実行できる。
  - root path、active file、loading、error がそれぞれ root path strip、StatusBar、error strip に表示される。
  - 既存単一ファイル表示、Mermaid、PlantUML、相対画像、リンク遷移が退行しない。

## TODO-2026-004 Tauri Recent Folders 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-002
- depends_on: TODO-2026-003
- summary: Tauri 版に最近開いたディレクトリを追加し、MenuBar の `Recent Folders` から再オープンできるようにする。
- scope:
  - Tauri v2 の native menu API (`@tauri-apps/api/menu`) を使い、OS 標準の menu bar / app menu に `File` / `Recent Folders` を表示できるか設計する。
  - macOS では app-wide menu、Windows / Linux では window menu として扱う platform 差分を整理する。
  - native menu の action から既存 React state / handler へ接続する event / command bridge と disabled 状態同期を設計する。
- completion:
  - Tauri の制約上可能な platform では OS 標準 menu として `Open Folder` / `Reload` / `Recent Folders` が表示・実行できる。
  - root open 成功時に最近開いたディレクトリが保存される。
  - 最大件数、重複更新、存在しない path のエラー、削除 UI が機能する。
  - 再起動後も一覧が復元される。

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
