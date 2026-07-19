# TODO

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
- depends_on: TODO-2026-003, TODO-2026-004, TODO-2026-005, TODO-2026-006, TODO-2026-014
- summary: Tauri 先行実装の UX 評価を行い、Avalonia へ適用する確定仕様を文書化する。
- completion:
  - MenuBar、StatusBar、Recent Folders、TabStrip、split view、設定確認・変更 UI と設定永続化の評価結果が文書化される。
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
- depends_on: TODO-2026-008, TODO-2026-009, TODO-2026-015
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

## TODO-2026-014 Tauri Viewer 設定永続化と設定 UI 導入

- status: open
- workflow: new-feature
- depends_on: TODO-2026-005
- summary: Tauri 版で Viewer 設定を app config JSON に永続化し、MenuBar から確認・変更できるようにする。
- target_users:
  - Tauri 版を継続利用し、起動のたびに表示環境や PlantUML runtime を設定し直したくない利用者。
- user_value:
  - 前回終了時のウィンドウサイズと Theme が次回起動時に復元される。
  - `plantuml.jar` の場所をアプリ内で確認・変更でき、runtime directory の設定ファイルを手編集しなくても PlantUML を利用できる。
- use_cases:
  - ウィンドウを使いやすい大きさに変更して終了し、次回起動時も同じサイズで閲覧を再開する。
  - MenuBar から設定 UI を開き、現在の Theme と `plantuml.jar` path を確認・変更する。
  - 保存済み設定がない初回起動では既定値で起動し、既存 Recent Folders は維持する。
- minimum_scope:
  - 既存 Recent Folders と同じ app config JSON に window width / height、Theme、`plantuml.jar` path を保存する。
  - 起動時に保存済み設定を読み込み、ウィンドウサイズ、Theme、PlantUML runtime 解決へ反映する。
  - MenuBar から設定 UI を開き、Theme と `plantuml.jar` path を確認・変更・保存できるようにする。
  - ウィンドウサイズは resize 後に永続化し、設定 UI では現在値を確認できるようにする。
- out_of_scope:
  - Avalonia 版への実装（TODO-2026-015 で水平展開する）。
  - ウィンドウ位置、最大化 / 最小化状態、open folder、open tab、split pane 状態の永続化。
  - Java runtime 自体のインストールや `plantuml.jar` の自動ダウンロード。
- prerequisites:
  - Tauri 版の既存 app config JSON と Recent Folders を壊さず拡張する。
  - Multi-tab core（TODO-2026-005）完了後に実装する。Split view（TODO-2026-006）とは独立に進め、Tauri 先行 UX 評価（TODO-2026-007）で両機能を統合評価する。
  - Tauri 先行 UX 評価（TODO-2026-007）より前に完了する。
- affected_components:
  - `markdown-viewer-tauri/src/App.tsx`, `markdown-viewer-tauri/src/App.css`
  - `markdown-viewer-tauri/src-tauri/src/lib.rs`, Tauri window / dialog capability の必要箇所
  - `docs/components/tauri_viewer/*`, `docs/rules/development_workflow.md`
- integration_points:
  - MenuBar の設定導線、起動時設定ロード、Theme state、Tauri window resize event。
  - `AppConfig` / `AppConfigStore` と PlantUML runtime resolver。
- completion:
  - window width / height、Theme、`plantuml.jar` path が app config JSON に保存され、アプリ再起動後に復元される。
  - MenuBar から設定 UI を開き、現在値の確認と Theme / `plantuml.jar` path の変更・保存ができる。
  - 未設定または無効な `plantuml.jar` path は UI で識別可能なエラーとなり、Markdown / Mermaid 閲覧は継続できる。
  - 既存 `settings.json` の Recent Folders が保持され、追加設定がない既存 JSON も読み込める。
  - `npm run build` と `cargo check` が成功し、設定保存・再起動復元・既定値・無効 path の手動確認が完了する。
- success_metrics:
  - 通常終了・再起動を挟んだ手動確認で、対象 3 設定が失われない。
  - 設定変更のために `plantuml.config.json` を手編集する必要がない。

## TODO-2026-015 Avalonia Viewer 設定永続化と設定 UI 水平展開

- status: open
- workflow: new-feature
- depends_on: TODO-2026-007, TODO-2026-009
- summary: Tauri 先行 UX 評価で確定した設定仕様を、Avalonia の自然な責務境界に合わせて水平展開する。
- completion:
  - Tauri 先行 UX 評価で確定した window width / height、Theme、`plantuml.jar` path の永続化仕様が反映される。
  - MenuBar から設定 UI を開き、現在値の確認と変更・保存ができる。
  - Avalonia の user config JSON と既存 Recent Folders が共存し、再起動後に設定が復元される。
  - `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj` が成功し、設定保存・再起動復元・既定値・無効 path の手動確認が完了する。
