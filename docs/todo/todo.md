# TODO

## TODO-2026-006 Tauri Split view 導入

- status: open
- workflow: new-feature
- wbs: `docs/design_analysis/wbs/20260705_ui_ux_multi_tab_menu_status_recent_dirs/wbs.md#work-package-一覧`
- work_package_id: WP-004
- depends_on: TODO-2026-005, TODO-2026-017
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
- depends_on: TODO-2026-003, TODO-2026-004, TODO-2026-005, TODO-2026-006, TODO-2026-014, TODO-2026-017
- summary: Tauri 先行実装の UX 評価を行い、Avalonia へ適用する確定仕様を文書化する。
- completion:
  - MenuBar、StatusBar、Recent Folders、TabStrip、split view、設定確認・変更 UI と設定永続化の評価結果が文書化される。
  - Tauri版HTML形式仕様書表示の操作性、resource表示、外部link、安全性を評価し、Avaloniaへ反映する共通仕様とstack差分を確定する。
  - Avalonia 反映時の共通仕様と stack 差分方針が明確になる。
  - 未解決 UI 調整が必要な場合は todo 化される。

## TODO-2026-018 Avalonia HTML形式仕様書表示対応

- status: open
- workflow: spec-change
- source_report: `docs/design_analysis/research_analysis/20260719_html_document_viewing_support/report.md`
- depends_on: TODO-2026-007
- execution_order: TODO-2026-007（Tauri 先行 UX 評価と Avalonia 反映仕様化）の完了後に実施する。
- summary: Tauri先行UX評価で確定したHTML形式仕様書表示を、AvaloniaのWebViewと責務境界に合わせて水平展開する。
- completion:
  - 選択root配下のUTF-8 HTMLがMarkdownと同じExplorerに表示され、選択して開ける。
  - self-contained HTMLと、root内の相対画像、SVG、CSS、JavaScript、JSON、fontを利用するHTMLを表示できる。
  - inline SVG、Canvas、描画済みUML、root内runtimeによるdiagramを表示できる。
  - HTML内の`http:` / `https:` linkをViewer内で遷移させず、scheme検証後にOS標準ブラウザで開く。
  - trusted root契約、top-level navigation制御、host bridge制限を主境界とし、利用可能なplatform adapterではsubresource監視を追加防御として適用する。
  - 既存Markdown経路を含む`openExternal`へscheme allowlistを共通適用し、raw HTMLを許可し続けるか`DisableHtml()`を採用するかを確定する。
  - macOS / Windows / Linuxでroot内resource、root外拒否、外部link、既存Markdown / Mermaid / PlantUMLの回帰を確認する。

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

## TODO-2026-016 Tauri Viewer 設定 Windows platform verification

- status: open
- workflow: issue-resolution
- depends_on: TODO-2026-014
- summary: Windows環境でTauri Viewer設定永続化のtarget固有atomic replaceとpath境界を検証する。
- completion:
  - Windows targetで`cargo check`または同等のTauri buildが成功する。
  - 既存`settings.json`を`MoveFileExW(REPLACE_EXISTING | WRITE_THROUGH)`で置換し、Recent FoldersとViewer settingsが保持される。
  - Unicode pathとWindows verbatim / drive / UNC path境界で設定保存・再起動復元を確認する。
  - 検証結果と、必要な修正があればsource / tests / Tauri component docsへ反映する。
