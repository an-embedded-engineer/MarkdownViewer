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
| WP-005 | TODO-2026-007 | documentation | WP-001, WP-002, WP-003, WP-004, TODO-2026-014, TODO-2026-017 | Tauri 先行実装の UX 評価を行い、Avalonia へ適用する確定仕様と work item 構成を文書化する | MenuBar / StatusBar、Recent Folders、TabStrip、split view、Settings、trusted HTMLをbaselineとして評価し、完了済みTODO-2026-019 / 021 / 022も追加資料としてExplorer、responsive preview、image viewerの採否を整理する。共通仕様、stack差分、根拠レベル、未解決事項が文書化される。 | `docs/design_analysis/documentation/`, `docs/components/avalonia_viewer/`, `docs/todo/` | `docs/components/tauri_viewer/*`, `docs/components/avalonia_viewer/*`, `docs/todo/*`, 必要に応じて`docs/architecture/*` | リンク、todo / archive、WBS、履歴、評価根拠の整合。ビルド不要。 | TODO-2026-019はExplorer統合のsource。TODO-2026-021 / 022はbaseline dependencyではなく追加評価資料とする。 |
| WP-006 | TODO-2026-008 | spec-change | WP-005 | Avalonia shell / Explorer UX foundationとしてMenuBar、StatusBar、Explorer resize / scroll / iconをまとめて導入する | `Open Folder` / `Reload` / theme操作、root / active file / loading / error表示、GridSplitter、必要時のExplorer横scroll、directory / Markdown / HTML / image iconが機能し、既存単一document表示が退行しない。 | `Views/MainWindow.axaml`, `MainWindow.axaml.cs`, `ViewModels/MainWindowViewModel.cs`, Explorer template周辺 | `docs/components/avalonia_viewer/*` | `dotnet build`; 手動確認: Menu / Status、幅境界、keyboard、scroll、icon、Light / Dark、既存preview | TODO-2026-020を統合。OS native menuではなくWindow内Menuを第一候補とする。 |
| WP-007 | TODO-2026-009 | new-feature | WP-006 | typed user config基盤へRecent Folders、Theme、logical window size、PlantUML jar pathとSettings UIをまとめて導入する | Recent Folders最大10件 / 重複昇格 / 削除 / 復元、Settingsでの現在値確認 / 保存、Theme同期、window size / jar path復元、field更新時の他設定保持が機能する。 | `ViewModels/`, `Models/`, `Services/`, `Views/MainWindow.axaml`, `MainWindow.axaml.cs` | `docs/components/avalonia_viewer/*` | `dotnet build`; 手動確認: Recent Folders、Settings、既定値、invalid path、保存失敗、再起動復元 | TODO-2026-015を統合。user config JSONとtyped settings serviceを使用する。 |
| WP-008A | TODO-2026-018 | spec-change | WP-006 | trusted UTF-8 HTMLをAvaloniaのNativeWebViewとsecurity境界へ適応し、typed Markdown / HTML document modelを先に確立する | root内HTML / resource、外部http(s)委譲、root外 / unsafe scheme拒否、host bridge制限を実装し、Markdown経路を維持する。 | `Models/`, `Services/`, `ViewModels/MainWindowViewModel.cs`, `Views/MainWindow.axaml.cs`, NativeWebView adapter周辺 | `docs/components/avalonia_viewer/*` | `dotnet build`; macOS / Windows / Linuxでsecurity / resource matrixを確認 | WP-007と並行可能。Multi-tabより先に完了する。 |
| WP-008 | TODO-2026-010 | new-feature | WP-007, WP-008A | Avalonia版にtyped Markdown / HTML documentのMulti-tab core stateとTabControlを追加する | 同一pathのactivate、新規tab、switch / close / Reload / theme / link、root変更、async result guardが一貫して機能する。 | `ViewModels/MainWindowViewModel.cs`, `Models/`, `Views/MainWindow.axaml`, `MainWindow.axaml.cs`, preview host周辺 | `docs/components/avalonia_viewer/*` | `dotnet build`; 手動確認: Markdown / HTML tab、close、Reload、theme、Mermaid / PlantUML、root変更 | single paneとNativeWebView 1 hostでtab stateを安定させる。 |
| WP-009 | TODO-2026-011 | new-feature | WP-008 | Avalonia版へTauri評価済みのsingle / 左右2pane Split View baselineを反映する | global document collection、pane-local selection / runtime、active pane routing、separator、tab close / root fallbackが機能し、Markdown / HTML / Mermaid / PlantUMLの結果が混線しない。 | `Views/MainWindow.axaml`, `MainWindow.axaml.cs`, `ViewModels/MainWindowViewModel.cs`, preview host周辺 | `docs/components/avalonia_viewer/*` | `dotnet build`; 手動確認: split on/off、左右別document、active pane、separator、close / root復旧、security | Tauri TODO-2026-023 / 025はbaselineをブロックしない。複数NativeWebViewのresource / lifecycleは設計Phaseで検証する。 |
| WP-010 | TODO-2026-012 | documentation | WP-009 | 両実装のUI/UX仕様・比較観点・残課題を最終同期する | Tauri / Avalonia docsが実装と一致し、共通仕様、差分理由、Tauri追加follow-upの採否、残課題、todo状態が整理される。 | `docs/components/*`, `docs/architecture/*`, `docs/todo/*`, 必要に応じて`docs/history/` | 同左 | リンク、索引、重複、ADR候補、todo / archive整合。ビルド不要。 | Tauri TODO-2026-023 / 025が完了済みならAvalonia採否、未完ならfollow-up状態を記録する。 |

### 追加案件統合

- TODO-2026-014（Tauri Viewer settings）は WP-003 / TODO-2026-005 完了後に着手でき、WP-004 / TODO-2026-006（Split view）とは独立に進める。
- WP-005 / TODO-2026-007 の Tauri 先行 UX 評価は、WP-004 と TODO-2026-014 の両方を完了条件とし、Settings modal、window size、Theme、PlantUML jar path と split pane の統合 UX を評価する。
- TODO-2026-020はWP-006 / TODO-2026-008へ統合し、shell layoutとExplorer UXを同時に固定する。
- TODO-2026-015はWP-007 / TODO-2026-009へ統合し、Recent FoldersとViewer settingsを1つのtyped user config基盤で扱う。
- TODO-2026-024はTODO-2026-023へ統合し、pane-local ownershipとpane間移動を同じtyped transitionで扱う。

## 推奨実行順序

1. `WP-001` Tauri MenuBar / StatusBar
2. `WP-002` Tauri Recent Folders
3. `WP-003` Tauri Multi-tab core
4. `WP-004` Tauri Split view と `TODO-2026-014` Tauri Viewer settings（独立に実施可能）
5. 両方の完了後に `WP-005` Tauri UX 評価と確定仕様化
6. `WP-006` Avalonia shell / Explorer UX foundation
7. `WP-007` Avalonia app settings / Recent Foldersと`WP-008A` Avalonia trusted HTML（並行可能）
8. 両方の完了後に`WP-008` Avalonia Multi-tab core
9. `WP-009` Avalonia Split View baseline
10. `WP-010` 両実装 docs / todo 最終同期

## 通常 workflow へ引き継ぐ追跡項目

`WP-001`から`WP-010`は`docs/todo/todo.md`の`TODO-2026-003`から`TODO-2026-012`に対応する。後から追加したtrusted HTMLの`WP-008A`は`TODO-2026-018`に対応し、`WP-007`と並行して`WP-008`の前提を構成する。
