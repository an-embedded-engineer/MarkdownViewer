# TODO

## TODO-2026-022 Tauri Markdown画像オーバーレイ表示

- status: open
- workflow: spec-change
- summary: Tauri版のMarkdown previewで画像や描画済みUMLをオーバーレイ表示し、拡大縮小・パン操作で大きな図の細部を確認できるようにする。
- purpose:
  - preview pane幅へ縮小された巨大な画像、Mermaid、PlantUMLを、文書レイアウトを変えずに読みやすい倍率で閲覧できるようにする。
- existing_spec:
  - Markdown画像とPlantUML SVGは本文幅以下へ縮小され、Mermaid / PlantUML containerは必要時に横scrollする。
  - 画像または描画済みUMLをクリックして別表示する操作、拡大縮小、パン操作は提供しない。
- expected_spec:
  - Markdown内の通常画像、描画済みMermaid SVG、描画済みPlantUML SVGをclickまたは同等のkeyboard操作で選択すると、app shell上にmodalな画像viewerをオーバーレイ表示する。
  - viewerは初期fit表示、拡大、縮小、パン、fit/reset、closeを提供し、巨大な図の細部へ到達できる。
  - zoom / panはbutton、pointer、wheelまたはtrackpad、keyboardから利用でき、現在倍率と操作対象を支援技術へ伝える。
  - overlay表示中は背面のdocument操作を抑止し、Escape、close button、定義したbackdrop操作で安全に閉じ、close後は起点へfocusを戻す。
- scope:
  - `markdown-viewer-tauri/src/`のMarkdown preview、画像viewer state / interaction policy、modal UI、theme対応CSS、自動test。
  - `sample_docs/`の通常画像、巨大Mermaid、巨大PlantUMLを使う手動確認fixture。
  - Tauri Viewer component docs、開発・手動確認手順、必要なproject history。
- out_of_scope:
  - sandboxed iframe内のtrusted HTML画像。iframe DOMへ親Reactからアクセスしない既存security境界を維持する。
  - Avalonia版への同時実装。
  - 画像編集、download、別window表示、zoom / pan状態の永続化。
- affected_components:
  - Tauri React `App` / `MarkdownPreview`とMarkdown click・keyboard event delegation。
  - Markdown通常画像、Mermaid生成SVG、PlantUML生成SVGの表示契約。
  - Tauri CSS layout / dialog stacking / Light・Dark theme。
  - Tauri frontend interaction policy testsとMarkdown / UML手動fixture。
- compatibility:
  - 通常時のMarkdown本文幅、画像縮小、Mermaid / PlantUML描画、要素内scrollを維持する。
  - 既存のMarkdown link / anchor / tab / Explorer / Reload / Theme操作を退行させない。
  - Rust command、filesystem、asset protocol、trusted HTML iframe / bridge契約は変更しない。
- permanent_docs:
  - `docs/components/tauri_viewer/README.md`
  - `docs/components/tauri_viewer/basic_design.md`
  - `docs/components/tauri_viewer/detail_design.md`
  - `docs/components/tauri_viewer/interface_spec.md`
  - `docs/rules/development_workflow.md`
- completion:
  - 通常画像、描画済みMermaid、描画済みPlantUMLをpointer clickとkeyboard操作からoverlayで開ける。
  - 初期fit表示から拡大・縮小・パン・fit/resetができ、viewportより大きい図の四隅と中央の細部へ到達できる。
  - zoom倍率には安全な下限・上限があり、button、wheel / trackpad、keyboard操作が一貫し、現在倍率が表示される。
  - Escape、close button、backdropの定義済み操作で閉じ、背景scroll / 操作が抑止され、close後に起点へfocusが戻る。
  - Light / Dark、window resize、tab切替、Reloadの各境界でviewer stateが混線せず、通常時の画像・Mermaid・PlantUML表示とlink操作が退行しない。
  - trusted HTML iframeのsandbox / protocol / bridge境界とRust backendに変更がない。
  - `npm test -- --run`、`npm run build`、`cargo check`が成功し、通常画像・巨大Mermaid・巨大PlantUMLを使った手動確認結果が記録される。

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

## TODO-2026-020 Avalonia Explorer ツリーペイン UX 水平展開

- status: open
- workflow: spec-change
- depends_on: TODO-2026-019
- execution_order: TODO-2026-019のTauri先行実装とUX確認完了後に実施する。
- summary: Tauri版で確定したExplorer幅変更、横scroll、node iconのUXを、AvaloniaのGridSplitter / TreeViewの自然な責務境界に合わせて水平展開する。
- scope:
  - Avalonia版Explorer / Preview layout、TreeView表示、関連ViewModelまたはconverter、component docs。
- out_of_scope:
  - Tauri版と内部実装を共通化すること。
  - Explorer幅の再起動後永続化。Tauri評価で必要性が確認された場合は別途仕様化する。
- completion:
  - Tauri先行UXで確定した最小・最大幅と操作契約をAvalonia版へ反映し、stack差分を文書化する。
  - tree contentがExplorer幅を超えた場合だけExplorer内に水平scrollbarが表示され、長い表示名の末尾へ到達できる。
  - directory、Markdown、HTMLに識別可能なアイコンが表示され、既存のtree開閉・document選択が退行しない。
  - `dotnet build Avalonia/MarkdownViewer.Avalonia/MarkdownViewer.Avalonia.csproj`が成功し、幅変更、境界値、横scroll、Light / Darkを手動確認する。
