# UI/UX改善 WBS

## Source References

- 調査レポート: `docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/report.md`
- 調査レビュー: `docs/design_analysis/research_analysis/20260705_ui_ux_multi_tab_menu_status_recent_dirs/ui_ux_multi_tab_menu_status_recent_dirs_report_review.md`
- WBS レビュー: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/ui_ux_multi_tab_menu_status_recent_dirs_wbs_review.md`

## 前提判断

Avalonia 版と Tauri 版を同時に仕様変更しない。先に Tauri 版でメニュー / ステータス / 最近開いたディレクトリ / タブ / split view / Viewer settings の一連の UX を実装し、手動評価で見た目と使い勝手を固める。その後、確定した UX 仕様を Avalonia 版へ反映する。

理由:

- Tauri / React / CSS の方が UI レイアウト、タブ overflow、split view、メニュー表示の見た目を短いサイクルで調整しやすい。
- Avalonia 版は `NativeWebView` や XAML レイアウト、ViewModel 状態管理の変更が大きく、UX 方針が揺れると手戻りが大きい。
- 片方で UX を確定してからもう一方へ適用する方が、比較実装としての差分理由を記録しやすい。

## Work Package 一覧

| work_package_id | source_id | recommended_workflow | depends_on | purpose | completion_criteria | main_targets | docs_targets | verification_points | deferred_or_follow_up |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WP-001 | TODO-2026-003 | spec-change | なし | Tauri 版で Toolbar をアプリ内 MenuBar と StatusBar へ分離し、後続タブ UI の土台を作る | `Open Folder` / `Reload` / theme 操作が MenuBar から実行できる。root path、active file、loading、error が StatusBar に表示される。既存単一ファイル表示、Mermaid、PlantUML、相対画像、リンク遷移が退行しない。 | `markdown-viewer-tauri/src/App.tsx`, `markdown-viewer-tauri/src/App.css` | `docs/components/tauri_viewer/README.md`, `basic_design.md`, `detail_design.md`, `interface_spec.md` | `npm run build`; `cargo check`; 手動確認: Open Folder, Reload, Theme, Markdown preview, Mermaid, PlantUML loading/error, StatusBar 表示 | OS native menu は扱わず、React 内 MenuBar に限定する。 |
| WP-002 | TODO-2026-004 | new-feature | WP-001 | Tauri 版に最近開いたディレクトリを追加し、MenuBar の `Recent Folders` から再オープンできるようにする | root open 成功時に最近開いたディレクトリが保存される。最大件数、重複更新、存在しない path のエラー、削除 UI が機能する。再起動後も一覧が復元される。 | `markdown-viewer-tauri/src/App.tsx`, `markdown-viewer-tauri/src/App.css`, `markdown-viewer-tauri/src-tauri/src/lib.rs`, Tauri capability / config 必要箇所 | `docs/components/tauri_viewer/README.md`, `basic_design.md`, `detail_design.md`, `interface_spec.md` | `npm run build`; `cargo check`; 手動確認: Recent Folders 追加、再起動後復元、存在しない path、削除、StatusBar 表示 | 保存先は app config JSON を第一候補にする。localStorage は採用しない。 |
| WP-003 | TODO-2026-005 | new-feature | WP-001, WP-002 | Tauri 版に複数タブの core state と TabStrip を追加する | Explorer クリックで同一 path のタブがあれば activate、なければ新規タブを開く。タブ切替、タブ close、Reload、theme、Markdown 内リンクが仕様通り動く。タブは現在の `rootPath` 内に限定される。 | `markdown-viewer-tauri/src/App.tsx`, `markdown-viewer-tauri/src/App.css` | `docs/components/tauri_viewer/README.md`, `basic_design.md`, `detail_design.md`, `interface_spec.md` | `npm run build`; `cargo check`; 手動確認: 複数 Markdown open、同一 path activate、close active tab、Reload active tab、theme、Mermaid/PlantUML 再描画、root 変更時のタブ扱い | split view は含めない。設計 Phase で工数超過と判断した場合は、タブ切替 / close / Reload / theme までを完了条件に縮小し、Markdown 内リンクのタブ挙動や overflow 表示は follow-up todo へ分離する。 |
| WP-004 | TODO-2026-006 | new-feature | WP-003 | Tauri 版に 2 ペイン split view を追加する | single / split の切替ができ、primary / secondary に別タブを表示できる。各 pane で Markdown preview、Mermaid、PlantUML、scroll、loading/error 表示が破綻しない。 | `markdown-viewer-tauri/src/App.tsx`, `markdown-viewer-tauri/src/App.css` | `docs/components/tauri_viewer/README.md`, `basic_design.md`, `detail_design.md`, `interface_spec.md` | `npm run build`; `cargo check`; 手動確認: split on/off、左右別ファイル、Mermaid/PlantUML 同時表示、pane resize 相当の responsive 表示、タブ close 時の pane 復旧 | 3 ペイン以上、ドラッグ＆ドロップによる pane 移動は後続へ送る。 |
| WP-005 | TODO-2026-007 | documentation | WP-001, WP-002, WP-003, WP-004, TODO-2026-014 | Tauri 先行実装の UX 評価を行い、Avalonia へ適用する確定仕様を文書化する | MenuBar、StatusBar、Recent Folders、TabStrip、split view、Settings modal、window size、Theme、PlantUML jar path の評価結果、採用仕様、Avalonia 反映時の差分方針が文書化される。未解決 UI 調整が todo 化される。 | `docs/design_analysis/documentation/` または `docs/components/tauri_viewer/` | `docs/components/tauri_viewer/*`, `docs/components/avalonia_viewer/*`, 必要に応じて `docs/architecture/*` | リンク整合、todo 参照整合、調査レポートとの矛盾確認、ADR 候補の起票要否確認。ビルドは不要。 | UX 評価で大きな変更が出た場合は Avalonia 着手前に WBS を更新する。 |
| WP-006 | TODO-2026-008 | spec-change | WP-005 | Avalonia 版で MenuBar / StatusBar を導入し、Tauri 先行仕様に合わせて UI 領域を分離する | `Open Folder` / `Reload` / theme 操作が MenuBar から実行できる。root path、active file、loading、error が StatusBar に表示される。既存単一ファイル表示、Mermaid、PlantUML、相対画像、リンク遷移が退行しない。 | `Avalonia/MarkdownViewer.Avalonia/Views/MainWindow.axaml`, `MainWindow.axaml.cs`, `ViewModels/MainWindowViewModel.cs` | `docs/components/avalonia_viewer/README.md`, `basic_design.md`, `detail_design.md`, `interface_spec.md` | `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj`; 手動確認: Open Folder, Reload, Theme, Markdown preview, Mermaid, PlantUML loading/error, StatusBar 表示 | OS native menu は扱わず、Window 内 menu を第一候補にする。 |
| WP-007 | TODO-2026-009 | new-feature | WP-006 | Avalonia 版に最近開いたディレクトリを追加し、MenuBar から再オープンできるようにする | root open 成功時に最近開いたディレクトリが保存される。最大件数、重複更新、存在しない path のエラー、削除 UI が機能する。再起動後も一覧が復元される。 | `ViewModels/MainWindowViewModel.cs`, `Models/`, `Services/`, `Views/MainWindow.axaml`, `MainWindow.axaml.cs` | `docs/components/avalonia_viewer/README.md`, `basic_design.md`, `detail_design.md`, `interface_spec.md` | `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj`; 手動確認: Recent Folders 追加、再起動後復元、存在しない path、削除、StatusBar 表示 | 保存先は user config JSON を第一候補にする。 |
| WP-008 | TODO-2026-010 | new-feature | WP-006, WP-007 | Avalonia 版に複数タブの core state と TabControl を追加する | Explorer 選択で同一 path のタブがあれば activate、なければ新規タブを開く。タブ切替、close、Reload、theme、Markdown 内リンクが仕様通り動く。タブは現在の `RootPath` 内に限定される。 | `ViewModels/MainWindowViewModel.cs`, `Models/`, `Views/MainWindow.axaml`, `MainWindow.axaml.cs`, 必要に応じて `Services/HtmlTemplateService.cs` | `docs/components/avalonia_viewer/README.md`, `basic_design.md`, `detail_design.md`, `interface_spec.md` | `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj`; 手動確認: 複数 Markdown open、同一 path activate、close active tab、Reload active tab、theme、Mermaid/PlantUML 再描画、root 変更時のタブ扱い | 初期実装は `NativeWebView` 1 つを active tab に再利用する。 |
| WP-009 | TODO-2026-011 | new-feature | WP-008 | Avalonia 版に 2 ペイン split view を追加する | single / split の切替ができ、primary / secondary に別タブを表示できる。各 pane で Markdown preview、Mermaid、PlantUML、loading/error 表示が破綻しない。 | `Views/MainWindow.axaml`, `MainWindow.axaml.cs`, `ViewModels/MainWindowViewModel.cs`, 必要に応じて preview host 周辺 | `docs/components/avalonia_viewer/README.md`, `basic_design.md`, `detail_design.md`, `interface_spec.md` | `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj`; 手動確認: split on/off、左右別ファイル、Mermaid/PlantUML 同時表示、tab close 時の pane 復旧 | 複数 `NativeWebView` のメモリ負荷が大きい場合は active pane のみ描画などに縮小する。 |
| WP-010 | TODO-2026-012 | documentation | WP-005, WP-009 | 両実装の UI/UX 仕様・比較観点・残課題を最終同期する | Tauri / Avalonia の docs が実装と一致する。共通仕様、差分理由、残課題、今後の follow-up が整理される。todo の完了 / 残項目が整合する。 | `docs/components/*`, `docs/architecture/*`, `docs/todo/todo.md`, 必要に応じて `docs/history/` | `docs/components/tauri_viewer/*`, `docs/components/avalonia_viewer/*`, `docs/architecture/*`, `docs/todo/*`, 必要に応じて `docs/adr/*` | リンク整合、索引整合、重複記述の矛盾確認、ADR 候補の起票要否確認。ビルドは不要。 | OS native menu、3 ペイン以上、編集機能を将来課題として残す。 |

### 追加案件統合（Viewer settings）

- TODO-2026-014（Tauri Viewer settings）は WP-003 / TODO-2026-005 完了後に着手でき、WP-004 / TODO-2026-006（Split view）とは独立に進める。
- WP-005 / TODO-2026-007 の Tauri 先行 UX 評価は、WP-004 と TODO-2026-014 の両方を完了条件とし、Settings modal、window size、Theme、PlantUML jar path と split pane の統合 UX を評価する。
- TODO-2026-015（Avalonia Viewer settings）は WP-005 / TODO-2026-007 の評価結果と Avalonia Recent Folders（TODO-2026-009）に依存し、既存 Avalonia work package の流れへ水平展開する。

## 推奨実行順序

1. `WP-001` Tauri MenuBar / StatusBar
2. `WP-002` Tauri Recent Folders
3. `WP-003` Tauri Multi-tab core
4. `WP-004` Tauri Split view と `TODO-2026-014` Tauri Viewer settings（独立に実施可能）
5. 両方の完了後に `WP-005` Tauri UX 評価と確定仕様化
6. `WP-006` Avalonia MenuBar / StatusBar
7. `WP-007` Avalonia Recent Folders
8. `WP-008` Avalonia Multi-tab core
9. `WP-009` Avalonia Split view
10. `WP-010` 両実装 docs / todo 最終同期

## 通常 workflow へ引き継ぐ追跡項目

各 work package は `docs/todo/todo.md` の `TODO-2026-003` から `TODO-2026-012` に対応する。
